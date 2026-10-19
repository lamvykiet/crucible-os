"use client";

import { Activity, Beef, Droplets, Gauge } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { REMEASURE_DAYS, change, daysBetween } from "@/lib/health";
import SceneSummary, { num } from "@/components/SceneSummary";
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
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const ddmm = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const signed = (n: number, d: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${num(Math.abs(n), vi, d)}`;

  const weight = change("weightKg", prev, latest);
  const score = change("bodyScore", prev, latest);
  const sinceDays = latest ? daysBetween(latest.measuredAt, new Date(now)) : null;

  const weekAgo = now - 7 * 86_400_000;
  const recent = workouts.filter((w) => new Date(w.startedAt).getTime() >= weekAgo);
  const lastWorkout = workouts[0] ?? null;

  let title = t("Health", "Sức khoẻ");
  if (!loading) {
    if (!latest) title = t("No measurement yet", "Chưa có lần đo nào");
    else if (sinceDays !== null && sinceDays > REMEASURE_DAYS) title = t(`${sinceDays} days since last check`, `${sinceDays} ngày chưa đo lại`);
    else if (weight && Math.abs(weight.diff) >= 0.05)
      title = weight.diff < 0
        ? t(`Weight down ${num(-weight.diff, false, 1)} kg`, `Cân giảm ${num(-weight.diff, true, 1)} kg`)
        : t(`Weight up ${num(weight.diff, false, 1)} kg`, `Cân tăng ${num(weight.diff, true, 1)} kg`);
    else if (weight) title = t("Weight holding steady", "Cân giữ nguyên");
    else if (latest.bodyScore != null) title = t(`Body score ${latest.bodyScore}`, `Điểm hình thể ${latest.bodyScore}`);
  }

  const metric = (v: number | null | undefined, d: number, unit = "") =>
    v == null ? "—" : `${num(v, vi, d)}${unit}`;

  return (
    <SceneSummary
      title={title}
      main={{
        title: latest ? t(`Check of ${ddmm(latest.measuredAt)}`, `Lần đo ${ddmm(latest.measuredAt)}`) : t("Latest check", "Lần đo mới nhất"),
        subtitle: [name, prev ? t(`vs ${ddmm(prev.measuredAt)}`, `so lần ${ddmm(prev.measuredAt)}`) : null]
          .filter(Boolean)
          .join(" · ") || undefined,
        pill: weight ? { text: `${signed(weight.diff, 1)} kg`, tone: "flat" } : null,
        minis: [
          { label: t("Body fat", "Tỷ lệ mỡ"), value: metric(latest?.pbf, 1, "%"), icon: Droplets },
          { label: t("Skeletal muscle", "Cơ xương"), value: metric(latest?.smmKg, 1, " kg"), icon: Beef },
          { label: t("Visceral fat", "Mỡ nội tạng"), value: metric(latest?.visceralFat, 0), icon: Gauge },
          { label: t("Heart rate", "Nhịp tim"), value: metric(latest?.heartRate, 0, " bpm"), icon: Activity },
        ],
        big: latest?.weightKg != null ? { value: num(latest.weightKg, vi, 1), unit: "kg" } : null,
      }}
      rows={[
        {
          title: t("Body score", "Điểm hình thể"),
          subtitle: score ? t(`was ${score.from}`, `lần trước ${score.from}`) : t("Out of 100", "Thang 100"),
          pill: score
            ? score.withinNoise || score.diff === 0
              ? { text: t("within noise", "trong sai số"), tone: "flat" }
              : { text: `${score.diff > 0 ? "▲" : "▼"} ${Math.abs(score.diff)}`, tone: score.diff > 0 ? "good" : "bad" }
            : null,
          big: latest?.bodyScore != null ? { value: String(latest.bodyScore), unit: "/100" } : null,
        },
        {
          title: t("Workouts, last 7 days", "Buổi tập 7 ngày qua"),
          subtitle: lastWorkout
            ? `${lastWorkout.title} · ${ddmm(lastWorkout.startedAt)}`
            : t("No workout logged yet", "Chưa ghi buổi tập nào"),
          big: loading ? null : { value: String(recent.length), unit: t("sessions", "buổi") },
        },
      ]}
    />
  );
}
