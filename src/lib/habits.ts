// Phần "sự thật" của module Thói quen: quy ước ngày, kỳ, và cách tính chuỗi.
//
// Cả route handler lẫn component đều gọi vào đây. Đưa ra một file riêng vì
// chuỗi ngày (streak) là thứ dễ tính lệch nhất: máy chủ chạy UTC, người dùng ở
// UTC+7, và một thói quen chỉ làm Thứ hai–Thứ sáu thì Chủ nhật không được coi
// là "đứt chuỗi". Hai chỗ tính hai kiểu là có hai con số khác nhau trên cùng
// một màn hình.

export const HABIT_TZ = "Asia/Ho_Chi_Minh";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HABIT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ngày lịch (YYYY-MM-DD) theo giờ Việt Nam của một mốc thời gian. */
export function dayKey(d: Date = new Date()): string {
  return dayFormatter.format(d);
}

/**
 * Nửa đêm của một ngày lịch, lưu như mốc UTC.
 *
 * Cùng quy ước với `Transaction.date` và `DailyTask.taskDate`: cột ngày trong
 * DB không mang phần giờ, nên "2026-09-17" luôn là 2026-09-17T00:00:00Z bất kể
 * máy chủ đứng ở múi giờ nào.
 */
export function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD mà không đi qua múi giờ máy chủ. */
export function addDays(iso: string, n: number): string {
  const d = dayStart(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Chủ nhật … 6 = Thứ bảy, khớp với `Habit.weekdays`. */
export function weekdayOf(iso: string): number {
  return dayStart(iso).getUTCDay();
}

/** Thứ hai của tuần chứa ngày này. Tuần bắt đầu từ Thứ hai (quy ước Việt Nam). */
export function weekStart(iso: string): string {
  const wd = weekdayOf(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

/** Bảy ngày của tuần chứa `iso`, từ Thứ hai đến Chủ nhật. */
export function weekDays(iso: string): string[] {
  const mon = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** Mọi ngày trong tháng chứa `iso`. */
export function monthDays(iso: string): string[] {
  const [y, m] = iso.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${iso.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`);
}

/**
 * Khoá kỳ của một ngày: "2026-09-17" | "2026-W38" | "2026-09".
 *
 * Thói quen tính theo tuần ("đọc 200 trang/tuần") cộng dồn theo khoá này, nên
 * mọi ngày trong cùng tuần phải cho ra đúng một chuỗi.
 */
export function periodKey(iso: string, period: string): string {
  if (period === "week") return `W:${weekStart(iso)}`;
  if (period === "month") return `M:${iso.slice(0, 7)}`;
  return iso;
}

// ---------------------------------------------------------------------------
// Danh mục tuỳ chọn. Giá trị lưu xuống DB luôn là chuỗi tiếng Anh ở cột `value`;
// phần chữ chỉ để hiển thị. Đổi nhãn không bao giờ làm tách đôi dữ liệu.
// ---------------------------------------------------------------------------

export const UNITS = [
  { value: "times", en: "times", vi: "lần" },
  { value: "minutes", en: "minutes", vi: "phút" },
  { value: "hours", en: "hours", vi: "giờ" },
  { value: "pages", en: "pages", vi: "trang" },
  { value: "cups", en: "cups", vi: "cốc" },
  { value: "ml", en: "ml", vi: "ml" },
  { value: "steps", en: "steps", vi: "bước" },
  { value: "km", en: "km", vi: "km" },
  { value: "calories", en: "calories", vi: "calo" },
  { value: "cards", en: "cards", vi: "thẻ" },
] as const;

export const GROUPS = [
  { value: "daily", en: "Daily habits", vi: "Thói quen ngày" },
  { value: "health", en: "Health", vi: "Sức khoẻ" },
  { value: "mind", en: "Mind", vi: "Tinh thần" },
  { value: "work", en: "Work & study", vi: "Việc & học" },
] as const;

export const PERIODS = [
  { value: "day", en: "per day", vi: "mỗi ngày" },
  { value: "week", en: "per week", vi: "mỗi tuần" },
  { value: "month", en: "per month", vi: "mỗi tháng" },
] as const;

/**
 * Nguồn tiến độ tự đếm.
 *
 * Đây là điểm khác biệt so với một ứng dụng thói quen đứng một mình: Crucible
 * đã có nhật ký ôn thẻ, phiên tập trung và sổ chi tiêu, nên ba thói quen này
 * không cần ai bấm tay — và vì thế không bao giờ lệch với sổ gốc.
 */
export const AUTO_SOURCES = [
  { value: "manual", en: "I log it myself", vi: "Tự bấm" },
  { value: "review", en: "Cards reviewed (Learning Hub)", vi: "Số thẻ đã ôn (Learning Hub)" },
  { value: "focus", en: "Focus minutes (Timer)", vi: "Số phút tập trung (Bấm giờ)" },
  { value: "noSpend", en: "A no-spend day (Finance)", vi: "Ngày không tiêu (Sổ chi tiêu)" },
] as const;

/** Màu thẻ thói quen — chỉ nhận token có sẵn, không nhận mã màu tự do. */
export const COLORS = ["accent", "success", "warning", "error", "info", "primary"] as const;
export type HabitColor = (typeof COLORS)[number];

export function colorVar(color: string): string {
  const safe = (COLORS as readonly string[]).includes(color) ? color : "accent";
  return `var(--color-${safe})`;
}

export function tintVar(color: string): string {
  const safe = (COLORS as readonly string[]).includes(color) ? color : "accent";
  return safe === "primary" ? "var(--color-surface-2)" : `var(--color-${safe}-tint)`;
}

export const WEEKDAY_LABELS = [
  { en: "Sun", vi: "CN" },
  { en: "Mon", vi: "T2" },
  { en: "Tue", vi: "T3" },
  { en: "Wed", vi: "T4" },
  { en: "Thu", vi: "T5" },
  { en: "Fri", vi: "T6" },
  { en: "Sat", vi: "T7" },
];

// ---------------------------------------------------------------------------
// Tính toán
// ---------------------------------------------------------------------------

/** Hình dạng tối thiểu để tính toán — dùng được cho cả bản ghi Prisma lẫn DTO. */
export interface HabitShape {
  kind: string;
  period: string;
  target: number;
  weekdays: number[];
}

export interface EntryShape {
  /** YYYY-MM-DD */
  day: string;
  amount: number;
  skipped: boolean;
}

/** Ngày này có nằm trong lịch của thói quen không. Mảng rỗng = mọi ngày. */
export function isScheduled(habit: HabitShape, iso: string): boolean {
  if (!habit.weekdays || habit.weekdays.length === 0) return true;
  return habit.weekdays.includes(weekdayOf(iso));
}

/** Cộng dồn số đã làm theo kỳ của thói quen. */
export function totalsByPeriod(habit: HabitShape, entries: EntryShape[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    const key = periodKey(e.day, habit.period);
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }
  return map;
}

/**
 * Chuỗi ngày (hoặc chuỗi kỳ) liên tiếp đã hoàn thành, tính lùi từ `today`.
 *
 * Ba quy tắc, và cả ba đều cố ý:
 * - Ngày không nằm trong lịch thì **bỏ qua**, không tính và không phá chuỗi.
 * - Ngày đánh dấu nghỉ (`skipped`) cũng bỏ qua — nghỉ có kế hoạch không phải là
 *   thất bại, và chuỗi đứt vì một ngày ốm là lý do phổ biến nhất khiến người ta
 *   bỏ hẳn ứng dụng.
 * - Kỳ hiện tại chưa đủ chỉ tiêu thì **chưa** tính là đứt: hôm nay còn chưa hết.
 */
export function computeStreak(habit: HabitShape, entries: EntryShape[], today: string): number {
  const byDay = new Map(entries.map((e) => [e.day, e]));
  const totals = totalsByPeriod(habit, entries);
  const currentKey = periodKey(today, habit.period);

  let streak = 0;
  let cursor = today;

  // 400 bước là đủ cho hơn một năm; chuỗi dài hơn thế thì con số đã đủ ý nghĩa.
  for (let i = 0; i < 400; i++) {
    const key = periodKey(cursor, habit.period);

    if (habit.period === "day") {
      const entry = byDay.get(cursor);
      if (!isScheduled(habit, cursor) || entry?.skipped) {
        cursor = addDays(cursor, -1);
        continue;
      }
      if ((entry?.amount ?? 0) >= habit.target) streak++;
      else if (key !== currentKey) break;
      cursor = addDays(cursor, -1);
      continue;
    }

    // Kỳ tuần/tháng: nhảy về ngày cuối của kỳ trước sau khi xét xong kỳ này.
    if ((totals.get(key) ?? 0) >= habit.target) streak++;
    else if (key !== currentKey) break;

    const firstOfPeriod = habit.period === "week" ? weekStart(cursor) : `${cursor.slice(0, 7)}-01`;
    cursor = addDays(firstOfPeriod, -1);
  }

  return streak;
}

/**
 * Tỷ lệ hoàn thành trong một dải ngày.
 *
 * Mẫu số chỉ đếm những ngày **có lịch và không nghỉ** — nếu không, một thói
 * quen ba buổi một tuần sẽ vĩnh viễn hiện 43% dù tuần nào cũng làm đủ.
 */
export function completionRate(
  habit: HabitShape,
  entries: EntryShape[],
  days: string[]
): { done: number; scheduled: number; percent: number } {
  const byDay = new Map(entries.map((e) => [e.day, e]));

  if (habit.period === "day") {
    let done = 0;
    let scheduled = 0;
    for (const iso of days) {
      const entry = byDay.get(iso);
      if (!isScheduled(habit, iso) || entry?.skipped) continue;
      scheduled++;
      if ((entry?.amount ?? 0) >= habit.target) done++;
    }
    return { done, scheduled, percent: scheduled ? Math.round((done / scheduled) * 100) : 0 };
  }

  const totals = totalsByPeriod(habit, entries);
  const keys = [...new Set(days.map((d) => periodKey(d, habit.period)))];
  const done = keys.filter((k) => (totals.get(k) ?? 0) >= habit.target).length;
  return { done, scheduled: keys.length, percent: keys.length ? Math.round((done / keys.length) * 100) : 0 };
}

/** "6 / 8 cốc" — phần chữ do component dịch, đây chỉ ghép số. */
export function formatProgress(amount: number, target: number): string {
  return `${amount.toLocaleString("vi-VN")} / ${target.toLocaleString("vi-VN")}`;
}

/** Khoảng đã nhịn được của thói quen `quit`, tách sẵn thành ngày/giờ/phút/giây. */
export function elapsedParts(since: Date | string, now: Date = new Date()) {
  const ms = Math.max(0, now.getTime() - new Date(since).getTime());
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
