"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Eye, Lightbulb, Loader2, Sparkles, Volume2, AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, stopSpeaking, speechSupported } from "@/lib/speech";
import { revealedCount, hintNext, sameSentence, markWords, displayTokens } from "@/lib/sentences/types";
import { WordSlots, Kbd, postResult, type PracticeSentence, type SentenceOutcome } from "./shared";

interface Grade {
  score: number;
  verdict: "correct" | "close" | "wrong";
  corrected: string;
  summary: string;
  issues: { wrong: string; right: string; why: string }[];
}

type Status = "typing" | "wrong" | "done";

/**
 * Dịch câu Việt → Anh.
 *
 * Lấy cách làm của luyentu.com ("gõ đúng tới đâu mở từ tới đó", Ctrl+Space hiện
 * từ kế) và phần chấm bản dịch của aioenglish.com. Ô chữ chỉ so với MỘT bản
 * mẫu; dịch kiểu khác mà vẫn đúng thì bấm "Chấm bằng AI" — AI nói đúng thì câu
 * vẫn tính là qua.
 */
export default function TranslateRunner({
  languageId,
  code,
  sentences,
  onFinish,
  onExit,
}: {
  languageId: string;
  code: string;
  sentences: PracticeSentence[];
  onFinish: (outcomes: SentenceOutcome[]) => void;
  onExit: () => void;
}) {
  const { t } = useLanguage();
  const [at, setAt] = useState(0);
  const [input, setInput] = useState("");
  const [hints, setHints] = useState(0);
  const [shown, setShown] = useState(false);
  const [status, setStatus] = useState<Status>("typing");
  const [marks, setMarks] = useState<boolean[] | undefined>();
  const [grade, setGrade] = useState<Grade | null>(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);

  const outcomes = useRef<SentenceOutcome[]>([]);
  const posted = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const s = sentences[at];
  const total = displayTokens(s.en).length;
  const revealed = revealedCount(input, s.en);
  const isLast = at === sentences.length - 1;
  const canHear = speechSupported();

  /** Chốt câu: ghi kết quả đúng một lần. */
  const finish = useCallback(
    (perfect: boolean, typed: string) => {
      if (posted.current) return;
      posted.current = true;
      setStatus("done");
      setPassed(perfect);
      outcomes.current.push({ sentence: s, perfect, clean: perfect && hints === 0, hints });
      void postResult({
        languageId, mode: "translate", sentence: s, perfect, hints, typed, sessionEnd: isLast,
      });
      if (canHear) speak(s.en, code);
    },
    [s, hints, isLast, languageId, code, canHear]
  );

  // Gõ trọn mọi ô là xong câu, không cần bấm Enter.
  useEffect(() => {
    if (status !== "done" && total > 0 && revealed === total && !shown) finish(true, input);
  }, [revealed, total, status, shown, finish, input]);

  const next = useCallback(() => {
    stopSpeaking();
    if (isLast) {
      onFinish(outcomes.current);
      return;
    }
    posted.current = false;
    setAt((i) => i + 1);
    setInput("");
    setHints(0);
    setShown(false);
    setStatus("typing");
    setMarks(undefined);
    setGrade(null);
    setError(null);
    setPassed(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isLast, onFinish]);

  // Xong câu thì Enter để sang câu sau (ô nhập đã khoá nên bắt ở cửa sổ).
  useEffect(() => {
    if (status !== "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, next]);

  const check = () => {
    if (!input.trim() || status === "done") return;
    if (sameSentence(input, s.en)) {
      finish(true, input);
      return;
    }
    setMarks(markWords(input, s.en).map((m) => m.ok));
    setStatus("wrong");
  };

  const hint = () => {
    if (status === "done") return;
    setInput((v) => hintNext(v, s.en));
    setHints((h) => h + 1);
    setMarks(undefined);
    setStatus("typing");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const reveal = () => {
    setShown(true);
    finish(false, input);
  };

  const askAi = async () => {
    if (!input.trim()) return;
    setGrading(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/sentences/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, vi: s.vi, reference: s.en, answer: input }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không chấm được");
      setGrade(json.grade);
      finish(json.grade.verdict === "correct", input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chấm được");
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => { stopSpeaking(); onExit(); }} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
          <ArrowLeft size={16} />
          {t("Stop", "Dừng")}
        </button>
        <span className="c-stat-label tabular-nums ml-auto">
          {t(`Sentence ${at + 1} of ${sentences.length}`, `Câu ${at + 1}/${sentences.length}`)}
        </span>
      </div>
      <div className="c-progress">
        <span style={{ width: `${(at / sentences.length) * 100}%` }} />
      </div>

      <div className="c-card c-elev-md p-6 space-y-5">
        <div className="space-y-2">
          <p className="c-stat-label">{t("Vietnamese", "Nghĩa tiếng Việt")}</p>
          <p className="c-h3">{s.vi}</p>
        </div>

        <WordSlots text={s.en} revealed={revealed} revealAll={status === "done"} marks={status === "wrong" ? marks : undefined} />

        {status !== "done" ? (
          <>
            <textarea
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (status === "wrong") {
                  setStatus("typing");
                  setMarks(undefined);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  check();
                } else if (e.key === " " && e.ctrlKey) {
                  e.preventDefault();
                  hint();
                }
              }}
              rows={2}
              placeholder={t("Type the English sentence…", "Gõ câu tiếng Anh…")}
              className="c-textarea w-full text-[17px] leading-relaxed"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />

            {status === "wrong" && (
              <div className="c-alert c-alert-warning">
                <AlertCircle size={18} className="icon" />
                <p className="flex-1">
                  {t(
                    "Not the same as the model answer. Fix the red words, take a hint — or if you translated it another way, let AI judge it.",
                    "Chưa khớp bản mẫu. Sửa các chữ đỏ, xin gợi ý — hoặc nếu bạn dịch theo cách khác, để AI chấm."
                  )}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={check} disabled={!input.trim()} className="c-btn c-btn-primary">
                <Check size={16} />
                {t("Check", "Kiểm tra")} <Kbd>Enter</Kbd>
              </button>
              <button onClick={hint} className="c-btn c-btn-secondary">
                <Lightbulb size={16} />
                {t("Next word", "Gợi ý 1 chữ")} <Kbd>Ctrl Space</Kbd>
              </button>
              <button onClick={askAi} disabled={!input.trim() || grading} className="c-btn c-btn-secondary">
                {grading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {t("AI check my version", "Chấm bằng AI")}
              </button>
              <button onClick={reveal} className="c-btn c-btn-tertiary">
                <Eye size={16} />
                {t("Show answer", "Xem đáp án")}
              </button>
              {hints > 0 && (
                <span className="c-stat-label tabular-nums ml-auto">
                  {t(`${hints} hint(s)`, `đã gợi ý ${hints} chữ`)}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className={`c-alert ${passed ? (hints === 0 ? "c-alert-success" : "c-alert-info") : "c-alert-warning"}`}>
              <Check size={18} className="icon" />
              <p className="flex-1">
                {passed
                  ? hints === 0
                    ? t("Spot on, no help needed.", "Chuẩn, không cần gợi ý.")
                    : t(`Done, with ${hints} hint(s). It goes into your mistake book.`, `Xong, có ${hints} lần gợi ý. Câu này vào sổ lỗi sai để ôn lại.`)
                  : t("Saved to your mistake book — it will come back for review.", "Đã ghi vào sổ lỗi sai — câu này sẽ quay lại để ôn.")}
              </p>
            </div>

            {input.trim() && !sameSentence(input, s.en) && (
              <p className="c-help">
                {t("You wrote:", "Bạn viết:")} <span className="text-[var(--color-text)]">{input}</span>
              </p>
            )}

            {grade && (
              <div className="c-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[var(--color-accent)]" />
                  <span className="font-bold tabular-nums">{grade.score}/10</span>
                  <span className={`c-chip ${grade.verdict === "correct" ? "c-chip-success" : grade.verdict === "close" ? "c-chip-warning" : "c-chip-error"}`}>
                    {grade.verdict === "correct" ? t("Correct", "Đúng") : grade.verdict === "close" ? t("Nearly", "Gần đúng") : t("Wrong", "Sai")}
                  </span>
                </div>
                <p className="c-card-body">{grade.summary}</p>
                {grade.corrected && !sameSentence(grade.corrected, input) && (
                  <p>
                    <span className="c-stat-label">{t("Your version, fixed: ", "Bản của bạn sau khi sửa: ")}</span>
                    {grade.corrected}
                  </p>
                )}
                {grade.issues.length > 0 && (
                  <ul className="space-y-1.5">
                    {grade.issues.map((i, k) => (
                      <li key={k} className="text-[14px]">
                        <span className="line-through text-[var(--color-error)]">{i.wrong}</span>
                        {" → "}
                        <span className="text-[var(--color-success)] font-medium">{i.right}</span>
                        <span className="c-help"> · {i.why}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* Không autoFocus: Enter đã bắt ở cửa sổ, focus thêm vào nút là
                  một lần Enter nhảy hai câu. */}
              <button onClick={next} className="c-btn c-btn-primary">
                {isLast ? t("Finish", "Xong lượt") : t("Next sentence", "Câu tiếp")}
                <ArrowRight size={16} /> <Kbd>Enter</Kbd>
              </button>
              {canHear && (
                <button onClick={() => speak(s.en, code)} className="c-btn c-btn-secondary">
                  <Volume2 size={16} />
                  {t("Listen", "Nghe")}
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="c-alert c-alert-error">
            <AlertCircle size={18} className="icon" />
            <p className="flex-1">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
