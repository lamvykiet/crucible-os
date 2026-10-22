"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { MODULES } from "@/lib/modules";

/**
 * Thanh chuyển màn trong module Thói quen.
 *
 * Mỗi màn là một URL riêng (không phải tab trong cùng một trang) để nút Back
 * của trình duyệt đi đúng một bước, và để mở thẳng /habits/timer từ màn hình
 * chính của điện thoại được.
 *
 * Trên khổ 375px dải này cuộn ngang; `.hide-scrollbar` bỏ thanh cuộn vì nó ăn
 * mất chiều cao và đẩy nội dung xuống.
 *
 * Chỉ hiện ở điện thoại: từ 768px các tab này nằm trên thanh trên (`TopNav`).
 * Danh sách lấy từ `src/lib/modules.tsx` — sửa ở đó.
 */
export default function HabitsNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const tabs = (MODULES.find((m) => m.key === "habits")?.tabs ?? []).map((tab) => ({
    href: tab.href, icon: tab.icon, label: t(tab.en, tab.vi),
  }));

  return (
    <nav className="flex md:hidden gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = href === "/habits" ? pathname === "/habits" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex-none inline-flex items-center gap-2 px-3.5 h-11 rounded-full text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Icon size={16} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
