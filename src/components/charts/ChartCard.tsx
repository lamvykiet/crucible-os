"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

// Khung chung cho mọi biểu đồ — xem docs/bieu-do.md.
//
// Tiêu đề là MỘT CÂU NÓI KẾT LUẬN ("Tháng này chi ít hơn tháng trước 30%"),
// không phải tên biểu đồ ("Chi tiêu theo tháng"). Tên biểu đồ xuống dòng phụ.
// Người đọc biết phải nhìn gì trước khi nhìn. Chú giải (nếu cần) nằm ngay dưới
// tiêu đề, căn trái — chỗ mắt đi qua trước khi tới dữ liệu, không phải dưới đáy.

export interface SeriesKeyItem {
  label: string;
  color: string;
  /** bar: ô vuông · line: vạch liền · dash: vạch đứt · tick: vạch dọc (mốc so sánh) */
  shape?: "bar" | "line" | "dash" | "tick";
}

export function SeriesKey({ items }: { items: SeriesKeyItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--color-text-muted)]">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.shape === "line" ? (
            <span className="w-3.5 h-0.5 rounded-full" style={{ background: it.color }} aria-hidden />
          ) : it.shape === "dash" ? (
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: it.color }} aria-hidden />
          ) : it.shape === "tick" ? (
            <span className="w-0.5 h-3 rounded-full" style={{ background: it.color }} aria-hidden />
          ) : (
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: it.color }} aria-hidden />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

export default function ChartCard({
  title,
  subtitle,
  keys,
  action,
  footnote,
  children,
  className = "",
}: {
  /** Câu kết luận. */
  title: ReactNode;
  /** Biểu đồ vẽ cái gì, đơn vị, khoảng thời gian. */
  subtitle?: ReactNode;
  keys?: SeriesKeyItem[];
  /** Nút/điều khiển góc phải (ít dùng — bộ lọc nên nằm ngoài thẻ). */
  action?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] flex flex-col gap-4 min-w-0 ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="c-h5 text-[var(--color-text)] text-balance">{title}</h4>
          {subtitle && <p className="text-xs text-[var(--color-text-faint)] mt-1">{subtitle}</p>}
        </div>
        {action}
      </header>
      {keys && keys.length > 0 && <SeriesKey items={keys} />}
      {children}
      {footnote && <p className="text-[11px] text-[var(--color-text-faint)]">{footnote}</p>}
    </section>
  );
}

/**
 * Mũi tên tăng/giảm có chữ, màu theo "tăng là tốt hay xấu" (chi tăng là xấu,
 * thu tăng là tốt). Màu trạng thái luôn đi kèm mũi tên — không bao giờ chỉ
 * dựa vào màu.
 */
export function Delta({
  pct,
  upIsGood,
  vs,
}: {
  pct: number | null;
  upIsGood: boolean;
  /** "so tháng trước" — nói rõ so với kỳ nào. */
  vs?: string;
}) {
  const { t } = useLanguage();
  const tail = vs ? <span className="font-normal text-[var(--color-text-faint)]"> {vs}</span> : null;
  // Kỳ gốc bằng 0: chỉ ghi "mới" — "mới so 0" thì thừa chữ.
  if (pct === null)
    return <span className="text-[11px] text-[var(--color-text-faint)]">{t("new", "mới")}</span>;
  if (pct === 0)
    return (
      <span className="text-[11px] text-[var(--color-text-faint)]">
        ±0%{tail}
      </span>
    );
  const up = pct > 0;
  const good = up === upIsGood;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
        good ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
      }`}
    >
      {up ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />}
      <span className="tabular-nums">{Math.abs(pct)}%</span>
      {tail}
    </span>
  );
}

/** Ô số liệu: nhãn · giá trị (chữ số tỷ lệ, không tabular) · so sánh · ghi chú. */
export function StatTile({
  label,
  value,
  delta,
  note,
  emphasis = false,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  note?: ReactNode;
  /** Ô đang là "câu chuyện" — chữ đậm hơn, các ô còn lại lùi. */
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface-2)] p-4 min-w-0">
      <div className="text-[11px] text-[var(--color-text-muted)]">{label}</div>
      <div
        className={`mt-1 font-bold ${
          emphasis ? "text-xl text-[var(--color-text)]" : "text-base text-[var(--color-text-muted)]"
        }`}
      >
        {value}
      </div>
      {(delta || note) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--color-text-faint)]">
          {delta}
          {note && <span>{note}</span>}
        </div>
      )}
    </div>
  );
}
