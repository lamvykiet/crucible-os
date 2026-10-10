import type { ReactNode } from "react";
import { HealthProvider } from "@/components/health/HealthContext";

/**
 * Module Sức khoẻ.
 *
 * Mỗi màn một URL (/health, /health/body, /health/workouts) như module Thói
 * quen — Back đi đúng một bước. Người đang xem nằm ở layout để đi theo khi
 * chuyển màn.
 */
export default function HealthLayout({ children }: { children: ReactNode }) {
  return <HealthProvider>{children}</HealthProvider>;
}
