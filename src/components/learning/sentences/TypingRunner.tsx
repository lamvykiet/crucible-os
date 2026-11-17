"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Check, Eye, EyeOff, Lightbulb, Mic, MicOff, Volume2, Gauge, AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, stopSpeaking, speechSupported } from "@/lib/speech";
import { listenOnce, speechInputSupported } from "@/lib/speechInput";
import {
  revealedCount, hintNext, sameSentence, markWords, displayTokens, typingSteps,
  type TypingLevel,
} from "@/lib/sentences/types";
import { WordSlots, Kbd, postResult, type PracticeSentence, type SentenceOutcome } from "./shared";

export type TypingMode = "meaning" | "listen" | "speak";

const KIND_LABEL = {
  key: ["Key word", "Từ khoá"],
  chunk: ["Phrase", "Cụm"],
  sentence: ["Whole sentence", "Cả câu"],
} as const;

/**
 * Gõ câu — học theo mục "Gõ câu" của aioenglish.com.
 *
 * Một câu đi qua nhiều bậc: từ khoá → từng cụm → cả câu (bậc Cơ bản). Đi từ
 * nhỏ lên lớn để tới lúc gõ cả câu thì các mảnh đã nằm sẵn trong tay. Ba cách:
 * nhìn nghĩa rồi gõ; nghe rồi gõ (nghĩa giấu đi); nghe rồi nói lại.
 */
export default function TypingRunner({
  languageId,
  code,
  sentences,
  mode,
  level,
  onFinish,
  onExit,
}: {
  languageId: string;
  code: string;
  sentences: PracticeSentence[];
  mode: TypingMode;
  level: TypingLevel;
  onFinish: (outcomes: SentenceOutcome[]) => void;
  onExit: () => void;
}) {
  const { t } = useLanguage();
  const canHear = speechSupported();
  const canSpeak = speechInputSupported();
  // Nghe & nói mà máy không nhận giọng được thì lùi về nghe rồi gõ.
  const effectiveMode: TypingMode = mode === "speak" && !canSpeak ? "listen" : mode;

  const [at, setAt] = useState(0);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [stepShown, setStepShown] = useState(false);
  const [showMeaning, setShowMeaning] = useState(effectiveMode === "meaning");
  const [marks, setMarks] = useState<boolean[] | undefined>();
  const [stepOk, setStepOk] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Theo dõi cả câu (mọi bậc gộp lại) để ghi kết quả một lần.
  const hintsRef = useRef(0);
  const shownRef = useRef(false);
  const outcomes = useRef<SentenceOutcome[]>([]);
  const stopMic = useRef<(() => void) | null>(null);
  // Chặn qua bậc hai lần (vừa gõ trọn vừa bấm Enter cùng lúc).
  const acceptedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const s = sentences[at];
  const steps = useMemo(() => typingSteps(s, level), [s, level]);
  const cur = steps[step];
  const total = displayTokens(cur.en).length;
  const revealed = revealedCount(input, cur.en);
  const isLastSentence = at === sentences.length - 1;

  const play = useCallback((rate = 1) => { if (canHear) speak(cur.en, code, rate); }, [canHear, cur.en, code]);

  // Chế độ nghe: mỗi bậc mới tự đọc lên.
  useEffect(() => {
    if (effectiveMode !== "meaning") play();
    return () => stopSpeaking();
  }, [at, step, effectiveMode, play]);

  const advance = useCallback(() => {
    acceptedRef.current = false;
    setInput("");
    setMarks(undefined);
    setStepOk(false);
    setStepShown(false);
    setMicError(null);
    if (step < steps.length - 1) {
      setStep((x) => x + 1);
    } else {
      const perfect = !shownRef.current;
      const hints = hintsRef.current;
      outcomes.current.push({ sentence: s, perfect, clean: perfect && hints === 0, hints });
      void postResult({
        languageId, mode: "typing", sentence: s, perfect, hints, typed: "", sessionEnd: isLastSentence,
      });
      if (isLastSentence) {
        onFinish(outcomes.current);
        return;
      }
      hintsRef.current = 0;
      shownRef.current = false;
      setAt((x) => x + 1);
      setStep(0);
      setShowMeaning(effectiveMode === "meaning");
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [step, steps.length, s, languageId, isLastSentence, onFinish, effectiveMode]);

  const accept = useCallback(() => {
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    setStepOk(true);
    setMarks(undefined);
    // Nhìn nghĩa thì đọc lên khi đúng để tai nghe lại cái tay vừa gõ.
    if (effectiveMode === "meaning") play();
    window.setTimeout(advance, cur.kind === "sentence" ? 900 : 500);
  }, [advance, effectiveMode, play, cur.kind]);

  // Gõ trọn mọi ô là qua bậc.
  useEffect(() => {
    if (!stepOk && total > 0 && revealed === total) accept();
  }, [revealed, total, stepOk, accept]);

  const check = (value = input) => {
    if (!value.trim() || stepOk) return;
    if (sameSentence(value, cur.en)) accept();
    else setMarks(markWords(value, cur.en).map((m) => m.ok));
  };

  const hint = () => {
    if (stepOk) return;
    setInput((v) => hintNext(v, cur.en));
    hintsRef.current += 1;
    setMarks(undefined);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const reveal = () => {
    setStepShown(true);
    shownRef.current = true;
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const toggleMic = () => {
    if (listening) {
      stopMic.current?.();
      return;
    }
    setMicError(null);
    setInput("");
    setListening(true);
    stopMic.current = listenOnce(code, {
      onText: (text, final) => {
        setInput(text);
        if (final) check(text);
      },
      onEnd: () => setListening(false),
      onError: (msg) => setMicError(msg),
    });
  };

  useEffect(() => () => stopMic.current?.(), []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => { stopSpeaking(); stopMic.current?.(); onExit(); }} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
          <ArrowLeft size={16} />
          {t("Stop", "Dừng")}
        </button>
        <span className="c-stat-label tabular-nums ml-auto">
          {t(`Sentence ${at + 1} of ${sentences.length}`, `Câu ${at + 1}/${sentences.length}`)}
        </span>
      </div>
      <div className="c-progress">
        <span style={{ width: `${((at + step / steps.length) / sentences.length) * 100}%` }} />
      </div>

      {mode === "speak" && !canSpeak && (
        <div className="c-alert c-alert-info">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">
            {t(
              "This browser cannot turn speech into text, so you will type what you hear instead.",
              "Trình duyệt này không nhận được giọng nói, nên bạn gõ lại điều nghe được thay vì nói."
            )}
          </p>
        </div>
      )}

      <div className="c-card c-elev-md p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((x, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-colors ${x.kind === "sentence" ? "w-10" : "w-5"} ${
                i < step || (i === step && stepOk)
                  ? "bg-[var(--color-success)]"
                  : i === step
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-surface-2)]"
              }`}
            />
          ))}
          <span className="c-chip c-chip-outline ml-2">{t(KIND_LABEL[cur.kind][0], KIND_LABEL[cur.kind][1])}</span>
        </div>

        <div className="space-y-2 min-h-[3.5rem]">
          {showMeaning ? (
            <p className={cur.kind === "sentence" ? "c-h3" : "c-h2"}>{cur.vi}</p>
          ) : (
            <p className="c-help">
              {effectiveMode === "speak"
                ? t("Listen, then say it back.", "Nghe rồi nói lại.")
                : t("Listen, then type what you hear.", "Nghe rồi gõ lại điều nghe được.")}
            </p>
          )}
          {effectiveMode !== "meaning" && (
            <button onClick={() => setShowMeaning((v) => !v)} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
              {showMeaning ? <EyeOff size={14} /> : <Eye size={14} />}
              {showMeaning ? t("Hide meaning", "Ẩn nghĩa") : t("Show meaning", "Hiện nghĩa")}
            </button>
          )}
        </div>

        <WordSlots text={cur.en} revealed={revealed} revealAll={stepOk || stepShown} marks={marks} />

        <div className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={input}
            disabled={stepOk}
            onChange={(e) => { setInput(e.target.value); setMarks(undefined); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); check(); }
              else if (e.key === " " && e.ctrlKey) { e.preventDefault(); hint(); }
            }}
            placeholder={
              effectiveMode === "speak"
                ? t("Press the mic and speak — or type", "Bấm micro rồi nói — hoặc gõ")
                : t("Type in English…", "Gõ tiếng Anh…")
            }
            className="c-input w-full text-[17px]"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {effectiveMode === "speak" && (
            <button
              onClick={toggleMic}
              disabled={stepOk}
              className={`c-btn ${listening ? "c-btn-danger" : "c-btn-primary"} flex-none`}
              aria-label={listening ? t("Stop", "Dừng") : t("Speak", "Nói")}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
        </div>

        {micError && <p className="c-help text-[var(--color-error)]">{micError}</p>}

        {stepOk ? (
          <div className="c-alert c-alert-success">
            <Check size={18} className="icon" />
            <p className="flex-1">{cur.en}</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => check()} disabled={!input.trim()} className="c-btn c-btn-primary">
              <Check size={16} />
              {t("Submit", "Gửi")} <Kbd>Enter</Kbd>
            </button>
            {canHear && (
              <>
                <button onClick={() => play()} className="c-btn c-btn-secondary">
                  <Volume2 size={16} />
                  {t("Listen", "Phát âm")}
                </button>
                {effectiveMode !== "meaning" && (
                  <button onClick={() => play(0.6)} className="c-btn c-btn-secondary">
                    <Gauge size={16} />
                    {t("Slower", "Chậm")}
                  </button>
                )}
              </>
            )}
            <button onClick={hint} className="c-btn c-btn-secondary">
              <Lightbulb size={16} />
              {t("Next word", "Gợi ý 1 chữ")} <Kbd>Ctrl Space</Kbd>
            </button>
            <button onClick={reveal} disabled={stepShown} className="c-btn c-btn-tertiary">
              <Eye size={16} />
              {t("Answer", "Đáp án")}
            </button>
          </div>
        )}

        {stepShown && !stepOk && (
          <p className="c-help">
            {t("Now type it yourself to move on.", "Giờ tự gõ lại để đi tiếp.")}
          </p>
        )}
      </div>
    </div>
  );
}
