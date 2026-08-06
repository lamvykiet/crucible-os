import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { schedule, previewIntervals, STATE, type Grade, type CardState } from "@/lib/fsrs";

export const dynamic = "force-dynamic";

const DEFAULT_BATCH = 30;

function toCardState(card: {
  stability: number; difficulty: number; elapsedDays: number; scheduledDays: number;
  reps: number; state: number; lastReview: Date | null; dueDate: Date;
}): CardState {
  return { ...card };
}

/**
 * Hàng ôn hôm nay.
 *
 * Trả về thẻ đã tới hạn (`dueDate <= now`), thẻ đang học trước, rồi tới thẻ mới.
 * Kèm sẵn khoảng cách dự kiến của cả bốn lựa chọn để nút hiện "3 ngày", "2
 * tháng" thay cho các nhãn viết cứng "(1m) (10m) (1d) (4d)" của bản cũ — những
 * con số đó không liên quan gì tới thẻ đang xem.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || DEFAULT_BATCH, 100);
    const now = new Date();

    const [due, newCount, total] = await Promise.all([
      prisma.flashcard.findMany({
        where: { userId: user.id, dueDate: { lte: now } },
        orderBy: [{ state: "desc" }, { dueDate: "asc" }],
        take: limit,
        include: { dictionaryItem: { select: { term: true, domain: true } } },
      }),
      prisma.flashcard.count({ where: { userId: user.id, state: STATE.NEW } }),
      prisma.flashcard.count({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({
      success: true,
      total,
      newCount,
      dueCount: due.length,
      cards: due.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        state: c.state,
        reps: c.reps,
        domain: c.dictionaryItem?.domain ?? null,
        intervals: previewIntervals(toCardState(c), now),
      })),
    });
  } catch (error) {
    console.error("List due cards error:", error);
    return NextResponse.json(
      { success: false, error: "Server Error", cards: [], total: 0, newCount: 0, dueCount: 0 },
      { status: 500 }
    );
  }
}

/** Chấm điểm một thẻ và ghi lại lịch mới do FSRS tính. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, grade } = await req.json();

    if (!id || ![1, 2, 3, 4].includes(Number(grade))) {
      return NextResponse.json(
        { success: false, error: "Thiếu id hoặc mức đánh giá không hợp lệ" },
        { status: 400 }
      );
    }

    const card = await prisma.flashcard.findUnique({ where: { id } });
    if (!card || card.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Không tìm thấy thẻ" }, { status: 404 });
    }

    const next = schedule(toCardState(card), Number(grade) as Grade);

    const updated = await prisma.flashcard.update({
      where: { id },
      data: {
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: next.elapsedDays,
        scheduledDays: next.scheduledDays,
        reps: next.reps,
        state: next.state,
        lastReview: next.lastReview,
        dueDate: next.dueDate,
      },
    });

    return NextResponse.json({
      success: true,
      card: { id: updated.id, dueDate: updated.dueDate, state: updated.state, reps: updated.reps },
      intervalMinutes: next.intervalMinutes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được kết quả ôn";
    console.error("Review card error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Xoá một thẻ khỏi bộ ôn. */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const result = await prisma.flashcard.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy thẻ" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete card error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
