import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { CLEAR_STREAK } from "@/lib/mistakes";
import { sameSentence } from "@/lib/sentences/types";
import { compareLine } from "@/lib/dictationSets";

export const dynamic = "force-dynamic";

/**
 * Sổ lỗi sai của một thứ tiếng: đọc, ôn lại, và bỏ ra khỏi sổ.
 *
 * Chấm ở máy chủ, so với đáp án đã lưu. Câu gõ đúng thì `rightStreak` tăng, đủ
 * `CLEAR_STREAK` lần liền thì rời sổ; gõ sai thì về 0 và tăng `wrongCount`.
 */

async function langOf(userId: string, languageId: string | null | undefined) {
  if (!languageId) return null;
  return prisma.language.findFirst({ where: { id: languageId, userId }, select: { id: true, code: true } });
}

/** So đáp án theo đúng kiểu của nguồn: chép chính tả bỏ qua dấu câu, còn lại so cả câu. */
function isRight(source: string, typed: string, answer: string) {
  if (source === "dictation") return compareLine(typed, answer).perfect;
  if (source === "flashcard") return typed.trim().toLowerCase() === answer.trim().toLowerCase() || sameSentence(typed, answer);
  return sameSentence(typed, answer);
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const lang = await langOf(user.id, params.get("languageId"));
    const langCode = lang?.code ?? "en";
    const where = { userId: user.id, langCode, resolvedAt: null };

    if (params.get("countOnly")) {
      const open = await prisma.mistakeItem.count({ where });
      return NextResponse.json({ success: true, open });
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [items, clearedThisWeek] = await Promise.all([
      prisma.mistakeItem.findMany({
        where,
        orderBy: [{ wrongCount: "desc" }, { lastWrongAt: "desc" }],
        take: 300,
        select: {
          id: true, source: true, refKey: true, prompt: true, answer: true, lastWrong: true,
          wrongCount: true, rightStreak: true, lastWrongAt: true,
        },
      }),
      prisma.mistakeItem.count({ where: { userId: user.id, langCode, resolvedAt: { gte: weekAgo } } }),
    ]);

    return NextResponse.json({ success: true, langCode, clearStreak: CLEAR_STREAK, clearedThisWeek, items });
  } catch (error) {
    console.error("Mistake list error:", error);
    return NextResponse.json({ success: false, error: "Không đọc được sổ lỗi sai" }, { status: 500 });
  }
}

/** Ôn một câu trong sổ. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, typed } = await req.json();
    const row = await prisma.mistakeItem.findFirst({ where: { id: String(id ?? ""), userId: user.id } });
    if (!row) return NextResponse.json({ success: false, error: "Không có câu này trong sổ" }, { status: 404 });

    const text = String(typed ?? "").slice(0, 1000);
    const correct = isRight(row.source, text, row.answer);
    const streak = correct ? row.rightStreak + 1 : 0;
    const cleared = correct && streak >= CLEAR_STREAK;

    await prisma.mistakeItem.update({
      where: { id: row.id },
      data: correct
        ? { rightStreak: streak, ...(cleared ? { resolvedAt: new Date() } : {}) }
        : { rightStreak: 0, wrongCount: { increment: 1 }, lastWrong: text, lastWrongAt: new Date() },
    });

    return NextResponse.json({ success: true, correct, cleared, streak, answer: row.answer });
  } catch (error) {
    console.error("Mistake review error:", error);
    return NextResponse.json({ success: false, error: "Không chấm được" }, { status: 500 });
  }
}

/** Bỏ một câu ra khỏi sổ bằng tay ("đã nhớ rồi"). */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const result = await prisma.mistakeItem.updateMany({
      where: { id, userId: user.id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không có câu này trong sổ" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mistake remove error:", error);
    return NextResponse.json({ success: false, error: "Không bỏ được câu này" }, { status: 500 });
  }
}
