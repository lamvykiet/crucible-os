import {
  Banknote, Briefcase, Car, Coffee, Film, Gift, Heart, Home, LayoutGrid, Package,
  ShoppingBag, ShoppingCart, TrendingUp, User, Zap, type LucideIcon,
} from "lucide-react";

/**
 * Icon và màu của nhóm danh mục cho biểu đồ hệ Kính (SegRing, PetalChart, hàng
 * "So với ngân sách"). Tên nhóm là tên CHUẨN tiếng Anh (`Transaction.categoryGroup`);
 * nhóm do người dùng tự tạo không có trong bảng thì lấy icon "Khác".
 */
const ICONS: Record<string, LucideIcon> = {
  "Food & Dining": Coffee,
  Groceries: ShoppingCart,
  Housing: Home,
  Transportation: Car,
  "Bills & Utilities": Zap,
  Shopping: ShoppingBag,
  Personal: User,
  Entertainment: Film,
  "Health & Fitness": Heart,
  "Assets & Equipment": Package,
  "Main Income": Banknote,
  Investment: TrendingUp,
  Business: Briefcase,
  Gift: Gift,
};

export function groupIcon(name: string): LucideIcon {
  return ICONS[name] ?? LayoutGrid;
}

export const OTHER_KEY = "__other";

export interface RankedGroup {
  key: string;
  /** Tên chuẩn của nhóm; `OTHER_KEY` cho phần gộp. */
  name: string;
  value: number;
  /** 1–6, trỏ tới `--rg-1..6`. */
  color: number;
}

/**
 * Xếp nhóm giảm dần theo giá trị, giữ tối đa `max` nhóm có tên, gộp phần còn
 * lại (và nhóm tên "Other") vào "Khác" xếp CUỐI. Màu: nhóm có tên lấy 1,2,3,4,6
 * theo thứ hạng, "Khác" luôn 5 — bảng `--rg-*` chỉ có sáu màu, không thêm màu.
 */
export function rankGroups(
  list: { name: string; value: number }[],
  max = 5
): RankedGroup[] {
  const positive = list.filter((g) => g.value > 0);
  const named = positive.filter((g) => g.name !== "Other").sort((a, b) => b.value - a.value);
  const keep = named.slice(0, max);
  const rest = [...named.slice(max), ...positive.filter((g) => g.name === "Other")];
  const palette = [1, 2, 3, 4, 6];
  const out: RankedGroup[] = keep.map((g, i) => ({ key: g.name, name: g.name, value: g.value, color: palette[i] }));
  if (rest.length > 0) {
    out.push({ key: OTHER_KEY, name: OTHER_KEY, value: rest.reduce((s, g) => s + g.value, 0), color: 5 });
  }
  return out;
}
