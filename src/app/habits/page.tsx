import HabitsToday from "@/components/habits/HabitsToday";

/**
 * Module Thói quen.
 *
 * Mỗi màn là một URL riêng (/habits, /habits/reports, /habits/schedule,
 * /habits/journal, /habits/timer) thay vì tab trong một trang — Back đi đúng
 * một bước, và mở thẳng đồng hồ tập trung từ màn hình chính điện thoại được.
 */
export default function HabitsPage() {
  return <HabitsToday />;
}
