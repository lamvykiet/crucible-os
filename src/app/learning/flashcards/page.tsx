"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Brain, RotateCcw, Check, X, ThumbsUp, Loader2, AlertCircle, Trash2, PartyPopper,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { DomainStat } from "@/lib/learningStats";
import ExerciseCard, {
  seededShuffle, type StudyCard, type ExerciseMode,
} from "@/components/learning/ExerciseCard";

type Mode = "detail" | "quick" | "exercise";

/**
 * Chọn kiểu bài tập hợp với thẻ này.
 *
 * Không phải kiểu nào cũng dùng được cho mọi thẻ: luyện thanh cần thứ tiếng có
 * thanh VÀ thẻ phải ghi sẵn số thanh; luyện viết chỉ hợp chữ Hán và Hangul;
 * trắc nghiệm cần đủ nghĩa của thẻ khác làm phương án nhiễu. Lọc trước rồi mới
 * bốc ngẫu nhiên, để không bao giờ rơi vào câu không trả lời được.
 *
 * Thẻ mới gặp lần đầu chỉ cho trắc nghiệm — bắt gõ lại một từ vừa nhìn lần đầu
 * thì chỉ tổ làm nản.
 */
function pickExercise(card: StudyCard, distractorCount: number): ExerciseMode {
  const lang = card.language;
  const pool: ExerciseMode[] = [];

  if (distractorCount >= 3) pool.push("choice");
  if (card.state === 0) return pool[0] ?? "fill";

  pool.push("fill");
  if (lang?.hasTones && card.tone) pool.push("tone");
  if (lang && lang.script !== "latin") pool.push("write");
  if (lang) pool.push("listen");

  // Bốc theo id thẻ chứ không theo Math.random(): render lại cùng một thẻ mà
  // đổi luôn kiểu bài tập thì người học đang gõ dở sẽ mất trắng câu trả lời.
  return seededShuffle(pool, card.id)[0] ?? "fill";
}

function FlashcardSession() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const domain = searchParams.get("domain")?.trim() || null;
  const deckId = searchParams.get("deck")?.trim() || null;

  const [cards, setCards] = useState<StudyCard[]>([]);
  const [distractors, setDistractors] = useState<string[]>([]);
  const [intervals, setIntervals] = useState<Record<string, Record<string, string>>>({});
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, newCount: 0, dueCount: 0 });
  const [reviewed, setReviewed] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<Mode>("detail");
  const [domains, setDomains] = useState<DomainStat[]>([]);
  const [lowercaseAnswers, setLowercaseAnswers] = useState(false);

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = `${reloadKey}:${domain ?? ""}:${deckId ?? ""}`;
  const loading = loadedFor !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/overview", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setDomains((json.domains as DomainStat[]).filter((d) => d.domain.trim() && d.cardCount > 0));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [reloadKey]);

  // Tuỳ chọn "gõ đáp án bằng chữ thường" ảnh hưởng tới ô nhập của bài tập.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/prefs", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!controller.signal.aborted && json?.success) {
          setLowercaseAnswers(Boolean(json.pref?.lowercaseAnswers));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const query = deckId
      ? `?deck=${encodeURIComponent(deckId)}`
      : domain
        ? `?domain=${encodeURIComponent(domain)}`
        : "";

    fetch(`/api/learning/flashcards${query}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được thẻ");
        setCards(json.cards);
        setDistractors(json.distractors ?? []);
        setIntervals(
          Object.fromEntries(
            (json.cards as Array<{ id: string; intervals: Record<string, string> }>).map((c) => [
              c.id, c.intervals,
            ])
          )
        );
        setStats({ total: json.total, newCount: json.newCount, dueCount: json.dueCount });
        setIndex(0);
        setFlipped(false);
        setReviewed(0);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(requestKey);
      });

    return () => controller.abort();
  }, [requestKey, domain, deckId]);

  const current = cards[index] ?? null;

  // Kiểu bài tập chốt theo thẻ, không đổi giữa chừng khi component render lại.
  const exercise = useMemo(
    () => (current && mode === "exercise" ? pickExercise(current, distractors.length) : null),
    [current, mode, distractors.length]
  );

  const pickDomain = (next: string | null) => {
    router.replace(next ? `/learning/flashcards?domain=${encodeURIComponent(next)}` : "/learning/flashcards");
  };

  const grade = useCallback(
    async (value: 1 | 2 | 3 | 4, meta?: { mode: string; correct?: boolean }) => {
      if (!current || grading) return;
      setGrading(true);
      setError(null);
      try {
        const res = await fetch("/api/learning/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: current.id,
            grade: value,
            mode: meta?.mode ?? mode,
            correct: meta?.correct,
          }),
        });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.error || "Không lưu được kết quả");

        setReviewed((n) => n + 1);
        setFlipped(false);
        // Thẻ chấm "Quên" hoặc "Khó" quay lại cuối hàng để ôn tiếp trong phiên.
        setCards((prev) => {
          const rest = prev.filter((_, i) => i !== index);
          return value <= 2 ? [...rest, prev[index]] : rest;
        });
        setIndex(0);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setGrading(false);
      }
    },
    [current, grading, index, mode]
  );

  /** Bài tập chỉ cho hai tín hiệu, quy về mức 1 (quên) và mức 3 (tốt). */
  const answerExercise = (correct: boolean) =>
    grade(correct ? 3 : 1, { mode: exercise ?? "exercise", correct });

  const removeCard = async () => {
    if (!current) return;
    if (!window.confirm(t("Delete this card permanently?", "Xoá vĩnh viễn thẻ này?"))) return;
    await fetch(`/api/learning/flashcards?id=${current.id}`, { method: "DELETE" }).catch(() => {});
    setCards((prev) => prev.filter((_, i) => i !== index));
    setIndex(0);
    setFlipped(false);
  };

  useEffect(() => {
    if (mode === "exercise") return; // bài tập tự nhận phím trong ô nhập
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (!flipped) {
        return;
      } else if (mode === "detail" && ["1", "2", "3", "4"].includes(e.key)) {
        grade(Number(e.key) as 1 | 2 | 3 | 4);
      } else if (mode === "quick" && e.key === "ArrowLeft") {
        grade(1);
      } else if (mode === "quick" && e.key === "ArrowRight") {
        grade(3);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, flipped, grade, mode]);

  const buttons = [
    { g: 1 as const, label: t("Forgot", "Quên"), icon: X, color: "error" },
    { g: 2 as const, label: t("Hard", "Khó"), icon: RotateCcw, color: "warning" },
    { g: 3 as const, label: t("Good", "Tốt"), icon: Check, color: "success" },
    { g: 4 as const, label: t("Easy", "Dễ"), icon: ThumbsUp, color: "info" },
  ];

  const sessionTotal = reviewed + cards.length;
  const progress = sessionTotal > 0 ? Math.round((reviewed / sessionTotal) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="space-y-4 mb-8">
        <Link href="/learning" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
          <ArrowLeft size={16} />
          {t("Learning Hub", "Learning Hub")}
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="c-h1 flex items-center gap-3">
              <Brain className="text-[var(--color-accent)]" size={30} />
              {t("Review", "Ôn tập")}
            </h1>
            <p className="c-stat-label mt-1">
              {domain ?? t("All fields", "Tất cả lĩnh vực")}
              {" · "}
              {t(`${stats.dueCount} due`, `${stats.dueCount} thẻ tới hạn`)}
              {" · "}
              {t(`${stats.total} total`, `tổng ${stats.total} thẻ`)}
            </p>
          </div>

          <div className="c-seg">
            {(["detail", "quick", "exercise"] as const).map((m) => (
              <button
                key={m}
                className={`c-seg-opt ${mode === m ? "active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "detail" && t("Detailed", "Chi tiết")}
                {m === "quick" && t("Quick", "Nhanh")}
                {m === "exercise" && t("Exercises", "Bài tập")}
              </button>
            ))}
          </div>
        </div>

        {domains.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => pickDomain(null)}
              className={`c-chip ${domain === null ? "c-chip-solid" : "c-chip-outline"}`}
            >
              {t("All", "Tất cả")}
            </button>
            {domains.map((d) => (
              <button
                key={d.domain}
                onClick={() => pickDomain(d.domain)}
                className={`c-chip ${
                  domain?.toLowerCase() === d.domain.toLowerCase() ? "c-chip-solid" : "c-chip-outline"
                }`}
              >
                {d.domain}
                {d.dueCount > 0 && ` · ${d.dueCount}`}
              </button>
            ))}
          </div>
        )}

        {sessionTotal > 0 && (
          <div className="c-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {error && (
        <div className="c-alert c-alert-error mb-6">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh] gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={22} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading cards...", "Đang tải thẻ...")}</span>
        </div>
      ) : !current ? (
        <div className="flex flex-col items-center gap-4 text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
            {stats.total === 0 ? <Brain size={32} /> : <PartyPopper size={32} />}
          </div>
          <div>
            <p className="c-h3">
              {stats.total === 0
                ? t("No cards here yet", "Chưa có thẻ nào ở đây")
                : reviewed > 0
                  ? t(`Session done — ${reviewed} cards`, `Xong phiên — ${reviewed} thẻ`)
                  : t("Nothing due right now", "Chưa tới hạn ôn thẻ nào")}
            </p>
            <p className="c-card-body mt-1 max-w-md">
              {stats.total === 0
                ? t(
                    "Add words in the term bank, or import a batch.",
                    "Thêm từ ở kho thuật ngữ, hoặc nhập hàng loạt."
                  )
                : t(
                    "Come back later, or switch to another field.",
                    "Quay lại sau, hoặc chuyển sang lĩnh vực khác."
                  )}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/learning" className="c-btn c-btn-primary c-btn-sm">
              {t("Back to Hub", "Về Learning Hub")}
            </Link>
            {(domain || deckId) && (
              <button onClick={() => pickDomain(null)} className="c-btn c-btn-secondary c-btn-sm">
                {t("Review all fields", "Ôn tất cả lĩnh vực")}
              </button>
            )}
            {stats.total > 0 && (
              <button onClick={() => setReloadKey((k) => k + 1)} className="c-btn c-btn-secondary c-btn-sm">
                {t("Refresh", "Tải lại")}
              </button>
            )}
          </div>
        </div>
      ) : mode === "exercise" && exercise ? (
        <ExerciseCard
          key={current.id}
          card={current}
          mode={exercise}
          distractors={distractors}
          lowercaseAnswers={lowercaseAnswers}
          onAnswer={answerExercise}
          busy={grading}
        />
      ) : (
        <div className="flex flex-col items-center">
          <div
            className="w-full h-80 perspective-1000 cursor-pointer"
            onClick={() => setFlipped((f) => !f)}
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                flipped ? "rotate-y-180" : ""
              }`}
            >
              <div className="absolute inset-0 backface-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[32px] shadow-lg flex flex-col items-center justify-center p-8 text-center gap-2">
                <h2 className="c-h2 text-[var(--color-text)]">{current.front}</h2>
                {current.phonetic && <p className="c-stat-label">{current.phonetic}</p>}
                <div className="absolute bottom-6 text-xs uppercase tracking-widest opacity-40 font-semibold">
                  {t("Click or press Space", "Bấm hoặc nhấn Space")}
                </div>
                {current.state === 0 && (
                  <span className="absolute top-5 left-5 c-chip text-[10px] py-1">
                    {t("New", "Thẻ mới")}
                  </span>
                )}
                {current.language && (
                  <span className="absolute top-5 right-5 c-stat-label">{current.language.name}</span>
                )}
              </div>

              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[32px] shadow-xl flex flex-col items-center justify-center p-10 text-center overflow-y-auto gap-3">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{current.back}</p>
                {current.example && (
                  <p className="text-sm opacity-75 leading-relaxed">
                    {current.example}
                    {current.exampleTranslation && (
                      <>
                        <br />
                        {current.exampleTranslation}
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div
            className={`mt-6 transition-opacity duration-300 ${
              flipped ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {mode === "detail" ? (
              <div className="flex items-center gap-3">
                {buttons.map(({ g, label, icon: Icon, color }) => (
                  <button
                    key={g}
                    onClick={(e) => { e.stopPropagation(); grade(g); }}
                    disabled={grading}
                    className={`flex flex-col items-center gap-2 text-[var(--color-${color})] hover:opacity-80 transition-opacity disabled:opacity-40`}
                  >
                    <div className={`w-14 h-14 rounded-full bg-[var(--color-${color}-tint)] flex items-center justify-center`}>
                      {grading ? <Loader2 size={22} className="animate-spin" /> : <Icon size={24} />}
                    </div>
                    <span className="text-xs font-semibold">{label}</span>
                    {/* Khoảng cách thật do FSRS tính cho CHÍNH thẻ này. */}
                    <span className="text-[10px] text-[var(--color-text-faint)]">
                      {intervals[current.id]?.[g]}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              /* Chế độ nhanh vẫn ghi vào FSRS như thường: Quên = mức 1, Nhớ = mức 3. */
              <div className="flex items-center gap-4">
                <button
                  onClick={(e) => { e.stopPropagation(); grade(1); }}
                  disabled={grading}
                  className="c-btn c-btn-danger c-btn-lg min-w-[160px] justify-center"
                >
                  <X size={20} />
                  {t("Forgot", "Quên")}
                  <span className="text-xs opacity-60">←</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); grade(3); }}
                  disabled={grading}
                  className="c-btn c-btn-success c-btn-lg min-w-[160px] justify-center"
                >
                  <Check size={20} />
                  {t("Got it", "Nhớ")}
                  <span className="text-xs opacity-60">→</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={removeCard}
            className="mt-6 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-error)] flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={13} /> {t("Delete this card", "Xoá thẻ này")}
          </button>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `,
        }}
      />
    </div>
  );
}

/**
 * `useSearchParams` buộc phần cây phía dưới phải render ở trình duyệt. Không bọc
 * Suspense thì Next 16 báo lỗi lúc build và cả trang mất khả năng dựng sẵn.
 */
export default function FlashcardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-[var(--color-text-muted)]">
          <Loader2 size={22} className="animate-spin" />
        </div>
      }
    >
      <FlashcardSession />
    </Suspense>
  );
}
