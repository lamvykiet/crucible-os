import {
  BarChart3, Boxes, Briefcase, CalendarDays, CalendarRange, CheckSquare, CreditCard,
  Database, Dumbbell, FileText, GraduationCap, HeartPulse, History, Landmark, Languages,
  LayoutDashboard, Lightbulb, NotebookPen, Package, Palette, Repeat, Scale, Timer,
  TrendingUp, Video, Wallet, type LucideIcon,
} from "lucide-react";

/**
 * Danh sách function và tab con của từng function — MỘT chỗ duy nhất.
 *
 * Dùng bởi: menu xổ ở logo (`TopNav`), dải tab con trên thanh trên
 * (`TopNav`), menu logo và tab của `MobileTopBar`,
 * và tên function to trên phông cảnh (`SceneSummary`). Thêm một function hay
 * một tab là sửa ở đây, đừng chép danh sách sang chỗ khác.
 *
 * Tab có `href` chứa `?tab=` là tab trong cùng một trang (Tài chính,
 * Knowledge) — trang đọc `?tab=` để biết hiện gì, nên nút Back đi đúng bước.
 */
export interface ModuleTab {
  href: string;
  icon: LucideIcon;
  en: string;
  vi: string;
}

export interface ModuleDef {
  key: string;
  href: string;
  icon: LucideIcon;
  en: string;
  vi: string;
  tabs: ModuleTab[];
}

export const MODULES: ModuleDef[] = [
  { key: "home", href: "/", icon: LayoutDashboard, en: "Home", vi: "Tổng quan", tabs: [] },
  {
    key: "finance", href: "/finance", icon: Wallet, en: "Finance", vi: "Tài chính",
    tabs: [
      { href: "/finance?tab=dashboard", icon: LayoutDashboard, en: "Overview", vi: "Tổng quan" },
      { href: "/finance?tab=income", icon: TrendingUp, en: "Income", vi: "Thu nhập" },
      { href: "/finance?tab=expense", icon: CreditCard, en: "Expense", vi: "Chi tiêu" },
      { href: "/finance?tab=debts", icon: Landmark, en: "Debts", vi: "Nợ" },
      { href: "/finance?tab=assets", icon: Package, en: "Assets", vi: "Tài sản" },
      { href: "/finance?tab=accounts", icon: Wallet, en: "Accounts", vi: "Tài khoản" },
      { href: "/finance?tab=projects", icon: Briefcase, en: "Projects", vi: "Dự án" },
      { href: "/finance?tab=history", icon: History, en: "History", vi: "Lịch sử" },
    ],
  },
  {
    key: "learning", href: "/learning", icon: GraduationCap, en: "Learning", vi: "Học tập",
    tabs: [
      { href: "/learning", icon: LayoutDashboard, en: "Overview", vi: "Tổng quan" },
      { href: "/learning/languages", icon: Languages, en: "Languages", vi: "Ngôn ngữ" },
      { href: "/learning/inventory", icon: Boxes, en: "Inventory", vi: "Kho thẻ" },
      { href: "/learning/history", icon: CalendarDays, en: "History", vi: "Lịch sử" },
      { href: "/learning/progress", icon: BarChart3, en: "Progress", vi: "Tiến độ" },
      { href: "/learning/focus", icon: Timer, en: "Focus", vi: "Tập trung" },
      { href: "/learning/space", icon: Palette, en: "Study space", vi: "Không gian" },
    ],
  },
  {
    key: "habits", href: "/habits", icon: Repeat, en: "Habits", vi: "Thói quen",
    tabs: [
      { href: "/habits", icon: CheckSquare, en: "Today", vi: "Hôm nay" },
      { href: "/habits/reports", icon: BarChart3, en: "Reports", vi: "Báo cáo" },
      { href: "/habits/schedule", icon: CalendarRange, en: "Schedule", vi: "Lịch tuần" },
      { href: "/habits/journal", icon: NotebookPen, en: "Journal", vi: "Nhật ký" },
      { href: "/habits/timer", icon: Timer, en: "Timer", vi: "Bấm giờ" },
    ],
  },
  {
    key: "health", href: "/health", icon: HeartPulse, en: "Health", vi: "Sức khoẻ",
    tabs: [
      { href: "/health", icon: LayoutDashboard, en: "Overview", vi: "Tổng quan" },
      { href: "/health/body", icon: Scale, en: "Body", vi: "Cơ thể" },
      { href: "/health/workouts", icon: Dumbbell, en: "Workouts", vi: "Buổi tập" },
    ],
  },
  {
    key: "knowledge", href: "/knowledge", icon: Database, en: "Knowledge", vi: "Knowledge",
    tabs: [
      { href: "/knowledge?tab=dashboard", icon: LayoutDashboard, en: "Overview", vi: "Tổng quan" },
      { href: "/knowledge?tab=documents", icon: FileText, en: "Documents", vi: "Tài liệu" },
      { href: "/knowledge?tab=ideas", icon: Lightbulb, en: "Ideas", vi: "Ý tưởng" },
      { href: "/knowledge?tab=videos", icon: Video, en: "Videos", vi: "Video" },
    ],
  },
];

/** Function đang mở theo đường dẫn; `/settings` và trang lạ trả về null. */
export function moduleFor(pathname: string): ModuleDef | null {
  if (pathname === "/") return MODULES[0];
  return MODULES.find((m) => m.href !== "/" && (pathname === m.href || pathname.startsWith(m.href + "/"))) ?? null;
}

/**
 * Tab nào đang chọn. `tab` là giá trị `?tab=` hiện tại (null nếu không có).
 * Tab theo đường dẫn: khớp dài nhất thắng (/habits/reports thắng /habits).
 */
export function isTabActive(tab: ModuleTab, pathname: string, tabParam: string | null, first: boolean): boolean {
  const [path, query] = tab.href.split("?");
  if (query) {
    const want = new URLSearchParams(query).get("tab");
    return pathname === path && (tabParam === want || (!tabParam && first));
  }
  if (pathname === path) return true;
  return pathname.startsWith(path + "/") && path.split("/").length > 2;
}
