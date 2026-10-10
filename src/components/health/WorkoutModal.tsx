"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { EXERCISES, findExercise } from "@/lib/exercises";
import {
  EXERCISE_KINDS, MUSCLES, e1rm, exerciseVolume, fmt, fmtSet, lastPerformance,
} from "@/lib/health";
import { useHealth } from "@/components/health/HealthContext";
import {
  fromLocalInput, fmtDate, sendJson, toLocalInput, type WExercise, type WSet, type WorkoutDraft,
} from "@/components/health/types";

const emptySet = (): WSet => ({ weightKg: null, reps: null, durationSec: null, warmup: false });

const numOrNull = (s: string) => {
  if (!s.trim()) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** "1:30" / "90" / "1m30s" → giây. */
function parseDuration(s: string): number | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  const colon = v.match(/^(\d+):(\d{1,2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const hms = v.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/);
  if (hms && (hms[1] || hms[2] || hms[3])) return Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const durText = (sec: number | null) =>
  sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "";

/**
 * Ghi / sửa một buổi tập.
 *
 * Mỗi bài hiện "lần trước" ngay dưới tên — đó là thứ Hevy/Strong làm cho người
 * tập biết hôm nay cần vượt mức nào. Hiệp mới chép số của hiệp ngay trên, vì
 * phần lớn hiệp chỉ đổi một trong hai con số.
 */
export default function WorkoutModal({
  draft: initial,
  onClose,
  onSaved,
}: {
  draft: WorkoutDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, language } = useLanguage();
  const { profile, workouts } = useHealth();
  const [draft, setDraft] = useState<WorkoutDraft>(initial);
  const [minutes, setMinutes] = useState(initial.durationSec ? String(Math.round(initial.durationSec / 60)) : "");
  // Ô thời lượng của bài plank gõ dạng chữ "1:30" — giữ chuỗi gốc khi đang gõ.
  const [durInputs, setDurInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const history = (workouts ?? []).filter((w) => w.id !== draft.id);

  const setExercise = (i: number, patch: Partial<WExercise>) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((ex, j) => (j === i ? { ...ex, ...patch } : ex)) }));

  const setSet = (i: number, si: number, patch: Partial<WSet>) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((ex, j) =>
        j === i ? { ...ex, sets: ex.sets.map((s, k) => (k === si ? { ...s, ...patch } : s)) } : ex
      ),
    }));

  const addExercise = () =>
    setDraft((d) => ({
      ...d,
      exercises: [...d.exercises, { name: "", muscleGroup: null, kind: "weight", sets: [emptySet()] }],
    }));

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.exercises.length) return d;
      const list = [...d.exercises];
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, exercises: list };
    });

  const onName = (i: number, name: string) => {
    // Chọn đúng một bài trong danh mục: điền sẵn nhóm cơ và kiểu bài.
    const hit = findExercise(name);
    const ex = draft.exercises[i];
    setExercise(i, {
      name,
      ...(hit && !ex.muscleGroup ? { muscleGroup: hit.muscle } : {}),
      ...(hit ? { kind: hit.kind } : {}),
    });
  };

  const save = async (force = false) => {
    const startedAt = fromLocalInput(draft.startedAt);
    if (!startedAt) return setError(t("Pick the start time", "Chưa chọn giờ bắt đầu"));
    const exercises = draft.exercises.filter((ex) => ex.name.trim());
    if (!exercises.length) return setError(t("Add at least one exercise", "Thêm ít nhất một bài"));
    const unnamed = exercises.find((ex) => !ex.muscleGroup);
    if (unnamed) {
      return setError(
        t(`Pick a muscle group for "${unnamed.name}"`, `Chọn nhóm cơ cho "${unnamed.name}" — cần để đếm số hiệp mỗi nhóm cơ`)
      );
    }
    setSaving(true);
    setError(null);
    try {
      await sendJson("/api/health/workouts", draft.id ? "PUT" : "POST", {
        id: draft.id,
        profileId: profile?.id,
        title: draft.title,
        startedAt,
        durationSec: minutes ? Math.round(Number(minutes) * 60) : null,
        calories: draft.calories,
        note: draft.note,
        source: draft.source,
        exercises,
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-[var(--color-surface)] w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <h2 className="c-h4 min-w-0 truncate">
            {draft.id ? t("Edit workout", "Sửa buổi tập") : t("Log a workout", "Ghi buổi tập")}
            <span className="text-[var(--color-text-faint)] font-normal"> · {profile?.name}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label={t("Close", "Đóng")} className="c-btn c-btn-tertiary c-btn-icon">
            <X size={18} />
          </button>
        </div>

        <datalist id="exercise-catalog">
          {/* value là tên chuẩn tiếng Anh và được LƯU nguyên văn — không dịch. */}
          {EXERCISES.map((e) => (
            <option key={e.name} value={e.name}>
              {e.vi}
            </option>
          ))}
        </datalist>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {draft.source === "import" && !draft.id && (
            <div className="c-alert c-alert-info">
              <span>
                {t(
                  "Read from screenshots. Check every set before saving.",
                  "Đã đọc từ ảnh chụp. Soát từng hiệp trước khi lưu."
                )}
              </span>
            </div>
          )}

          <div className="c-field">
            <label htmlFor="w-title">{t("Title", "Tên buổi")}</label>
            <input
              id="w-title"
              className="c-input"
              value={draft.title}
              maxLength={120}
              placeholder={t("Back & biceps", "Lưng – tay trước")}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="c-field col-span-2 sm:col-span-1">
              <label htmlFor="w-at">{t("Started", "Bắt đầu")}</label>
              <input
                id="w-at"
                type="datetime-local"
                className="c-input"
                value={draft.startedAt}
                onChange={(e) => setDraft((d) => ({ ...d, startedAt: e.target.value }))}
              />
            </div>
            <div className="c-field">
              <label htmlFor="w-min">{t("Minutes", "Số phút")}</label>
              <input id="w-min" className="c-input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
            <div className="c-field">
              <label htmlFor="w-kcal">{t("Calories (est.)", "Calo (ước tính)")}</label>
              <input
                id="w-kcal"
                className="c-input"
                inputMode="numeric"
                value={draft.calories ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, calories: numOrNull(e.target.value) }))}
              />
            </div>
          </div>

          {draft.exercises.map((ex, i) => {
            const last = ex.name.trim() ? lastPerformance(history, ex.name, fromLocalInput(draft.startedAt) ?? undefined) : null;
            const vol = exerciseVolume(ex);
            return (
              <section key={i} className="rounded-2xl border border-[var(--color-border)] p-3 flex flex-col gap-3">
                {/* Tên bài và nút đổi thứ tự một hàng; hai ô chọn một hàng riêng đủ rộng —
                    chung hàng với nút thì ở 375px chữ bị cắt còn "Muscle g". */}
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <input
                      className="c-input font-semibold"
                      list="exercise-catalog"
                      value={ex.name}
                      placeholder={t("Exercise", "Tên bài tập")}
                      aria-label={t("Exercise", "Tên bài tập")}
                      onChange={(e) => onName(i, e.target.value)}
                    />
                  </div>
                  <div className="flex flex-none">
                    <button type="button" onClick={() => move(i, -1)} aria-label={t("Move up", "Lên")} className="c-btn c-btn-tertiary c-btn-icon">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} aria-label={t("Move down", "Xuống")} className="c-btn c-btn-tertiary c-btn-icon">
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="c-input"
                    aria-label={t("Muscle group", "Nhóm cơ")}
                    value={ex.muscleGroup ?? ""}
                    onChange={(e) => setExercise(i, { muscleGroup: e.target.value || null })}
                  >
                    <option value="">{t("Muscle…", "Nhóm cơ…")}</option>
                    {MUSCLES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {t(m.en, m.vi)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="c-input"
                    aria-label={t("Type", "Kiểu bài")}
                    value={ex.kind}
                    onChange={(e) => setExercise(i, { kind: e.target.value })}
                  >
                    {EXERCISE_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {t(k.en, k.vi)}
                      </option>
                    ))}
                  </select>
                </div>

                {last && (
                  <p className="c-help">
                    {t("Last time", "Lần trước")} ({fmtDate(last.startedAt)}):{" "}
                    {last.exercise.sets
                      .filter((s) => !s.warmup)
                      .map((s) => fmtSet(s, last.exercise.kind, language))
                      .join(" · ")}
                  </p>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-[28px_1fr_1fr_48px_36px] gap-2 text-[11px] text-[var(--color-text-faint)] px-1">
                    <span>#</span>
                    {ex.kind === "duration" ? (
                      <span className="col-span-2">{t("Time (m:ss)", "Thời lượng (p:gg)")}</span>
                    ) : (
                      <>
                        <span>{ex.kind === "bodyweight" ? t("+kg", "+kg") : "kg"}</span>
                        <span>{t("Reps", "Lần")}</span>
                      </>
                    )}
                    <span className="text-right">{ex.kind === "weight" ? "1RM" : ""}</span>
                    <span />
                  </div>
                  {ex.sets.map((s, si) => {
                    const est = ex.kind === "weight" ? e1rm(s.weightKg, s.reps) : null;
                    const key = `${i}-${si}`;
                    return (
                      <div key={si} className="grid grid-cols-[28px_1fr_1fr_48px_36px] gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => setSet(i, si, { warmup: !s.warmup })}
                          title={t("Toggle warm-up", "Đánh dấu hiệp khởi động")}
                          className={`h-9 rounded-full text-xs font-bold ${
                            s.warmup ? "bg-[var(--color-surface-3)] text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {s.warmup ? "W" : si + 1 - ex.sets.slice(0, si).filter((x) => x.warmup).length}
                        </button>
                        {ex.kind === "duration" ? (
                          <input
                            className="c-input col-span-2"
                            inputMode="numeric"
                            placeholder="1:30"
                            aria-label={t("Duration", "Thời lượng")}
                            value={durInputs[key] ?? durText(s.durationSec)}
                            onChange={(e) => {
                              setDurInputs((d) => ({ ...d, [key]: e.target.value }));
                              setSet(i, si, { durationSec: parseDuration(e.target.value) });
                            }}
                          />
                        ) : (
                          <>
                            <input
                              className="c-input"
                              inputMode="decimal"
                              aria-label="kg"
                              value={s.weightKg ?? ""}
                              onChange={(e) => setSet(i, si, { weightKg: numOrNull(e.target.value) })}
                            />
                            <input
                              className="c-input"
                              inputMode="numeric"
                              aria-label={t("Reps", "Số lần")}
                              value={s.reps ?? ""}
                              onChange={(e) => setSet(i, si, { reps: numOrNull(e.target.value) })}
                            />
                          </>
                        )}
                        <span
                          className={`text-right text-sm tabular-nums ${est && !est.reliable ? "text-[var(--color-text-faint)]" : ""}`}
                          title={est && !est.reliable ? t("Above 12 reps the estimate is rough", "Trên 12 lần ước lượng kém tin cậy") : undefined}
                        >
                          {est ? Math.round(est.value) : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExercise(i, { sets: ex.sets.length > 1 ? ex.sets.filter((_, k) => k !== si) : [emptySet()] })
                          }
                          aria-label={t("Remove set", "Bỏ hiệp")}
                          className="c-btn c-btn-tertiary c-btn-icon"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExercise(i, { sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] ?? emptySet()), warmup: false }] })}
                      className="c-btn c-btn-secondary c-btn-sm"
                    >
                      <Plus size={14} /> {t("Set", "Hiệp")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}
                      className="c-btn c-btn-tertiary c-btn-sm"
                    >
                      <Trash2 size={14} /> {t("Exercise", "Bài")}
                    </button>
                  </div>
                  {vol > 0 && (
                    <span className="c-help tabular-nums">
                      {fmt(vol, 0, language)} kg {t("volume", "khối lượng")}
                    </span>
                  )}
                </div>
              </section>
            );
          })}

          <button type="button" onClick={addExercise} className="c-btn c-btn-secondary self-start">
            <Plus size={16} /> {t("Add exercise", "Thêm bài tập")}
          </button>

          <div className="c-field">
            <label htmlFor="w-note">{t("Notes", "Ghi chú")}</label>
            <textarea
              id="w-note"
              className="c-textarea"
              rows={2}
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            />
          </div>

          {error && <p className="c-help error">{error}</p>}
          {duplicate && (
            <button type="button" onClick={() => save(true)} className="c-btn c-btn-secondary c-btn-sm self-start">
              {t("It's a different workout — save anyway", "Đây là buổi khác — vẫn lưu")}
            </button>
          )}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-[var(--color-border)] flex gap-2">
          <button type="button" onClick={onClose} className="c-btn c-btn-secondary flex-1">
            {t("Cancel", "Huỷ")}
          </button>
          <button type="button" onClick={() => save(false)} disabled={saving} className="c-btn c-btn-primary flex-1">
            {saving ? <Loader2 size={16} className="animate-spin" /> : t("Save workout", "Lưu buổi tập")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bản nháp trống cho một buổi tập mới. */
export function newWorkoutDraft(): WorkoutDraft {
  return {
    title: "",
    startedAt: toLocalInput(),
    durationSec: null,
    calories: null,
    note: "",
    source: "manual",
    exercises: [{ name: "", muscleGroup: null, kind: "weight", sets: [emptySet()] }],
  };
}
