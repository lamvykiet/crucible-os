"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { MODULES } from "@/lib/modules";

/**
 * Dock kính đáy màn hình cho điện thoại (hệ v3): cách mép 12px, bo 26px,
 * icon 22px + chữ 11px, mục chọn nền trắng 18%.
 *
 * Đúng **năm** mục, không hơn: mục thứ sáu làm nhãn bị bóp và vùng chạm tụt
 * dưới 44px ở khổ 375px. Knowledge, Cài đặt, ngôn ngữ, sáng/tối nằm ở
 * `MobileTopBar`.
 *
 * `.c-bottomnav` cộng `env(safe-area-inset-bottom)` để không bị thanh Home của
 * iPhone che.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  // Năm mục có `dock: true` trong src/lib/modules.tsx.
  const items = MODULES.filter((m) => m.dock).map((m) => ({ href: m.href, icon: m.icon, label: t(m.en, m.vi) }));

  return (
    <nav className="c-bottomnav md:hidden fixed z-50">
      {items.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`c-bottomnav-item ${active ? "active" : ""}`}>
            <Icon size={22} strokeWidth={1.6} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
