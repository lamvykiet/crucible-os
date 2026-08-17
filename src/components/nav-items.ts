import { Settings, FileText, Database, GraduationCap, LayoutDashboard } from "lucide-react";

type Translate = (en: string, vi: string) => string;

/** Nguồn duy nhất cho điều hướng chính. Sidebar (desktop) và BottomNav (mobile)
 *  cùng đọc từ đây để hai bên không lệch nhau khi thêm/bớt mục.
 *
 *  `short` là nhãn cho bottom nav — trên màn 375px mỗi ô chỉ rộng ~53px nên nhãn
 *  dài như "Knowledge Hub" sẽ bị cắt. */
export function getNavItems(t: Translate) {
  return [
    { name: t("Home", "Trang chủ"), short: t("Home", "Nhà"), href: "/", icon: LayoutDashboard },
    { name: t("Knowledge Hub", "Knowledge Hub"), short: t("Knowledge", "Kiến thức"), href: "/knowledge", icon: Database },
    { name: t("Finance OS", "Sổ chi tiêu"), short: t("Finance", "Chi tiêu"), href: "/finance", icon: FileText },
    { name: t("Learning Hub", "Learning Hub"), short: t("Learning", "Học tập"), href: "/learning", icon: GraduationCap },
    { name: t("Settings", "Cài đặt"), short: t("Settings", "Cài đặt"), href: "/settings", icon: Settings },
  ];
}

export function isNavActive(pathname: string, href: string) {
  // "/" khớp mọi đường dẫn nếu dùng startsWith, nên trang chủ phải so khớp tuyệt đối.
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
