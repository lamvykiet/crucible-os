import type { ReactNode } from "react";

// Tiêu đề của một MỤC LỚN trong tab ("Tuần này", "Theo ngày", "Thẻ tín dụng").
//
// Một khuôn thay cho ba kiểu cũ (c-h3 + icon 24px, c-h3 trần `mt-8 mb-6`, c-h5
// `mb-4`). globals.css kéo một đường mảnh tan dần sau mọi `h3.c-h3`; ở đây h3
// nằm trong khối `flex-1` nên đường đó chạy tới sát cụm nút bên phải thay vì
// cụt lại thành một mẩu ngắn. Đừng tự vẽ thêm `border-b` cạnh tiêu đề.
//
// Tiêu đề của CẢ TAB thì không dùng cái này: `<h2 className="c-h2 c-page-title">`.

export default function SectionHeader({
  title,
  icon,
  subtitle,
  actions,
  className = "",
}: {
  title: ReactNode;
  /** Icon lucide cỡ 20. */
  icon?: ReactNode;
  /** Một dòng phạm vi / ghi chú dưới tiêu đề. */
  subtitle?: ReactNode;
  /** Nút đi tiếp, bộ lọc — nằm bên phải, xuống dòng khi hẹp. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-3 ${className}`}>
      <div className="min-w-0 flex-1 basis-48">
        <h3 className="c-h3 text-[var(--color-text)]">
          {icon && (
            <span className="flex-none text-[var(--color-text-muted)]" aria-hidden>
              {icon}
            </span>
          )}
          <span className="min-w-0">{title}</span>
        </h3>
        {subtitle && <p className="mt-1 text-xs text-[var(--color-text-faint)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
