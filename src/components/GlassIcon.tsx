import type { LucideIcon } from "lucide-react";

/**
 * Icon "kính nhiều lớp" của hệ Kính (demo `.gi`): khối màu gradient sau-phải,
 * tấm kính trắng mờ phía trước, icon nét màu đậm của khối. Làm mờ nằm ở `::after`
 * (xem `.c-gi` trong globals.css), nên dùng được trong thẻ mà không tạo khối
 * chứa cho `position: fixed`.
 *
 * Mỗi MẢNG một màu đất trầm — không neon, tím hay xanh dương:
 *   fin     Tài chính (mật ong)
 *   spend   Ăn uống / chi tiêu (đất nung)
 *   learn   Học tập (xô thơm)
 *   habit   Thói quen (be đá)
 *   health  Sức khoẻ (hồng đất)
 *
 * `size`: 40 trong hàng danh sách và đầu thẻ, 44 trong ô KPI.
 */
export type GlassTone = "fin" | "spend" | "learn" | "habit" | "health";

export default function GlassIcon({
  icon: Icon,
  tone,
  size = 40,
  className = "",
}: {
  icon: LucideIcon;
  tone: GlassTone;
  size?: 40 | 44;
  className?: string;
}) {
  return (
    <span className={`c-gi ${tone} ${size === 44 ? "k44" : ""} ${className}`} aria-hidden>
      <Icon strokeWidth={1.75} />
    </span>
  );
}
