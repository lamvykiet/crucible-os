"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  /** Đi sang trang khác. Dùng `Link` để giữ được bấm chuột giữa và mở tab mới. */
  href?: string;
  /** Đổi trạng thái ngay trong trang. Không có cả hai thì đây là mục hiện tại. */
  onClick?: () => void;
}

/**
 * Dải đường dẫn kiểu thư mục: Tủ sách › Tên sách › Unit.
 *
 * Thay cho mấy nút "Quay lại" xếp chồng. Nút quay lại chỉ lùi được từng bước
 * một, mà từ trong một unit muốn về thẳng tủ sách thì phải bấm hai lần và không
 * nhìn ra mình đang ở tầng nào. Dải này vừa nói rõ vị trí vừa cho nhảy thẳng.
 *
 * Mục cuối là chỗ đang đứng nên không bấm được — một dòng dẫn mà bấm vào chính
 * nó lại không đi đâu thì gây hiểu nhầm.
 */
export default function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-0.5 -ml-1">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center min-w-0">
            {i > 0 && (
              <ChevronRight
                size={14}
                className="flex-none mx-0.5 text-[var(--color-text-faint)]"
                aria-hidden="true"
              />
            )}
            {last || (!item.onClick && !item.href) ? (
              <span
                aria-current="page"
                className="c-stat-label font-medium text-[var(--color-text)] truncate max-w-[16rem] px-1"
              >
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="c-stat-label px-1 py-1 rounded truncate max-w-[12rem] hover:text-[var(--color-primary)] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <button
                onClick={item.onClick}
                className="c-stat-label px-1 py-1 rounded truncate max-w-[12rem] hover:text-[var(--color-primary)] transition-colors"
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
