"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { METRICS, fmt, toneTint, toneVar, type MetricKey, type Reading, type Tone } from "@/lib/health";

/** Nhãn trạng thái: chữ mang màu ngữ nghĩa trên nền tint — đúng luật màu của hệ. */
export function StatusChip({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: toneTint(tone), color: toneVar(tone) }}
    >
      {label}
    </span>
  );
}

/**
 * Thanh ngưỡng ba khúc (thấp | bình thường | cao) với một vạch đánh dấu giá trị.
 * Khúc giữa luôn chiếm 1/3 bề ngang; hai khúc ngoài trải đều nửa khoảng bình
 * thường mỗi bên — đủ để thấy "vượt bao xa" mà không cần trục số.
 */
export function RangeBar({ value, range, tone }: { value: number; range: [number, number]; tone: Tone }) {
  const [lo, hi] = range;
  const span = hi - lo || 1;
  const min = lo - span / 2;
  const max = hi + span / 2;
  const pos = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <div className="relative h-1.5 rounded-full bg-[var(--color-surface-2)]" aria-hidden>
      <div className="absolute inset-y-0 left-1/4 right-1/4 bg-[var(--viz-ghost)]" />
      <div
        className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-surface)]"
        style={{ left: `${pos * 100}%`, background: toneVar(tone) }}
      />
    </div>
  );
}

/** Một dòng chỉ số: nhãn · giá trị · ngưỡng · trạng thái. */
export function MetricRow({ k, reading }: { k: MetricKey; reading: Reading }) {
  const { t, language } = useLanguage();
  const def = METRICS[k];
  return (
    <div className="flex flex-col gap-1.5 py-2.5 border-b border-[var(--color-border)] last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm min-w-0 truncate">{t(def.en, def.vi)}</span>
        <span className="flex items-center gap-2 flex-none">
          <span className="font-semibold tabular-nums" style={{ color: reading.tone === "neutral" || reading.tone === "good" ? undefined : toneVar(reading.tone) }}>
            {fmt(reading.value, def.digits, language)}
            {def.unit && <span className="text-xs font-normal text-[var(--color-text-faint)]"> {def.unit}</span>}
          </span>
          {reading.label && <StatusChip tone={reading.tone} label={t(reading.label.en, reading.label.vi)} />}
        </span>
      </div>
      {reading.range && (
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <RangeBar value={reading.value} range={reading.range} tone={reading.tone} />
          <span className="text-[11px] text-[var(--color-text-faint)] tabular-nums">
            {fmt(reading.range[0], def.digits, language)}–{fmt(reading.range[1], def.digits, language)}
          </span>
        </div>
      )}
    </div>
  );
}
