"use client";

import {
  Activity, BedDouble, Bike, BookOpen, Brain, CheckCircle2, CigaretteOff, Coffee,
  Droplet, Dumbbell, Footprints, Heart, Languages, Leaf, Moon, Music, NotebookPen,
  Salad, Sparkles, Sun, Timer, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Bộ icon chọn được cho thói quen.
 *
 * Danh sách cố định thay vì tra động từ toàn bộ lucide-react: tra động kéo cả
 * gói vào bundle của trang, và tên icon lưu trong DB thì không ai kiểm tra được
 * là còn tồn tại ở phiên bản sau hay không.
 */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  droplet: Droplet,
  footprints: Footprints,
  dumbbell: Dumbbell,
  bike: Bike,
  salad: Salad,
  heart: Heart,
  moon: Moon,
  sun: Sun,
  bed: BedDouble,
  book: BookOpen,
  brain: Brain,
  languages: Languages,
  note: NotebookPen,
  music: Music,
  coffee: Coffee,
  timer: Timer,
  wallet: Wallet,
  leaf: Leaf,
  sparkles: Sparkles,
  activity: Activity,
  cigaretteOff: CigaretteOff,
  check: CheckCircle2,
};

export const ICON_NAMES = Object.keys(HABIT_ICONS);

/** Icon mặc định theo nhóm, dùng khi thói quen chưa chọn icon riêng. */
const GROUP_FALLBACK: Record<string, LucideIcon> = {
  daily: CheckCircle2,
  health: Heart,
  mind: Brain,
  work: BookOpen,
};

/**
 * Icon của một thói quen.
 *
 * Là một component chứ không phải hàm trả về component: `const Icon =
 * habitIcon(...)` rồi `<Icon />` bị quy tắc react-hooks bắt ("Cannot create
 * components during render"), và đó là cảnh báo đúng — mỗi lần render lại sinh
 * một tham chiếu mới thì React coi như component khác và dựng lại cây con.
 */
export function HabitGlyph({
  icon,
  group,
  size = 16,
  className,
}: {
  icon: string | null;
  group: string;
  size?: number;
  className?: string;
}) {
  const Icon: LucideIcon = (icon && HABIT_ICONS[icon]) || GROUP_FALLBACK[group] || CheckCircle2;
  return <Icon size={size} strokeWidth={2} className={className} />;
}
