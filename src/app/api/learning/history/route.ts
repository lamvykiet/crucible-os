import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STATE } from "@/lib/fsrs";

export const dynamic = "force-dynamic";

/**
 * Múi giờ cắt ngày. Xem chú thích ở /api/learning/overview — cùng một lý do:
 * ôn lúc 22h tối ở Việt Nam mà cắt theo UTC thì bị tính sang ngày hôm sau.
 */
const TZ = "Asia/Ho_Chi_Minh";
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayKey = (d: Date) => dayFormatter.format(d);

/**
 * Lịch sử học theo ngày, cộng thống kê tình trạng thẻ.
 *
 * `?month=YYYY-MM` lấy đúng một tháng để vẽ lịch. Không truyền thì lấy 90 ngày
 * gần nhất.
 *
 * Số liệu đến từ `ReviewLog` chứ không từ `Flashcard`: thẻ chỉ mang trạng thái
 * hiện tại, nên nếu chỉ nhìn thẻ thì không thể biết ngày 12/08 đã ôn những gì.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const month = params.get("month")?.trim() || null;
    const languageId = params.get("languageId")?.trim() || null;

    let from: Date;
    let to: Date;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      // Lấy rộng ra một ngày mỗi đầu để không rơi mất lượt ôn sát nửa đêm do
      // lệch giữa giờ UTC lưu trong DB và giờ Việt Nam dùng để cắt ngày.
      from = new Date(Date.UTC(y, m - 1, 1));
      from.setUTCDate(from.getUTCDate() - 1);
      to = new Date(Date.UTC(y, m, 1));
      to.setUTCDate(to.getUTCDate() + 1);
    } else {
      to = new Date();
      from = new Date(to.getTime() - 90 * 86_400_000);
    }

    const [logs, notes, cards] = await Promise.all([
      prisma.reviewLog.findMany({
        where: {
          userId: user.id,
          reviewedAt: { gte: from, lt: to },
          ...(languageId ? { languageId } : {}),
        },
        select: { reviewedAt: true, grade: true, mode: true, correct: true },
      }),
      prisma.studyNote.findMany({
        where: { userId: user.id, noteDate: { gte: from, lt: to } },
        orderBy: { noteDate: "asc" },
        select: { id: true, body: true, noteDate: true, color: true },
      }),
      // Thống kê tình trạng thẻ, phục vụ biểu đồ tròn.
      prisma.flashcard.findMany({
        where: { userId: user.id },
        select: {
          state: true,
          dueDate: true,
          dictionaryItem: { select: { languageId: true, deck: { select: { status: true } } } },
        },
      }),
    ]);

    // Gom lượt ôn theo ngày.
    const byDay = new Map<string, { reviews: number; correct: number; wrong: number }>();
    for (const log of logs) {
      const key = dayKey(log.reviewedAt);
      const bucket = byDay.get(key) ?? { reviews: 0, correct: 0, wrong: 0 };
      bucket.reviews += 1;
      // "Quên" và "Khó" tính là chưa thuộc; "Tốt" và "Dễ" tính là thuộc.
      if (log.correct === false || log.grade <= 2) bucket.wrong += 1;
      else bucket.correct += 1;
      byDay.set(key, bucket);
    }

    const notesByDay = new Map<string, typeof notes>();
    for (const note of notes) {
      const key = dayKey(note.noteDate);
      notesByDay.set(key, [...(notesByDay.get(key) ?? []), note]);
    }

    const days = [...new Set([...byDay.keys(), ...notesByDay.keys()])].sort().map((date) => ({
      date,
      ...(byDay.get(date) ?? { reviews: 0, correct: 0, wrong: 0 }),
      notes: notesByDay.get(date) ?? [],
    }));

    // Bốn nhóm tình trạng thẻ, khớp với biểu đồ tròn của bản tham chiếu.
    const now = new Date();
    const scoped = languageId
      ? cards.filter((c) => c.dictionaryItem?.languageId === languageId)
      : cards;

    const stats = { mastered: 0, learning: 0, due: 0, paused: 0 };
    for (const c of scoped) {
      if (c.dictionaryItem?.deck?.status === "paused") stats.paused += 1;
      else if (c.dueDate <= now) stats.due += 1;
      else if (c.state === STATE.REVIEW) stats.mastered += 1;
      else stats.learning += 1;
    }

    return NextResponse.json({
      success: true,
      days,
      stats,
      totalReviews: logs.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được lịch sử";
    console.error("Learning history error:", error);
    return NextResponse.json({ success: false, error: message, days: [], stats: null }, { status: 500 });
  }
}
