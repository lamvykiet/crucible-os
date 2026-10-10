"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Dumbbell, FileUp, Loader2, Medal } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import { GRID, LINE, TOOLTIP_LINE, VIZ, labelAt, refLabel, yAxis } from "@/lib/viz";
import ChartCard, { StatTile } from "@/components/charts/ChartCard";
import {
  METRICS, MUSCLES, PR_LABELS, REMEASURE_DAYS, WEEKLY_SETS_TARGET,
  bmiClass, bpCategory, change, computeRecords, daysBetween, fatToLose, fmt, fmtDuration, fmtSigned,
  muscleLabel, readMetric, setsByMuscle, toneVar, weekStartOf, weeklyRatePct, workoutVolume,
  type MetricKey, type Tone,
} from "@/lib/health";
import { useHealth } from "@/components/health/HealthContext";
import HealthShell from "@/components/health/HealthShell";
import MeasurementModal from "@/components/health/MeasurementModal";
import WorkoutModal, { newWorkoutDraft } from "@/components/health/WorkoutModal";
import { StatusChip } from "@/components/health/parts";
import { fmtDate, type Measurement, type WorkoutDraft } from "@/components/health/types";

const DAY_MS = 86_400_000;

/** Chỉ số được soi để đưa vào mục "Cần chú ý". Cân nặng/điểm đã có chỗ riêng. */
const WATCH: MetricKey[] = [
  "pbf", "fatMassKg", "visceralFat", "whr", "heartRate", "smmKg", "leanMassKg", "smi",
  "musclePct", "proteinPct", "proteinKg", "mineralKg", "waterPct", "waterL",
];

const TONE_RANK: Record<Tone, number> = { bad: 0, warn: 1, neutral: 2, good: 3 };

/** Mốc ngày ngắn cho trục: "12/09". */
const shortDate = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Tổng quan sức khoẻ của MỘT người.
 *
 * Thứ tự là thứ tự câu hỏi: lần đo mới nhất nói gì → chỗ nào cần chú ý → còn
 * bao xa tới mục tiêu → xu hướng → tuần này tập ra sao. Mỗi thẻ mở bằng một câu
 * kết luận tính từ dữ liệu (docs/bieu-do.md §1); không có dữ liệu thì thẻ không
 * hiện, không bịa số.
 */
export default function HealthDashboard() {
  const { t } = useLanguage();
  const { profile, measurements, workouts, reloadData } = useHealth();
  const [measureModal, setMeasureModal] = useState(false);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutDraft | null>(null);
  // Mốc "bây giờ" cố định cho một lần mở trang — tính tuần này / 7 ngày qua.
  const [now] = useState(() => Date.now());

  const list = measurements ?? [];
  const latest = list[list.length - 1] ?? null;
  const prev = list[list.length - 2] ?? null;
  const first = list[0] ?? null;
  const sex = profile?.sex ?? "male";

  const records = useMemo(() => computeRecords(workouts ?? []), [workouts]);

  const loading = measurements === null || workouts === null;

  return (
    <HealthShell
      title={t("Health", "Sức khoẻ")}
      lede={t("Body composition and training, one person at a time.", "Thành phần cơ thể và luyện tập, theo từng người.")}
      actions={
        <>
          <button type="button" onClick={() => setWorkoutDraft(newWorkoutDraft())} className="c-btn c-btn-secondary">
            <Dumbbell size={16} /> {t("Log workout", "Ghi buổi tập")}
          </button>
          <button type="button" onClick={() => setMeasureModal(true)} className="c-btn c-btn-primary">
            <FileUp size={16} /> {t("Import report", "Nhập phiếu đo")}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="c-card h-40 grid place-content-center text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !latest && !workouts?.length ? (
        <section className="c-card text-center py-10">
          <p className="c-card-body">
            {t(
              `Nothing recorded for ${profile?.name} yet. Import a body-composition report or log a workout to start.`,
              `${profile?.name} chưa có dữ liệu. Nhập một phiếu đo cơ thể hoặc ghi một buổi tập để bắt đầu.`
            )}
          </p>
        </section>
      ) : (
        <>
          {latest && <LatestCard latest={latest} prev={prev} />}
          {latest && <AttentionCard latest={latest} sex={sex} />}
          {latest && <GoalCard latest={latest} first={first} list={list} now={now} />}
          {list.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TrendCard k="weightKg" list={list} target={profile?.targetWeightKg ?? latest?.targetWeightKg ?? null} />
              <TrendCard k="pbf" list={list} />
              <TrendCard k="smmKg" list={list} />
            </div>
          )}
          {!!workouts?.length && <TrainingCard now={now} />}
          {records.prs.length > 0 && <RecentPrs now={now} />}
          {!latest && (
            <section className="c-card flex flex-wrap items-center justify-between gap-3">
              <p className="c-card-body">
                {t("No body measurement yet for", "Chưa có lần đo cơ thể nào cho")} {profile?.name}.
              </p>
              <button type="button" onClick={() => setMeasureModal(true)} className="c-btn c-btn-secondary c-btn-sm">
                <FileUp size={14} /> {t("Import report", "Nhập phiếu đo")}
              </button>
            </section>
          )}
          {latest && (
            <p className="text-[11px] text-[var(--color-text-faint)]">
              {t(
                "For reference only — device readings are estimates and do not replace a medical diagnosis.",
                "Chỉ để tham khảo — số của máy đo là ước lượng, không thay cho chẩn đoán y khoa."
              )}{" "}
              <Link href="/health/body" className="underline">
                {t("All measurements", "Xem mọi lần đo")}
              </Link>
            </p>
          )}
        </>
      )}

      {measureModal && profile && (
        <MeasurementModal
          measurement={null}
          startWithImport
          onClose={() => setMeasureModal(false)}
          onSaved={() => {
            setMeasureModal(false);
            reloadData();
          }}
        />
      )}
      {workoutDraft && (
        <WorkoutModal
          draft={workoutDraft}
          onClose={() => setWorkoutDraft(null)}
          onSaved={() => {
            setWorkoutDraft(null);
            reloadData();
          }}
        />
      )}
    </HealthShell>
  );
}

// ---------------------------------------------------------------------------

/** Lần đo mới nhất so với lần trước: bốn con số và một câu kết luận. */
function LatestCard({ latest, prev }: { latest: Measurement; prev: Measurement | null }) {
  const { t, language } = useLanguage();
  const days = prev ? daysBetween(prev.measuredAt, latest.measuredAt) : 0;
  const w = change("weightKg", prev, latest);
  const fat = change("fatMassKg", prev, latest);
  const lean = change("leanMassKg", prev, latest) ?? change("smmKg", prev, latest);

  let title: string;
  if (!prev) {
    title = t(
      `First measurement: ${fmt(latest.weightKg, 1, "en")} kg${latest.pbf != null ? `, ${fmt(latest.pbf, 1, "en")}% body fat` : ""}`,
      `Lần đo đầu tiên: ${fmt(latest.weightKg, 1, "vi")} kg${latest.pbf != null ? `, mỡ ${fmt(latest.pbf, 1, "vi")}%` : ""}`
    );
  } else {
    const head = w
      ? t(
          `Weight ${fmtSigned(w.diff, 1, "en")} kg in ${days} days`,
          `Cân nặng ${fmtSigned(w.diff, 1, "vi")} kg sau ${days} ngày`
        )
      : t(`${days} days since the previous measurement`, `${days} ngày sau lần đo trước`);
    const bothNoise = fat && lean && fat.withinNoise && lean.withinNoise;
    const tail = bothNoise
      ? t("; fat and lean mass moved less than the device's error", "; mỡ và nạc thay đổi chưa vượt sai số của máy")
      : fat && lean
        ? t(
            `; fat ${fmtSigned(fat.diff, 1, "en")} kg, lean ${fmtSigned(lean.diff, 1, "en")} kg`,
            `; mỡ ${fmtSigned(fat.diff, 1, "vi")} kg, nạc ${fmtSigned(lean.diff, 1, "vi")} kg`
          )
        : "";
    title = head + tail;
  }

  const tile = (k: MetricKey, goodDir: 1 | -1 | 0) => {
    const def = METRICS[k];
    const v = latest[k];
    const c = change(k, prev, latest);
    const tone: Tone =
      !c || c.withinNoise || !goodDir || Math.abs(c.diff) < 0.05 ? "neutral" : Math.sign(c.diff) === goodDir ? "good" : "bad";
    return (
      <StatTile
        key={k}
        emphasis={k === "weightKg"}
        label={t(def.en, def.vi)}
        value={
          v == null ? (
            "—"
          ) : (
            <span className="tabular-nums">
              {fmt(v, def.digits, language)}
              <span className="text-xs font-normal text-[var(--color-text-faint)]"> {def.unit}</span>
            </span>
          )
        }
        delta={
          c ? (
            <span className="tabular-nums" style={{ color: toneVar(tone) }}>
              {fmtSigned(c.diff, def.digits, language)}
            </span>
          ) : undefined
        }
        note={c?.withinNoise ? t("within error", "trong sai số") : undefined}
      />
    );
  };

  return (
    <ChartCard
      title={title}
      subtitle={t(
        `Measured ${fmtDate(latest.measuredAt, true)}${prev ? ` vs ${fmtDate(prev.measuredAt)}` : ""}${latest.device ? ` · ${latest.device}` : ""}`,
        `Đo ${fmtDate(latest.measuredAt, true)}${prev ? ` so với ${fmtDate(prev.measuredAt)}` : ""}${latest.device ? ` · ${latest.device}` : ""}`
      )}
      footnote={
        fat || lean
          ? t(
              "\"Within error\": smaller than the change a lab-grade InBody 770 can tell apart (2.8 pts body fat, 1.9 kg fat, 2.4 kg lean). Kiosk devices are less precise still.",
              "\"Trong sai số\": nhỏ hơn mức máy InBody 770 loại phòng khám phân biệt được (2,8 điểm % mỡ, 1,9 kg mỡ, 2,4 kg nạc). Máy ở trạm đo công cộng còn kém chính xác hơn."
            )
          : undefined
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tile("weightKg", 0)}
        {tile("pbf", -1)}
        {tile("smmKg", 1)}
        {tile("bodyScore", 1)}
      </div>
    </ChartCard>
  );
}

/** Chỉ số nằm ngoài ngưỡng ở lần đo mới nhất, xấu nhất trước. */
function AttentionCard({ latest, sex }: { latest: Measurement; sex: "male" | "female" }) {
  const { t, language } = useLanguage();

  type Flag = { key: string; en: string; vi: string; value: string; range: string | null; tone: Tone; label: { en: string; vi: string } };
  const flags: Flag[] = [];

  if (latest.systolic && latest.diastolic) {
    const bp = bpCategory(latest.systolic, latest.diastolic);
    if (bp.tone !== "good") {
      flags.push({
        key: "bp", en: "Blood pressure", vi: "Huyết áp",
        value: `${latest.systolic}/${latest.diastolic} mmHg`, range: "< 120/80", tone: bp.tone, label: bp,
      });
    }
  }
  if (latest.bmi != null) {
    const c = bmiClass(latest.bmi);
    if (c.tone !== "good") {
      flags.push({ key: "bmi", en: "BMI", vi: "BMI", value: fmt(latest.bmi, 1, language), range: "18,5–22,9", tone: c.tone, label: c });
    }
  }
  for (const k of WATCH) {
    const r = readMetric(k, latest[k], sex, latest.ranges);
    if (!r || !r.label || (r.tone !== "bad" && r.tone !== "warn")) continue;
    const def = METRICS[k];
    flags.push({
      key: k, en: def.en, vi: def.vi,
      value: `${fmt(r.value, def.digits, language)}${def.unit ? ` ${def.unit}` : ""}`,
      range: r.range ? `${fmt(r.range[0], def.digits, language)}–${fmt(r.range[1], def.digits, language)}` : null,
      tone: r.tone, label: r.label,
    });
  }
  if (latest.bmr != null && latest.bmrLow != null && latest.bmr < latest.bmrLow) {
    flags.push({
      key: "bmr", en: "Basal metabolic rate", vi: "Trao đổi chất cơ bản",
      value: `${latest.bmr} kcal`, range: `${latest.bmrLow}–${latest.bmrHigh ?? "?"}`, tone: "warn",
      label: { en: "Below range", vi: "Dưới khuyến nghị" },
    });
  }
  flags.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);

  const bad = flags.filter((f) => f.tone === "bad").length;
  const title = !flags.length
    ? t("Every measured marker is within its normal range", "Mọi chỉ số đo được đều trong ngưỡng bình thường")
    : bad
      ? t(`${flags.length} markers need attention — ${bad} clearly out of range`, `${flags.length} chỉ số cần chú ý — ${bad} chỉ số vượt ngưỡng rõ`)
      : t(`${flags.length} markers slightly out of range`, `${flags.length} chỉ số lệch nhẹ khỏi ngưỡng`);

  const highBp = latest.systolic && latest.diastolic && bpCategory(latest.systolic, latest.diastolic).tone === "bad";

  return (
    <ChartCard
      title={title}
      subtitle={t(`From the measurement on ${fmtDate(latest.measuredAt)}`, `Theo lần đo ngày ${fmtDate(latest.measuredAt)}`)}
      footnote={t(
        "Ranges printed on the report come first; otherwise published standards. BMI uses Asian cut-offs (overweight from 23). Blood pressure: AHA 2017 — Vietnamese/ESC guidelines diagnose hypertension from 140/90; one kiosk reading is not a diagnosis, re-check at rest several times.",
        "Ưu tiên ngưỡng in trên phiếu; không có thì theo chuẩn công bố. BMI theo chuẩn châu Á (thừa cân từ 23). Huyết áp theo AHA 2017 — hướng dẫn Việt Nam/ESC chẩn đoán tăng huyết áp từ 140/90; một lần đo ở trạm chưa phải chẩn đoán, nên đo lại vài lần lúc nghỉ."
      )}
    >
      {flags.length > 0 && (
        <div className="flex flex-col">
          {flags.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm truncate">{t(f.en, f.vi)}</p>
                {f.range && (
                  <p className="text-[11px] text-[var(--color-text-faint)] tabular-nums">
                    {t("normal", "bình thường")} {f.range}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-none">
                <span className="font-semibold tabular-nums" style={{ color: toneVar(f.tone) }}>
                  {f.value}
                </span>
                <StatusChip tone={f.tone} label={t(f.label.en, f.label.vi)} />
              </div>
            </div>
          ))}
        </div>
      )}
      {highBp && (
        <p className="c-help" style={{ color: toneVar("bad") }}>
          {t("Blood pressure this high is worth discussing with a doctor.", "Huyết áp ở mức này nên hỏi ý kiến bác sĩ.")}
        </p>
      )}
    </ChartCard>
  );
}

/** Còn bao xa tới cân nặng mục tiêu, và nhịp hiện tại có đúng hướng không. */
function GoalCard({
  latest,
  first,
  list,
  now,
}: {
  latest: Measurement;
  first: Measurement | null;
  list: Measurement[];
  now: number;
}) {
  const { t, language } = useLanguage();
  const { profile } = useHealth();
  const sex = profile?.sex ?? "male";
  const target = profile?.targetWeightKg ?? latest.targetWeightKg;
  const weight = latest.weightKg;

  const sinceLast = Math.floor((now - new Date(latest.measuredAt).getTime()) / DAY_MS);
  const nextAt = new Date(new Date(latest.measuredAt).getTime() + REMEASURE_DAYS * DAY_MS);
  const remeasure = (
    <p className="c-help inline-flex items-center gap-1.5">
      <CalendarClock size={13} aria-hidden />
      {sinceLast >= REMEASURE_DAYS
        ? t(
            `Last measured ${sinceLast} days ago — time to re-measure (same time of day, fasted, before training).`,
            `Lần đo gần nhất cách đây ${sinceLast} ngày — đến lúc đo lại (cùng giờ, lúc đói, trước khi tập).`
          )
        : t(
            `Next measurement around ${fmtDate(nextAt)} — every ~4 weeks, same conditions.`,
            `Lần đo tới khoảng ${fmtDate(nextAt)} — mỗi ~4 tuần, cùng điều kiện đo.`
          )}
    </p>
  );

  if (target == null || weight == null) {
    return (
      <section className="c-card flex flex-col gap-2">
        <p className="c-h5">{t("No weight goal yet", "Chưa đặt cân nặng mục tiêu")}</p>
        <p className="c-card-body">
          {t("Set one with the pencil next to the name.", "Đặt bằng nút bút chì cạnh tên người.")}
        </p>
        {remeasure}
      </section>
    );
  }

  const remaining = weight - target;
  const losing = remaining > 0;
  const absRem = Math.abs(remaining);
  // Nhịp an toàn 0,5–1 % cân nặng mỗi tuần (giữ được cơ khi giảm).
  const fastWeeks = Math.ceil(absRem / (weight * 0.01));
  const slowWeeks = Math.ceil(absRem / (weight * 0.005));
  const fat = latest.pbf != null ? fatToLose(weight, latest.pbf, sex) : null;

  // Tốc độ thật: lần đo mới nhất so với lần gần nhất cách nó ít nhất 7 ngày.
  const base = [...list].reverse().find((m) => daysBetween(m.measuredAt, latest.measuredAt) >= 7) ?? null;
  const rate = base ? weeklyRatePct(base, latest) : null;
  let rateNote: { tone: Tone; en: string; vi: string } | null = null;
  if (rate !== null) {
    const r = `${fmtSigned(rate, 2, "en")}%`;
    const rv = `${fmtSigned(rate, 2, "vi")}%`;
    if (losing && rate > 0.05)
      rateNote = { tone: "bad", en: `Gaining ${r}/week — opposite to the goal`, vi: `Đang tăng ${rv}/tuần — ngược hướng mục tiêu` };
    else if (losing && rate < -1)
      rateNote = { tone: "warn", en: `Losing ${r}/week — faster than 1% risks muscle`, vi: `Đang giảm ${rv}/tuần — nhanh hơn 1% dễ mất cơ` };
    else if (losing && rate <= -0.5)
      rateNote = { tone: "good", en: `Losing ${r}/week — in the 0.5–1% sweet spot`, vi: `Đang giảm ${rv}/tuần — đúng nhịp 0,5–1%` };
    else if (losing)
      rateNote = { tone: "neutral", en: `${r}/week — slower than 0.5%`, vi: `${rv}/tuần — chậm hơn mức 0,5%` };
    else rateNote = { tone: "neutral", en: `${r}/week`, vi: `${rv}/tuần` };
  }

  const start = first?.weightKg ?? weight;
  const progress = start === target ? 1 : Math.max(0, Math.min(1, (start - weight) / (start - target)));

  const title =
    absRem < 0.5
      ? t(`At the ${fmt(target, 1, "en")} kg goal`, `Đã chạm mục tiêu ${fmt(target, 1, "vi")} kg`)
      : t(
          `${fmt(absRem, 1, "en")} kg to the ${fmt(target, 1, "en")} kg goal — about ${fastWeeks}–${slowWeeks} weeks at a safe pace`,
          `Còn ${fmt(absRem, 1, "vi")} kg tới mục tiêu ${fmt(target, 1, "vi")} kg — khoảng ${fastWeeks}–${slowWeeks} tuần ở nhịp an toàn`
        );

  return (
    <ChartCard
      title={title}
      subtitle={t(
        `${profile?.targetWeightKg ? "Your goal" : "Goal suggested by the device"} · safe pace 0.5–1% of body weight per week`,
        `${profile?.targetWeightKg ? "Mục tiêu tự đặt" : "Mục tiêu máy đo gợi ý"} · nhịp an toàn 0,5–1% cân nặng mỗi tuần`
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="relative h-2 rounded-full bg-[var(--color-surface-2)]" aria-hidden>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress * 100}%`, background: VIZ.accent }} />
        </div>
        <div className="flex justify-between text-[11px] text-[var(--color-text-faint)] tabular-nums">
          <span>
            {t("start", "bắt đầu")} {fmt(start, 1, language)} kg
          </span>
          <span>
            {t("now", "hiện tại")} {fmt(weight, 1, language)} kg
          </span>
          <span>
            {t("goal", "mục tiêu")} {fmt(target, 1, language)} kg
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {fat !== null && losing && (
          <StatTile
            label={t("Fat to lose (keeping lean mass)", "Mỡ cần giảm (giữ nguyên nạc)")}
            value={`${fmt(fat, 1, language)} kg`}
            note={t(`to reach ${sex === "female" ? 23 : 15}% body fat`, `để mỡ về ${sex === "female" ? 23 : 15}%`)}
          />
        )}
        {latest.maintenanceKcal != null && (
          <StatTile
            label={t("Maintenance calories", "Calo duy trì")}
            value={`${latest.maintenanceKcal.toLocaleString("vi-VN")} kcal`}
            note={t("device estimate", "máy đo ước tính")}
          />
        )}
        {rateNote && (
          <StatTile
            label={t("Current pace", "Nhịp hiện tại")}
            value={<span style={{ color: toneVar(rateNote.tone) }}>{t(rateNote.en, rateNote.vi).split(" — ")[0]}</span>}
            note={t(rateNote.en, rateNote.vi).split(" — ")[1]}
          />
        )}
      </div>
      {remeasure}
    </ChartCard>
  );
}

/** Đường xu hướng của một chỉ số — trục thời gian thật, vì các lần đo cách nhau không đều. */
function TrendCard({ k, list, target }: { k: MetricKey; list: Measurement[]; target?: number | null }) {
  const { t, language } = useLanguage();
  const def = METRICS[k];
  const data = list
    .filter((m) => m[k] != null)
    .map((m) => ({ ts: new Date(m.measuredAt).getTime(), v: m[k] as number }));
  if (data.length < 2) return null;
  const a = data[0];
  const b = data[data.length - 1];
  const diff = b.v - a.v;
  const unit = def.unit === "%" ? t(" pts", " điểm") : ` ${def.unit}`;
  const title = t(
    `${def.en} ${fmtSigned(diff, def.digits, "en")}${unit} since ${shortDate(a.ts)}`,
    `${def.vi} ${fmtSigned(diff, def.digits, "vi")}${unit} từ ${shortDate(a.ts)}`
  );
  const values = data.map((d) => d.v).concat(target != null ? [target] : []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.25, def.digits ? 0.5 : 1);

  return (
    <ChartCard title={title} subtitle={`${t(def.en, def.vi)}${def.unit ? `, ${def.unit}` : ""} · ${data.length} ${t("measurements", "lần đo")}`}>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={data.length <= 6 ? data.map((d) => d.ts) : undefined}
              tickFormatter={(v) => shortDate(Number(v))}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis {...yAxis((v) => fmt(v, def.digits ? 1 : 0, language), 40)} domain={[Math.floor(lo - pad), Math.ceil(hi + pad)]} />
            <Tooltip
              {...TOOLTIP_LINE}
              labelFormatter={(l) => shortDate(Number(l))}
              formatter={(v) => [`${fmt(Number(v), def.digits, language)} ${def.unit}`, t(def.en, def.vi)]}
            />
            {target != null && (
              <ReferenceLine
                y={target}
                stroke={VIZ.muted}
                strokeDasharray="4 4"
                label={refLabel(t(`goal ${fmt(target, 1, "en")}`, `mục tiêu ${fmt(target, 1, "vi")}`))}
              />
            )}
            <Line
              dataKey="v"
              stroke={VIZ.accent}
              {...LINE}
              dot={{ r: 3, fill: VIZ.accent, strokeWidth: 0 }}
              label={labelAt(data.length - 1, (v) => fmt(v, def.digits, language))}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Tuần này tập ra sao: buổi, khối lượng, và số hiệp mỗi nhóm cơ trong 7 ngày qua. */
function TrainingCard({ now }: { now: number }) {
  const { t, language } = useLanguage();
  const { workouts } = useHealth();
  const all = workouts ?? [];

  const weekStart = weekStartOf(new Date(now)).getTime();
  const inRange = (from: number, to: number) =>
    all.filter((w) => {
      const ts = new Date(w.startedAt).getTime();
      return ts >= from && ts < to;
    });
  const thisWeek = inRange(weekStart, now + DAY_MS);
  const lastWeek = inRange(weekStart - 7 * DAY_MS, weekStart);
  const vol = (ws: typeof all) => ws.reduce((s, w) => s + workoutVolume(w), 0);
  const dur = (ws: typeof all) => ws.reduce((s, w) => s + (w.durationSec ?? 0), 0);

  // Số buổi mỗi tuần, 8 tuần gần nhất — tuần này là cột nhấn.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = weekStart - (7 - i) * 7 * DAY_MS;
    return { from, count: inRange(from, from + 7 * DAY_MS).length };
  });
  const maxCount = Math.max(1, ...weeks.map((w) => w.count));

  // Số hiệp theo nhóm cơ, 7 ngày lăn — không reset về 0 mỗi sáng thứ Hai.
  const sets = setsByMuscle(all, new Date(now - 7 * DAY_MS), new Date(now + DAY_MS));
  const rows = MUSCLES.filter((m) => m.value !== "cardio")
    .map((m) => ({ ...m, sets: sets.get(m.value) ?? 0 }))
    .filter((m) => m.sets > 0)
    .sort((a, b) => b.sets - a.sets);
  const untrained = MUSCLES.filter((m) => !["cardio", "fullbody", "forearms"].includes(m.value) && !(sets.get(m.value) ?? 0));
  const scale = Math.max(WEEKLY_SETS_TARGET[1] + 2, ...rows.map((r) => r.sets));
  const [lo, hi] = WEEKLY_SETS_TARGET;

  const title =
    thisWeek.length === 0
      ? lastWeek.length
        ? t(`No workout yet this week — ${lastWeek.length} last week`, `Tuần này chưa tập — tuần trước ${lastWeek.length} buổi`)
        : t("No workout this week or last", "Hai tuần nay chưa tập buổi nào")
      : t(
          `${thisWeek.length} ${thisWeek.length === 1 ? "workout" : "workouts"} this week, ${fmt(vol(thisWeek), 0, "en")} kg moved`,
          `Tuần này ${thisWeek.length} buổi, nâng tổng ${fmt(vol(thisWeek), 0, "vi")} kg`
        );

  return (
    <ChartCard
      title={title}
      subtitle={t("Week starts Monday · warm-up sets excluded", "Tuần tính từ thứ Hai · không tính hiệp khởi động")}
      footnote={t(
        `Shaded band: ${lo}–${hi} hard sets per muscle per week, the range most hypertrophy research supports (≥10 beats 5–9).`,
        `Dải tô: ${lo}–${hi} hiệp nặng mỗi nhóm cơ mỗi tuần — mức nghiên cứu tăng cơ ủng hộ (≥10 hiệp tốt hơn 5–9).`
      )}
    >
      <div className="grid grid-cols-3 gap-2">
        <StatTile emphasis label={t("Sessions", "Số buổi")} value={thisWeek.length} note={t(`last week ${lastWeek.length}`, `tuần trước ${lastWeek.length}`)} />
        <StatTile label={t("Volume", "Khối lượng")} value={`${fmt(vol(thisWeek), 0, language)} kg`} note={t(`last week ${fmt(vol(lastWeek), 0, "en")}`, `tuần trước ${fmt(vol(lastWeek), 0, "vi")}`)} />
        <StatTile label={t("Time", "Thời gian")} value={fmtDuration(dur(thisWeek))} />
      </div>

      <div>
        <p className="c-overline mb-2">{t("Sessions per week, last 8 weeks", "Số buổi mỗi tuần, 8 tuần")}</p>
        <div className="flex items-end gap-1.5 h-16 border-b border-[var(--viz-grid)]" role="img" aria-label={t("Sessions per week", "Số buổi mỗi tuần")}>
          {weeks.map((w, i) => (
            <div key={w.from} className="relative flex-1 h-full flex items-end justify-center" title={`${shortDate(w.from)}: ${w.count}`}>
              {w.count > 0 && (
                <div
                  className="w-full max-w-6 rounded-t-[4px]"
                  style={{ height: `${(w.count / maxCount) * 100}%`, background: i === 7 ? VIZ.accent : VIZ.muted }}
                />
              )}
              {i === 7 && (
                <span className="absolute -top-4 text-[11px] font-bold tabular-nums">{w.count}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1">
          {weeks.map((w, i) => (
            <span key={w.from} className={`flex-1 text-center text-[10px] ${i === 7 ? "font-bold text-[var(--color-text)]" : "text-[var(--color-text-faint)]"}`}>
              {i === 7 ? t("now", "nay") : shortDate(w.from)}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="c-overline mb-2">{t("Hard sets per muscle, last 7 days", "Hiệp mỗi nhóm cơ, 7 ngày qua")}</p>
        {rows.length === 0 ? (
          <p className="c-help">{t("No sets in the last 7 days.", "7 ngày qua chưa có hiệp nào.")}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <div key={r.value} className="grid grid-cols-[96px_1fr_28px] items-center gap-2 text-sm">
                <span className="truncate text-[var(--color-text-muted)]">{t(r.en, r.vi)}</span>
                <div className="relative h-[14px]">
                  <div
                    className="absolute inset-y-0 rounded-[3px] bg-[var(--viz-ghost)] opacity-60"
                    style={{ left: `${(lo / scale) * 100}%`, width: `${((hi - lo) / scale) * 100}%` }}
                    aria-hidden
                  />
                  <div className="absolute inset-y-[2px] left-0 rounded-r-[4px]" style={{ width: `${(r.sets / scale) * 100}%`, background: VIZ.muted }} />
                </div>
                <span className="text-right font-bold tabular-nums">{r.sets}</span>
              </div>
            ))}
          </div>
        )}
        {untrained.length > 0 && rows.length > 0 && (
          <p className="c-help mt-2">
            {t("Not trained in 7 days:", "7 ngày chưa tập:")} {untrained.map((m) => t(m.en, m.vi)).join(", ")}
          </p>
        )}
      </div>
    </ChartCard>
  );
}

/** Kỷ lục lập trong 30 ngày qua. */
function RecentPrs({ now }: { now: number }) {
  const { t, language } = useLanguage();
  const { workouts } = useHealth();
  const all = workouts ?? [];
  const { prs } = computeRecords(all);
  const since = now - 30 * DAY_MS;
  const items = prs
    .map((p) => {
      const w = all.find((x) => x.id === p.workoutId);
      const ex = w?.exercises[p.exerciseIndex];
      const s = ex?.sets[p.setIndex];
      return w && ex && s ? { p, w, ex, s } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && new Date(x.w.startedAt).getTime() >= since)
    .sort((a, b) => b.w.startedAt.localeCompare(a.w.startedAt))
    .slice(0, 6);
  if (!items.length) return null;

  return (
    <ChartCard
      title={t(`${items.length} personal records in the last 30 days`, `${items.length} kỷ lục cá nhân trong 30 ngày qua`)}
      subtitle={t("Beats every earlier session of the same exercise", "Vượt mọi buổi trước của cùng bài tập")}
    >
      <div className="flex flex-col">
        {items.map(({ p, w, ex, s }) => {
          const m = muscleLabel(ex.muscleGroup);
          const val =
            ex.kind === "duration"
              ? fmtDuration(s.durationSec)
              : ex.kind === "bodyweight"
                ? `× ${s.reps}`
                : `${fmt(s.weightKg, (s.weightKg ?? 0) % 1 ? 1 : 0, language)} kg × ${s.reps}`;
          return (
            <div key={`${p.workoutId}-${p.exerciseIndex}-${p.setIndex}`} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{ex.name}</p>
                <p className="c-help truncate">
                  {fmtDate(w.startedAt)}
                  {m && ` · ${t(m.en, m.vi)}`} · {p.types.map((ty) => t(PR_LABELS[ty].en, PR_LABELS[ty].vi)).join(", ")}
                </p>
              </div>
              <span className="flex items-center gap-1.5 flex-none font-semibold tabular-nums">
                <Medal size={14} className="text-[var(--color-accent)]" aria-hidden />
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
