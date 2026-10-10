"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useHealth } from "@/components/health/HealthContext";
import {
  SEGMENT_LABELS, fromLocalInput, sendJson, toLocalInput,
  type HealthProfile, type Measurement, type Segments,
} from "@/components/health/types";

/** Ô nhập số trong form, theo nhóm như phiếu kết quả. */
const FIELD_GROUPS: { en: string; vi: string; fields: { key: string; en: string; vi: string; unit?: string }[] }[] = [
  {
    en: "Basics", vi: "Cơ bản",
    fields: [
      { key: "weightKg", en: "Weight", vi: "Cân nặng", unit: "kg" },
      { key: "heightCm", en: "Height", vi: "Chiều cao", unit: "cm" },
      { key: "age", en: "Age", vi: "Tuổi" },
      { key: "bodyScore", en: "Body score", vi: "Điểm hình thể", unit: "/100" },
      { key: "systolic", en: "BP systolic", vi: "Huyết áp tâm thu", unit: "mmHg" },
      { key: "diastolic", en: "BP diastolic", vi: "Huyết áp tâm trương", unit: "mmHg" },
      { key: "heartRate", en: "Heart rate", vi: "Nhịp tim", unit: "bpm" },
    ],
  },
  {
    en: "Composition", vi: "Thành phần",
    fields: [
      { key: "bmi", en: "BMI", vi: "BMI" },
      { key: "pbf", en: "Body fat", vi: "Tỷ lệ mỡ", unit: "%" },
      { key: "fatMassKg", en: "Fat mass", vi: "Khối lượng mỡ", unit: "kg" },
      { key: "smmKg", en: "Skeletal muscle", vi: "Cơ xương (SMM)", unit: "kg" },
      { key: "leanMassKg", en: "Lean mass", vi: "Khối lượng nạc", unit: "kg" },
      { key: "musclePct", en: "Muscle %", vi: "Tỷ lệ cơ bắp", unit: "%" },
      { key: "smi", en: "Skeletal muscle index", vi: "Chỉ số cơ xương", unit: "kg/m²" },
      { key: "visceralFat", en: "Visceral fat level", vi: "Mỡ nội tạng" },
      { key: "whr", en: "Waist–hip ratio", vi: "Eo/hông" },
    ],
  },
  {
    en: "Water, protein, minerals", vi: "Nước, đạm, khoáng",
    fields: [
      { key: "proteinPct", en: "Protein %", vi: "Tỷ lệ đạm", unit: "%" },
      { key: "proteinKg", en: "Protein", vi: "Khối lượng đạm", unit: "kg" },
      { key: "mineralKg", en: "Minerals", vi: "Khoáng chất", unit: "kg" },
      { key: "waterPct", en: "Water %", vi: "Tỷ lệ nước", unit: "%" },
      { key: "waterL", en: "Body water", vi: "Thể tích nước", unit: "L" },
    ],
  },
  {
    en: "Metabolism & device advice", vi: "Trao đổi chất & khuyến nghị của máy",
    fields: [
      { key: "bmr", en: "BMR", vi: "BMR", unit: "kcal" },
      { key: "bmrLow", en: "BMR range low", vi: "BMR khuyến nghị từ", unit: "kcal" },
      { key: "bmrHigh", en: "BMR range high", vi: "BMR khuyến nghị đến", unit: "kcal" },
      { key: "maintenanceKcal", en: "Maintenance", vi: "Calo duy trì", unit: "kcal" },
      { key: "targetWeightKg", en: "Target weight", vi: "Cân nặng mục tiêu", unit: "kg" },
      { key: "weightControlKg", en: "Weight control", vi: "Điều chỉnh cân nặng", unit: "kg" },
      { key: "muscleControlKg", en: "Muscle control", vi: "Điều chỉnh cơ", unit: "kg" },
      { key: "fatControlKg", en: "Fat control", vi: "Điều chỉnh mỡ", unit: "kg" },
      { key: "obesityPct", en: "Obesity ratio", vi: "Tỷ lệ béo phì", unit: "%" },
    ],
  },
];

const ALL_KEYS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

type Draft = {
  profileId: string;
  measuredAt: string;
  device: string;
  bodyType: string;
  note: string;
  fileName: string;
  source: "manual" | "import";
  values: Record<string, string>;
  lean: Record<string, string>;
  fat: Record<string, string>;
  ranges: Measurement["ranges"];
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function fromMeasurement(m: Partial<Measurement> | null, profile: HealthProfile): Draft {
  const values: Record<string, string> = {};
  for (const k of ALL_KEYS) values[k] = str((m as Record<string, unknown> | null)?.[k]);
  if (!values.heightCm && profile.heightCm) values.heightCm = String(profile.heightCm);
  const seg = (s: Segments | null | undefined) =>
    Object.fromEntries(SEGMENT_LABELS.map(({ key }) => [key, str(s?.[key])]));
  return {
    profileId: m?.profileId ?? profile.id,
    measuredAt: m?.measuredAt ? toLocalInput(m.measuredAt) : toLocalInput(),
    device: m?.device ?? "",
    bodyType: m?.bodyType ?? "",
    note: m?.note ?? "",
    fileName: m?.fileName ?? "",
    source: m?.source === "import" ? "import" : "manual",
    values,
    lean: seg(m?.segmentalLean),
    fat: seg(m?.segmentalFat),
    ranges: m?.ranges ?? null,
  };
}

const toNum = (s: string) => {
  if (!s.trim()) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Thêm/sửa một lần đo. Ba đường vào:
 * 1. Nhập phiếu (PDF/ảnh) → AI đọc → form điền sẵn → người dùng soát → lưu.
 * 2. Nhập tay (cân ở nhà chỉ có vài số).
 * 3. Sửa một lần đo đã có.
 *
 * Đọc xong KHÔNG tự lưu: AI nhầm một chữ số là cả đường xu hướng lệch.
 */
export default function MeasurementModal({
  measurement,
  startWithImport,
  onClose,
  onSaved,
}: {
  measurement: Measurement | null;
  startWithImport?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const { profiles, profile } = useHealth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<"pick" | "form">(measurement || !startWithImport ? "form" : "pick");
  const [draft, setDraft] = useState<Draft>(() => fromMeasurement(measurement, profile!));
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [readName, setReadName] = useState<string | null>(null);

  const people = profiles ?? [];
  const chosen = people.find((p) => p.id === draft.profileId) ?? profile!;

  const setValue = (key: string, v: string) => setDraft((d) => ({ ...d, values: { ...d.values, [key]: v } }));

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("kind", "body");
      for (const f of Array.from(files)) form.append("file", f);
      const res = await fetch("/api/health/import", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Lỗi ${res.status}`);
      const data = json.data ?? {};
      // Đoán người theo tên in trên phiếu; phiếu che tên (*****) thì giữ người đang chọn.
      const name = typeof data.personName === "string" && !data.personName.includes("*") ? data.personName : null;
      const norm = (s: string) => s.normalize("NFC").toLowerCase().trim();
      const byName = name ? people.find((p) => norm(p.name) === norm(name)) : undefined;
      const base = fromMeasurement(
        { ...data, profileId: byName?.id ?? draft.profileId, source: "import", fileName: json.fileName },
        byName ?? chosen
      );
      setDraft({ ...base, source: "import" });
      setReadName(name);
      setStage("form");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  const save = async (force = false) => {
    const measuredAt = fromLocalInput(draft.measuredAt);
    if (!measuredAt) return setError(t("Pick the measurement time", "Chưa chọn thời gian đo"));
    const values = Object.fromEntries(ALL_KEYS.map((k) => [k, toNum(draft.values[k] ?? "")]));
    if (Object.values(values).every((v) => v === null)) {
      return setError(t("Enter at least one number", "Chưa có con số nào"));
    }
    const seg = (s: Record<string, string>) => {
      const out = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, toNum(v)]).filter(([, v]) => v !== null));
      return Object.keys(out).length ? out : null;
    };
    setSaving(true);
    setError(null);
    try {
      await sendJson("/api/health/measurements", measurement ? "PUT" : "POST", {
        id: measurement?.id,
        profileId: draft.profileId,
        measuredAt,
        device: draft.device,
        bodyType: draft.bodyType,
        note: draft.note,
        fileName: draft.fileName,
        source: draft.source,
        ...values,
        segmentalLean: seg(draft.lean),
        segmentalFat: seg(draft.fat),
        ranges: draft.ranges,
        force,
      });
      onSaved();
    } catch (e) {
      const err = e as Error & { duplicate?: boolean };
      setDuplicate(Boolean(err.duplicate));
      setError(err.message);
      setSaving(false);
    }
  };

  // Phiếu của người khác lọt vào hồ sơ đang chọn là lỗi khó thấy nhất: soát
  // chiều cao với hồ sơ.
  const heightRead = toNum(draft.values.heightCm ?? "");
  const heightMismatch =
    chosen.heightCm && heightRead && Math.abs(heightRead - chosen.heightCm) > 3 ? heightRead : null;
  const rangeCount = draft.ranges ? Object.keys(draft.ranges).length : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-[var(--color-surface)] w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <h2 className="c-h4">
            {measurement ? t("Edit measurement", "Sửa lần đo") : t("New measurement", "Lần đo mới")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("Close", "Đóng")} className="c-btn c-btn-tertiary c-btn-icon">
            <X size={18} />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            readFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {stage === "pick" ? (
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-4">
            <button
              type="button"
              disabled={reading}
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl border-2 border-dashed border-[var(--color-border)] p-8 flex flex-col items-center gap-3 text-center hover:bg-[var(--color-surface-2)] transition-colors"
            >
              {reading ? <Loader2 size={28} className="animate-spin" /> : <FileUp size={28} className="text-[var(--color-accent)]" />}
              <span className="font-semibold">
                {reading ? t("Reading the report…", "Đang đọc phiếu…") : t("Choose a report (PDF or photos)", "Chọn phiếu kết quả (PDF hoặc ảnh)")}
              </span>
              <span className="c-help">
                {t(
                  "InBody, CiviPay/GoTrust kiosk, smart-scale screenshots — up to 6 files. Nothing is saved until you review it.",
                  "InBody, trạm đo CiviPay/GoTrust, ảnh chụp app cân — tối đa 6 tệp. Chưa lưu gì cho tới khi bạn soát lại."
                )}
              </span>
            </button>
            {error && <p className="c-help error">{error}</p>}
            <button type="button" onClick={() => setStage("form")} className="c-btn c-btn-tertiary self-center">
              {t("Enter numbers by hand instead", "Nhập tay thay vì đọc phiếu")}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
            {draft.source === "import" && !measurement && (
              <div className="c-alert c-alert-info">
                <AlertTriangle size={16} className="icon" />
                <span>
                  {t(
                    `Read from ${draft.fileName || "the report"}. Check every number against the report before saving.`,
                    `Đã đọc từ ${draft.fileName || "phiếu"}. Soát từng con số với phiếu trước khi lưu.`
                  )}
                  {readName && ` ${t("Name on report", "Tên trên phiếu")}: ${readName}.`}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="c-field">
                <label htmlFor="m-person">{t("Person", "Người được đo")}</label>
                <select
                  id="m-person"
                  className="c-input"
                  value={draft.profileId}
                  onChange={(e) => setDraft((d) => ({ ...d, profileId: e.target.value }))}
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="c-field">
                <label htmlFor="m-at">{t("Measured at", "Thời gian đo")}</label>
                <input
                  id="m-at"
                  type="datetime-local"
                  className="c-input"
                  value={draft.measuredAt}
                  onChange={(e) => setDraft((d) => ({ ...d, measuredAt: e.target.value }))}
                />
              </div>
            </div>

            {heightMismatch && (
              <p className="c-help error">
                {t(
                  `Height on this report is ${heightMismatch} cm, but ${chosen.name} is ${chosen.heightCm} cm — is this the right person?`,
                  `Chiều cao trên phiếu là ${heightMismatch} cm, hồ sơ ${chosen.name} là ${chosen.heightCm} cm — đúng người chưa?`
                )}
              </p>
            )}

            {FIELD_GROUPS.map((group) => (
              <fieldset key={group.en} className="flex flex-col gap-2">
                <legend className="c-overline mb-2">{t(group.en, group.vi)}</legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {group.fields.map((f) => (
                    <div key={f.key} className="c-field min-w-0">
                      <label htmlFor={`m-${f.key}`} className="truncate">
                        {t(f.en, f.vi)}
                        {f.unit && <span className="text-[var(--color-text-faint)] font-normal"> · {f.unit}</span>}
                      </label>
                      <input
                        id={`m-${f.key}`}
                        className="c-input"
                        inputMode="decimal"
                        value={draft.values[f.key] ?? ""}
                        onChange={(e) => setValue(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}

            <fieldset className="flex flex-col gap-2">
              <legend className="c-overline mb-2">{t("Lean mass by segment (kg)", "Nạc theo vùng (kg)")}</legend>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {SEGMENT_LABELS.map((s) => (
                  <div key={s.key} className="c-field min-w-0">
                    <label htmlFor={`lean-${s.key}`} className="truncate">{t(s.en, s.vi)}</label>
                    <input
                      id={`lean-${s.key}`}
                      className="c-input"
                      inputMode="decimal"
                      value={draft.lean[s.key] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, lean: { ...d.lean, [s.key]: e.target.value } }))}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="c-overline mb-2">{t("Fat mass by segment (kg)", "Mỡ theo vùng (kg)")}</legend>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {SEGMENT_LABELS.map((s) => (
                  <div key={s.key} className="c-field min-w-0">
                    <label htmlFor={`fat-${s.key}`} className="truncate">{t(s.en, s.vi)}</label>
                    <input
                      id={`fat-${s.key}`}
                      className="c-input"
                      inputMode="decimal"
                      value={draft.fat[s.key] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, fat: { ...d.fat, [s.key]: e.target.value } }))}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="c-field">
                <label htmlFor="m-device">{t("Device / station", "Thiết bị / trạm đo")}</label>
                <input
                  id="m-device"
                  className="c-input"
                  value={draft.device}
                  placeholder="InBody 270, CiviPay…"
                  onChange={(e) => setDraft((d) => ({ ...d, device: e.target.value }))}
                />
              </div>
              <div className="c-field">
                <label htmlFor="m-type">{t("Body type (as printed)", "Phân loại hình thể (theo phiếu)")}</label>
                <input
                  id="m-type"
                  className="c-input"
                  value={draft.bodyType}
                  onChange={(e) => setDraft((d) => ({ ...d, bodyType: e.target.value }))}
                />
              </div>
            </div>

            <div className="c-field">
              <label htmlFor="m-note">{t("Conditions & notes", "Điều kiện đo & ghi chú")}</label>
              <textarea
                id="m-note"
                className="c-textarea"
                rows={2}
                value={draft.note}
                placeholder={t("e.g. morning, fasted, before training", "vd: buổi sáng, nhịn ăn, trước khi tập")}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              />
              <p className="c-help">
                {t(
                  "Measure at the same time of day, fasted and before training — otherwise water swings the numbers more than real change.",
                  "Đo cùng giờ, lúc đói và trước khi tập — không thì lượng nước làm số nhảy nhiều hơn cả thay đổi thật."
                )}
              </p>
            </div>

            {rangeCount > 0 && (
              <p className="c-help">
                {t(
                  `Also keeps ${rangeCount} personal normal ranges printed on the report.`,
                  `Lưu kèm ${rangeCount} ngưỡng bình thường cá nhân in trên phiếu.`
                )}
              </p>
            )}

            {error && <p className="c-help error">{error}</p>}
            {duplicate && (
              <button type="button" onClick={() => save(true)} className="c-btn c-btn-secondary c-btn-sm self-start">
                {t("It's a different measurement — save anyway", "Đây là lần đo khác — vẫn lưu")}
              </button>
            )}
          </div>
        )}

        {stage === "form" && (
          <div className="shrink-0 px-5 py-4 border-t border-[var(--color-border)] flex gap-2">
            <button type="button" onClick={onClose} className="c-btn c-btn-secondary flex-1">
              {t("Cancel", "Huỷ")}
            </button>
            <button type="button" onClick={() => save(false)} disabled={saving} className="c-btn c-btn-primary flex-1">
              {saving ? <Loader2 size={16} className="animate-spin" /> : t("Save measurement", "Lưu lần đo")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
