import type { ReactNode } from "react";

// Ô số liệu ĐỨNG RIÊNG trên tấm nền (thẻ nổi soft UI) — một khuôn cho mọi tab.
//
// Trước đây mỗi tab tự viết thẻ này bằng tay (khoảng 25 bản, ba dáng khác
// nhau: có icon tint màu, không icon, cỡ nhỏ), nên hàng bốn ô mang bốn màu và
// không còn điểm nhấn. Luật v3: SỐ MỨC (thu, chi, dư nợ, giá trị) là màu mực;
// màu chỉ cho tốt/xấu — số âm, vượt ngân sách — và cho chênh lệch qua `Delta`.
// Icon luôn trung tính.
//
// Ô số liệu lồng TRONG một thẻ khác thì dùng `StatTile` (ChartCard.tsx).

export type MetricTone = "neutral" | "good" | "bad" | "faint";

const TONE: Record<MetricTone, string> = {
  neutral: "text-[var(--color-text)]",
  good: "text-[var(--color-success)]",
  bad: "text-[var(--color-error)]",
  faint: "text-[var(--color-text-faint)]",
};

export default function MetricCard({
  label,
  value,
  icon,
  tone = "neutral",
  aside,
  delta,
  note,
  size = "md",
  children,
  className = "",
}: {
  /** Nhãn — hiện VIẾT HOA bằng CSS, chuỗi `t()` giữ chữ thường. */
  label: ReactNode;
  /** Con số đã định dạng. Không tính được thì truyền "—" kèm `tone="faint"`. */
  value: ReactNode;
  /** Icon lucide (cỡ 18 cho `md`, 16 cho `sm`). Luôn trung tính, không tô màu. */
  icon?: ReactNode;
  /** `good`/`bad` CHỈ khi con số tự nó là tin tốt/xấu (dòng tiền âm, vượt hạn mức). */
  tone?: MetricTone;
  /** Chữ nhỏ góc phải hàng nhãn ("09/11 – 15/11 · 3 giao dịch"). */
  aside?: ReactNode;
  /** `<Delta … />` — nằm ngay dưới con số. */
  delta?: ReactNode;
  /** Một dòng giải thích dưới con số ("thu − tiền ra"). */
  note?: ReactNode;
  /** `sm`: hàng 5 ô / lưới 2 cột trên điện thoại. */
  size?: "md" | "sm";
  /** Nội dung thêm dưới cùng (thanh tiến độ, danh sách ngắn). */
  children?: ReactNode;
  className?: string;
}) {
  const sm = size === "sm";
  return (
    <div
      className={`bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] flex flex-col gap-2 min-w-0 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span
            className={`flex-none flex items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] ${
              sm ? "w-8 h-8" : "w-10 h-10"
            }`}
            aria-hidden
          >
            {icon}
          </span>
        )}
        <span className="c-overline min-w-0 flex-1 text-[var(--color-text-muted)]">{label}</span>
        {aside && <span className="flex-none text-xs text-[var(--color-text-faint)]">{aside}</span>}
      </div>
      <div className={`${sm ? "c-metric-value-sm" : "c-metric-value"} ${TONE[tone]}`}>{value}</div>
      {(delta || note) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-faint)]">
          {delta}
          {note && <span>{note}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
