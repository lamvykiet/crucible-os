import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  AUTO_SOURCES, COLORS, GROUPS, PERIODS, UNITS,
  addDays, computeStreak, dayKey, dayStart, isScheduled, periodKey,
} from "@/lib/habits";

export const dynamic = "force-dynamic";

/** Số ngày lịch sử kéo về để tính chuỗi. Đủ cho chuỗi hơn nửa năm. */
const HISTORY_DAYS = 220;

const allowed = (list: readonly { value: string }[], v: unknown, fallback: string) =>
  list.some((x) => x.value === v) ? (v as string) : fallback;

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** "HH:MM" hoặc null. Chuỗi rác bị bỏ chứ không lưu để hỏng lịch tuần. */
const timeOrNull = (v: unknown): string | null =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;

/** Dựng phần dữ liệu ghi xuống DB từ body, bỏ qua mọi khoá lạ. */
function habitData(body: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (!partial || body[key] !== undefined) data[key] = value;
  };

  set("name", String(body.name ?? "").trim().slice(0, 80));
  set("cue", body.cue ? String(body.cue).trim().slice(0, 200) : null);
  set("kind", body.kind === "quit" ? "quit" : "build");
  set("group", allowed(GROUPS, body.group, "daily"));
  set("color", (COLORS as readonly string[]).includes(String(body.color)) ? String(body.color) : "accent");
  set("icon", body.icon ? String(body.icon).slice(0, 40) : null);
  set("unit", allowed(UNITS, body.unit, "times"));
  set("period", allowed(PERIODS, body.period, "day"));
  set("target", clampInt(body.target, 1, 1_000_000, 1));
  set("step", clampInt(body.step, 1, 100_000, 1));
  set("autoSource", allowed(AUTO_SOURCES, body.autoSource, "manual"));
  set("reminderAt", timeOrNull(body.reminderAt));
  set("scheduleStart", timeOrNull(body.scheduleStart));
  set(
    "scheduleMinutes",
    body.scheduleMinutes == null || body.scheduleMinutes === "" ? null : clampInt(body.scheduleMinutes, 5, 720, 30)
  );
  set(
    "weekdays",
    Array.isArray(body.weekdays)
      ? [...new Set(body.weekdays.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))].sort()
      : []
  );

  if (data.name === "") delete data.name;
  return data;
}

/**
 * Danh sách thói quen kèm trạng thái của MỘT ngày.
 *
 * Trả luôn tiến độ, chuỗi và tỷ lệ trong cùng một lượt: trang Hôm nay cần cả
 * ba thứ cho mỗi dòng, gọi tách ra là ba lượt mạng cho một màn hình.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const url = new URL(req.url);
    const today = dayKey();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") ?? "")
      ? url.searchParams.get("date")!
      : today;
    const includeArchived = url.searchParams.get("archived") === "1";

    const habits = await prisma.habit.findMany({
      where: { userId: user.id, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const from = dayStart(addDays(date, -HISTORY_DAYS));
    const to = dayStart(addDays(date, 1));

    const entries = await prisma.habitEntry.findMany({
      where: { userId: user.id, entryDate: { gte: from, lt: to } },
      orderBy: { entryDate: "asc" },
    });

    // Tiến độ tự đếm: đọc thẳng từ sổ gốc của module khác cho đúng ngày đang xem.
    const dayFrom = dayStart(date);
    const dayTo = dayStart(addDays(date, 1));
    const needs = new Set(habits.map((h) => h.autoSource));

    const [reviewCount, sessions, expenseCount] = await Promise.all([
      needs.has("review")
        ? prisma.reviewLog.count({ where: { userId: user.id, reviewedAt: { gte: dayFrom, lt: dayTo } } })
        : Promise.resolve(0),
      needs.has("focus")
        ? prisma.focusSession.findMany({
            where: { userId: user.id, endedAt: { gte: dayFrom, lt: dayTo } },
            select: { habitId: true, seconds: true },
          })
        : Promise.resolve([] as { habitId: string | null; seconds: number }[]),
      needs.has("noSpend")
        ? prisma.transaction.count({ where: { userId: user.id, type: "Expense", date: { gte: dayFrom, lt: dayTo } } })
        : Promise.resolve(0),
    ]);

    const focusMinutes = (habitId: string) =>
      Math.floor(sessions.filter((s) => s.habitId === habitId).reduce((sum, s) => sum + s.seconds, 0) / 60);

    const rows = habits.map((habit) => {
      const own = entries
        .filter((e) => e.habitId === habit.id)
        .map((e) => ({
          day: e.entryDate.toISOString().slice(0, 10),
          amount: e.amount,
          skipped: e.skipped,
          note: e.note,
        }));

      const todayEntry = own.find((e) => e.day === date);

      // Nguồn tự đếm ghi đè con số bấm tay: sổ gốc luôn đúng hơn.
      const auto =
        habit.autoSource === "review" ? reviewCount
        : habit.autoSource === "focus" ? focusMinutes(habit.id)
        : habit.autoSource === "noSpend" ? (expenseCount === 0 ? 1 : 0)
        : null;

      const amount = auto ?? todayEntry?.amount ?? 0;
      const merged = auto === null ? own : own.map((e) => (e.day === date ? { ...e, amount: auto } : e));

      const key = periodKey(date, habit.period);
      const periodAmount = merged
        .filter((e) => periodKey(e.day, habit.period) === key)
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        ...habit,
        quitSince: habit.quitSince?.toISOString() ?? null,
        archivedAt: habit.archivedAt?.toISOString() ?? null,
        createdAt: habit.createdAt.toISOString(),
        updatedAt: habit.updatedAt.toISOString(),
        amount,
        note: todayEntry?.note ?? null,
        skipped: todayEntry?.skipped ?? false,
        periodAmount,
        done: habit.kind === "quit" ? false : periodAmount >= habit.target,
        scheduled: isScheduled(habit, date),
        streak: habit.kind === "quit" ? 0 : computeStreak(habit, merged, date),
      };
    });

    const counted = rows.filter((r) => r.kind === "build" && r.scheduled && !r.skipped);
    const doneCount = counted.filter((r) => r.done).length;

    return NextResponse.json({
      success: true,
      date,
      today,
      habits: rows,
      percent: counted.length ? Math.round((doneCount / counted.length) * 100) : 0,
      doneCount,
      dueCount: counted.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được thói quen";
    console.error("Habits GET error:", error);
    return NextResponse.json({ success: false, error: message, habits: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const data = habitData(body, false);
    if (!data.name) {
      return NextResponse.json({ success: false, error: "Thiếu tên thói quen" }, { status: 400 });
    }

    const last = await prisma.habit.findFirst({
      where: { userId: user.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const habit = await prisma.habit.create({
      data: {
        ...data,
        // Thói quen "bỏ" bắt đầu đếm ngay lúc tạo; không có mốc thì màn hình
        // Hôm nay không có gì để hiện.
        quitSince: data.kind === "quit" ? new Date() : null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        userId: user.id,
      } as Prisma.HabitUncheckedCreateInput,
    });

    return NextResponse.json({ success: true, habit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tạo được thói quen";
    console.error("Habits POST error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const id = String(body.id ?? "");
    const owned = await prisma.habit.findFirst({ where: { id, userId: user.id } });
    if (!owned) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    const data = habitData(body, true);

    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null;
    if (body.sortOrder !== undefined) data.sortOrder = clampInt(body.sortOrder, 0, 9999, owned.sortOrder);
    // Đổi một thói quen thường thành thói quen "bỏ" thì phải có mốc đếm.
    if (data.kind === "quit" && !owned.quitSince) data.quitSince = new Date();

    const habit = await prisma.habit.update({
      where: { id },
      data: data as Prisma.HabitUncheckedUpdateInput,
    });
    return NextResponse.json({ success: true, habit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không sửa được thói quen";
    console.error("Habits PATCH error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Xoá hẳn, kéo theo toàn bộ lịch sử. Giao diện luôn mời lưu kho trước. */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const owned = await prisma.habit.findFirst({ where: { id, userId: user.id } });
    if (!owned) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    await prisma.habit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xoá được";
    console.error("Habits DELETE error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
