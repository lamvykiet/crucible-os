"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import GlassIcon, { type GlassTone } from "@/components/GlassIcon";
import type { LucideIcon } from "lucide-react";

/**
 * Thẻ kính của hệ Kính: nền kính MỘT lớp (`.c-glass`, blur ở `::before`), đệm
 * 24px, đầu thẻ gồm GlassIcon · tiêu đề (câu kết luận) · dòng phụ · điều khiển.
 *
 * Thẻ chỉ có MỘT hành động thì bấm cả thẻ (`onOpen`): tiêu đề là nút thật để bàn
 * phím và trình đọc màn hình tới được; bấm vào vùng trống của thẻ cũng kích nó,
 * còn nút/ô nhập bên trong (công tắc kỳ, nút phụ) giữ nguyên việc của chúng.
 * Không `transform` trên thẻ — modal có thể render bên trong cây của trang.
 */
export function GlassCard({
  children,
  className = "",
  onOpen,
  variant,
  label,
}: {
  children: ReactNode;
  className?: string;
  onOpen?: () => void;
  variant?: "stat" | "solid";
  label?: string;
}) {
  const click = (e: MouseEvent<HTMLDivElement>) => {
    if (!onOpen) return;
    if ((e.target as HTMLElement).closest("button, a, input, select, label, [role=group]")) return;
    onOpen();
  };
  return (
    <section
      className={`c-glass c-gcard ${onOpen ? "link" : ""} ${variant ?? ""} ${className}`}
      onClick={click}
      aria-label={label}
    >
      {children}
    </section>
  );
}

export function CardHead({
  icon,
  tone,
  title,
  subtitle,
  onOpen,
  sum,
  actions,
  wrap,
}: {
  icon?: LucideIcon;
  tone?: GlassTone;
  title: ReactNode;
  subtitle?: ReactNode;
  onOpen?: () => void;
  /** Số tổng bên phải (cột 6 tháng). */
  sum?: ReactNode;
  actions?: ReactNode;
  wrap?: boolean;
}) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen?.();
    }
  };
  return (
    <div className={`c-hd ${wrap ? "wrap" : ""}`}>
      {icon && tone && <GlassIcon icon={icon} tone={tone} />}
      <div className="c-hd-grow">
        {onOpen ? (
          <button type="button" className="c-hd-t" onClick={onOpen} onKeyDown={onKey}>
            {title}
            <ChevronRight aria-hidden />
          </button>
        ) : (
          <div className="c-hd-t">{title}</div>
        )}
        {subtitle && <div className="c-hd-s">{subtitle}</div>}
      </div>
      {sum && <div className="c-hd-sum">{sum}</div>}
      {actions && <div className="c-hd-act">{actions}</div>}
    </div>
  );
}

/** Công tắc phân đoạn (Tuần/Tháng/Năm, Chi phí/Doanh thu) — dùng `.c-seg`. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="c-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`c-seg-opt ${o.value === value ? "active" : ""}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
