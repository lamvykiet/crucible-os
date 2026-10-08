// Bộ thiết lập dùng chung cho MỌI biểu đồ — xem docs/bieu-do.md.
//
// Ba luật cốt lõi (Storytelling with Data):
//   1. Mặc định là xám. Màu nhấn (`VIZ.accent`) chỉ cho điểm câu chuyện nói tới
//      — tháng đang xem, hôm nay, khoản tăng mạnh nhất.
//   2. Bỏ hết thứ không phải dữ liệu: lưới dọc, đường trục, vạch chia, viền.
//      Lưới ngang nếu có thì một nét mảnh liền.
//   3. Ghi nhãn thẳng lên dữ liệu thay vì bắt mắt chạy qua chạy lại với chú giải.

/** Màu dữ liệu, đều là CSS var nên tự đổi theo sáng/tối. */
export const VIZ = {
  accent: "var(--viz-accent)",
  muted: "var(--viz-muted)",
  ghost: "var(--viz-ghost)",
  other: "var(--viz-other)",
  ink: "var(--viz-ink)",
  grid: "var(--viz-grid)",
  surface: "var(--color-surface)",
  /** Chỉ khi các chuỗi LÀ đối tượng so sánh. Thứ tự cố định — màu đi theo đối
   *  tượng, không theo thứ hạng; quá 4 thì gộp phần đuôi vào "Khác". */
  cat: ["var(--viz-cat-1)", "var(--viz-cat-2)", "var(--viz-cat-3)", "var(--viz-cat-4)"] as const,
  good: "var(--color-success)",
  bad: "var(--color-error)",
} as const;

/** Màu thứ i của bảng phân loại; ngoài 4 màu là "Khác". */
export const catColor = (i: number) => (i >= 0 && i < VIZ.cat.length ? VIZ.cat[i] : VIZ.other);

/** Bậc nhạt của một màu (khúc phụ của CÙNG một đối tượng — thưởng so với lương). */
export const soft = (color: string, pct = 45) =>
  `color-mix(in srgb, ${color} ${pct}%, var(--color-surface))`;

/** Lưới: chỉ đường ngang, nét mảnh liền. */
export const GRID = { vertical: false, stroke: "var(--viz-grid)" } as const;

/** Trục Y gọn: không đường trục, không vạch, 4 mốc tròn. */
export const yAxis = (format: (v: number) => string, width = 46) =>
  ({
    axisLine: false,
    tickLine: false,
    width,
    tickCount: 4,
    tick: { fontSize: 11, fill: "var(--color-text-faint)" },
    tickFormatter: (v: number | string) => format(Number(v)),
  }) as const;

/** Trục X cho nhãn chữ (không phải tháng — tháng dùng `monthAxis`). */
export const xAxis = { axisLine: false, tickLine: false, tick: { fontSize: 11, fill: "var(--color-text-faint)" } } as const;

/** Cột: tối đa 24px, đầu bo 4px, gốc vuông. Cột ngang dùng `BAR_H`. */
export const BAR = { maxBarSize: 24, radius: [4, 4, 0, 0] as [number, number, number, number] };
export const BAR_H = { maxBarSize: 18, radius: [0, 4, 4, 0] as [number, number, number, number] };
/** Khúc cột chồng: khe 2px màu nền giữa các khúc thay cho viền. */
export const STACK_GAP = { stroke: "var(--color-surface)", strokeWidth: 2 } as const;

/** Đường: 2px, không chấm ở mọi điểm; chấm hiện khi rê chuột, có vòng nền 2px. */
export const LINE = {
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 5, strokeWidth: 2, stroke: "var(--color-surface)" },
  type: "monotone" as const,
};

/** Tooltip: con trỏ là một dải nền nhạt, không phải vạch đen. */
export const TOOLTIP = {
  cursor: { fill: "var(--viz-ghost)", fillOpacity: 0.45 },
  wrapperStyle: { outline: "none" },
} as const;
export const TOOLTIP_LINE = {
  cursor: { stroke: "var(--viz-muted)", strokeWidth: 1 },
  wrapperStyle: { outline: "none" },
} as const;

/** % thay đổi; null khi kỳ gốc bằng 0 (không chia được — gọi là "mới"). */
export function pctChange(now: number, before: number) {
  if (!before) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}

/**
 * Nhãn chỉ ở MỘT điểm (thường là điểm cuối hoặc điểm đang xem) — đừng bao giờ
 * ghi số lên mọi điểm. Dùng làm `label` của <Line>/<Bar>:
 *   label={labelAt(data.length - 1, (v) => money(v))}
 */
export function labelAt(index: number, format: (v: number) => string, opts: { dy?: number; anchor?: "start" | "middle" | "end" } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (props: any) => {
    if (props.index !== index || props.value === undefined || props.value === null) return null;
    const x = Number(props.x) + (props.width ? Number(props.width) / 2 : 0);
    const y = Number(props.y) + (opts.dy ?? -8);
    return (
      <text x={x} y={y} textAnchor={opts.anchor ?? "middle"} fontSize={11} fontWeight={700} fill="var(--color-text)">
        {format(Number(props.value))}
      </text>
    );
  };
  return render;
}
