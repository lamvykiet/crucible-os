"use client";

import { useState } from "react";
import {
  Loader2, AlertCircle, Check, X, Sparkles, Volume2, Gauge, RefreshCw, BookOpen,
  Headphones,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, stopSpeaking, speechSupported } from "@/lib/speech";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/grammarSyllabus";

interface Item {
  id: string;
  title: string;
  /** Bài nghe giấu lời thoại cho tới khi chấm xong. */
  body: string | null;
  questions: { prompt: string; options: string[] }[];
}

interface Result {
  correctIndex: number;
  explanation: string;
  chosen: number | null;
  correct: boolean;
}

interface Props {
  skill: "reading" | "listening";
  languageId?: string;
  /** Mã BCP-47 để đọc bài nghe. */
  langCode?: string;
}

/**
 * Luyện đọc và luyện nghe.
 *
 * Cùng một màn, khác nhau ở chỗ có được nhìn văn bản hay không. Bài nghe giấu
 * lời thoại và phát bằng giọng đọc của trình duyệt; lời thoại chỉ hiện sau khi
 * đã nộp, để đối chiếu chỗ mình nghe hụt.
 *
 * Máy không có giọng cho thứ tiếng đang học thì phần nghe báo trước thay vì
 * phát ra giọng sai — nghe một giọng sai còn hại hơn không nghe.
 */
export default function PracticeSession({ skill, languageId, langCode = "en" }: Props) {
  const { t } = useLanguage();

  const [level, setLevel] = useState<CefrLevel>("B1");
  const [item, setItem] = useState<Item | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plays, setPlays] = useState(0);

  const isListening = skill === "listening";
  const canSpeak = speechSupported();

  const newItem = async () => {
    setLoading(true);
    setError(null);
    setItem(null);
    setResults(null);
    setTranscript(null);
    setScore(null);
    setPlays(0);
    stopSpeaking();
    try {
      const res = await fetch("/api/learning/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, level, languageId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không soạn được bài");
      setItem(json.item);
      setAnswers(new Array(json.item.questions.length).fill(null));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!item || grading) return;
    setGrading(true);
    setError(null);
    stopSpeaking();
    try {
      const res = await fetch("/api/learning/practice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, answers }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không chấm được");
      setResults(json.results);
      setTranscript(json.body);
      setScore({ correct: json.correctCount, total: json.total });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGrading(false);
    }
  };

  const play = (rate = 1) => {
    // Lời thoại nằm ở máy chủ cho tới khi chấm xong, nên trước đó phải xin
    // riêng từng lượt phát. Sau khi chấm thì đã có sẵn trong `transcript`.
    if (transcript) {
      speak(transcript, langCode, rate);
      setPlays((n) => n + 1);
      return;
    }
    fetch("/api/learning/practice/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item?.id }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) {
          speak(j.body, langCode, rate);
          setPlays((n) => n + 1);
        } else setError(j?.error || "Không phát được");
      })
      .catch(() => setError(t("Could not play the audio", "Không phát được bài nghe")));
  };

  const allAnswered = answers.length > 0 && answers.every((a) => a !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="c-seg">
          {CEFR_LEVELS.map((lv) => (
            <button
              key={lv}
              className={`c-seg-opt ${level === lv ? "active" : ""}`}
              onClick={() => setLevel(lv)}
            >
              {lv}
            </button>
          ))}
        </div>
        <button onClick={newItem} disabled={loading} className="c-btn c-btn-primary">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {item ? t("New passage", "Bài khác") : t("Start", "Bắt đầu")}
        </button>
      </div>

      {isListening && !canSpeak && (
        <div className="c-alert c-alert-warning">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">
            {t(
              "This browser cannot read text aloud, so listening practice will not work here.",
              "Trình duyệt này không đọc thành tiếng được, nên phần luyện nghe sẽ không chạy."
            )}
          </span>
        </div>
      )}

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <div className="flex-1 space-y-2">
            <p>{error}</p>
            <button onClick={newItem} className="c-btn c-btn-secondary c-btn-sm">
              <RefreshCw size={14} />
              {t("Try again", "Thử lại")}
            </button>
          </div>
        </div>
      )}

      {!item ? (
        <div className="c-card p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] grid place-content-center">
            {isListening ? <Headphones size={28} /> : <BookOpen size={28} />}
          </div>
          <p className="c-h3">
            {isListening ? t("Listening practice", "Luyện nghe") : t("Reading practice", "Luyện đọc")}
          </p>
          <p className="c-card-body max-w-sm">
            {isListening
              ? t(
                  "A short talk at your level, played aloud. The transcript stays hidden until you answer.",
                  "Một đoạn nói ngắn đúng tầm, phát thành tiếng. Lời thoại bị giấu cho tới khi bạn trả lời xong."
                )
              : t(
                  "A short passage at your level, with questions you can only answer from the text.",
                  "Một đoạn văn ngắn đúng tầm, câu hỏi chỉ trả lời được từ chính bài."
                )}
          </p>
        </div>
      ) : (
        <>
          <div className="c-card p-6 space-y-4">
            <p className="c-card-kicker">{item.title}</p>

            {isListening ? (
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => play(1)} disabled={!canSpeak} className="c-btn c-btn-primary">
                  <Volume2 size={16} />
                  {plays === 0 ? t("Play", "Nghe") : t("Play again", "Nghe lại")}
                </button>
                <button onClick={() => play(0.7)} disabled={!canSpeak} className="c-btn c-btn-secondary">
                  <Gauge size={16} />
                  {t("Slower", "Chậm hơn")}
                </button>
                <span className="c-stat-label tabular-nums">
                  {t(`played ${plays}×`, `đã nghe ${plays} lần`)}
                </span>
              </div>
            ) : (
              <p className="leading-relaxed whitespace-pre-wrap text-[17px]">{item.body}</p>
            )}
          </div>

          {/* Câu hỏi */}
          <div className="space-y-5">
            {item.questions.map((q, qi) => {
              const r = results?.[qi];
              return (
                <div key={qi} className="c-card p-5 space-y-3">
                  <p className="font-medium">
                    <span className="c-stat-label mr-2 tabular-nums">{qi + 1}.</span>
                    {q.prompt}
                  </p>
                  <div className="grid gap-2">
                    {q.options.map((opt, oi) => {
                      const chosen = answers[qi] === oi;
                      const showRight = r && r.correctIndex === oi;
                      const showWrong = r && chosen && !r.correct;
                      return (
                        <button
                          key={oi}
                          onClick={() =>
                            !results &&
                            setAnswers((prev) => {
                              const next = [...prev];
                              next[qi] = oi;
                              return next;
                            })
                          }
                          disabled={Boolean(results)}
                          className={`c-btn justify-start text-left ${
                            showRight
                              ? "c-btn-success"
                              : showWrong
                                ? "c-btn-danger"
                                : chosen
                                  ? "c-btn-primary"
                                  : "c-btn-secondary"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {r && (
                    <p className="text-sm text-[var(--color-text-muted)] flex items-start gap-2">
                      {r.correct ? (
                        <Check size={14} className="text-[var(--color-success)] flex-none mt-0.5" />
                      ) : (
                        <X size={14} className="text-[var(--color-error)] flex-none mt-0.5" />
                      )}
                      {r.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!results ? (
            <button
              onClick={submit}
              disabled={!allAnswered || grading}
              className="c-btn c-btn-primary c-btn-lg"
            >
              {grading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {allAnswered
                ? t("Check answers", "Chấm bài")
                : t("Answer every question first", "Trả lời hết đã")}
            </button>
          ) : (
            <div className="space-y-5">
              <div className="c-card c-elev-md p-6">
                <p className="c-card-kicker">{t("Score", "Kết quả")}</p>
                <p className="c-stat-value">
                  {score?.correct}
                  <span className="text-[var(--color-text-faint)]">/{score?.total}</span>
                </p>
              </div>

              {/* Lời thoại chỉ hiện sau khi chấm — trước đó thì bài nghe hoá bài đọc */}
              {isListening && transcript && (
                <div className="c-card p-6 space-y-2">
                  <p className="c-card-kicker">{t("Transcript", "Lời thoại")}</p>
                  <p className="leading-relaxed whitespace-pre-wrap">{transcript}</p>
                </div>
              )}

              <button onClick={newItem} className="c-btn c-btn-primary">
                <Sparkles size={16} />
                {t("Another one", "Bài khác")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
