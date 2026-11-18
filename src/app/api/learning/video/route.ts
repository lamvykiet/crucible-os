import { NextResponse } from "next/server";
import { SchemaType, type Schema, type Part } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";

/** Model chính cho video: đã đo 2 phút ≈ 18 giây. Dự phòng xếp theo tốc độ. */
const VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "gemini-2.5-flash";
const VIDEO_FALLBACKS = ["gemini-2.5-flash-lite", "gemini-3.6-flash"];
import { generateWithRetry, aiErrorMessage, isTransientAiError } from "@/lib/aiRetry";
import { parseYouTubeId, parseStore, mergeChunk, CHUNK_SECONDS, type Segment, type SegmentStore } from "@/lib/videoLesson";
import { recordMistake, recordRight } from "@/lib/mistakes";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Video học tiếng — học từ mục Video của aioenglish.com (xem song ngữ, chép
 * chính tả, nói nhại từng câu).
 *
 * Phụ đề: Gemini đọc thẳng link YouTube công khai — tính năng chính thức của
 * API, không cào trang, không giả trình duyệt. Mỗi lần xử lý một đoạn 2 phút
 * (đo 18/11: 2 phút mất ~18 giây, ~12 nghìn token ở độ phân giải thấp) để vừa
 * giới hạn 60 giây của hàm Vercel. Tiêu đề lấy qua oEmbed công khai của YouTube.
 */

const SEG_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    segments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          start: { type: SchemaType.NUMBER },
          end: { type: SchemaType.NUMBER },
          en: { type: SchemaType.STRING },
          vi: { type: SchemaType.STRING },
        },
        required: ["start", "end", "en", "vi"],
      },
    },
  },
  required: ["segments"],
};

async function oembed(youtubeId: string) {
  const res = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new VideoError("Không mở được video này — có thể video riêng tư, đã gỡ hoặc chặn nhúng.");
  const j = (await res.json()) as { title?: string; author_name?: string };
  return { title: j.title ?? "YouTube", author: j.author_name ?? "" };
}

class VideoError extends Error {}

/** Gemini chép phụ đề cho một đoạn [from, from + CHUNK_SECONDS). */
async function transcribe(youtubeId: string, prev: SegmentStore): Promise<SegmentStore> {
  const from = Math.floor(prev.until);
  const to = from + CHUNK_SECONDS;
  const model = modelsWithFallback({
    // `mediaResolution` chưa có trong kiểu của SDK 0.24 nhưng API nhận: thấp
    // hơn ~3 lần token, phụ đề vẫn đúng vì nội dung nằm ở tiếng.
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SEG_SCHEMA,
      temperature: 0.1,
      mediaResolution: "MEDIA_RESOLUTION_LOW",
    } as Record<string, unknown>,
  }, VIDEO_MODEL, VIDEO_FALLBACKS);
  const videoPart = {
    fileData: { mimeType: "video/mp4", fileUri: `https://www.youtube.com/watch?v=${youtubeId}` },
    videoMetadata: { startOffset: `${from}s`, endOffset: `${to}s` },
  } as unknown as Part;
  const r = await generateWithRetry(
    model,
    [
      videoPart,
      `Chép lại NGUYÊN VĂN lời nói tiếng Anh trong đoạn video này (từ giây ${from} tới giây ${to} của video gốc), mỗi câu một mục, kèm thời điểm bắt đầu và kết thúc tính bằng GIÂY TÍNH TỪ ĐẦU VIDEO GỐC, và bản dịch tiếng Việt tự nhiên của từng câu. Câu quá dài (trên ~25 từ) thì tách ở chỗ ngắt tự nhiên. Không thêm lời bình, không chép chữ trên màn hình.`,
    ],
    { timeoutMs: 50_000, totalBudgetMs: 55_000 }
  );
  const out = JSON.parse(r.response.text()) as { segments?: Partial<Segment>[] };
  let raw = out.segments ?? [];
  // Có model trả thời gian tính từ đầu ĐOẠN thay vì đầu video — dời lại.
  if (from > 0 && raw.length && raw.every((s) => Number(s.start) < CHUNK_SECONDS + 5) && raw.some((s) => Number(s.start) < from - 5)) {
    raw = raw.map((s) => ({ ...s, start: Number(s.start) + from, end: Number(s.end) + from }));
  }
  return mergeChunk(prev, raw, from, to);
}

async function langOf(userId: string, languageId: unknown) {
  if (typeof languageId !== "string") return null;
  return prisma.language.findFirst({ where: { id: languageId, userId }, select: { id: true, code: true } });
}

async function progressOf(userId: string, langCode: string, setId: string) {
  const logs = await prisma.sentenceLog.findMany({
    where: { userId, langCode, setId },
    select: { index: true, mode: true, cleared: true },
  });
  const out: Record<string, { dictation?: boolean; shadowing?: boolean }> = {};
  for (const l of logs) {
    out[l.index] = { ...(out[l.index] ?? {}), [l.mode]: l.cleared };
  }
  return out;
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const params = new URL(req.url).searchParams;
    const id = params.get("id");
    if (id) {
      const v = await prisma.videoLesson.findFirst({ where: { id, userId: user.id } });
      if (!v) return NextResponse.json({ success: false, error: "Không có video này" }, { status: 404 });
      const store = parseStore(v.segments);
      return NextResponse.json({
        success: true,
        video: { id: v.id, youtubeId: v.youtubeId, title: v.title, level: v.level, lastIndex: v.lastIndex, ...store, progress: await progressOf(user.id, v.langCode, `video:${v.id}`) },
      });
    }
    const lang = await langOf(user.id, params.get("languageId"));
    if (!lang) return NextResponse.json({ success: false, error: "Không tìm thấy thứ tiếng này" }, { status: 404 });
    const videos = await prisma.videoLesson.findMany({ where: { userId: user.id, langCode: lang.code }, orderBy: { updatedAt: "desc" } });
    const logs = await prisma.sentenceLog.groupBy({
      by: ["setId"],
      where: { userId: user.id, langCode: lang.code, setId: { in: videos.map((v) => `video:${v.id}`) }, cleared: true },
      _count: { _all: true },
    });
    const done = new Map(logs.map((l) => [l.setId, l._count._all]));
    return NextResponse.json({
      success: true,
      videos: videos.map((v) => {
        const s = parseStore(v.segments);
        return { id: v.id, youtubeId: v.youtubeId, title: v.title, total: s.items.length, complete: s.complete, done: done.get(`video:${v.id}`) ?? 0 };
      }),
    });
  } catch (error) {
    console.error("Video list error:", error);
    return NextResponse.json({ success: false, error: "Không đọc được danh sách video" }, { status: 500 });
  }
}

/** Thêm video theo link: lấy tiêu đề, rồi chép đoạn đầu. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const lang = await langOf(user.id, body.languageId);
    if (!lang) return NextResponse.json({ success: false, error: "Không tìm thấy thứ tiếng này" }, { status: 404 });
    const youtubeId = parseYouTubeId(String(body.url ?? ""));
    if (!youtubeId) return NextResponse.json({ success: false, error: "Chưa nhận ra link YouTube" }, { status: 400 });

    const existing = await prisma.videoLesson.findUnique({ where: { userId_youtubeId: { userId: user.id, youtubeId } } });
    if (existing) return NextResponse.json({ success: true, id: existing.id });

    const meta = await oembed(youtubeId);
    const store = await transcribe(youtubeId, { until: 0, complete: false, items: [] });
    if (store.items.length === 0) {
      return NextResponse.json({ success: false, error: "Không nghe ra lời nói tiếng Anh trong 2 phút đầu video." }, { status: 422 });
    }
    const v = await prisma.videoLesson.create({
      data: {
        userId: user.id, languageId: lang.id, langCode: lang.code, youtubeId,
        title: meta.author ? `${meta.title} · ${meta.author}` : meta.title,
        segments: JSON.stringify(store),
      },
    });
    return NextResponse.json({ success: true, id: v.id });
  } catch (error) {
    if (error instanceof VideoError) return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    console.error("Video create error:", error);
    const transient = isTransientAiError(error);
    return NextResponse.json({ success: false, error: aiErrorMessage(error), transient }, { status: transient ? 503 : 500 });
  }
}

/**
 * action = "more": chép thêm một đoạn.
 * action = "result": ghi một câu chép chính tả / nói nhại.
 */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const v = await prisma.videoLesson.findFirst({ where: { id: String(body.id ?? ""), userId: user.id } });
    if (!v) return NextResponse.json({ success: false, error: "Không có video này" }, { status: 404 });
    const store = parseStore(v.segments);

    if (body.action === "more") {
      if (store.complete) return NextResponse.json({ success: true, added: 0, complete: true });
      const next = await transcribe(v.youtubeId, store);
      await prisma.videoLesson.update({ where: { id: v.id }, data: { segments: JSON.stringify(next) } });
      return NextResponse.json({ success: true, added: next.items.length - store.items.length, complete: next.complete });
    }

    if (body.action === "result") {
      const index = Number(body.index);
      const seg = store.items[index];
      const mode = body.mode === "shadowing" ? "shadowing" : "dictation";
      if (!seg) return NextResponse.json({ success: false, error: "Không có câu này" }, { status: 400 });
      const perfect = Boolean(body.perfect);
      const setId = `video:${v.id}`;
      await prisma.sentenceLog.upsert({
        where: { userId_langCode_setId_index_mode: { userId: user.id, langCode: v.langCode, setId, index, mode } },
        create: { userId: user.id, languageId: v.languageId, langCode: v.langCode, setId, index, mode, attempts: 1, cleared: perfect },
        update: { attempts: { increment: 1 }, ...(perfect ? { cleared: true } : {}), lastDoneAt: new Date() },
      });
      await prisma.videoLesson.update({ where: { id: v.id }, data: { lastIndex: index } });
      if (mode === "dictation") {
        const refKey = `${setId}#${index}`;
        if (perfect) await recordRight(user.id, "dictation", refKey);
        else await recordMistake({
          userId: user.id, languageId: v.languageId, langCode: v.langCode, source: "dictation", refKey,
          prompt: seg.vi || seg.en, answer: seg.en, lastWrong: typeof body.typed === "string" ? body.typed : null,
        });
      }
      if (v.languageId) {
        const skill = mode === "dictation" ? "listening" : "speaking";
        await prisma.skillProgress.upsert({
          where: { userId_languageId_skill: { userId: user.id, languageId: v.languageId, skill } },
          create: { userId: user.id, languageId: v.languageId, skill, xp: perfect ? 3 : 1, lessonsDone: 0, lastPracticedAt: new Date() },
          update: { xp: { increment: perfect ? 3 : 1 }, lastPracticedAt: new Date() },
        }).catch((e) => console.error("Skill progress write failed:", e));
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Thiếu thao tác" }, { status: 400 });
  } catch (error) {
    console.error("Video update error:", error);
    const transient = isTransientAiError(error);
    return NextResponse.json({ success: false, error: aiErrorMessage(error), transient }, { status: transient ? 503 : 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const v = await prisma.videoLesson.findFirst({ where: { id, userId: user.id } });
  if (!v) return NextResponse.json({ success: false }, { status: 404 });
  await prisma.$transaction([
    prisma.sentenceLog.deleteMany({ where: { userId: user.id, setId: `video:${v.id}` } }),
    prisma.mistakeItem.deleteMany({ where: { userId: user.id, refKey: { startsWith: `video:${v.id}#` } } }),
    prisma.videoLesson.delete({ where: { id: v.id } }),
  ]);
  return NextResponse.json({ success: true });
}
