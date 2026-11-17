import type { PillBar } from "@/components/charts/PillBars";

/**
 * Dựng dữ liệu cho `PillBars` từ một chuỗi có `name`: cột xám, ĐÚNG MỘT cột nhấn
 * (`accent` = vị trí trong chuỗi, -1 = không cột nào). Chuỗi dày (ngày trong
 * tháng) chỉ ghi số ở cột nhấn (`labelAll: false`) và chỉ ghi nhãn trục ở các
 * ngày 1, 5, 10… (`xLabel`). Ngày không có số liệu (v ≤ 0) là `null` → cột thấp,
 * không vẽ số 0 giả.
 */
export function pillSeries<T extends { name: string }>(
  items: T[],
  value: (d: T) => number,
  lab: (v: number) => string,
  opts: {
    accent: number;
    xLabel?: (d: T, i: number) => string;
    sxLabel?: (d: T, i: number) => string | undefined;
    labelAll?: boolean;
    partialLast?: boolean;
  },
): { data: PillBar[]; max: number } {
  const vals = items.map(value);
  const peak = vals.reduce((m, v) => (v > m ? v : m), 0);
  const data: PillBar[] = items.map((d, i) => ({
    key: `${d.name}-${i}`,
    x: opts.xLabel ? opts.xLabel(d, i) : d.name,
    sx: opts.sxLabel ? opts.sxLabel(d, i) : undefined,
    v: vals[i] > 0 ? vals[i] : null,
    lab: lab(vals[i]),
    accent: i === opts.accent,
    partial: !!opts.partialLast && i === items.length - 1,
    bare: !opts.labelAll && i !== opts.accent,
  }));
  return { data, max: peak > 0 ? peak * 1.12 : 1 };
}
