"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, GraduationCap, LayoutDashboard, Repeat, HeartPulse } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

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

  const items = [
    { href: "/", icon: LayoutDashboard, label: t("Home", "Tổng quan") },
    { href: "/finance", icon: Wallet, label: t("Finance", "Tài chính") },
    { href: "/learning", icon: GraduationCap, label: t("Learning", "Học tập") },
    { href: "/habits", icon: Repeat, label: t("Habits", "Thói quen") },
    { href: "/health", icon: HeartPulse, label: t("Health", "Sức khoẻ") },
  ];

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
