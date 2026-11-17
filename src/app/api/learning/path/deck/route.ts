import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { findPoint } from "@/lib/grammarSyllabus";
import { isSentenceMode } from "@/lib/sentences";
import { resolveLang, openSet } from "@/lib/sentenceSources";
import { generateSentenceDeck, DeckTooSmallError } from "@/lib/sentenceGen";
import { aiErrorMessage, isTransientAiError } from "@/lib/aiRetry";
import { SENTENCES_PER_POINT } from "@/lib/learningPath";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Bộ câu Gõ câu / Dịch câu của MỘT điểm ngữ pháp trên Lộ trình.
 *
 * Lần đầu mở thì AI soạn 8 câu luyện đúng điểm đó và lưu lại; các lần sau (và
 * bài Dịch câu cùng điểm) dùng lại đúng bộ đó — mỗi điểm chỉ tốn một lượt AI.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const pointId = String(body.pointId ?? "");
    const mode = body.mode;
    if (!isSentenceMode(mode)) return NextResponse.json({ success: false, error: "Thiếu chế độ luyện" }, { status: 400 });

    const { code, id } = await resolveLang(user.id, body.languageId);
    const found = findPoint(code, pointId);
    if (!found) return NextResponse.json({ success: false, error: "Không có điểm ngữ pháp này" }, { status: 404 });

    let deck = await prisma.sentenceDeck.findFirst({
      where: { userId: user.id, langCode: code, pointId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!deck) {
      deck = await generateSentenceDeck({
        userId: user.id, languageId: id, code,
        topic: `${found.group.title} — ${found.point.title}`,
        level: found.point.level,
        count: SENTENCES_PER_POINT,
        grammar: { pointId, title: found.point.title },
      });
    }

    const set = await openSet(user.id, id, code, `ai:${deck.id}`);
    if (!set) return NextResponse.json({ success: false, error: "Không mở được bộ câu" }, { status: 500 });

    const logs = await prisma.sentenceLog.findMany({
      where: { userId: user.id, langCode: code, setId: set.id, mode },
      select: { index: true, cleared: true, attempts: true },
    });
    const byIndex = new Map(logs.map((l) => [l.index, l]));

    return NextResponse.json({
      success: true,
      point: { id: pointId, title: found.point.title, level: found.point.level, family: found.family.title },
      set: {
        ...set,
        sentences: set.sentences.map((s) => ({
          ...s,
          cleared: byIndex.get(s.ref.index)?.cleared ?? false,
          attempts: byIndex.get(s.ref.index)?.attempts ?? 0,
        })),
      },
    });
  } catch (error) {
    if (error instanceof DeckTooSmallError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
    console.error("Path deck error:", error);
    const transient = isTransientAiError(error);
    return NextResponse.json({ success: false, error: aiErrorMessage(error), transient }, { status: transient ? 503 : 500 });
  }
}
