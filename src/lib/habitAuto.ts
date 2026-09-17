// Tiến độ tự đếm: đọc từ sổ gốc của các module khác.
//
// Cả trang Hôm nay lẫn trang Báo cáo đều cần đúng một cách đọc. Hai chỗ tự
// đếm theo hai kiểu là hai con số khác nhau cho cùng một thói quen — và vì
// chuỗi ngày tính từ chính những con số này, sai lệch sẽ hiện ra dưới dạng
// "chuỗi 12 ngày" ở màn này và "chuỗi 3 ngày" ở màn kia.

import { prisma } from "@/lib/prisma";
import { EMPTY_AUTO, addDays, dayKey, dayStart } from "@/lib/habits";
import type { AutoData } from "@/lib/habits";

// Hai route chỉ cần import từ đúng một chỗ, dù phần tính nằm ở habits.ts.
export { autoAmountFor, EMPTY_AUTO } from "@/lib/habits";
export type { AutoData, AutoHabit } from "@/lib/habits";

/** Kéo về đúng những nguồn đang có thói quen dùng tới, trong dải ngày cần vẽ. */
export async function loadAutoData(
  userId: string,
  sources: Set<string>,
  fromIso: string,
  toIso: string
): Promise<AutoData> {
  if (!sources.has("review") && !sources.has("focus") && !sources.has("noSpend")) return EMPTY_AUTO;

  const gte = dayStart(fromIso);
  const lt = dayStart(addDays(toIso, 1));

  const [reviews, sessions, expenses] = await Promise.all([
    sources.has("review")
      ? prisma.reviewLog.findMany({ where: { userId, reviewedAt: { gte, lt } }, select: { reviewedAt: true } })
      : Promise.resolve([] as { reviewedAt: Date }[]),
    sources.has("focus")
      ? prisma.focusSession.findMany({
          where: { userId, endedAt: { gte, lt } },
          select: { habitId: true, seconds: true, endedAt: true },
        })
      : Promise.resolve([] as { habitId: string | null; seconds: number; endedAt: Date }[]),
    sources.has("noSpend")
      ? prisma.transaction.findMany({
          where: { userId, type: "Expense", date: { gte, lt } },
          select: { date: true },
        })
      : Promise.resolve([] as { date: Date }[]),
  ]);

  const reviewByDay = new Map<string, number>();
  for (const r of reviews) {
    const k = dayKey(r.reviewedAt);
    reviewByDay.set(k, (reviewByDay.get(k) ?? 0) + 1);
  }

  const focusSecondsByHabitDay = new Map<string, number>();
  for (const s of sessions) {
    if (!s.habitId) continue;
    const k = `${s.habitId}|${dayKey(s.endedAt)}`;
    focusSecondsByHabitDay.set(k, (focusSecondsByHabitDay.get(k) ?? 0) + s.seconds);
  }

  // `Transaction.date` là ngày lịch lưu ở mốc 00:00 UTC, không cần đổi múi giờ.
  const spentDays = new Set(expenses.map((e) => e.date.toISOString().slice(0, 10)));

  return { reviewByDay, focusSecondsByHabitDay, spentDays };
}
