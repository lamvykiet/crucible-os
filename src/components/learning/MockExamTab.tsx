"use client";

import { useState, useEffect } from "react";
import {
  Play, Award, FileText, Loader2, AlertCircle, Check, X, RotateCcw, History,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface SourceFile {
  id: string;
  name: string;
  mimeType: string;
  path?: string;
}

interface Question {
  question: string;
  options: string[];
}

interface Result extends Question {
  correctIndex: number;
  explanation: string;
  chosenIndex: number | null;
}

interface Attempt {
  id: string;
  sourceName: string;
  questionCount: number;
  correctCount: number;
  completedAt: string;
}

/**
 * Thi thử sinh từ tài liệu.
 *
 * Bản cũ liệt kê ba đề viết cứng ("CFA Level 1 - Mock Exam A" 135 phút 90 câu,
 * "CMA Part 1", "IELTS Academic") không đề nào tồn tại ở đâu, và nút Bắt đầu
 * không có `onClick`. Giờ chọn một tài liệu thật, AI ra đề từ chính nội dung đó,
 * và bài làm được chấm ở máy chủ — đáp án không gửi xuống trình duyệt lúc phát đề.
 */
export default function MockExamTab() {
  const { t } = useLanguage();

  const [sources, setSources] = useState<SourceFile[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string>("");
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/drive/list?recursive=1", { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/learning/exam", { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([files, history]) => {
        if (controller.signal.aborted) return;
        setSources(files?.files ?? []);
        setAttempts(history?.attempts ?? []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const generate = async () => {
    if (!selected || generating) return;
    setGenerating(true);
    setError(null);
    setResults(null);
    setScore(null);
    try {
      const res = await fetch("/api/learning/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: selected, count }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tạo được đề");

      setAttemptId(json.attemptId);
      setSourceName(json.sourceName);
      setQuestions(json.questions);
      setAnswers(new Array(json.questions.length).fill(null));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const submit = async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/exam", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không chấm được bài");

      setResults(json.results);
      setScore({ correct: json.correctCount, total: json.questionCount });
      setAttempts((prev) => [
        {
          id: attemptId,
          sourceName,
          questionCount: json.questionCount,
          correctCount: json.correctCount,
          completedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setAttemptId(null);
    setQuestions([]);
    setAnswers([]);
    setResults(null);
    setScore(null);
  };

  const answered = answers.filter((a) => a !== null).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="c-h2 text-[var(--color-text)]">
          {t("Mock Exam", "Thi thử")}
        </h2>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          {t(
            "Generate a practice test from any document you are studying.",
            "Sinh đề luyện tập từ chính tài liệu bạn đang học."
          )}
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading...", "Đang tải...")}</span>
        </div>
      ) : !attemptId ? (
        <>
          <div className="c-card space-y-4">
            <div className="c-field">
              <label htmlFor="src">{t("Source document", "Tài liệu nguồn")}</label>
              <select
                id="src"
                className="c-input"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">{t("— Pick a document —", "— Chọn tài liệu —")}</option>
                {sources.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path ? `${f.path} / ${f.name}` : f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-3">
              <div className="c-field w-32">
                <label htmlFor="count">{t("Questions", "Số câu")}</label>
                <input
                  id="count"
                  type="number"
                  min={5}
                  max={20}
                  className="c-input"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
              <button
                onClick={generate}
                disabled={!selected || generating}
                className="c-btn c-btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {generating ? t("Writing questions...", "Đang ra đề...") : t("Start", "Bắt đầu")}
              </button>
            </div>

            {sources.length === 0 && (
              <p className="text-xs text-[var(--color-text-faint)]">
                {t(
                  "No documents in your Knowledge folder yet.",
                  "Thư mục tài liệu trên Drive đang trống."
                )}
              </p>
            )}
          </div>

          {attempts.length > 0 && (
            <div>
              <h3 className="c-h3 text-[var(--color-text)] mb-4 flex items-center gap-2">
                <History size={18} /> {t("Past attempts", "Lịch sử làm bài")}
              </h3>
              <div className="space-y-2">
                {attempts.map((a) => {
                  const pct = Math.round((a.correctCount / a.questionCount) * 100);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4"
                    >
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-none font-bold text-sm ${
                          pct >= 70
                            ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                            : pct >= 40
                              ? "bg-[var(--color-warning-tint)] text-[var(--color-warning)]"
                              : "bg-[var(--color-error-tint)] text-[var(--color-error)]"
                        }`}
                      >
                        {pct}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[var(--color-text)] truncate">{a.sourceName}</p>
                        <p className="text-xs text-[var(--color-text-faint)]">
                          {a.correctCount}/{a.questionCount} {t("correct", "câu đúng")} ·{" "}
                          {new Date(a.completedAt).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={16} className="text-[var(--color-text-muted)] flex-none" />
              <span className="font-bold text-sm text-[var(--color-text)] truncate">{sourceName}</span>
            </div>
            {score ? (
              <div className="flex items-center gap-3">
                <span className="c-chip c-chip-success flex items-center gap-1.5">
                  <Award size={14} /> {score.correct}/{score.total}
                </span>
                <button onClick={reset} className="c-btn c-btn-secondary c-btn-sm flex items-center gap-1.5">
                  <RotateCcw size={14} /> {t("New exam", "Đề mới")}
                </button>
              </div>
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">
                {answered}/{questions.length} {t("answered", "câu đã trả lời")}
              </span>
            )}
          </div>

          <div className="space-y-5">
            {questions.map((q, qi) => {
              const result = results?.[qi];
              return (
                <div key={qi} className="c-card">
                  <p className="font-bold text-[var(--color-text)] mb-4">
                    <span className="text-[var(--color-text-faint)] mr-2">{qi + 1}.</span>
                    {q.question}
                  </p>

                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const chosen = answers[qi] === oi;
                      const isCorrect = result && oi === result.correctIndex;
                      const isWrongPick = result && chosen && oi !== result.correctIndex;

                      return (
                        <button
                          key={oi}
                          onClick={() => {
                            if (results) return;
                            setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)));
                          }}
                          disabled={!!results}
                          className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors flex items-center gap-3 ${
                            isCorrect
                              ? "border-[var(--color-success)] bg-[var(--color-success-tint)] text-[var(--color-success)]"
                              : isWrongPick
                                ? "border-[var(--color-error)] bg-[var(--color-error-tint)] text-[var(--color-error)]"
                                : chosen
                                  ? "border-[var(--color-accent)] bg-[var(--color-surface-2)] text-[var(--color-text)]"
                                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
                          }`}
                        >
                          <span className="flex-none font-bold w-5">{"ABCD"[oi]}</span>
                          <span className="flex-1">{opt}</span>
                          {isCorrect && <Check size={16} className="flex-none" />}
                          {isWrongPick && <X size={16} className="flex-none" />}
                        </button>
                      );
                    })}
                  </div>

                  {result && (
                    <p className="mt-3 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] p-3 rounded-xl">
                      {result.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!results && (
            <button
              onClick={submit}
              disabled={submitting || answered === 0}
              className="c-btn c-btn-primary w-full justify-center flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />}
              {t("Submit", "Nộp bài")}
              {answered < questions.length &&
                ` (${t(`${questions.length - answered} unanswered`, `còn ${questions.length - answered} câu chưa làm`)})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
