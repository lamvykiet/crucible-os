"use client";

import { useState } from "react";
import { ChevronDown, FileUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  METRICS, METRIC_GROUPS, bmiClass, bpCategory, change, fmt, fmtSigned, readMetric, toneVar,
  type MetricKey,
} from "@/lib/health";
import { useHealth } from "@/components/health/HealthContext";
import HealthShell from "@/components/health/HealthShell";
import MeasurementModal from "@/components/health/MeasurementModal";
import { MetricRow, StatusChip } from "@/components/health/parts";
import { SEGMENT_LABELS, fmtDate, sendJson, type Measurement } from "@/components/health/types";

/** Bốn số trên mỗi thẻ lần đo — đủ để nhận ra lần đo, phần còn lại mở ra mới thấy. */
const HEADLINE: MetricKey[] = ["weightKg", "pbf", "smmKg", "fatMassKg"];

/** Cùng hướng là tốt: giảm mỡ, tăng cơ. Cân nặng không có hướng chung. */
const GOOD_DIRECTION: Partial<Record<MetricKey, 1 | -1>> = { pbf: -1, fatMassKg: -1, smmKg: 1, leanMassKg: 1 };

export default function BodyHistory() {
  const { t } = useLanguage();
  const { profile, measurements, reloadData } = useHealth();
  const [modal, setModal] = useState<{ m: Measurement | null; importing: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const list = [...(measurements ?? [])].reverse();

  return (
    <HealthShell
      title={t("Body composition", "Thành phần cơ thể")}
      lede={t("Every measurement, newest first.", "Mọi lần đo, mới nhất trước.")}
      actions={
        <>
          <button type="button" onClick={() => setModal({ m: null, importing: false })} className="c-btn c-btn-secondary">
            <Plus size={16} /> {t("Enter by hand", "Nhập tay")}
          </button>
          <button type="button" onClick={() => setModal({ m: null, importing: true })} className="c-btn c-btn-primary">
            <FileUp size={16} /> {t("Import report", "Nhập phiếu đo")}
          </button>
        </>
      }
    >
      {measurements === null ? (
        <div className="c-card h-40 grid place-content-center text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <section className="c-card text-center py-10">
          <p className="c-card-body">
            {t(
              `No measurements for ${profile?.name} yet. Import a report PDF or enter the numbers by hand.`,
              `${profile?.name} chưa có lần đo nào. Nhập phiếu PDF hoặc gõ tay các con số.`
            )}
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((m, i) => (
            <MeasurementCard
              key={m.id}
              m={m}
              prev={list[i + 1] ?? null}
              open={open === m.id}
              onToggle={() => setOpen(open === m.id ? null : m.id)}
              onEdit={() => setModal({ m, importing: false })}
              onDeleted={reloadData}
            />
          ))}
        </div>
      )}

      {modal && profile && (
        <MeasurementModal
          measurement={modal.m}
          startWithImport={modal.importing}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reloadData();
          }}
        />
      )}
    </HealthShell>
  );
}

function MeasurementCard({
  m,
  prev,
  open,
  onToggle,
  onEdit,
  onDeleted,
}: {
  m: Measurement;
  prev: Measurement | null;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const { t, language } = useLanguage();
  const { profile } = useHealth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const sex = profile?.sex ?? "male";

  const remove = async () => {
    setBusy(true);
    try {
      await sendJson(`/api/health/measurements?id=${m.id}`, "DELETE");
      onDeleted();
    } catch {
      setBusy(false);
    }
  };

  const bp = m.systolic && m.diastolic ? bpCategory(m.systolic, m.diastolic) : null;

  return (
    <section className="c-card flex flex-col gap-3">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-start justify-between gap-3 text-left w-full">
        <div className="min-w-0">
          <p className="font-semibold">{fmtDate(m.measuredAt, true)}</p>
          <p className="c-help truncate">
            {[m.device, m.bodyScore != null ? `${t("score", "điểm")} ${m.bodyScore}/100` : null].filter(Boolean).join(" · ") ||
              t("Manual entry", "Nhập tay")}
          </p>
        </div>
        <ChevronDown size={18} className={`flex-none mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {HEADLINE.map((k) => {
          const def = METRICS[k];
          const v = m[k];
          const c = change(k, prev, m);
          const dir = GOOD_DIRECTION[k];
          const tone = !c || c.withinNoise || !dir || Math.abs(c.diff) < 0.05 ? "neutral" : Math.sign(c.diff) === dir ? "good" : "bad";
          return (
            <div key={k} className="rounded-2xl bg-[var(--color-surface-2)] p-3 min-w-0">
              <div className="text-[11px] text-[var(--color-text-muted)] truncate">{t(def.en, def.vi)}</div>
              <div className="font-bold tabular-nums">
                {fmt(v, def.digits, language)}
                {v != null && <span className="text-xs font-normal text-[var(--color-text-faint)]"> {def.unit}</span>}
              </div>
              {c && (
                <div className="text-[11px] tabular-nums" style={{ color: toneVar(tone) }}>
                  {fmtSigned(c.diff, def.digits, language)}
                  {c.withinNoise && <span className="text-[var(--color-text-faint)]"> · {t("within error", "trong sai số")}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {open && (
        <div className="flex flex-col gap-4 pt-1">
          {bp && (
            <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-border)]">
              <span className="text-sm">{t("Blood pressure", "Huyết áp")}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums" style={{ color: bp.tone === "good" ? undefined : toneVar(bp.tone) }}>
                  {m.systolic}/{m.diastolic}
                  <span className="text-xs font-normal text-[var(--color-text-faint)]"> mmHg</span>
                </span>
                <StatusChip tone={bp.tone} label={t(bp.en, bp.vi)} />
              </span>
            </div>
          )}

          {METRIC_GROUPS.map((g) => {
            const rows = g.keys
              .map((k) => ({ k, r: readMetric(k, m[k], sex, m.ranges) }))
              .filter((x): x is { k: MetricKey; r: NonNullable<typeof x.r> } => x.r !== null);
            if (!rows.length) return null;
            return (
              <div key={g.en}>
                <p className="c-overline mb-1">{t(g.en, g.vi)}</p>
                {rows.map(({ k, r }) => {
                  // BMI: thanh theo ngưỡng máy in, nhãn theo chuẩn châu Á.
                  if (k === "bmi") {
                    const cls = bmiClass(r.value);
                    return <MetricRow key={k} k={k} reading={{ ...r, tone: cls.tone, label: { en: cls.en, vi: cls.vi } }} />;
                  }
                  return <MetricRow key={k} k={k} reading={r} />;
                })}
              </div>
            );
          })}

          {m.segmentalLean && Object.keys(m.segmentalLean).length > 0 && (
            <div>
              <p className="c-overline mb-2">{t("By segment", "Theo vùng")}</p>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="c-table text-sm">
                  <thead>
                    <tr>
                      <th />
                      {SEGMENT_LABELS.map((s) => (
                        <th key={s.key} className="num whitespace-nowrap">{t(s.en, s.vi)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="whitespace-nowrap">{t("Lean kg", "Nạc kg")}</td>
                      {SEGMENT_LABELS.map((s) => (
                        <td key={s.key} className="num">{fmt(m.segmentalLean?.[s.key], 2, language)}</td>
                      ))}
                    </tr>
                    {m.segmentalFat && Object.keys(m.segmentalFat).length > 0 && (
                      <tr>
                        <td className="whitespace-nowrap">{t("Fat kg", "Mỡ kg")}</td>
                        {SEGMENT_LABELS.map((s) => (
                          <td key={s.key} className="num">{fmt(m.segmentalFat?.[s.key], 2, language)}</td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(m.targetWeightKg != null || m.fatControlKg != null || m.maintenanceKcal != null || m.bodyType) && (
            <div>
              <p className="c-overline mb-2">{t("Device recommendations", "Khuyến nghị của máy đo")}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {[
                  { en: "Target weight", vi: "Cân nặng mục tiêu", v: m.targetWeightKg != null ? `${fmt(m.targetWeightKg, 1, language)} kg` : null },
                  { en: "Fat control", vi: "Điều chỉnh mỡ", v: m.fatControlKg != null ? `${fmtSigned(m.fatControlKg, 1, language)} kg` : null },
                  { en: "Muscle control", vi: "Điều chỉnh cơ", v: m.muscleControlKg != null ? `${fmtSigned(m.muscleControlKg, 1, language)} kg` : null },
                  { en: "Maintenance", vi: "Calo duy trì", v: m.maintenanceKcal != null ? `${fmt(m.maintenanceKcal, 0, language)} kcal` : null },
                  { en: "Body type", vi: "Hình thể", v: m.bodyType },
                  { en: "BMR range", vi: "BMR khuyến nghị", v: m.bmrLow && m.bmrHigh ? `${m.bmrLow}–${m.bmrHigh}` : null },
                ]
                  .filter((x) => x.v)
                  .map((x) => (
                    <div key={x.en} className="rounded-2xl bg-[var(--color-surface-2)] p-3 min-w-0">
                      <div className="text-[11px] text-[var(--color-text-muted)] truncate">{t(x.en, x.vi)}</div>
                      <div className="font-semibold tabular-nums truncate">{x.v}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {m.note && <p className="c-card-body whitespace-pre-line">{m.note}</p>}

          <p className="text-[11px] text-[var(--color-text-faint)]">
            {t(
              "Status uses the ranges printed on the report when available, otherwise published standards (BMI: Asian cut-offs). Blood pressure: AHA 2017 — Vietnamese and ESC guidelines call hypertension from 140/90. For reference only, not a diagnosis.",
              "Trạng thái dùng ngưỡng in trên phiếu nếu có, không thì theo chuẩn công bố (BMI: chuẩn châu Á). Huyết áp theo AHA 2017 — hướng dẫn Việt Nam và ESC chỉ gọi là tăng huyết áp từ 140/90. Chỉ để tham khảo, không thay chẩn đoán."
            )}
          </p>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
            <button type="button" onClick={onEdit} className="c-btn c-btn-secondary c-btn-sm">
              <Pencil size={14} /> {t("Edit", "Sửa")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirm ? remove() : setConfirm(true))}
              className="c-btn c-btn-danger c-btn-sm"
            >
              <Trash2 size={14} /> {confirm ? t("Delete for good?", "Xoá hẳn?") : t("Delete", "Xoá")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
