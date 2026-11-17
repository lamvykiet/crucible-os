"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { REMEASURE_DAYS, change, daysBetween } from "@/lib/health";
import { ddmm, num } from "@/components/SceneSummary";
import { en } from "@/lib/plural";
import PageIntro from "@/components/PageIntro";
import type { Measurement, Workout } from "@/components/health/types";

/**
 * Tóm tắt Sức khoẻ trên phông cảnh: lần đo mới nhất so với lần trước, và
 * buổi tập 7 ngày qua. Chênh lệch nhỏ hơn `METRICS[k].noise` là sai số máy —
 * ghi "trong sai số", không tô xanh/đỏ. Cân nặng không có hướng tốt/xấu cố
 * định (tuỳ mục tiêu) nên viên delta của nó luôn xám.
 */
export default function HealthScene({
  name, latest, prev, workouts, now, loading,
}: {
  name: string | null;
  latest: Measurement | null;
  prev: Measurement | null;
  workouts: Workout[];
  now: number;
  loading: boolean;
}) {
  const { t } = useLanguage();

  const weight = change("weightKg", prev, latest);
  const sinceDays = latest ? daysBetween(latest.measuredAt, new Date(now)) : null;

  const weekAgo = now - 7 * 86_400_000;
  const recent = workouts.filter((w) => new Date(w.startedAt).getTime() >= weekAgo);
  const lastWorkout = workouts[0] ?? null;

  const lede = (() => {
    if (loading) return undefined;
    if (!latest) return t("No measurement yet — import a report or enter one by hand.", "Chưa có lần đo nào — nhập phiếu đo hoặc nhập tay lần đầu.");
    if (sinceDays !== null && sinceDays > REMEASURE_DAYS) return t(`${sinceDays} days since the last check — time to measure again.`, `${sinceDays} ngày chưa đo lại — đến lúc đo tiếp.`);
    if (weight && Math.abs(weight.diff) >= 0.05 && !weight.withinNoise)
      return weight.diff < 0
        ? t(`Weight is down ${num(-weight.diff, false, 1)} kg since the previous check.`, `Cân giảm ${num(-weight.diff, true, 1)} kg so với lần đo trước.`)
        : t(`Weight is up ${num(weight.diff, false, 1)} kg since the previous check.`, `Cân tăng ${num(weight.diff, true, 1)} kg so với lần đo trước.`);
    if (weight) return t("Weight is within the scale's noise of the last check — holding steady.", "Cân nằm trong sai số của máy so với lần trước — giữ nguyên.");
    return latest.bodyScore != null ? t(`Body score ${latest.bodyScore}/100.`, `Điểm hình thể ${latest.bodyScore}/100.`) : undefined;
  })();

  const workoutLine = loading
    ? ""
    : lastWorkout
      ? " " + t(`${en(recent.length, "workout")} in the last 7 days (latest: ${lastWorkout.title}, ${ddmm(lastWorkout.startedAt)}).`, `${recent.length} buổi tập trong 7 ngày qua (gần nhất: ${lastWorkout.title}, ${ddmm(lastWorkout.startedAt)}).`)
      : " " + t("No workout logged yet.", "Chưa ghi buổi tập nào.");

  return (
    <>
      <PageIntro
        title={t("Health", "Sức khoẻ")}
        kicker={[name, latest ? t(`check of ${ddmm(latest.measuredAt)}`, `lần đo ${ddmm(latest.measuredAt)}`) : null].filter(Boolean).join(" · ") || undefined}
        lede={lede ? lede + workoutLine : undefined}
      />
    </>
  );
}
