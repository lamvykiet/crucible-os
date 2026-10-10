"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, ChevronDown, Copy, Loader2, Medal, Pencil, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  PR_LABELS, computeRecords, e1rm, fmt, fmtDuration, fmtSet, muscleLabel, workoutSets, workoutVolume,
  type PrType, type SetPr,
} from "@/lib/health";
import { useHealth } from "@/components/health/HealthContext";
import HealthShell from "@/components/health/HealthShell";
import WorkoutModal, { newWorkoutDraft } from "@/components/health/WorkoutModal";
import { fmtDate, sendJson, toLocalInput, type Workout, type WorkoutDraft } from "@/components/health/types";

/**
 * Nhật ký buổi tập và kỷ lục cá nhân.
 *
 * Kỷ lục tính trên TOÀN BỘ lịch sử của người đang chọn bằng `computeRecords` —
 * cùng một hàm với Tổng quan, nên huy chương ở hai nơi luôn khớp nhau.
 */
export default function WorkoutsView() {
  const { t, language } = useLanguage();
  const { profile, workouts, reloadData } = useHealth();
  const [view, setView] = useState<"log" | "records">("log");
  const [editing, setEditing] = useState<WorkoutDraft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { records, prs } = useMemo(() => computeRecords(workouts ?? []), [workouts]);

  const prsOf = (id: string) => prs.filter((p) => p.workoutId === id);

  const readScreens = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("kind", "workout");
      for (const f of Array.from(files)) form.append("file", f);
      const res = await fetch("/api/health/import", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Lỗi ${res.status}`);
      const d = json.data ?? {};
      setEditing({
        title: d.title ?? "",
        startedAt: d.startedAt && !Number.isNaN(new Date(d.startedAt).getTime()) ? toLocalInput(d.startedAt) : toLocalInput(),
        durationSec: d.durationSec ?? null,
        calories: d.calories ?? null,
        note: "",
        source: "import",
        exercises: (d.exercises ?? []).map((ex: Record<string, unknown>) => ({
          name: String(ex.name ?? ""),
          muscleGroup: (ex.muscleGroup as string) ?? null,
          kind: String(ex.kind ?? "weight"),
          sets: ((ex.sets as Record<string, unknown>[]) ?? []).map((s) => ({
            weightKg: (s.weightKg as number) ?? null,
            reps: (s.reps as number) ?? null,
            durationSec: (s.durationSec as number) ?? null,
            warmup: s.warmup === true,
          })),
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  const toDraft = (w: Workout, asNew: boolean): WorkoutDraft => ({
    id: asNew ? undefined : w.id,
    title: w.title,
    startedAt: asNew ? toLocalInput() : toLocalInput(w.startedAt),
    durationSec: asNew ? null : w.durationSec,
    calories: asNew ? null : w.calories,
    note: asNew ? "" : w.note ?? "",
    source: asNew ? "manual" : w.source === "import" ? "import" : "manual",
    exercises: w.exercises.map((ex) => ({
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      kind: ex.kind,
      sets: ex.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, durationSec: s.durationSec, warmup: s.warmup })),
    })),
  });

  const sortedRecords = [...records].sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return (
    <HealthShell
      title={t("Workouts", "Buổi tập")}
      lede={t("Sets, volume and personal records.", "Hiệp, khối lượng và kỷ lục cá nhân.")}
      actions={
        <>
          <button type="button" disabled={reading} onClick={() => fileRef.current?.click()} className="c-btn c-btn-secondary">
            {reading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {reading ? t("Reading…", "Đang đọc…") : t("From screenshots", "Từ ảnh chụp")}
          </button>
          <button type="button" onClick={() => setEditing(newWorkoutDraft())} className="c-btn c-btn-primary">
            <Plus size={16} /> {t("Log workout", "Ghi buổi tập")}
          </button>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          readScreens(e.target.files);
          e.target.value = "";
        }}
      />

      {error && <p className="c-help error">{error}</p>}

      <div className="c-seg">
        {[
          { v: "log", en: "Log", vi: "Nhật ký" },
          { v: "records", en: "Records", vi: "Kỷ lục" },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setView(o.v as typeof view)}
            className={`c-seg-opt flex-1 ${view === o.v ? "active" : ""}`}
          >
            {t(o.en, o.vi)}
          </button>
        ))}
      </div>

      {workouts === null ? (
        <div className="c-card h-40 grid place-content-center text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : workouts.length === 0 ? (
        <section className="c-card text-center py-10">
          <p className="c-card-body">
            {t(
              `No workouts for ${profile?.name} yet. Log one, or import screenshots from Hevy/Strong.`,
              `${profile?.name} chưa có buổi tập nào. Ghi một buổi, hoặc nhập ảnh chụp từ Hevy/Strong.`
            )}
          </p>
        </section>
      ) : view === "records" ? (
        <section className="c-card flex flex-col">
          {sortedRecords.map((r) => {
            const m = muscleLabel(r.muscleGroup);
            const main =
              r.kind === "duration"
                ? fmtDuration(r.best.duration)
                : r.kind === "bodyweight"
                  ? `${r.best.reps} ${t("reps", "lần")}`
                  : `${fmt(r.best.weight, r.best.weight % 1 ? 1 : 0, language)} kg`;
            return (
              <div key={r.name} className="flex items-center justify-between gap-3 py-3 border-b border-[var(--color-border)] last:border-b-0">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{r.name}</p>
                  <p className="c-help">
                    {m ? t(m.en, m.vi) : t("No muscle group", "Chưa có nhóm cơ")} · {r.sessions} {t("sessions", "buổi")} ·{" "}
                    {t("last", "gần nhất")} {fmtDate(r.lastAt)}
                  </p>
                </div>
                <div className="text-right flex-none">
                  <p className="font-bold tabular-nums">{main}</p>
                  {r.kind === "weight" && (
                    <p className="c-help tabular-nums">
                      1RM {Math.round(r.best.e1rm)} · {t("best set", "hiệp tốt nhất")} {fmt(r.best.setVolume, 0, language)} kg
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-[var(--color-text-faint)] pt-3">
            {t(
              "1RM is estimated with the Epley formula, the same one Hevy uses. Above 12 reps the estimate is rough.",
              "1RM ước tính theo công thức Epley, giống Hevy. Trên 12 lần/hiệp thì ước lượng kém tin cậy."
            )}
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          {workouts.map((w) => (
            <WorkoutCard
              key={w.id}
              w={w}
              prs={prsOf(w.id)}
              open={open === w.id}
              onToggle={() => setOpen(open === w.id ? null : w.id)}
              onEdit={() => setEditing(toDraft(w, false))}
              onRepeat={() => setEditing(toDraft(w, true))}
              onDeleted={reloadData}
            />
          ))}
        </div>
      )}

      {editing && (
        <WorkoutModal
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reloadData();
          }}
        />
      )}
    </HealthShell>
  );
}

function WorkoutCard({
  w,
  prs,
  open,
  onToggle,
  onEdit,
  onRepeat,
  onDeleted,
}: {
  w: Workout;
  prs: SetPr[];
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRepeat: () => void;
  onDeleted: () => void;
}) {
  const { t, language } = useLanguage();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const volume = workoutVolume(w);
  const prCount = prs.reduce((n, p) => n + p.types.length, 0);
  const muscles = [...new Set(w.exercises.map((e) => e.muscleGroup).filter(Boolean))]
    .map((m) => muscleLabel(m))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const remove = async () => {
    setBusy(true);
    try {
      await sendJson(`/api/health/workouts?id=${w.id}`, "DELETE");
      onDeleted();
    } catch {
      setBusy(false);
    }
  };

  const prTypes = (ei: number, si: number): PrType[] =>
    prs.find((p) => p.exerciseIndex === ei && p.setIndex === si)?.types ?? [];

  return (
    <section className="c-card flex flex-col gap-3">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-start justify-between gap-3 text-left w-full">
        <div className="min-w-0">
          <p className="font-semibold truncate">{w.title}</p>
          <p className="c-help">
            {fmtDate(w.startedAt, true)}
            {muscles.length > 0 && ` · ${muscles.map((m) => t(m.en, m.vi)).join(", ")}`}
          </p>
        </div>
        <ChevronDown size={18} className={`flex-none mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div className="grid grid-cols-4 gap-2">
        {[
          { en: "Time", vi: "Thời lượng", v: fmtDuration(w.durationSec) },
          { en: "Volume", vi: "Khối lượng", v: volume ? `${fmt(volume, 0, language)} kg` : "—" },
          { en: "Sets", vi: "Số hiệp", v: String(workoutSets(w)) },
          { en: "Records", vi: "Kỷ lục", v: String(prCount) },
        ].map((x) => (
          <div key={x.en} className="rounded-2xl bg-[var(--color-surface-2)] p-2.5 min-w-0">
            <div className="text-[11px] text-[var(--color-text-muted)] truncate">{t(x.en, x.vi)}</div>
            <div className="font-bold text-sm tabular-nums truncate">{x.v}</div>
          </div>
        ))}
      </div>

      {open && (
        <div className="flex flex-col gap-4 pt-1">
          {w.exercises.map((ex, ei) => {
            const m = muscleLabel(ex.muscleGroup);
            let n = 0;
            return (
              <div key={ei}>
                <p className="font-semibold text-sm">
                  {ex.name}
                  {m && <span className="font-normal text-[var(--color-text-faint)]"> · {t(m.en, m.vi)}</span>}
                </p>
                <div className="mt-1">
                  {ex.sets.map((s, si) => {
                    if (!s.warmup) n += 1;
                    const est = ex.kind === "weight" ? e1rm(s.weightKg, s.reps) : null;
                    const types = prTypes(ei, si);
                    return (
                      <div
                        key={si}
                        className="grid grid-cols-[28px_1fr_auto] gap-2 items-start py-1.5 border-b border-[var(--color-border)] last:border-b-0 text-sm"
                      >
                        <span className={s.warmup ? "text-[var(--color-warning)] font-bold" : "text-[var(--color-text-muted)]"}>
                          {s.warmup ? "W" : n}
                        </span>
                        <div className="min-w-0">
                          <span className="tabular-nums">{fmtSet(s, ex.kind, language)}</span>
                          {types.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {types.map((type) => (
                                <span
                                  key={type}
                                  className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold"
                                  style={{
                                    background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                                    color: "var(--color-accent)",
                                  }}
                                >
                                  <Medal size={10} aria-hidden /> {t(PR_LABELS[type].en, PR_LABELS[type].vi)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="tabular-nums text-[var(--color-text-muted)]">{est ? Math.round(est.value) : ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {w.calories != null && (
            <p className="c-help">
              {w.calories} kcal {t("(app estimate — rough)", "(ước tính của ứng dụng — sai số lớn)")}
            </p>
          )}
          {w.note && <p className="c-card-body whitespace-pre-line">{w.note}</p>}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
            <button type="button" onClick={onRepeat} className="c-btn c-btn-secondary c-btn-sm">
              <Copy size={14} /> {t("Repeat today", "Tập lại hôm nay")}
            </button>
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
