"use client";

import { useState, useEffect } from "react";
import {
  Loader2, AlertCircle, Check, Sparkles, CalendarClock, Volume2, RefreshCw,
  GraduationCap, ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak } from "@/lib/speech";

interface Word {
  term: string;
  pos: string;
  phonetic?: string | null;
  meaning: string;
  example: string;
  exampleTranslation: string;
}

interface OpenSet {
  id: string;
  dayIndex: number;
  cyclesDone: number;
  totalCycles: number;
  isReview: boolean;
  words: Word[];
}

interface Course {
  id: string;
  level: string;
  totalDays: number;
  wordsPerDay: number;
  startedCount: number;
  finishedCount: number;
  cycleDays: number;
  totalCycles: number;
}

interface Today {
  newSet: { id: string; dayIndex: number } | null;
  reviews: { id: string; dayIndex: number; cycle: number; dueAt: string }[];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

/**
 * Giáo trình từ vựng theo ngày.
 *
 * Mỗi ngày mười từ mới, và mỗi bộ quay lại sau đúng 10 ngày, năm vòng. Lịch cố
 * định nên nhìn là biết trước hôm nào phải ôn gì — khác với phần thẻ ghi nhớ
 * chạy FSRS, nơi khoảng cách co giãn theo mức độ nhớ từng thẻ.
 *
 * Chỉ mở MỘT bộ mới mỗi ngày. Học dồn năm bộ trong một buổi thì mười ngày sau
 * năm bộ đó cùng tới hạn, và buổi ôn hôm đó thành năm mươi từ.
 */
export default function VocabCourse({ languageId }: { languageId?: string }) {
  const { t } = useLanguage();

  const [level, setLevel] = useState("B1");
  const [levels, setLevels] = useState<string[]>(["B1", "B2", "C1", "C2"]);
  const [course, setCourse] = useState<Course | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [upcoming, setUpcoming] = useState<{ dayIndex: number; cycle: number; dueAt: string }[]>([]);

  const [open, setOpen] = useState<OpenSet | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = `${reloadKey}:${level}:${languageId ?? ""}`;
  const loading = loadedFor !== requestKey;

  useEffect(() => {
    const controller = new AbortController();

    const scope = languageId ? `&languageId=${encodeURIComponent(languageId)}` : "";
    fetch(`/api/learning/vocab-course?level=${encodeURIComponent(level)}${scope}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không đọc được giáo trình");
        setCourse(json.course);
        setToday(json.today ?? null);
        setUpcoming(json.upcoming ?? []);
        setLevels(json.levels ?? levels);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(requestKey);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, level, languageId]);

  const createCourse = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/vocab-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, languageId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tạo được");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openSet = async (setId: string) => {
    setBusy(true);
    setError(null);
    setRevealed(new Set());
    try {
      const res = await fetch("/api/learning/vocab-course", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không mở được bộ từ");
      setOpen(json.set);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finishSet = async () => {
    if (!open) return;
    setBusy(true);
    try {
      await fetch("/api/learning/vocab-course", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: open.id }),
      });
      setOpen(null);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  // ── Đang học một bộ ──────────────────────────────────────────────────────
  if (open) {
    const allRevealed = revealed.size >= open.words.length;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="c-chip c-chip-solid">
            {t(`Day ${open.dayIndex}`, `Ngày ${open.dayIndex}`)}
          </span>
          {open.isReview ? (
            <span className="c-chip c-chip-warning">
              {t(
                `Review ${open.cyclesDone + 1} of ${open.totalCycles}`,
                `Ôn vòng ${open.cyclesDone + 1}/${open.totalCycles}`
              )}
            </span>
          ) : (
            <span className="c-chip c-chip-success">{t("New words", "Từ mới")}</span>
          )}
          <span className="c-stat-label ml-auto tabular-nums">
            {revealed.size}/{open.words.length}
          </span>
        </div>

        {open.isReview && (
          <p className="c-help">
            {t(
              "Try to recall the meaning before you reveal it — that effort is what makes it stick.",
              "Cố nhớ nghĩa trước khi lật ra — chính lúc gắng nhớ đó mới là lúc từ ăn vào."
            )}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {open.words.map((w, i) => {
            const shown = revealed.has(i);
            return (
              <button
                key={i}
                onClick={() => setRevealed((prev) => new Set(prev).add(i))}
                className={`c-card p-5 text-left flex flex-col gap-2 transition-colors ${
                  shown ? "" : "hover:border-[var(--color-primary)] cursor-pointer"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="c-h3 break-words">{w.term}</p>
                    <p className="c-stat-label">
                      {w.pos}
                      {w.phonetic && ` · ${w.phonetic}`}
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); speak(w.term, "en"); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        speak(w.term, "en");
                      }
                    }}
                    className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors flex-none"
                    aria-label={t("Listen", "Nghe")}
                  >
                    <Volume2 size={16} />
                  </span>
                </div>

                {shown ? (
                  <>
                    <p className="text-[var(--color-text)]">{w.meaning}</p>
                    <div className="border-t border-dashed border-[var(--color-border)] pt-2 space-y-0.5">
                      <p className="text-sm">{w.example}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{w.exampleTranslation}</p>
                    </div>
                  </>
                ) : (
                  <p className="c-stat-label">{t("Tap to reveal", "Chạm để lật")}</p>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={finishSet}
            disabled={busy || !allRevealed}
            className="c-btn c-btn-primary"
            title={allRevealed ? undefined : t("Reveal every word first", "Lật hết các từ đã")}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {t("Done for today", "Xong hôm nay")}
          </button>
          <button onClick={() => setOpen(null)} disabled={busy} className="c-btn c-btn-secondary">
            {t("Back", "Quay lại")}
          </button>
        </div>
      </div>
    );
  }

  // ── Bảng điều khiển giáo trình ───────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="c-seg">
          {levels.map((lv) => (
            <button
              key={lv}
              className={`c-seg-opt ${level === lv ? "active" : ""}`}
              onClick={() => setLevel(lv)}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <div className="flex-1 space-y-2">
            <p>{error}</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="c-btn c-btn-secondary c-btn-sm">
              <RefreshCw size={14} />
              {t("Try again", "Thử lại")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : !course ? (
        <div className="c-card p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] grid place-content-center">
            <GraduationCap size={30} />
          </div>
          <div>
            <p className="c-h3">{t(`No ${level} course yet`, `Chưa có giáo trình ${level}`)}</p>
            <p className="c-card-body mt-1 max-w-md">
              {t(
                "30 days, 10 words a day. Each day's set comes back every 10 days, five times over.",
                "30 ngày, mỗi ngày 10 từ. Mỗi bộ quay lại sau 10 ngày, tất cả 5 vòng."
              )}
            </p>
          </div>
          <button onClick={createCourse} disabled={busy} className="c-btn c-btn-primary c-btn-lg">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {t(`Start the ${level} course`, `Bắt đầu giáo trình ${level}`)}
          </button>
        </div>
      ) : (
        <>
          <div className="c-card c-elev-md p-6 flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[160px]">
              <p className="c-card-kicker">{t("Progress", "Tiến độ")}</p>
              <p className="c-stat-value">
                {course.startedCount}
                <span className="text-[var(--color-text-faint)]">/{course.totalDays}</span>
              </p>
              <p className="c-stat-label">{t("days started", "ngày đã học")}</p>
            </div>
            <div>
              <p className="c-stat-value">{course.finishedCount}</p>
              <p className="c-stat-label">
                {t(`sets through all ${course.totalCycles}`, `bộ đã xong ${course.totalCycles} vòng`)}
              </p>
            </div>
            <div>
              <p className="c-stat-value">{course.startedCount * course.wordsPerDay}</p>
              <p className="c-stat-label">{t("words seen", "từ đã gặp")}</p>
            </div>
          </div>

          {/* Việc hôm nay */}
          <section className="space-y-3">
            <h3 className="c-h3">{t("Today", "Hôm nay")}</h3>

            {today?.newSet ? (
              <button
                onClick={() => openSet(today.newSet!.id)}
                disabled={busy}
                className="c-card c-elev-md p-5 w-full flex items-center gap-4 hover:border-[var(--color-primary)] transition-colors text-left"
              >
                <span className="w-11 h-11 rounded-xl grid place-content-center flex-none bg-[var(--color-success-tint)] text-[var(--color-success)]">
                  <Sparkles size={20} />
                </span>
                <span className="flex-1">
                  <span className="block font-bold">
                    {t(`Day ${today.newSet.dayIndex} — new words`, `Ngày ${today.newSet.dayIndex} — từ mới`)}
                  </span>
                  <span className="block c-stat-label">
                    {t(`${course.wordsPerDay} words`, `${course.wordsPerDay} từ`)}
                  </span>
                </span>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              </button>
            ) : (
              <p className="c-card-body">
                {t(
                  "New words for today are done. Come back tomorrow for the next set.",
                  "Từ mới hôm nay đã học xong. Mai quay lại cho bộ kế tiếp."
                )}
              </p>
            )}

            {(today?.reviews.length ?? 0) > 0 &&
              today!.reviews.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openSet(r.id)}
                  disabled={busy}
                  className="c-card p-5 w-full flex items-center gap-4 hover:border-[var(--color-primary)] transition-colors text-left"
                >
                  <span className="w-11 h-11 rounded-xl grid place-content-center flex-none bg-[var(--color-warning-tint)] text-[var(--color-warning)]">
                    <RefreshCw size={18} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold">
                      {t(`Review day ${r.dayIndex}`, `Ôn lại ngày ${r.dayIndex}`)}
                    </span>
                    <span className="block c-stat-label">
                      {t(`Cycle ${r.cycle} of ${course.totalCycles}`, `Vòng ${r.cycle}/${course.totalCycles}`)}
                    </span>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
          </section>

          {/* Lịch sắp tới */}
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h3 className="c-h3 flex items-center gap-2">
                <CalendarClock size={18} />
                {t("Coming up", "Sắp tới")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {upcoming.map((u, i) => (
                  <span key={i} className="c-chip c-chip-outline tabular-nums">
                    {fmtDate(u.dueAt)} · {t(`day ${u.dayIndex}`, `ngày ${u.dayIndex}`)} · {t(`cycle ${u.cycle}`, `vòng ${u.cycle}`)}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
