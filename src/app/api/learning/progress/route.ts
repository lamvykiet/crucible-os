import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dayKey, todayStart, DAY_MS } from "@/lib/learningDay";

export const dynamic = "force-dynamic";

/**
 * Bảng tiến độ cá nhân.
 *
 * Bản tham chiếu có Leaderboard so XP với những người học khác. Crucible là hệ
 * dùng riêng — chỉ có một tài khoản, nên một bảng xếp hạng như vậy sẽ mãi chỉ
 * có một dòng và không nói lên điều gì.
 *
 * Thay vào đó, so với chính mình theo thời gian: tuần này với tuần trước, và
 * với tuần tốt nhất từ trước tới nay. Đó là thứ một người học một mình thật sự
 * dùng được, và vẫn giữ nguyên cái lõi của leaderboard là "tôi đang tiến hay lùi".
 */

/** Mỗi lượt ôn một điểm; trả lời đúng bài tập được thêm một điểm. */
const xpOf = (log: { correct: boolean | null }) => (log.correct === true ? 2 : 1);

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const now = new Date();
    // Lấy 26 tuần để tuần tốt nhất có ý nghĩa mà không phải quét cả đời.
    const from = new Date(now.getTime() - 26 * 7 * DAY_MS);

    const logs = await prisma.reviewLog.findMany({
      where: { userId: user.id, reviewedAt: { gte: from } },
      select: { reviewedAt: true, correct: true },
    });

    // Gom theo ngày trước, rồi mới gom ngày vào tuần — tuần bắt đầu từ thứ Hai.
    const xpByDay = new Map<string, number>();
    for (const log of logs) {
      const key = dayKey(log.reviewedAt);
      xpByDay.set(key, (xpByDay.get(key) ?? 0) + xpOf(log));
    }

    const weekStartOf = (d: Date) => {
      const start = todayStart(d);
      const dow = (start.getUTCDay() + 6) % 7; // thứ Hai = 0
      return new Date(start.getTime() - dow * DAY_MS);
    };

    const xpByWeek = new Map<string, number>();
    for (const [key, xp] of xpByDay) {
      const wk = dayKey(weekStartOf(new Date(`${key}T12:00:00.000Z`)));
      xpByWeek.set(wk, (xpByWeek.get(wk) ?? 0) + xp);
    }

    const thisWeekKey = dayKey(weekStartOf(now));
    const lastWeekKey = dayKey(new Date(weekStartOf(now).getTime() - 7 * DAY_MS));

    const thisWeek = xpByWeek.get(thisWeekKey) ?? 0;
    const lastWeek = xpByWeek.get(lastWeekKey) ?? 0;
    const best = Math.max(0, ...xpByWeek.values());

    // Mười hai tuần gần nhất để vẽ cột, cũ trước mới sau.
    const recent = Array.from({ length: 12 }, (_, i) => {
      const wk = dayKey(new Date(weekStartOf(now).getTime() - (11 - i) * 7 * DAY_MS));
      return { week: wk, xp: xpByWeek.get(wk) ?? 0 };
    });

    const totalXp = [...xpByDay.values()].reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      thisWeek,
      lastWeek,
      best,
      totalXp,
      activeDays: xpByDay.size,
      recent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được tiến độ";
    console.error("Progress board error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
