"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, FileText, Database, GraduationCap, LayoutDashboard } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Thanh điều hướng dưới cùng cho màn hình nhỏ.
 *
 * Trước đây không có: `MainLayoutWrapper` render thẳng một flex row với
 * `<Sidebar />` rộng 256px luôn hiển thị, nên trên điện thoại 390px sidebar
 * nuốt hai phần ba màn hình và nội dung bị ép vào một dải hẹp.
 *
 * Dùng `.c-bottomnav` / `.c-bottomnav-item` có sẵn trong design system — chúng
 * đã đặt sẵn vùng chạm tối thiểu 44px và cộng `env(safe-area-inset-bottom)` để
 * không bị thanh Home của iPhone che.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/", icon: LayoutDashboard, label: t("Home", "Trang chủ") },
    { href: "/knowledge", icon: Database, label: t("Knowledge", "Kiến thức") },
    { href: "/finance", icon: FileText, label: t("Finance", "Tài chính") },
    { href: "/learning", icon: GraduationCap, label: t("Learning", "Học tập") },
    { href: "/settings", icon: Settings, label: t("Settings", "Cài đặt") },
  ];

  return (
    <nav className="c-bottomnav md:hidden fixed bottom-0 left-0 right-0 z-50">
      {items.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`c-bottomnav-item ${active ? "active" : ""}`}>
            <Icon size={20} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
