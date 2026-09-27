"use client";

import { useState, useEffect } from "react";
import {
  Loader2, AlertCircle, Check, Bookmark, BookmarkCheck, Volume2,
  Sparkles, X, Repeat, Feather, BookOpen, GraduationCap, Dumbbell, List,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, speechSupported, hasVoiceFor } from "@/lib/speech";
import BookUnitLesson from "./BookUnitLesson";
import BookUnitExercises from "./BookUnitExercises";
import Crumbs from "./Crumbs";

interface Word {
  term: string;
  ipa: string;
  marked: boolean;
}

interface StepData {
  step: number;
  label: string;
  kind: "grammar" | "vocabulary" | "review";
  title: string;
  section: string | null;
  done: boolean;
  words: Word[];
}

interface Lookup {
  term: string;
  definition?: string;
  example?: string;
  loading: boolean;
  error?: string;
}

const ICONS = { grammar: Feather, vocabulary: BookOpen, review: Repeat };

/**
 * Một unit của sách: danh sách từ, đánh dấu từ cần học, và tra nghĩa tại chỗ.
 *
 * Chạm vào một từ là hỏi AI ngay trong màn, không rời trang. Rời trang để tra
 * một từ là mất mạch đọc, và mất mạch đọc thì người ta thôi tra.
 *
 * Đánh dấu thì lưu thẳng vào ngân hàng từ vựng với thẻ `marked`, nên từ đánh
 * dấu ở đây và từ học qua giáo trình nằm chung một chỗ.
 */
export default function BookStepView({
  bookId,
  step,
  languageId,
  langCode,
  bookTitle,
  onBack,
  onBackToBooks,
}: {
  bookId: string;
  step: number;
  languageId?: string;
  langCode: string;
  bookTitle: string;
  onBack: () => void;
  onBackToBooks: () => void;
}) {
  const { t } = useLanguage();

  const [data, setData] = useState<StepData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);

  /**
   * Ba phần của một unit. Mặc định mở Bài học: đọc hiểu rồi mới luyện thì bài
   * luyện mới có ích, chứ luyện trước khi biết quy tắc là đoán mò.
   */
  const key = `${bookId}:${step}`;
  const loading = loadedFor !== key;
  const canHear = speechSupported() && hasVoiceFor(langCode);

  const [tab, setTab] = useState<"lesson" | "exercises" | "words">("lesson");

  /**
   * Bài học và bài tập, gắn kèm KHOÁ của unit đang mở.
   *
   * Gắn khoá để suy ra thay vì reset trong effect: reset bằng `setState` ngay
   * trong thân effect sinh ra một lượt dựng hình thừa, và trình biên dịch React
   * bắt đúng lỗi đó.
   */
  const [content, setContent] = useState<{
    key: string;
    lesson: Parameters<typeof BookUnitLesson>[0]["lesson"];
    exercises: Parameters<typeof BookUnitExercises>[0]["items"];
  }>({ key: "", lesson: null, exercises: null });

  const lesson = content.key === key ? content.lesson : null;
  const exercises = content.key === key ? content.exercises : null;

  const setLesson = (v: Parameters<typeof BookUnitLesson>[0]["lesson"]) =>
    setContent((prev) => ({ key, lesson: v, exercises: prev.key === key ? prev.exercises : null }));
  const setExercises = (v: Parameters<typeof BookUnitExercises>[0]["items"]) =>
    setContent((prev) => ({ key, lesson: prev.key === key ? prev.lesson : null, exercises: v }));


  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/books/step?bookId=${encodeURIComponent(bookId)}&step=${step}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không mở được unit");
        setData(json.step);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(key);
      });
    return () => controller.abort();
  }, [key, bookId, step]);

  // Nội dung đã soạn lần trước thì nạp lại, đừng bắt bấm "soạn" lần nữa.
  useEffect(() => {
    const controller = new AbortController();
    for (const part of ["lesson", "exercises"] as const) {
      fetch("/api/learning/books/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, step, part, peek: true }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((json) => {
          if (controller.signal.aborted || !json?.success || !json.cached) return;
          // Gọi thẳng `setContent` chứ không qua hàm phụ: hàm phụ dựng mới mỗi
          // lượt render nên đưa vào danh sách phụ thuộc là effect chạy lại vô hạn.
          setContent((prev) => {
            const base = prev.key === key ? prev : { key, lesson: null, exercises: null };
            return part === "lesson"
              ? { ...base, key, lesson: json.lesson }
              : { ...base, key, exercises: json.exercises?.items ?? null };
          });
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [key, bookId, step]);

  const toggleMark = async (word: Word) => {
    setBusy(word.term);
    const next = !word.marked;
    try {
      const res = await fetch("/api/learning/books/step", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, term: word.term, marked: next, languageId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không đánh dấu được");
      setData((prev) =>
        prev
          ? { ...prev, words: prev.words.map((w) => (w.term === word.term ? { ...w, marked: next } : w)) }
          : prev
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const askAi = async (term: string) => {
    setLookup({ term, loading: true });
    try {
      const res = await fetch("/api/learning/dictionary/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, context: data?.title, languageId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tra được");
      // Đường tra từ trả kết quả trong khoá `data`.
      const hit = json.data ?? {};
      setLookup({ term, loading: false, definition: hit.definition, example: hit.example });
    } catch (err) {
      setLookup({ term, loading: false, error: (err as Error).message });
    }
  };

  const markDone = async () => {
    if (!data) return;
    setBusy("__step");
    try {
      await fetch("/api/learning/books/step", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, step, done: !data.done }),
      });
      setData((prev) => (prev ? { ...prev, done: !prev.done } : prev));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 c-help">
        <Loader2 size={16} className="animate-spin" />
        {t("Loading…", "Đang tải…")}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="c-alert c-alert-error">
        <AlertCircle size={18} className="icon" />
        <p className="flex-1">{error ?? t("Unit not found", "Không tìm thấy unit")}</p>
      </div>
    );
  }

  const Icon = ICONS[data.kind];
  const markedCount = data.words.filter((w) => w.marked).length;

  return (
    <div className="space-y-6">
      <Crumbs
        items={[
          { label: t("Books", "Tủ sách"), onClick: onBackToBooks },
          { label: bookTitle, onClick: onBack },
          { label: `${data.label}. ${data.title}` },
        ]}
      />

      <div className="space-y-2">
        <p className="c-stat-label flex items-center gap-2">
          <Icon size={14} />
          {data.kind === "review"
            ? t("Review", "Bài ôn")
            : data.kind === "grammar"
              ? t("Grammar", "Ngữ pháp")
              : t("Vocabulary", "Từ vựng")}
          {data.section && ` · ${data.section}`}
        </p>
        <h2 className="c-h2">
          <span className="text-[var(--color-text-faint)] mr-2">{data.label}.</span>
          {data.title}
        </h2>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {/* Ba phần: học — luyện — từ. Unit ngữ pháp thì không có phần từ. */}
      <div className="c-seg w-fit">
        <button className={`c-seg-opt ${tab === "lesson" ? "active" : ""}`} onClick={() => setTab("lesson")}>
          <GraduationCap size={15} />
          {t("Lesson", "Bài học")}
        </button>
        <button className={`c-seg-opt ${tab === "exercises" ? "active" : ""}`} onClick={() => setTab("exercises")}>
          <Dumbbell size={15} />
          {t("Exercises", "Bài tập")}
        </button>
        {data.words.length > 0 && (
          <button className={`c-seg-opt ${tab === "words" ? "active" : ""}`} onClick={() => setTab("words")}>
            <List size={15} />
            {t("Words", "Từ vựng")}
          </button>
        )}
      </div>

      {tab === "lesson" ? (
        <BookUnitLesson bookId={bookId} step={step} lesson={lesson} onLoaded={setLesson} />
      ) : tab === "exercises" ? (
        <BookUnitExercises bookId={bookId} step={step} items={exercises} onLoaded={setExercises} />
      ) : (
        <>
          <p className="c-help">
            {t(
              "Tap a word to ask AI what it means. Use the bookmark to add it to your words to learn.",
              "Chạm vào một từ để hỏi AI nghĩa của nó. Bấm dấu trang để thêm vào danh sách từ cần học."
            )}
            {markedCount > 0 && ` · ${t(`${markedCount} marked`, `đã đánh dấu ${markedCount}`)}`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.words.map((w) => (
              <div
                key={w.term}
                className={`c-card px-4 py-3 flex items-center gap-3 ${
                  w.marked ? "border-[var(--color-primary)]" : ""
                }`}
              >
                <button
                  onClick={() => askAi(w.term)}
                  className="flex-1 min-w-0 text-left group"
                  title={t("Ask AI", "Hỏi AI")}
                >
                  <span className="block font-medium truncate group-hover:text-[var(--color-primary)] transition-colors">
                    {w.term}
                  </span>
                  {w.ipa && <span className="block c-stat-label truncate">/{w.ipa}/</span>}
                </button>

                {canHear && (
                  <button
                    onClick={() => speak(w.term, langCode, 0.9)}
                    aria-label={t(`Say ${w.term}`, `Đọc ${w.term}`)}
                    className="w-10 h-10 grid place-content-center rounded-full text-[var(--color-text-faint)] hover:text-[var(--color-primary)] transition-colors flex-none"
                  >
                    <Volume2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => void toggleMark(w)}
                  disabled={busy === w.term}
                  aria-label={
                    w.marked
                      ? t(`Unmark ${w.term}`, `Bỏ đánh dấu ${w.term}`)
                      : t(`Mark ${w.term} to learn`, `Đánh dấu ${w.term} để học`)
                  }
                  className={`w-10 h-10 grid place-content-center rounded-full flex-none transition-colors ${
                    w.marked
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-text-faint)] hover:text-[var(--color-primary)]"
                  }`}
                >
                  {busy === w.term ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : w.marked ? (
                    <BookmarkCheck size={17} />
                  ) : (
                    <Bookmark size={17} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <button
        onClick={markDone}
        disabled={busy === "__step"}
        className={`c-btn c-btn-lg ${data.done ? "c-btn-secondary" : "c-btn-primary"}`}
      >
        {busy === "__step" ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        {data.done ? t("Mark as not done", "Bỏ đánh dấu đã học") : t("Mark unit as done", "Đánh dấu đã học xong")}
      </button>

      {/* Ô tra nghĩa — đây là modal, nên được phép có bóng theo hệ thiết kế */}
      {lookup && (
        <div
          // Canh GIỮA chứ không dính đáy, và nằm trên thanh điều hướng dưới
          // (z-50). Dính đáy ở khổ điện thoại thì thanh nav che mất nửa ô.
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          onClick={() => setLookup(null)}
        >
          <div
            className="c-card c-elev-md w-full max-w-md p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="c-h3">{lookup.term}</p>
              <button
                onClick={() => setLookup(null)}
                aria-label={t("Close", "Đóng")}
                className="w-10 h-10 grid place-content-center rounded-full text-[var(--color-text-faint)] hover:text-[var(--color-text)] flex-none"
              >
                <X size={18} />
              </button>
            </div>

            {lookup.loading ? (
              <p className="c-help flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                {t("Asking AI…", "Đang hỏi AI…")}
              </p>
            ) : lookup.error ? (
              <p className="c-help">{lookup.error}</p>
            ) : (
              <>
                <p className="leading-relaxed">{lookup.definition}</p>
                {lookup.example && (
                  <p className="c-help italic border-l-2 border-[var(--color-border)] pl-3">
                    {lookup.example}
                  </p>
                )}
                <button
                  onClick={() => {
                    const w = data.words.find((x) => x.term === lookup.term);
                    if (w && !w.marked) void toggleMark(w);
                    setLookup(null);
                  }}
                  className="c-btn c-btn-primary c-btn-sm"
                >
                  <Sparkles size={15} />
                  {t("Add to words to learn", "Thêm vào từ cần học")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
