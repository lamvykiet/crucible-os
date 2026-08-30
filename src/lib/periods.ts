// Tính mốc kỳ cho phần so sánh tuần/tháng/năm.
//
// Mọi mốc tính bằng UTC, cùng quy ước với các route finance khác: cột
// `Transaction.date` lưu ngày lịch ở mốc 00:00 UTC, không có phần giờ. Client
// gửi lên ngày "hôm nay" theo lịch máy của người dùng (xem `todayLocalIso`),
// nên tuần này vẫn là tuần của người dùng chứ không phải của máy chủ.
//
// SO SÁNH PHẢI CÙNG SỐ NGÀY.
//
// Hôm nay 30/08 mà đem 30 ngày đầu tháng 8 so với trọn 31 ngày tháng 7 thì
// tháng 8 luôn trông tiết kiệm hơn, và càng đầu tháng càng sai — ngày mùng 2 sẽ
// báo "giảm 95%". Nên mọi kỳ đối chiếu đều bị cắt về đúng số ngày đã trôi qua
// của kỳ hiện tại. Kỳ đã đóng (xem tháng cũ) thì số ngày trôi qua bằng trọn kỳ,
// và phép so trở lại nguyên vẹn.

export type PeriodKind = "week" | "month" | "year";

export interface Window {
  /** Nhãn ngắn: "2026-W35", "2026-08", "2026". */
  label: string;
  /** Đầu kỳ, bao gồm. */
  from: Date;
  /** Mốc cắt, KHÔNG bao gồm — đã cắt theo số ngày đã trôi qua. */
  to: Date;
  /** Cuối kỳ trọn vẹn, không bao gồm. Bằng `to` khi kỳ đã đóng. */
  fullTo: Date;
}

const DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const pad = (n: number) => String(n).padStart(2, "0");

export function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = utc(y, m - 1, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? dt
    : null;
}

/** Thứ Hai đầu tuần chứa `d`. Tuần bắt đầu từ thứ Hai theo ISO-8601. */
export function startOfWeek(d: Date): Date {
  const dow = (d.getUTCDay() + 6) % 7; // CN=6, T2=0
  return new Date(d.getTime() - dow * DAY);
}

/** Số tuần ISO — dùng làm nhãn, không dùng để tính toán. */
function isoWeekLabel(d: Date): string {
  const t = new Date(d.getTime());
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
  const week1 = utc(t.getUTCFullYear(), 0, 4);
  const n =
    1 +
    Math.round(
      ((t.getTime() - week1.getTime()) / DAY -
        3 +
        ((week1.getUTCDay() + 6) % 7)) /
        7
    );
  return `${t.getUTCFullYear()}-W${pad(n)}`;
}

function startOf(kind: PeriodKind, d: Date): Date {
  if (kind === "week") return startOfWeek(d);
  if (kind === "month") return utc(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return utc(d.getUTCFullYear(), 0, 1);
}

function endOf(kind: PeriodKind, start: Date): Date {
  if (kind === "week") return new Date(start.getTime() + 7 * DAY);
  if (kind === "month")
    return utc(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  return utc(start.getUTCFullYear() + 1, 0, 1);
}

function label(kind: PeriodKind, start: Date): string {
  if (kind === "week") return isoWeekLabel(start);
  if (kind === "month")
    return `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`;
  return String(start.getUTCFullYear());
}

/** Lùi một kỳ: tuần trước / tháng trước / năm trước. */
function shiftBack(kind: PeriodKind, start: Date): Date {
  if (kind === "week") return new Date(start.getTime() - 7 * DAY);
  if (kind === "month")
    return utc(start.getUTCFullYear(), start.getUTCMonth() - 1, 1);
  return utc(start.getUTCFullYear() - 1, 0, 1);
}

/**
 * Cùng kỳ năm ngoái.
 *
 * Với tuần thì lùi 364 ngày (52 tuần chẵn) chứ không lùi 365: 364 giữ đúng thứ
 * trong tuần, nên thứ Hai vẫn khớp thứ Hai. Lùi 365 sẽ lệch một ngày và đem
 * tuần bắt đầu từ Chủ nhật so với tuần bắt đầu từ thứ Hai.
 */
function shiftYear(kind: PeriodKind, start: Date): Date {
  if (kind === "week") return new Date(start.getTime() - 364 * DAY);
  if (kind === "month")
    return utc(start.getUTCFullYear() - 1, start.getUTCMonth(), 1);
  return utc(start.getUTCFullYear() - 1, 0, 1);
}

export interface PeriodSet {
  kind: PeriodKind;
  /**
   * `lastYear` là TRỌN kỳ chứ không cắt.
   *
   * Chỉ đúng với kiểu `year`: ở đó "kỳ liền trước" và "cùng kỳ năm ngoái" là
   * một — cùng là năm ngoái tính tới cùng ngày — nên cột thứ ba lặp lại vô ích.
   * Đổi nó thành TRỌN năm ngoái thì trả lời được câu khác: năm nay đã đi được
   * bao nhiêu phần so với cả năm ngoái. Giao diện phải đổi nhãn theo cờ này,
   * gọi là "cùng kỳ" thì thành nói dối.
   */
  lastYearIsFullPeriod: boolean;
  /** Số ngày đã trôi qua của kỳ hiện tại, dùng cắt các kỳ đối chiếu. */
  elapsedDays: number;
  /** Kỳ hiện tại đã đóng chưa. */
  isComplete: boolean;
  current: Window;
  previous: Window;
  lastYear: Window;
}

/**
 * Ba cửa sổ để so sánh, đã cắt về cùng số ngày.
 *
 * `anchor` là ngày đang đứng (thường là hôm nay theo lịch người dùng).
 */
export function buildPeriods(kind: PeriodKind, anchor: Date): PeriodSet {
  const curStart = startOf(kind, anchor);
  const curFullEnd = endOf(kind, curStart);

  // Ngày neo nằm trong kỳ đang chạy thì cắt tới hết ngày neo; kỳ đã đóng thì
  // lấy trọn.
  const anchorNext = new Date(anchor.getTime() + DAY);
  const isComplete = anchorNext >= curFullEnd;
  const curEnd = isComplete ? curFullEnd : anchorNext;
  const elapsedDays = Math.round((curEnd.getTime() - curStart.getTime()) / DAY);

  const make = (start: Date): Window => {
    const full = endOf(kind, start);
    const cut = new Date(start.getTime() + elapsedDays * DAY);
    return {
      label: label(kind, start),
      from: start,
      // Kỳ ngắn hơn (tháng 2 chẳng hạn) thì không kéo dài quá kỳ đó.
      to: cut < full ? cut : full,
      fullTo: full,
    };
  };

  const lastYearStart = shiftYear(kind, curStart);
  const lastYearFull: Window = {
    label: label(kind, lastYearStart),
    from: lastYearStart,
    to: endOf(kind, lastYearStart),
    fullTo: endOf(kind, lastYearStart),
  };

  return {
    kind,
    lastYearIsFullPeriod: kind === "year",
    elapsedDays,
    isComplete,
    current: { label: label(kind, curStart), from: curStart, to: curEnd, fullTo: curFullEnd },
    previous: make(shiftBack(kind, curStart)),
    lastYear: kind === "year" ? lastYearFull : make(lastYearStart),
  };
}

/** Phần trăm thay đổi. `null` khi kỳ gốc bằng 0 — chia cho 0 không có nghĩa. */
export function pctChange(current: number, base: number): number | null {
  if (base === 0) return null;
  return Math.round(((current - base) / Math.abs(base)) * 1000) / 10;
}
