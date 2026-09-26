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

interface Review {
  id: string;
  dayIndex: number;
  cycle: number;
  dueAt: string;
}

interface Course {
  id: string;
  level: string;
  /** "ai", hoặc id của bộ rút từ giáo trình có sẵn. Cũng là cờ phân loại từ. */
  source: string;
  title: string | null;
  totalDays: number;
  wordsPerDay: number;
  startedCount: number;
  finishedCount: number;
  cycleDays: number;
  totalCycles: number;
  newSet: { id: string; dayIndex: number; ready: boolean } | null;
  reviews: Review[];
  upcoming: { dayIndex: number; cycle: number; dueAt: string }[];
}

interface Pack {
  id: string;
  title: string;
  level: string;
  note: string;
  unitCount: number;
  wordCount: number;
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);

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
        setCourses(json.courses ?? []);
        setPacks(json.packs ?? []);
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

  const createCourse = async (packId?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/vocab-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packId ? { packId, languageId } : { level, languageId }),
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
  //
  // Gộp việc của MỌI giáo trình vào một mục "Hôm nay". Chạy song song một giáo
  // trình AI theo cấp và một giáo trình bám sách thì tách ra là bắt người học
  // tự nhớ hôm nay còn nợ bộ nào ở đâu.
  const todayItems = courses.flatMap((c) => [
    ...(c.newSet ? [{ kind: "new" as const, course: c, set: c.newSet }] : []),
    ...c.reviews.map((r) => ({ kind: "review" as const, course: c, review: r })),
  ]);

  const courseName = (c: Course) =>
    c.title ?? t(`${c.level} course`, `Giáo trình ${c.level}`);

  return (
    <div className="space-y-8">
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
      ) : (
        <>
          {/* ── Hôm nay ───────────────────────────────────────────────── */}
          {courses.length > 0 && (
            <section className="space-y-3">
              <h3 className="c-h3">{t("Today", "Hôm nay")}</h3>

              {todayItems.length === 0 ? (
                <p className="c-card-body">
                  {t(
                    "Everything for today is done. Come back tomorrow.",
                    "Hôm nay xong hết rồi. Mai quay lại."
                  )}
                </p>
              ) : (
                todayItems.map((item) => {
                  const isNew = item.kind === "new";
                  const id = isNew ? item.set.id : item.review.id;
                  const day = isNew ? item.set.dayIndex : item.review.dayIndex;
                  return (
                    <button
                      key={id}
                      onClick={() => openSet(id)}
                      disabled={busy}
                      className="c-card c-elev-md p-5 w-full flex items-center gap-4 hover:border-[var(--color-primary)] transition-colors text-left"
                    >
                      <span
                        className={`w-11 h-11 rounded-xl grid place-content-center flex-none ${
                          isNew
                            ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                            : "bg-[var(--color-warning-tint)] text-[var(--color-warning)]"
                        }`}
                      >
                        {isNew ? <Sparkles size={20} /> : <RefreshCw size={18} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold truncate">
                          {isNew
                            ? t(`Day ${day} — new words`, `Ngày ${day} — từ mới`)
                            : t(`Review day ${day}`, `Ôn lại ngày ${day}`)}
                        </span>
                        <span className="block c-stat-label truncate">
                          {courseName(item.course)}
                          {" · "}
                          {isNew
                            ? t(`${item.course.wordsPerDay} words`, `${item.course.wordsPerDay} từ`)
                            : t(
                                `Cycle ${item.review.cycle} of ${item.course.totalCycles}`,
                                `Vòng ${item.review.cycle}/${item.course.totalCycles}`
                              )}
                        </span>
                      </span>
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    </button>
                  );
                })
              )}
            </section>
          )}

          {/* ── Các giáo trình đang chạy ──────────────────────────────── */}
          {courses.length > 0 && (
            <section className="space-y-3">
              <h3 className="c-h3">{t("Your courses", "Giáo trình của bạn")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courses.map((c) => (
                  <div key={c.id} className="c-card p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold truncate">{courseName(c)}</p>
                        <p className="c-stat-label">
                          {c.source === "ai"
                            ? t("Words picked by level", "Từ bốc theo cấp độ")
                            : t("Follows the book's order", "Theo trình tự của sách")}
                        </p>
                      </div>
                      <span className="c-chip c-chip-outline flex-none">{c.level}</span>
                    </div>

                    <div className="c-progress">
                      <span
                        style={{
                          width: `${c.totalDays ? Math.round((c.startedCount / c.totalDays) * 100) : 0}%`,
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 c-stat-label tabular-nums">
                      <span>
                        {t(`${c.startedCount}/${c.totalDays} days`, `${c.startedCount}/${c.totalDays} ngày`)}
                      </span>
                      <span>
                        {t(`${c.startedCount * c.wordsPerDay} words seen`, `${c.startedCount * c.wordsPerDay} từ đã gặp`)}
                      </span>
                      <span>
                        {t(`${c.finishedCount} finished`, `${c.finishedCount} bộ xong ${c.totalCycles} vòng`)}
                      </span>
                    </div>

                    {c.upcoming.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <CalendarClock size={14} className="text-[var(--color-text-faint)] mt-0.5" />
                        {c.upcoming.slice(0, 4).map((u, i) => (
                          <span key={i} className="c-chip c-chip-outline tabular-nums">
                            {fmtDate(u.dueAt)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Bắt đầu một giáo trình mới ────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="c-h3">
              {courses.length > 0
                ? t("Start another course", "Mở thêm giáo trình")
                : t("Start a course", "Bắt đầu một giáo trình")}
            </h3>
            <p className="c-help">
              {t(
                "Every course follows the same rhythm: 10 words a day, each set coming back after 10 days, five times over.",
                "Giáo trình nào cũng chung một nhịp: mỗi ngày 10 từ, mỗi bộ quay lại sau 10 ngày, tất cả 5 vòng."
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Theo sách */}
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => createCourse(pack.id)}
                  disabled={busy}
                  className="c-card p-5 text-left space-y-2 hover:border-[var(--color-primary)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{pack.title}</p>
                    <span className="c-chip c-chip-outline flex-none">{pack.level}</span>
                  </div>
                  <p className="c-help">{pack.note}</p>
                  <p className="c-stat-label tabular-nums">
                    {t(
                      `${pack.wordCount} words · ${pack.unitCount} units · ${Math.ceil(pack.wordCount / 10)} days`,
                      `${pack.wordCount} từ · ${pack.unitCount} bài · ${Math.ceil(pack.wordCount / 10)} ngày`
                    )}
                  </p>
                </button>
              ))}

              {/* Theo cấp độ, từ do AI bốc */}
              <div className="c-card p-5 space-y-3">
                <p className="font-bold">{t("By level", "Theo cấp độ")}</p>
                <p className="c-help">
                  {t(
                    "30 days of words picked for the level you choose.",
                    "30 ngày, từ được bốc theo cấp độ bạn chọn."
                  )}
                </p>
                <div className="c-seg w-fit">
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
                <button
                  onClick={() => createCourse()}
                  disabled={busy || courses.some((c) => c.source === "ai" && c.level === level)}
                  className="c-btn c-btn-primary"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {courses.some((c) => c.source === "ai" && c.level === level)
                    ? t(`${level} already running`, `Đã có giáo trình ${level}`)
                    : t(`Start ${level}`, `Bắt đầu ${level}`)}
                </button>
              </div>
            </div>
          </section>

          {courses.length === 0 && packs.length === 0 && (
            <div className="c-card p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] grid place-content-center">
                <GraduationCap size={30} />
              </div>
              <p className="c-h3">{t("Nothing to study yet", "Chưa có gì để học")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
