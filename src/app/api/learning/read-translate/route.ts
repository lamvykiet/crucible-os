import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { FAST_MODEL, FAST_FALLBACKS } from "@/lib/fastModels";
import { generateWithRetry, aiErrorMessage, isTransientAiError } from "@/lib/aiRetry";
import { bandBrief, cefrOf } from "@/lib/bookBand";
import { fetchArticle, ArticleError } from "@/lib/articleText";
import { splitParagraphs } from "@/lib/readingSplit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Đọc & dịch song ngữ — học từ mục "Đọc & dịch" của aioenglish.com.
 *
 * Ba cách có bài: dán văn bản, dán link bài báo, AI soạn theo chủ đề. Văn bản
 * dán/link được CẮT ĐOẠN BẰNG CODE (giữ nguyên chữ gốc), AI chỉ dịch từng đoạn;
 * để AI tự cắt là nó tiện tay "sửa" câu của tác giả. Người học dịch từng đoạn
 * theo hai chiều, AI chấm và lưu vào `progress`.
 */

interface Para { en: string; vi: string }

const TRANSLATE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    titleVi: { type: SchemaType.STRING },
    translations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["titleVi", "translations"],
};

const WRITE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    paragraphs: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { en: { type: SchemaType.STRING }, vi: { type: SchemaType.STRING } },
        required: ["en", "vi"],
      },
    },
  },
  required: ["title", "paragraphs"],
};

const GRADE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER },
    verdict: { type: SchemaType.STRING, format: "enum", enum: ["correct", "close", "wrong"] },
    corrected: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    issues: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { wrong: { type: SchemaType.STRING }, right: { type: SchemaType.STRING }, why: { type: SchemaType.STRING } },
        required: ["wrong", "right", "why"],
      },
    },
  },
  required: ["score", "verdict", "corrected", "summary", "issues"],
};

async function langOf(userId: string, languageId: unknown) {
  if (typeof languageId !== "string") return null;
  return prisma.language.findFirst({ where: { id: languageId, userId }, select: { id: true, code: true } });
}

const parse = <T,>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

async function translateParagraphs(paragraphs: string[], title: string) {
  const model = modelsWithFallback({
    generationConfig: { responseMimeType: "application/json", responseSchema: TRANSLATE_SCHEMA, temperature: 0.3 },
    systemInstruction:
      "Bạn dịch bài tiếng Anh sang tiếng Việt cho người Việt học tiếng Anh. Dịch từng đoạn, tự nhiên nhưng sát nghĩa, giữ đúng số đoạn và thứ tự. Không gộp, không tách, không bỏ đoạn.",
  }, FAST_MODEL, FAST_FALLBACKS);
  const prompt = `Tiêu đề: ${title || "(không có)"}\nSố đoạn: ${paragraphs.length}\n\n${paragraphs.map((p, i) => `[${i + 1}] ${p}`).join("\n\n")}`;
  const r = await generateWithRetry(model, prompt, { timeoutMs: 50_000, totalBudgetMs: 55_000 });
  const out = JSON.parse(r.response.text()) as { titleVi?: string; translations?: string[] };
  const tr = out.translations ?? [];
  if (tr.length !== paragraphs.length) throw new Error("AI dịch thiếu đoạn. Thử lại.");
  return { titleVi: out.titleVi ?? "", paras: paragraphs.map((en, i) => ({ en, vi: String(tr[i] ?? "") })) };
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const params = new URL(req.url).searchParams;
    const id = params.get("id");
    if (id) {
      const text = await prisma.readingText.findFirst({ where: { id, userId: user.id } });
      if (!text) return NextResponse.json({ success: false, error: "Không có bài này" }, { status: 404 });
      return NextResponse.json({
        success: true,
        text: { ...text, paragraphs: parse<Para[]>(text.paragraphs, []), progress: parse<Record<string, unknown>>(text.progress, {}) },
      });
    }
    const lang = await langOf(user.id, params.get("languageId"));
    if (!lang) return NextResponse.json({ success: false, error: "Không tìm thấy thứ tiếng này" }, { status: 404 });
    const texts = await prisma.readingText.findMany({
      where: { userId: user.id, langCode: lang.code },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, source: true, url: true, level: true, topic: true, paragraphs: true, progress: true, updatedAt: true },
    });
    return NextResponse.json({
      success: true,
      texts: texts.map((t) => ({
        id: t.id, title: t.title, source: t.source, url: t.url, level: t.level, topic: t.topic, updatedAt: t.updatedAt,
        total: parse<Para[]>(t.paragraphs, []).length,
        done: Object.keys(parse<Record<string, unknown>>(t.progress, {})).length,
      })),
    });
  } catch (error) {
    console.error("Reading list error:", error);
    return NextResponse.json({ success: false, error: "Không đọc được danh sách bài" }, { status: 500 });
  }
}

/** Tạo bài: dán văn bản, dán link, hoặc AI soạn. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const lang = await langOf(user.id, body.languageId);
    if (!lang) return NextResponse.json({ success: false, error: "Không tìm thấy thứ tiếng này" }, { status: 404 });
    const kind = body.kind;

    let title = "";
    let paras: Para[] = [];
    let url: string | null = null;
    let level: string | null = null;
    let topic: string | null = null;

    if (kind === "paste" || kind === "link") {
      let raw = "";
      if (kind === "link") {
        const art = await fetchArticle(String(body.url ?? ""));
        raw = art.text;
        title = art.title;
        url = art.url;
      } else {
        raw = String(body.text ?? "");
        title = String(body.title ?? "").trim();
      }
      const pieces = splitParagraphs(raw);
      if (pieces.length === 0) return NextResponse.json({ success: false, error: "Văn bản quá ngắn" }, { status: 400 });
      const tr = await translateParagraphs(pieces, title);
      paras = tr.paras;
      if (!title) title = pieces[0].split(/\s+/).slice(0, 8).join(" ") + "…";
    } else if (kind === "ai") {
      topic = String(body.topic ?? "").trim().slice(0, 120);
      if (!topic) return NextResponse.json({ success: false, error: "Chưa nhập chủ đề" }, { status: 400 });
      level = cefrOf(String(body.level ?? "B1"));
      const model = modelsWithFallback({
        generationConfig: { responseMimeType: "application/json", responseSchema: WRITE_SCHEMA, temperature: 0.8 },
        systemInstruction: `Bạn viết bài đọc tiếng Anh cho người Việt luyện đọc và dịch.\n\n${bandBrief(level)}\n\nViết 4–5 đoạn, tổng 220–320 từ, giọng như bài báo hoặc blog thật, có thông tin cụ thể. Mỗi đoạn kèm bản dịch tiếng Việt tự nhiên. Tiêu đề tiếng Anh ngắn.`,
      }, FAST_MODEL, FAST_FALLBACKS);
      const r = await generateWithRetry(model, `Chủ đề: ${topic}`, { timeoutMs: 45_000, totalBudgetMs: 55_000 });
      const out = JSON.parse(r.response.text()) as { title?: string; paragraphs?: Para[] };
      paras = (out.paragraphs ?? []).filter((p) => p.en?.trim() && p.vi?.trim()).map((p) => ({ en: p.en.trim(), vi: p.vi.trim() }));
      title = out.title?.trim() || topic;
      if (paras.length < 2) return NextResponse.json({ success: false, error: "AI soạn bài chưa được. Thử lại." }, { status: 422 });
    } else {
      return NextResponse.json({ success: false, error: "Thiếu kiểu tạo bài" }, { status: 400 });
    }

    const text = await prisma.readingText.create({
      data: {
        userId: user.id, languageId: lang.id, langCode: lang.code, title: title.slice(0, 200), source: kind,
        url, level, topic, paragraphs: JSON.stringify(paras),
      },
    });
    return NextResponse.json({ success: true, id: text.id });
  } catch (error) {
    if (error instanceof ArticleError) return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    console.error("Reading create error:", error);
    const transient = isTransientAiError(error);
    return NextResponse.json({ success: false, error: aiErrorMessage(error), transient }, { status: transient ? 503 : 500 });
  }
}

/** Nộp bản dịch một đoạn: AI chấm, lưu vào progress. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const text = await prisma.readingText.findFirst({ where: { id: String(body.id ?? ""), userId: user.id } });
    if (!text) return NextResponse.json({ success: false, error: "Không có bài này" }, { status: 404 });
    const paras = parse<Para[]>(text.paragraphs, []);
    const index = Number(body.index);
    const para = paras[index];
    if (!para) return NextResponse.json({ success: false, error: "Không có đoạn này" }, { status: 400 });
    const direction = body.direction === "vi-en" ? "vi-en" : "en-vi";
    const answer = String(body.answer ?? "").trim().slice(0, 3000);
    if (!answer) return NextResponse.json({ success: false, error: "Chưa có bản dịch" }, { status: 400 });

    const [src, ref, from, to] = direction === "en-vi"
      ? [para.en, para.vi, "tiếng Anh", "tiếng Việt"]
      : [para.vi, para.en, "tiếng Việt", "tiếng Anh"];

    const model = modelsWithFallback(
      {
        generationConfig: { responseMimeType: "application/json", responseSchema: GRADE_SCHEMA, temperature: 0.2 },
        systemInstruction: `Bạn chấm bài dịch một đoạn văn từ ${from} sang ${to} của người Việt đang luyện tiếng Anh.
Chấm Ý NGHĨA, ĐỦ Ý và ĐỘ TỰ NHIÊN; bản tham khảo chỉ để đối chiếu, dịch khác mà đúng vẫn là đúng.
- correct (8–10): đủ ý, đúng nghĩa, tự nhiên.
- close (5–7): hiểu được nhưng sót ý nhỏ hoặc có lỗi diễn đạt/ngữ pháp.
- wrong (0–4): sai nghĩa, thiếu nhiều ý.
"corrected": bản của người học sửa ít nhất có thể. "issues": từng lỗi cụ thể, giải thích bằng tiếng Việt. "summary": một câu nhận xét tiếng Việt.`,
      },
      FAST_MODEL,
      FAST_FALLBACKS
    );
    const r = await generateWithRetry(model, `Đoạn gốc (${from}):\n${src}\n\nBản tham khảo (${to}):\n${ref}\n\nBản dịch của người học:\n${answer}`, { timeoutMs: 25_000, totalBudgetMs: 30_000 });
    const g = JSON.parse(r.response.text()) as { score?: number; verdict?: string; corrected?: string; summary?: string; issues?: { wrong: string; right: string; why: string }[] };
    const grade = {
      score: Math.max(0, Math.min(10, Math.round(Number(g.score) || 0))),
      verdict: g.verdict === "correct" || g.verdict === "close" ? g.verdict : "wrong",
      corrected: String(g.corrected ?? answer),
      summary: String(g.summary ?? ""),
      issues: Array.isArray(g.issues) ? g.issues.slice(0, 10) : [],
    };

    const progress = parse<Record<string, unknown>>(text.progress, {});
    progress[String(index)] = { direction, text: answer, score: grade.score, verdict: grade.verdict, at: new Date().toISOString() };
    await prisma.readingText.update({ where: { id: text.id }, data: { progress: JSON.stringify(progress) } });

    if (text.languageId) {
      await prisma.skillProgress.upsert({
        where: { userId_languageId_skill: { userId: user.id, languageId: text.languageId, skill: "translation" } },
        create: { userId: user.id, languageId: text.languageId, skill: "translation", xp: 2 + Math.round(grade.score / 3), lessonsDone: 1, lastPracticedAt: new Date() },
        update: { xp: { increment: 2 + Math.round(grade.score / 3) }, lastPracticedAt: new Date() },
      }).catch((e) => console.error("Skill progress write failed:", e));
    }

    return NextResponse.json({ success: true, grade });
  } catch (error) {
    console.error("Reading grade error:", error);
    const transient = isTransientAiError(error);
    return NextResponse.json({ success: false, error: aiErrorMessage(error), transient }, { status: transient ? 503 : 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const r = await prisma.readingText.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ success: r.count > 0 });
}
