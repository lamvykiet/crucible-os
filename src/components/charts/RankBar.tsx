import type { ReactNode } from "react";
import { VIZ } from "@/lib/viz";

// Thanh ngang vẽ bằng div trên một thước chung — xem docs/bieu-do.md mục 2
// ("cột ngang xếp hạng", "cột kỳ này + vạch mốc kỳ trước").
//
// Gom bốn bản trùng nhau: `HBar` (DashboardTab), `RankBar` (WeekPanel),
// `RankList` (ExpenseTab), `Bullet` (IncomeTab). Đừng viết bản thứ năm.

/**
 * Một thanh. `scale` là giá trị lớn nhất của CẢ danh sách (thước chung), không
 * phải của riêng dòng này. `mark` là vạch mốc dọc trên cùng thước: kỳ trước,
 * hạn mức ngân sách. Truyền `mark` (kể cả 0) thì thanh cao 20px để chừa chỗ
 * cho vạch — các dòng trong một danh sách nên cùng có hoặc cùng không có.
 */
export default function RankBar({
  value,
  scale,
  color = VIZ.muted,
  mark,
}: {
  value: number;
  scale: number;
  color?: string;
  mark?: number;
}) {
  const s = Math.max(1, scale);
  const pos = (v: number) => `${Math.min(100, (Math.max(0, v) / s) * 100)}%`;
  const withMark = mark !== undefined;
  return (
    <div className={`relative w-full ${withMark ? "h-5" : "h-3"}`} aria-hidden>
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-r-[4px]"
        style={{ width: pos(value), minWidth: value > 0 ? 3 : 0, background: color }}
      />
      {withMark && mark > 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 rounded-full"
          style={{ left: `calc(${pos(mark)} - 1px)`, background: VIZ.ink }}
        />
      )}
    </div>
  );
}

/** Kỳ này + vạch mốc kỳ trước (bullet). */
export function Bullet({
  now,
  before,
  scale,
  color = VIZ.muted,
}: {
  now: number;
  before: number;
  scale: number;
  color?: string;
}) {
  return <RankBar value={now} scale={scale} color={color} mark={before} />;
}

export interface RankRow {
  key: string;
  name: ReactNode;
  amount: number;
  /** Mặc định `VIZ.muted`; dòng câu chuyện nói tới thì `VIZ.accent`. */
  color?: string;
  /** Tên in đậm (dòng đang là trọng tâm). */
  strong?: boolean;
  /** Chữ nhỏ sau con số ("38%"). */
  note?: ReactNode;
  /** Vạch mốc của dòng (kỳ trước, hạn mức). */
  mark?: number;
  /** Dòng phụ dưới thanh (`<Delta … />`, "còn 684k"). */
  sub?: ReactNode;
}

/**
 * Danh sách xếp hạng: tên và số ở dòng trên, thanh mảnh ở dòng dưới — vừa cả
 * thẻ hẹp một phần ba lẫn khổ 375px, số luôn thấy trọn. `scale` bỏ trống thì
 * lấy giá trị lớn nhất trong `rows` (kể cả `mark`).
 */
export function RankList({
  rows,
  format,
  scale,
}: {
  rows: RankRow[];
  format: (v: number) => string;
  scale?: number;
}) {
  const s = scale ?? Math.max(1, ...rows.map((r) => Math.max(r.amount, r.mark ?? 0)));
  const anyMark = rows.some((r) => r.mark !== undefined);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`min-w-0 truncate text-sm text-[var(--color-text)] ${r.strong ? "font-bold" : ""}`}
              title={typeof r.name === "string" ? r.name : undefined}
            >
              {r.name}
            </span>
            <span className="flex-none text-sm font-bold tabular-nums text-[var(--color-text)]">
              {format(r.amount)}
              {r.note && <span className="ml-1.5 text-xs font-normal text-[var(--color-text-faint)]">{r.note}</span>}
            </span>
          </div>
          <RankBar value={r.amount} scale={s} color={r.color} mark={anyMark ? (r.mark ?? 0) : undefined} />
          {r.sub && <div className="text-xs text-[var(--color-text-faint)]">{r.sub}</div>}
        </li>
      ))}
    </ul>
  );
}
