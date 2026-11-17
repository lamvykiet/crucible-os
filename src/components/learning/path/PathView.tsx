"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, Check, CircleDot, GraduationCap, Loader2, Map as MapIcon, Play, Target,
  CalendarCheck, TrendingUp, Pencil,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { PATH_LEVELS, etaLabel, type LessonKind, type ExtraKind } from "@/lib/learningPath";
import type { PathView as View } from "@/lib/pathServer";
import { KIND_LABEL, EXTRA_NOTE, lessonHref, extraHref } from "./links";

type Ready = Extract<View, { available: true }>;

const BANDS = ["4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0"];
const MINUTES = [30, 45, 60, 90];

/**
 * Lộ trình học — bố cục theo aioenglish.com/lo-trinh, phong cách Kính của dự án.
 *
 * Bốn khối: đầu trang có "Học tiếp"; thẻ tiến độ (cấp, % chặng đường, mốc kiểm
 * tra, số bài/số từ, số phút mỗi ngày, kiểm tra lên cấp); kế hoạch hôm nay; mục
 * lục chương cạnh danh sách bài của chương đang chọn.
 */
export default function PathView({ languageId }: { languageId: string }) {
  const { t } = useLanguage();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      fetch(`/api/learning/path?languageId=${encodeURIComponent(languageId)}`)
        .then((r) => r.json())
        .then((json) => {
          if (!json.success) throw new Error(json.error || "Không đọc được lộ trình");
          setView(json.view);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Không đọc được lộ trình")),
    [languageId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: { level?: string; targetBand?: string; minutesPerDay?: number }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/learning/path", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, ...patch }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không lưu được");
      setChapter(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  if (error && !view) {
    return (
      <div className="c-alert c-alert-error">
        <AlertCircle size={18} className="icon" />
        <p className="flex-1">{error}</p>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="flex items-center gap-2 c-help">
        <Loader2 size={16} className="animate-spin" />
        {t("Loading…", "Đang tải…")}
      </div>
    );
  }
  if (!view.available) {
    return <p className="c-help">{t("This language has no grammar syllabus yet, so there is no path.", "Thứ tiếng này chưa có khung ngữ pháp nên chưa có lộ trình.")}</p>;
  }

  if (!view.pref) return <Setup onSave={save} saving={saving} />;

  const v: Ready = view;
  const pref = view.pref;
  const nextHref = v.next ? lessonHref(languageId, v.next.kind, v.next.pointId) : `/learning/languages/${languageId}/path/test`;
  const current = chapter ?? v.next?.chapterIndex ?? 1;
  const ch = v.chapters.find((c) => c.index === current) ?? v.chapters[0];
  const chaptersDone = v.chapters.filter((c) => c.done === c.total).length;
  const planDone = v.plan.filter((p) => p.done).length;
  const firstUndone = v.plan.find((p) => !p.done)?.key;
  const levelEta = etaLabel(v.etaDays);
  const finalEta = etaLabel(v.finalEtaDays);
  const levelIdx = PATH_LEVELS.indexOf(v.level);

  return (
    <div className="space-y-6">
      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {/* ── Đầu trang ─────────────────────────────────────────────────── */}
      <div className="c-card c-elev-md p-6 flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] grid place-content-center flex-none">
          <MapIcon size={22} />
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          <h1 className="c-h1">{t("Learning path", "Lộ trình học")}</h1>
          <div className="flex flex-wrap gap-1.5">
            <span className="c-chip c-chip-outline inline-flex items-center gap-1"><CircleDot size={12} />{t("At your level", "Theo đúng trình độ")}</span>
            <span className="c-chip c-chip-outline inline-flex items-center gap-1"><CalendarCheck size={12} />{t("A plan every day", "Kế hoạch mỗi ngày")}</span>
            <span className="c-chip c-chip-outline inline-flex items-center gap-1"><TrendingUp size={12} />{t("Level-up test", "Kiểm tra lên cấp")}</span>
          </div>
        </div>
        <Link href={nextHref} className="c-btn c-btn-primary c-btn-lg">
          {v.next ? t("Continue", "Học tiếp") : t("Take the test", "Làm bài kiểm tra")}
          <ArrowRight size={18} />
        </Link>
      </div>

      {/* ── Tiến độ ───────────────────────────────────────────────────── */}
      <div className="c-card p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {PATH_LEVELS.map((lv, i) => (
            <span
              key={lv}
              className={`c-chip inline-flex items-center gap-1 ${i === levelIdx ? "c-chip-solid" : "c-chip-outline"}`}
            >
              {lv}
              {i < levelIdx && <Check size={12} />}
              {i === levelIdx && ` · ${t("current", "Đang học")}`}
            </span>
          ))}
          <select
            value={v.level}
            disabled={saving}
            onChange={(e) => {
              if (window.confirm(t(`Switch the path to ${e.target.value}?`, `Chuyển lộ trình sang cấp ${e.target.value}?`))) {
                void save({ level: e.target.value });
              }
            }}
            className="c-input w-auto ml-auto"
            aria-label={t("Change level", "Đổi cấp")}
          >
            {PATH_LEVELS.map((lv) => (
              <option key={lv} value={lv}>{t(`Level ${lv}`, `Cấp ${lv}`)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="c-display tabular-nums">{v.percent}%</span>
          <span className="c-help">
            {t(`of the way through ${v.level} (≈ IELTS ${v.levelBand})`, `chặng đường hết ${v.level} (≈ IELTS ${v.levelBand})`)}
          </span>
        </div>

        <div className="relative pt-5">
          <div className="c-progress">
            <span style={{ width: `${v.percent}%` }} />
          </div>
          {/* Mốc gợi ý làm bài kiểm tra lên cấp. */}
          <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: "80%" }}>
            <span className="c-stat-label whitespace-nowrap -translate-x-1/2">{t("Level-up test", "Kiểm tra lên cấp")}</span>
            <span className="w-px flex-1 bg-[var(--color-text-faint)] -translate-x-1/2" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[var(--color-surface-2)] p-4">
            <p className="c-stat-label">{t("Lessons done", "Bài đã học")}</p>
            <p className="c-h3 tabular-nums">
              {v.stats.lessonsDone}<span className="text-[var(--color-text-faint)]"> / {v.stats.lessonsTotal}</span>
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--color-surface-2)] p-4">
            <p className="c-stat-label">{t("Words learned", "Từ đã học")}</p>
            {v.stats.wordsTotal ? (
              <p className="c-h3 tabular-nums">
                {v.stats.wordsLearned}<span className="text-[var(--color-text-faint)]"> / {v.stats.wordsTotal}</span>
              </p>
            ) : (
              <Link href={`/learning/languages/${languageId}/vocabulary`} className="c-help underline">
                {t(`Start the ${v.level} vocabulary course`, `Mở giáo trình từ vựng ${v.level}`)}
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--color-surface-2)] p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Target size={18} className="flex-none mt-0.5 text-[var(--color-accent)]" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{t(`${pref.minutesPerDay} minutes a day`, `${pref.minutesPerDay} phút mỗi ngày`)}</p>
              <p className="c-help">
                {t(
                  `Finishing ${v.level}: ${levelEta.en}. Goal IELTS ${pref.targetBand} (${v.targetLevel}): ${finalEta.en}.`,
                  `Hết ${v.level}: ${levelEta.vi}. Đích IELTS ${pref.targetBand} (${v.targetLevel}): ${finalEta.vi}.`
                )}
              </p>
            </div>
            <button onClick={() => setEditing((e) => !e)} className="c-btn c-btn-secondary c-btn-sm flex-none">
              <Pencil size={14} />
              {t("Edit", "Sửa")}
            </button>
          </div>
          {editing && (
            <div className="flex flex-wrap gap-4 pt-1">
              <div className="space-y-1.5">
                <p className="c-stat-label">{t("Minutes a day", "Phút mỗi ngày")}</p>
                <div className="c-seg w-fit">
                  {MINUTES.map((m) => (
                    <button key={m} disabled={saving} onClick={() => void save({ minutesPerDay: m })} className={`c-seg-opt ${pref.minutesPerDay === m ? "active" : ""}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="c-stat-label">{t("Target band", "Band mục tiêu")}</p>
                <select value={pref.targetBand} disabled={saving} onChange={(e) => void save({ targetBand: e.target.value })} className="c-input w-auto">
                  {BANDS.map((b) => <option key={b} value={b}>IELTS {b}</option>)}
                </select>
              </div>
            </div>
          )}
          <p className="c-help text-[12px]">
            {t(
              "Estimate from the lessons left, assuming ~60% of your daily time goes to the path.",
              "Ước lượng từ số bài còn lại, giả định ~60% thời gian mỗi ngày dành cho lộ trình."
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-surface-2)] p-4 flex items-center gap-3 flex-wrap">
          <GraduationCap size={18} className="flex-none text-[var(--color-accent)]" />
          <div className="flex-1 min-w-[180px]">
            <p className="font-medium">{t("Level-up test", "Bài kiểm tra lên cấp")}</p>
            <p className="c-help">
              {v.test.cooldownUntil
                ? t(`Retake after ${new Date(v.test.cooldownUntil).toLocaleString()}`, `Thi lại sau ${new Date(v.test.cooldownUntil).toLocaleString("vi-VN")}`)
                : v.test.lastScore !== null
                  ? t(`Last try: ${v.test.lastScore}/36`, `Lần gần nhất: ${v.test.lastScore}/36`)
                  : v.percent < 80
                    ? t(`Best taken after 80% of the path (now ${v.percent}%)`, `Nên làm khi xong 80% lộ trình (hiện ${v.percent}%)`)
                    : t("You are ready to try.", "Bạn đã sẵn sàng thử.")}
            </p>
          </div>
          <Link href={`/learning/languages/${languageId}/path/test`} className="c-btn c-btn-secondary">
            {v.test.openTestId ? t("Resume", "Làm tiếp") : t("Take it", "Làm bài")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* ── Kế hoạch hôm nay ─────────────────────────────────────────── */}
      <div className="c-card p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="c-h3">{t("Today's plan", "Kế hoạch hôm nay")}</h3>
          <span className="c-stat-label tabular-nums">
            {planDone}/{v.plan.length} · {t(`${v.plan.reduce((s, p) => s + p.minutes, 0)} min`, `${v.plan.reduce((s, p) => s + p.minutes, 0)} phút`)}
          </span>
        </div>
        <ul className="space-y-1.5">
          {v.plan.map((p) => {
            const href = p.lesson ? lessonHref(languageId, p.lesson.kind, p.lesson.pointId) : extraHref(languageId, p.kind as ExtraKind);
            const label = KIND_LABEL[p.kind as LessonKind | ExtraKind];
            const sub = p.lesson ? p.lesson.pointTitle : t(...EXTRA_NOTE[p.kind as ExtraKind]);
            const isNext = p.key === firstUndone;
            return (
              <li key={p.key}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
                    isNext ? "bg-[var(--glass-pill)] shadow-sm" : "hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full grid place-content-center flex-none ${
                    p.done ? "bg-[var(--color-success-tint)] text-[var(--color-success)]" : isNext ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
                  }`}>
                    {p.done ? <Check size={14} /> : <Play size={12} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="c-stat-label block">{t(label[0], label[1])}</span>
                    <span className={`block truncate ${p.done ? "text-[var(--color-text-muted)]" : "font-medium"}`}>{sub}</span>
                  </span>
                  {isNext && <span className="c-chip c-chip-outline flex-none">{t("Next", "Tiếp theo")}</span>}
                  <span className="c-stat-label tabular-nums flex-none">~{p.minutes}′</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Mục lục + chương ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-6 items-start">
        {/* Thẻ làm khung, chỉ danh sách bên trong cuộn (xem AGENTS.md). */}
        <div className="c-card p-5 flex flex-col gap-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)]">
          <div className="flex items-baseline justify-between gap-3 flex-none">
            <h3 className="c-h3">{t(`${v.level} contents`, `Mục lục ${v.level}`)}</h3>
            <span className="c-stat-label tabular-nums">{t(`${chaptersDone}/${v.chapters.length} done`, `Xong ${chaptersDone}/${v.chapters.length} chương`)}</span>
          </div>
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto -mx-2 px-2 space-y-1.5 max-h-[50vh] overflow-y-auto lg:max-h-none">
            {v.chapters.map((c) => {
              const active = c.index === ch.index;
              const full = c.done === c.total;
              return (
                <button
                  key={c.id}
                  onClick={() => setChapter(c.index)}
                  className={`w-full text-left rounded-2xl px-4 py-3 transition-colors ${
                    active ? "bg-[var(--glass-pill)] shadow-sm" : "hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="c-stat-label">{t(`Chapter ${c.index}`, `Chương ${c.index}`)}</span>
                    <span className={`c-stat-label tabular-nums ${full ? "text-[var(--color-success)]" : ""}`}>{c.done}/{c.total}</span>
                  </span>
                  <span className="block font-medium leading-snug">{c.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="c-card p-6 space-y-4">
          <div>
            <p className="c-stat-label">{t(`Chapter ${ch.index} of ${v.chapters.length}`, `Chương ${ch.index}/${v.chapters.length}`)}</p>
            <h3 className="c-h2">{ch.title}</h3>
            <p className="c-help tabular-nums">{t(`${ch.done}/${ch.total} lessons done`, `${ch.done}/${ch.total} bài đã học`)}</p>
          </div>
          <ul className="space-y-1.5">
            {ch.lessons.map((l) => {
              const isNext = v.next?.key === l.key;
              const label = KIND_LABEL[l.kind];
              return (
                <li key={l.key}>
                  <Link
                    href={lessonHref(languageId, l.kind, l.pointId)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${
                      isNext ? "bg-[var(--glass-pill)] shadow-sm" : "hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full grid place-content-center flex-none ${
                      l.done ? "bg-[var(--color-success-tint)] text-[var(--color-success)]" : isNext ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
                    }`}>
                      {l.done ? <Check size={14} /> : <Play size={12} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="c-stat-label block">{t(label[0], label[1])}</span>
                      <span className={`block ${l.done ? "text-[var(--color-text-muted)]" : "font-medium"}`}>{l.pointTitle}</span>
                    </span>
                    {isNext ? (
                      <span className="c-chip c-chip-outline flex-none">{t("Next", "Tiếp theo")}</span>
                    ) : !l.done && l.total > 0 && l.cleared > 0 ? (
                      <span className="c-stat-label tabular-nums flex-none">{l.cleared}/{l.total}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Lần đầu mở: hỏi ba thứ, không bắt làm bài xếp lớp. */
function Setup({ onSave, saving }: { onSave: (p: { level: string; targetBand: string; minutesPerDay: number }) => void; saving: boolean }) {
  const { t } = useLanguage();
  const [level, setLevel] = useState("B1");
  const [band, setBand] = useState("6.5");
  const [minutes, setMinutes] = useState(45);
  return (
    <div className="c-card c-elev-md p-6 space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] grid place-content-center">
          <MapIcon size={22} />
        </div>
        <div>
          <h2 className="c-h2">{t("Set up your path", "Thiết lập lộ trình")}</h2>
          <p className="c-help">{t("Three questions. You can change any of them later.", "Ba câu hỏi. Đổi lại lúc nào cũng được.")}</p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="c-stat-label">{t("Your level now", "Trình độ hiện tại")}</p>
        <div className="c-seg w-fit flex-wrap">
          {PATH_LEVELS.map((lv) => (
            <button key={lv} onClick={() => setLevel(lv)} className={`c-seg-opt ${level === lv ? "active" : ""}`}>{lv}</button>
          ))}
        </div>
        <p className="c-help">{t("A2 ≈ IELTS 3.0–3.5 · B1 ≈ 4.0–5.0 · B2 ≈ 5.5–6.5 · C1 ≈ 7.0+", "A2 ≈ IELTS 3.0–3.5 · B1 ≈ 4.0–5.0 · B2 ≈ 5.5–6.5 · C1 ≈ 7.0+")}</p>
      </div>
      <div className="space-y-2">
        <p className="c-stat-label">{t("Target band", "Band mục tiêu")}</p>
        <select value={band} onChange={(e) => setBand(e.target.value)} className="c-input w-auto">
          {BANDS.map((b) => <option key={b} value={b}>IELTS {b}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <p className="c-stat-label">{t("Minutes a day", "Mỗi ngày học bao lâu")}</p>
        <div className="c-seg w-fit">
          {MINUTES.map((m) => (
            <button key={m} onClick={() => setMinutes(m)} className={`c-seg-opt ${minutes === m ? "active" : ""}`}>
              {m === 60 ? t("1 hour", "1 giờ") : m === 90 ? t("1.5 hours", "1,5 giờ") : t(`${m} min`, `${m} phút`)}
            </button>
          ))}
        </div>
      </div>
      <button disabled={saving} onClick={() => onSave({ level, targetBand: band, minutesPerDay: minutes })} className="c-btn c-btn-primary c-btn-lg">
        {saving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {t("Start the path", "Bắt đầu lộ trình")}
      </button>
    </div>
  );
}
