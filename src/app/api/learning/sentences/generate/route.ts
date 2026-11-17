import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry, aiErrorMessage, isTransientAiError } from "@/lib/aiRetry";
import { bandBrief, cefrOf } from "@/lib/bookBand";
import { resolveLang, parseDeckSentences } from "@/lib/sentenceSources";

export const runtime = "nodejs";
export const maxDuration = 60;

const COUNT = 10;

/**
 * AI soạn một bộ câu theo chủ đề người dùng gõ vào, rồi LƯU lại.
 *
 * Lưu chứ không sinh mỗi lượt: một bộ được học nhiều lần qua nhiều ngày, tiến
 * độ ghi theo vị trí câu, và hạn mức Gemini gói miễn phí chỉ 20 lượt/ngày/model.
 *
 * Câu nào AI trả về mà cụm ghép không ra câu, hay từ khoá không nằm trong câu,
 * thì bị loại (`parseDeckSentences`) — màn Gõ câu dựa hẳn vào hai thứ đó.
 */

const PIECE: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    en: { type: SchemaType.STRING },
    vi: { type: SchemaType.STRING },
  },
  required: ["en", "vi"],
};

const DECK_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: "Tên bộ ngắn bằng tiếng Việt, dưới 60 ký tự" },
    sentences: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          en: { type: SchemaType.STRING, description: "Câu hoàn chỉnh bằng thứ tiếng đang học" },
          vi: { type: SchemaType.STRING, description: "Bản dịch tiếng Việt tự nhiên" },
          chunks: {
            type: SchemaType.ARRAY,
            items: PIECE,
            description: "2–4 cụm liên tiếp, nối lại bằng dấu cách phải ra ĐÚNG nguyên câu en, kể cả dấu câu",
          },
          keys: {
            type: SchemaType.ARRAY,
            items: PIECE,
            description: "1–2 từ hoặc cụm từ đáng học, chép NGUYÊN VĂN từ câu en",
          },
        },
        required: ["en", "vi", "chunks", "keys"],
      },
    },
  },
  required: ["title", "sentences"],
};

const LANG_NAMES: Record<string, string> = {
  en: "tiếng Anh", fr: "tiếng Pháp", de: "tiếng Đức", cmn: "tiếng Trung (Quan Thoại)",
  yue: "tiếng Quảng Đông", ko: "tiếng Hàn",
};

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const topic = String(body.topic ?? "").trim();
    const level = cefrOf(String(body.level ?? "B1"));
    if (!topic) return NextResponse.json({ success: false, error: "Chưa nhập chủ đề" }, { status: 400 });
    if (topic.length > 120) return NextResponse.json({ success: false, error: "Chủ đề quá dài" }, { status: 400 });

    const { code, id } = await resolveLang(user.id, body.languageId);
    const langName = LANG_NAMES[code] ?? code;

    const recent = await prisma.sentenceDeck.findMany({
      where: { userId: user.id, langCode: code },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { sentences: true },
    });
    const avoid = recent
      .flatMap((d) => parseDeckSentences(d.sentences).map((s) => s.en))
      .slice(0, 30);

    const model = modelsWithFallback({
      generationConfig: { responseMimeType: "application/json", responseSchema: DECK_SCHEMA, temperature: 0.8 },
      systemInstruction: `Bạn soạn câu luyện dịch Việt → ${langName} và luyện gõ câu cho người Việt.

${bandBrief(level)}

Yêu cầu cho từng câu:
- Câu tự nhiên, người bản xứ thật sự nói/viết như vậy trong bối cảnh chủ đề.
- "vi" là bản dịch tiếng Việt tự nhiên, không dịch word-by-word.
- "chunks": cắt câu thành 2–4 cụm theo nhịp ngữ nghĩa (chủ ngữ + động từ, tân ngữ, trạng ngữ…). Nối các cụm bằng một dấu cách phải ra ĐÚNG câu "en", giữ nguyên dấu câu. Mỗi cụm kèm nghĩa tiếng Việt.
- "keys": 1–2 từ hoặc cụm từ đáng học nhất trong câu, chép NGUYÊN VĂN (cùng dạng chia) từ câu "en", kèm nghĩa ngắn.
- Mười câu phải khác nhau về cấu trúc, không lặp một khuôn.`,
    });

    const prompt = `Chủ đề: ${topic}
Soạn đúng ${COUNT} câu.${avoid.length ? `\nĐừng lặp lại các câu đã có:\n${avoid.map((s) => `- ${s}`).join("\n")}` : ""}`;

    const result = await generateWithRetry(model, prompt, { timeoutMs: 45_000, totalBudgetMs: 55_000 });
    const parsed = JSON.parse(result.response.text()) as { title?: string; sentences?: unknown[] };
    const sentences = parseDeckSentences(JSON.stringify(parsed.sentences ?? []));

    if (sentences.length < 4) {
      return NextResponse.json(
        { success: false, error: "AI trả về quá ít câu dùng được. Thử lại hoặc đổi chủ đề." },
        { status: 422 }
      );
    }

    const deck = await prisma.sentenceDeck.create({
      data: {
        userId: user.id,
        languageId: id,
        langCode: code,
        title: (parsed.title?.trim() || topic).slice(0, 80),
        level,
        topic: topic.slice(0, 120),
        sentences: JSON.stringify(sentences),
      },
    });

    return NextResponse.json({ success: true, setId: `ai:${deck.id}`, count: sentences.length });
  } catch (error) {
    console.error("Sentence deck generate error:", error);
    const transient = isTransientAiError(error);
    return NextResponse.json(
      { success: false, error: aiErrorMessage(error), transient },
      { status: transient ? 503 : 500 }
    );
  }
}

/** Xoá một bộ AI. Tiến độ và lỗi sai của bộ đó xoá theo. */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const setId = new URL(req.url).searchParams.get("setId") ?? "";
    if (!setId.startsWith("ai:")) {
      return NextResponse.json({ success: false, error: "Chỉ xoá được bộ AI tạo" }, { status: 400 });
    }
    const deck = await prisma.sentenceDeck.findFirst({ where: { id: setId.slice(3), userId: user.id } });
    if (!deck) return NextResponse.json({ success: false, error: "Không có bộ này" }, { status: 404 });

    await prisma.$transaction([
      prisma.sentenceLog.deleteMany({ where: { userId: user.id, setId } }),
      prisma.mistakeItem.deleteMany({
        where: { userId: user.id, source: { in: ["typing", "translate"] }, refKey: { startsWith: `${setId}#` } },
      }),
      prisma.sentenceDeck.delete({ where: { id: deck.id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sentence deck delete error:", error);
    return NextResponse.json({ success: false, error: "Không xoá được bộ câu" }, { status: 500 });
  }
}
