import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  addDays, completionRate, computeStreak, dayKey, dayStart,
  isScheduled, monthDays, periodKey, weekDays, weekdayOf,
} from "@/lib/habits";

export const dynamic = "force-dynamic";

/** Trạng thái một ô trong lưới báo cáo. */
const CELL = { off: -1, empty: 0, partial: 1, done: 2, skipped: 3 } as const;

/** Mọi ngày của năm chứa `iso`, cắt ở hôm nay để không vẽ ô cho tương lai. */
function yearDays(iso: string, today: string): string[] {
  const year = iso.slice(0, 4);
  const out: string[] = [];
  let cursor = `${year}-01-01`;
  const end = `${year}-12-31` < today ? `${year}-12-31` : today;
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Báo cáo tuần / tháng / năm.
 *
 * Mẫu số là "số ngày có lịch", không phải "số ngày trong dải" — thói quen ba
 * buổi một tuần mà tuần nào cũng đủ thì phải là 100%, không phải 43%.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const url = new URL(req.url);
    const today = dayKey();
    const anchor = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") ?? "")
      ? url.searchParams.get("date")!
      : today;
    const range = ["week", "month", "year"].includes(url.searchParams.get("range") ?? "")
      ? url.searchParams.get("range")!
      : "week";

    const days =
      range === "week" ? weekDays(anchor) : range === "month" ? monthDays(anchor) : yearDays(anchor, today);
    const visible = days.filter((d) => d <= today);

    const habits = await prisma.habit.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const from = dayStart(days[0]);
    const to = dayStart(addDays(days[days.length - 1], 1));

    const needs = new Set(habits.map((h) => h.autoSource));
    const [rawEntries, reviews, sessions, expenses, journals] = await Promise.all([
      prisma.habitEntry.findMany({
        where: { userId: user.id, entryDate: { gte: dayStart(addDays(days[0], -220)), lt: to } },
        orderBy: { entryDate: "asc" },
      }),
      needs.has("review")
        ? prisma.reviewLog.findMany({
            where: { userId: user.id, reviewedAt: { gte: from, lt: to } },
            select: { reviewedAt: true },
          })
        : Promise.resolve([] as { reviewedAt: Date }[]),
      needs.has("focus")
        ? prisma.focusSession.findMany({
            where: { userId: user.id, endedAt: { gte: from, lt: to } },
            select: { habitId: true, seconds: true, endedAt: true },
          })
        : Promise.resolve([] as { habitId: string | null; seconds: number; endedAt: Date }[]),
      needs.has("noSpend")
        ? prisma.transaction.findMany({
            where: { userId: user.id, type: "Expense", date: { gte: from, lt: to } },
            select: { date: true },
          })
        : Promise.resolve([] as { date: Date }[]),
      prisma.habitJournal.findMany({
        where: { userId: user.id, entryDate: { gte: from, lt: to }, mood: { not: null } },
        select: { entryDate: true, mood: true },
      }),
    ]);

    // Gom dữ liệu tự đếm về từng ngày lịch trước khi trộn vào lịch sử.
    const reviewByDay = new Map<string, number>();
    for (const r of reviews) {
      const k = dayKey(r.reviewedAt);
      reviewByDay.set(k, (reviewByDay.get(k) ?? 0) + 1);
    }
    const focusByHabitDay = new Map<string, number>();
    for (const s of sessions) {
      if (!s.habitId) continue;
      const k = `${s.habitId}|${dayKey(s.endedAt)}`;
      focusByHabitDay.set(k, (focusByHabitDay.get(k) ?? 0) + s.seconds);
    }
    const spentDays = new Set(expenses.map((e) => e.date.toISOString().slice(0, 10)));

    const rows = habits.map((habit) => {
      const own = rawEntries
        .filter((e) => e.habitId === habit.id)
        .map((e) => ({
          day: e.entryDate.toISOString().slice(0, 10),
          amount: e.amount,
          skipped: e.skipped,
        }));

      const byDay = new Map(own.map((e) => [e.day, e]));

      // Ngày nào có nguồn tự đếm thì con số của sổ gốc thắng.
      if (habit.autoSource !== "manual") {
        for (const iso of visible) {
          const amount =
            habit.autoSource === "review" ? (reviewByDay.get(iso) ?? 0)
            : habit.autoSource === "focus" ? Math.floor((focusByHabitDay.get(`${habit.id}|${iso}`) ?? 0) / 60)
            : spentDays.has(iso) ? 0 : 1;
          byDay.set(iso, { day: iso, amount, skipped: byDay.get(iso)?.skipped ?? false });
        }
      }

      const merged = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
      const totalsPerPeriod = new Map<string, number>();
      for (const e of merged) {
        const k = periodKey(e.day, habit.period);
        totalsPerPeriod.set(k, (totalsPerPeriod.get(k) ?? 0) + e.amount);
      }

      const cells = days.map((iso) => {
        if (iso > today) return CELL.off;
        const entry = byDay.get(iso);
        if (entry?.skipped) return CELL.skipped;
        if (!isScheduled(habit, iso)) return CELL.off;
        const value = habit.period === "day" ? (entry?.amount ?? 0) : (totalsPerPeriod.get(periodKey(iso, habit.period)) ?? 0);
        if (value >= habit.target) return CELL.done;
        return value > 0 ? CELL.partial : CELL.empty;
      });

      const rate = completionRate(habit, merged, visible);
      const total = merged.filter((e) => visible.includes(e.day)).reduce((s, e) => s + e.amount, 0);

      return {
        id: habit.id,
        name: habit.name,
        kind: habit.kind,
        color: habit.color,
        unit: habit.unit,
        target: habit.target,
        period: habit.period,
        group: habit.group,
        quitSince: habit.quitSince?.toISOString() ?? null,
        streak: habit.kind === "quit" ? 0 : computeStreak(habit, merged, today),
        percent: rate.percent,
        done: rate.done,
        scheduled: rate.scheduled,
        total,
        cells,
      };
    });

    // Thứ nào trong tuần làm tốt nhất — tính trên các thói quen "xây", vì thói
    // quen "bỏ" không có ô tick hằng ngày để so.
    const buildRows = rows.filter((r) => r.kind === "build");
    const byWeekday = Array.from({ length: 7 }, () => ({ done: 0, scheduled: 0 }));
    days.forEach((iso, i) => {
      if (iso > today) return;
      const wd = weekdayOf(iso);
      for (const r of buildRows) {
        const cell = r.cells[i];
        if (cell === CELL.off || cell === CELL.skipped) continue;
        byWeekday[wd].scheduled++;
        if (cell === CELL.done) byWeekday[wd].done++;
      }
    });

    const weekdayRates = byWeekday.map((b) => (b.scheduled ? Math.round((b.done / b.scheduled) * 100) : null));
    const rated = weekdayRates.map((v, i) => ({ i, v })).filter((x) => x.v !== null) as { i: number; v: number }[];

    const totalScheduled = buildRows.reduce((s, r) => s + r.scheduled, 0);
    const totalDone = buildRows.reduce((s, r) => s + r.done, 0);

    // Tâm trạng trung bình những ngày làm đủ so với những ngày không — chỉ hiện
    // khi cả hai bên đều có ít nhất ba lượt chấm, dưới mức đó thì chỉ là nhiễu.
    const moodByDay = new Map<string, number[]>();
    for (const j of journals) {
      const k = j.entryDate.toISOString().slice(0, 10);
      if (j.mood != null) moodByDay.set(k, [...(moodByDay.get(k) ?? []), j.mood]);
    }
    const goodMoods: number[] = [];
    const otherMoods: number[] = [];
    days.forEach((iso, i) => {
      const moods = moodByDay.get(iso);
      if (!moods?.length) return;
      const counted = buildRows.filter((r) => r.cells[i] !== CELL.off && r.cells[i] !== CELL.skipped);
      if (!counted.length) return;
      const allDone = counted.every((r) => r.cells[i] === CELL.done);
      (allDone ? goodMoods : otherMoods).push(...moods);
    });
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

    return NextResponse.json({
      success: true,
      range,
      anchor,
      today,
      days,
      habits: rows,
      insights: {
        percent: totalScheduled ? Math.round((totalDone / totalScheduled) * 100) : 0,
        bestWeekday: rated.length ? rated.reduce((a, b) => (b.v > a.v ? b : a)).i : null,
        worstWeekday: rated.length > 1 ? rated.reduce((a, b) => (b.v < a.v ? b : a)).i : null,
        weekdayRates,
        longestStreak: rows.reduce((m, r) => Math.max(m, r.streak), 0),
        moodOnFullDays: goodMoods.length >= 3 && otherMoods.length >= 3 ? avg(goodMoods) : null,
        moodOnOtherDays: goodMoods.length >= 3 && otherMoods.length >= 3 ? avg(otherMoods) : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không dựng được báo cáo";
    console.error("Habit reports error:", error);
    return NextResponse.json({ success: false, error: message, habits: [] }, { status: 500 });
  }
}
