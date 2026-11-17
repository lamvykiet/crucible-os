import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { aiErrorMessage, isTransientAiError } from "@/lib/aiRetry";
import { resolveLang } from "@/lib/sentenceSources";
import { generateSentenceDeck, DeckTooSmallError } from "@/lib/sentenceGen";

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

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const topic = String(body.topic ?? "").trim();
    if (!topic) return NextResponse.json({ success: false, error: "Chưa nhập chủ đề" }, { status: 400 });
    if (topic.length > 120) return NextResponse.json({ success: false, error: "Chủ đề quá dài" }, { status: 400 });

    const { code, id } = await resolveLang(user.id, body.languageId);
    const deck = await generateSentenceDeck({
      userId: user.id, languageId: id, code, topic, level: String(body.level ?? "B1"), count: COUNT,
    });
    return NextResponse.json({ success: true, setId: `ai:${deck.id}` });
  } catch (error) {
    if (error instanceof DeckTooSmallError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 });
    }
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
