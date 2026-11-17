import {
  Award, Baby, Banknote, BookOpen, Briefcase, Car, Coffee, CreditCard, Ellipsis, Film, Gift,
  Heart, HeartHandshake, HeartPulse, Home, LayoutGrid, Package, Plane, CirclePlus, ShoppingBag,
  ShoppingCart, SprayCan, TrendingUp, User, Users, Wallet, Zap, type LucideIcon,
} from "lucide-react";

/**
 * Icon của nhóm danh mục cho biểu đồ hệ Kính (SegRing, PetalChart, hàng "So với
 * ngân sách", BudgetTab). Tên nhóm là tên CHUẨN tiếng Anh
 * (`Transaction.categoryGroup`). Khớp KHÔNG phân biệt hoa thường và khoảng trắng
 * thừa; nhóm lạ (do người dùng tự tạo) lấy icon mặc định `LayoutGrid`.
 */
const ICON_LIST: [string, LucideIcon][] = [
  // Chi
  ["Food & Dining", Coffee],
  ["Groceries", ShoppingCart],
  ["Housing", Home],
  ["Transportation", Car],
  ["Bills & Utilities", Zap],
  ["Shopping", ShoppingBag],
  ["Personal", User],
  ["Entertainment", Film],
  ["Entertainment & Subscriptions", Film],
  ["Health", HeartPulse],
  ["Health & Fitness", Heart],
  ["Assets & Equipment", Package],
  ["Debt & Installments", CreditCard],
  ["Books & Courses", BookOpen],
  ["Business", Briefcase],
  ["Children", Baby],
  ["Friends", Users],
  ["Grandparents", HeartHandshake],
  ["Household Supplies", SprayCan],
  ["Travel", Plane],
  ["Other", Ellipsis],
  // Thu
  ["Main Income", Banknote],
  ["Salary", Wallet],
  ["Bonus", Award],
  ["Allowance", Wallet],
  ["Investment", TrendingUp],
  ["Gift", Gift],
  ["Other Income", CirclePlus],
];

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const ICONS = new Map(ICON_LIST.map(([k, v]) => [norm(k), v]));

export function groupIcon(name: string): LucideIcon {
  return ICONS.get(norm(name)) ?? LayoutGrid;
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
