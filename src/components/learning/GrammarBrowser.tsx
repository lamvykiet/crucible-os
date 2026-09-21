"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen, Dumbbell, Loader2, AlertCircle, Check, X, ChevronDown, Search,
  RefreshCw, CircleCheck,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  CEFR_LEVELS, type CefrLevel, type GrammarFamily,
} from "@/lib/grammarSyllabus";

interface Progress {
  viewed: boolean;
  practiceCount: number;
  correctCount: number;
}

interface Lesson {
  pointId: string;
  summary: string;
  useWhen: string;
  structures: { pattern: string; note: string }[];
  examples: { sentence: string; note: string }[];
  practiceCount: number;
  correctCount: number;
}

interface Question {
  prompt: string;
  options: string[];
}

interface Graded {
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

/** Màu huy hiệu theo cấp độ — dùng token ngữ nghĩa, không đặt màu mới. */
const LEVEL_STYLE: Record<CefrLevel, { bg: string; fg: string }> = {
  A1: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  A2: { bg: "var(--color-info-tint)", fg: "var(--color-info)" },
  B1: { bg: "var(--color-accent-tint)", fg: "var(--color-accent)" },
  B2: { bg: "var(--color-warning-tint)", fg: "var(--color-warning)" },
  C1: { bg: "var(--color-error-tint)", fg: "var(--color-error)" },
};

function LevelBadge({ level }: { level: CefrLevel }) {
  const s = LEVEL_STYLE[level];
  return (
    <span
      className="inline-grid place-content-center px-1.5 h-[18px] rounded text-[10px] font-bold flex-none"
      style={{ background: s.bg, color: s.fg }}
    >
      {level}
    </span>
  );
}

/**
 * Học ngữ pháp.
 *
 * Khung chương trình nằm trong code nên nó hiện ra ngay, không phải chờ mạng.
 * Nội dung từng bài thì sinh bằng AI lần đầu mở rồi giữ lại — mở lại là đọc từ
 * bảng, và bài học không đổi chữ mỗi lần xem.
 *
 * Bài tập chấm ở máy chủ: đáp án không đi kèm lúc phát đề, nên mở tab mạng ra
 * cũng không thấy.
 */
export default function GrammarBrowser() {
  const { t } = useLanguage();

  const [families, setFamilies] = useState<GrammarFamily[]>([]);
  const [byLevel, setByLevel] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [loadedSyllabus, setLoadedSyllabus] = useState(false);

  const [level, setLevel] = useState<CefrLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [openFamilies, setOpenFamilies] = useState<Set<string>>(new Set());

  const [pointId, setPointId] = useState<string | null>(null);
  const [tab, setTab] = useState<"knowledge" | "practice">("knowledge");

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadingPractice, setLoadingPractice] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [graded, setGraded] = useState<Graded | null>(null);

  // Khung chương trình: một lần, ngay khi mở.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/grammar", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setFamilies(json.families);
        setByLevel(json.byLevel);
        setTotal(json.total);
        setProgress(json.progress ?? {});
        setOpenFamilies(new Set([json.families[0]?.id].filter(Boolean)));
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadedSyllabus(true);
      });
    return () => controller.abort();
  }, []);

  /** Lọc cây theo cấp độ và từ khoá, bỏ hẳn nhóm và họ không còn bài nào. */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return families
      .map((f) => ({
        ...f,
        groups: f.groups
          .map((g) => ({
            ...g,
            points: g.points.filter(
              (p) =>
                (level === "all" || p.level === level) &&
                (!q || p.title.toLowerCase().includes(q) || g.title.toLowerCase().includes(q))
            ),
          }))
          .filter((g) => g.points.length > 0),
      }))
      .filter((f) => f.groups.length > 0);
  }, [families, level, search]);

  // Trải phẳng rồi tìm, thay cho hai vòng lặp lồng có return sớm: trình biên
  // dịch React không giữ được memo qua kiểu nhảy ra giữa chừng đó.
  const current = useMemo(
    () =>
      families
        .flatMap((family) =>
          family.groups.flatMap((group) => group.points.map((point) => ({ family, group, point })))
        )
        .find((entry) => entry.point.id === pointId) ?? null,
    [families, pointId]
  );

  const openPoint = async (id: string) => {
    setPointId(id);
    setTab("knowledge");
    setLesson(null);
    setQuestions(null);
    setQIndex(0);
    setPicked(null);
    setGraded(null);
    setError(null);
    setLoadingLesson(true);

    try {
      const res = await fetch("/api/learning/grammar/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointId: id }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không soạn được bài");
      setLesson(json.lesson);
      setProgress((prev) => ({
        ...prev,
        [id]: { viewed: true, practiceCount: json.lesson.practiceCount, correctCount: json.lesson.correctCount },
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingLesson(false);
    }
  };

  const startPractice = async (refresh = false) => {
    if (!pointId) return;
    setTab("practice");
    setLoadingPractice(true);
    setError(null);
    setQIndex(0);
    setPicked(null);
    setGraded(null);

    try {
      const res = await fetch("/api/learning/grammar/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointId, refresh }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không ra được đề");
      setQuestions(json.questions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingPractice(false);
    }
  };

  const answer = async (choice: number) => {
    if (!pointId || graded) return;
    setPicked(choice);
    try {
      const res = await fetch("/api/learning/grammar/practice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointId, index: qIndex, choice }),
      });
      const json = await res.json();
      if (json?.success) setGraded(json);
    } catch {
      // Không chấm được thì để người dùng bấm tiếp, đừng khoá cứng bài.
    }
  };

  const nextQuestion = () => {
    setPicked(null);
    setGraded(null);
    setQIndex((i) => i + 1);
  };

  const toggleFamily = (id: string) =>
    setOpenFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const viewedCount = Object.values(progress).filter((p) => p.viewed).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-6 items-start">
      {/* ── Cây chương trình ─────────────────────────────────────────────── */}
      <aside className="c-card p-5 space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div>
          <h2 className="c-h3">{t("Grammar", "Ngữ pháp")}</h2>
          <p className="c-stat-label">
            {t(`${viewedCount} of ${total} opened`, `Đã mở ${viewedCount}/${total} bài`)}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={15} />
          <input
            className="c-input w-full pl-9!"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Find a point...", "Tìm một điểm ngữ pháp...")}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setLevel("all")}
            className={`c-chip ${level === "all" ? "c-chip-solid" : "c-chip-outline"}`}
          >
            {t("All", "Tất cả")} ({total})
          </button>
          {CEFR_LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              className={`c-chip ${level === lv ? "c-chip-solid" : "c-chip-outline"}`}
            >
              {lv} ({byLevel[lv] ?? 0})
            </button>
          ))}
        </div>

        {!loadedSyllabus ? (
          <div className="flex justify-center py-6 text-[var(--color-text-muted)]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <p className="c-card-body">{t("Nothing matches.", "Không có bài nào khớp.")}</p>
        ) : (
          <nav className="space-y-1">
            {visible.map((family, fi) => {
              const open = openFamilies.has(family.id) || search.trim().length > 0;
              return (
                <div key={family.id}>
                  <button
                    onClick={() => toggleFamily(family.id)}
                    className="w-full flex items-center gap-2 py-2 text-left font-bold text-sm hover:text-[var(--color-accent)] transition-colors"
                  >
                    <span className="flex-1">
                      {fi + 1}. {family.title}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`flex-none transition-transform ${open ? "" : "-rotate-90"}`}
                    />
                  </button>

                  {open && (
                    <div className="pl-2 space-y-2 pb-2">
                      {family.groups.map((group, gi) => (
                        <div key={group.id}>
                          <p className="c-stat-label py-1">
                            {fi + 1}.{gi + 1}. {group.title}
                          </p>
                          <ul className="space-y-0.5">
                            {group.points.map((point) => {
                              const active = point.id === pointId;
                              const seen = progress[point.id]?.viewed;
                              return (
                                <li key={point.id}>
                                  <button
                                    onClick={() => openPoint(point.id)}
                                    className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                                      active
                                        ? "bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-bold"
                                        : "hover:bg-[var(--color-surface-2)]"
                                    }`}
                                  >
                                    <span className="flex-1 leading-snug">{point.title}</span>
                                    {seen && !active && (
                                      <CircleCheck size={13} className="text-[var(--color-success)] flex-none mt-0.5" />
                                    )}
                                    <LevelBadge level={point.level} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </aside>

      {/* ── Bài học ──────────────────────────────────────────────────────── */}
      <section className="c-card p-6 md:p-8 min-h-[60vh]">
        {!current ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] grid place-content-center">
              <BookOpen size={30} />
            </div>
            <p className="c-h3">{t("Pick a grammar point", "Chọn một điểm ngữ pháp")}</p>
            <p className="c-card-body max-w-sm">
              {t(
                "Each lesson is written when you first open it, then kept so it reads the same next time.",
                "Mỗi bài được soạn lúc bạn mở lần đầu, rồi giữ nguyên để lần sau đọc lại vẫn đúng câu chữ đó."
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="c-card-kicker">{current.group.title}</p>
              <h1 className="c-h1 mt-1">{current.point.title}</h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTab("knowledge")}
                className={`c-btn ${tab === "knowledge" ? "c-btn-primary" : "c-btn-secondary"}`}
              >
                <BookOpen size={16} />
                {t("Knowledge", "Kiến thức")}
              </button>
              <button
                onClick={() => (questions ? setTab("practice") : startPractice())}
                disabled={!lesson}
                className={`c-btn ${tab === "practice" ? "c-btn-primary" : "c-btn-secondary"}`}
              >
                <Dumbbell size={16} />
                {t("Practice", "Luyện tập")}
              </button>
              <LevelBadge level={current.point.level} />
            </div>

            {/* Lỗi AI thoáng qua thì phải bấm lại được ngay tại chỗ — bắt tải
                lại cả trang cho một cơn quá tải vài giây là quá tay. */}
            {error && (
              <div className="c-alert c-alert-error">
                <AlertCircle size={18} className="icon" />
                <div className="flex-1 space-y-2">
                  <p>{error}</p>
                  <button
                    onClick={() => (tab === "practice" ? startPractice(true) : openPoint(current.point.id))}
                    className="c-btn c-btn-secondary c-btn-sm"
                  >
                    <RefreshCw size={14} />
                    {t("Try again", "Thử lại")}
                  </button>
                </div>
              </div>
            )}

            {tab === "knowledge" ? (
              loadingLesson ? (
                <div className="flex items-center gap-3 py-16 justify-center text-[var(--color-text-muted)]">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm font-bold">
                    {t("Writing this lesson...", "Đang soạn bài này...")}
                  </span>
                </div>
              ) : lesson ? (
                <div className="space-y-6">
                  <p className="leading-relaxed text-[var(--color-text)]">{lesson.summary}</p>

                  {lesson.useWhen && (
                    <div className="rounded-xl p-5 bg-[var(--color-surface-2)]">
                      <p className="c-card-kicker">{t("Use when", "Dùng khi")}</p>
                      <p className="mt-1">{lesson.useWhen}</p>
                    </div>
                  )}

                  {lesson.structures.length > 0 && (
                    <div className="rounded-xl p-5 bg-[var(--color-surface-2)] space-y-4">
                      <p className="c-card-kicker">{t("Structure", "Cấu trúc")}</p>
                      {lesson.structures.map((s, i) => (
                        <div key={i} className="space-y-1">
                          <code
                            className="inline-block font-mono text-sm font-bold px-2 py-1 rounded"
                            style={{
                              background: "var(--color-warning-tint)",
                              color: "var(--color-text)",
                            }}
                          >
                            {s.pattern}
                          </code>
                          <p className="c-italic text-[var(--color-text-muted)] text-sm">{s.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {lesson.examples.length > 0 && (
                    <div className="space-y-4">
                      <p className="c-card-kicker">{t("Examples", "Ví dụ")}</p>
                      {lesson.examples.map((e, i) => (
                        <div
                          key={i}
                          className="space-y-1 pb-4 border-b border-[var(--color-border)] last:border-0"
                        >
                          <p className="text-[17px] text-[var(--color-text)]">{e.sentence}</p>
                          <p className="c-italic text-[var(--color-text-muted)] text-sm">{e.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={() => startPractice()} className="c-btn c-btn-primary">
                    <Dumbbell size={16} />
                    {t("Practice this", "Luyện điểm này")}
                  </button>
                </div>
              ) : null
            ) : loadingPractice ? (
              <div className="flex items-center gap-3 py-16 justify-center text-[var(--color-text-muted)]">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-bold">{t("Writing questions...", "Đang ra đề...")}</span>
              </div>
            ) : !questions ? null : qIndex >= questions.length ? (
              <div className="flex flex-col items-center gap-4 py-14 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-success-tint)] text-[var(--color-success)] grid place-content-center">
                  <Check size={30} />
                </div>
                <p className="c-h3">{t("Set finished", "Xong bộ câu hỏi")}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button onClick={() => startPractice(true)} className="c-btn c-btn-primary c-btn-sm">
                    <RefreshCw size={14} />
                    {t("New questions", "Bộ câu mới")}
                  </button>
                  <button onClick={() => setTab("knowledge")} className="c-btn c-btn-secondary c-btn-sm">
                    {t("Back to the lesson", "Về phần kiến thức")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="c-progress flex-1">
                    <span style={{ width: `${(qIndex / questions.length) * 100}%` }} />
                  </div>
                  <span className="c-stat-label tabular-nums">
                    {qIndex + 1}/{questions.length}
                  </span>
                </div>

                <p className="text-lg leading-relaxed">{questions[qIndex].prompt}</p>

                <div className="grid gap-2">
                  {questions[qIndex].options.map((opt, i) => {
                    const isRight = graded?.correctIndex === i;
                    const isWrongPick = graded && picked === i && !graded.correct;
                    return (
                      <button
                        key={i}
                        onClick={() => answer(i)}
                        disabled={graded !== null}
                        className={`c-btn justify-start text-left ${
                          isRight ? "c-btn-success" : isWrongPick ? "c-btn-danger" : "c-btn-secondary"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {graded && (
                  <>
                    <div className={`c-alert ${graded.correct ? "c-alert-success" : "c-alert-error"}`}>
                      {graded.correct ? (
                        <Check size={18} className="icon" />
                      ) : (
                        <X size={18} className="icon" />
                      )}
                      <div className="flex-1">
                        <strong>{graded.correct ? t("Correct", "Đúng") : t("Not quite", "Chưa đúng")}</strong>
                        <p className="mt-0.5">{graded.explanation}</p>
                      </div>
                    </div>
                    <button onClick={nextQuestion} className="c-btn c-btn-primary">
                      {qIndex + 1 >= questions.length
                        ? t("Finish", "Kết thúc")
                        : t("Next question", "Câu tiếp")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
