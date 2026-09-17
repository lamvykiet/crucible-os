"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarRange, CheckSquare, NotebookPen, Timer } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Thanh chuyển màn trong module Thói quen.
 *
 * Mỗi màn là một URL riêng (không phải tab trong cùng một trang) để nút Back
 * của trình duyệt đi đúng một bước, và để mở thẳng /habits/timer từ màn hình
 * chính của điện thoại được.
 *
 * Trên khổ 375px dải này cuộn ngang; `.hide-scrollbar` bỏ thanh cuộn vì nó ăn
 * mất chiều cao và đẩy nội dung xuống.
 */
export default function HabitsNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const tabs = [
    { href: "/habits", icon: CheckSquare, label: t("Today", "Hôm nay") },
    { href: "/habits/reports", icon: BarChart3, label: t("Reports", "Báo cáo") },
    { href: "/habits/schedule", icon: CalendarRange, label: t("Schedule", "Lịch tuần") },
    { href: "/habits/journal", icon: NotebookPen, label: t("Journal", "Nhật ký") },
    { href: "/habits/timer", icon: Timer, label: t("Timer", "Bấm giờ") },
  ];

  return (
    <nav className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
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
