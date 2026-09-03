"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Volume2, Gauge, Check, X, Eraser, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, answerMatches } from "@/lib/speech";
import { toneLabels } from "@/lib/languagePresets";

export interface StudyCard {
  id: string;
  front: string;
  back: string;
  state: number;
  term: string | null;
  phonetic: string | null;
  tone: string | null;
  example: string | null;
  exampleTranslation: string | null;
  imageUrl: string | null;
  language: {
    id: string;
    code: string;
    name: string;
    script: string;
    phoneticSystem: string;
    hasTones: boolean;
    toneCount: number;
  } | null;
}

export type ExerciseMode = "fill" | "choice" | "listen" | "tone" | "write";

/**
 * Trộn mảng theo một hạt giống cố định.
 *
 * `Math.random()` gọi lúc render là không thuần khiết: React có thể render lại
 * cùng một thẻ bất cứ lúc nào, và mỗi lần như thế thứ tự phương án lại nhảy
 * ngay dưới con trỏ người dùng. Trộn theo id thẻ thì thứ tự vẫn xáo, nhưng ổn
 * định trong suốt lúc thẻ đó còn trên màn.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  const next = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
  return items
    .map((value) => ({ value, order: next() }))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.value);
}

interface Props {
  card: StudyCard;
  mode: ExerciseMode;
  distractors: string[];
  lowercaseAnswers: boolean;
  /** Báo lên phiên học: đúng hay sai, để quy ra mức FSRS. */
  onAnswer: (correct: boolean) => void;
  busy: boolean;
}

/**
 * Một câu bài tập.
 *
 * Năm kiểu, và không phải kiểu nào cũng hợp với mọi thứ tiếng — luyện thanh chỉ
 * có nghĩa với Quan Thoại và Quảng Đông, luyện viết chỉ có nghĩa với chữ Hán và
 * Hangul. Phiên học ở tầng trên lọc trước, ở đây chỉ lo dựng.
 *
 * Mọi kiểu đều quy về một tín hiệu duy nhất: đúng hay sai. Phiên học quy tín
 * hiệu đó thành mức FSRS, nên bài tập không phải biết gì về thuật toán lặp lại.
 */
export default function ExerciseCard({
  card, mode, distractors, lowercaseAnswers, onAnswer, busy,
}: Props) {
  const { t } = useLanguage();

  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const lang = card.language;
  const answer = card.term ?? card.front;

  // Không cần dọn state khi đổi thẻ: phiên học render component này với
  // `key={card.id}`, nên mỗi thẻ là một lượt dựng mới và state đã sạch sẵn.
  // Ở đây chỉ đưa con trỏ vào ô nhập để gõ được ngay, không phải với chuột.
  useEffect(() => {
    if (mode === "fill" || mode === "listen") inputRef.current?.focus();
  }, [mode]);

  // Câu nghe thì đọc luôn khi hiện ra — chờ bấm nút mới nghe là thừa một nhịp.
  useEffect(() => {
    if (mode === "listen" && lang) speak(answer, lang.code);
  }, [card.id, mode, lang, answer]);

  /** Bốn phương án: một đúng, ba nhiễu lấy từ nghĩa của các thẻ khác. */
  const options = useMemo(() => {
    if (mode !== "choice") return [];
    const pool = distractors.filter((d) => d !== card.back);
    const picked = seededShuffle(pool, card.id).slice(0, 3);
    return seededShuffle([...picked, card.back], `${card.id}:opts`);
  }, [mode, distractors, card.back, card.id]);

  const settle = (correct: boolean) => {
    setChecked(correct);
    // Giữ kết quả trên màn một nhịp để người học kịp nhìn đáp án đúng.
    setTimeout(() => onAnswer(correct), correct ? 700 : 1600);
  };

  const submitTyped = () => {
    if (checked !== null || !typed.trim()) return;
    settle(answerMatches(typed, answer));
  };

  // ── Luyện viết: nét vẽ trên canvas ────────────────────────────────────────
  const draw = (e: React.PointerEvent<HTMLCanvasElement>, start: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (start) {
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }
    if (!drawing.current) return;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const prompt = (
    <div className="text-center space-y-2">
      <p className="c-stat-label">
        {mode === "fill" && t("Type the word", "Gõ lại từ")}
        {mode === "choice" && t("Pick the meaning", "Chọn nghĩa đúng")}
        {mode === "listen" && t("Listen and type", "Nghe rồi gõ lại")}
        {mode === "tone" && t("Which tone?", "Thanh điệu nào?")}
        {mode === "write" && t("Write it out", "Viết lại chữ")}
      </p>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {prompt}

      {/* ── Đề bài ──────────────────────────────────────────────────────── */}
      <div className="c-card c-elev-md p-8 flex flex-col items-center gap-4 min-h-[180px] justify-center text-center">
        {mode === "listen" ? (
          <button
            onClick={() => lang && speak(answer, lang.code)}
            className="c-btn c-btn-primary c-btn-lg"
            aria-label={t("Play again", "Nghe lại")}
          >
            <Volume2 size={22} />
            {t("Play again", "Nghe lại")}
          </button>
        ) : mode === "tone" || mode === "write" ? (
          <>
            <p className="c-display leading-none">{answer}</p>
            {mode === "tone" && card.phonetic && (
              // Ở câu luyện thanh phải giấu số thanh trong phiên âm, nếu không
              // "seoi2" đã lộ mất đáp án.
              <p className="c-stat-label">{card.phonetic.replace(/\d/g, "·")}</p>
            )}
          </>
        ) : (
          <>
            <p className="c-h2">{mode === "fill" ? card.back : answer}</p>
            {mode === "choice" && card.phonetic && (
              <p className="c-stat-label">{card.phonetic}</p>
            )}
          </>
        )}

        {lang && mode !== "listen" && mode !== "fill" && (
          <div className="flex gap-2">
            <button
              onClick={() => speak(answer, lang.code)}
              className="c-btn c-btn-secondary c-btn-sm"
              title={t("Listen", "Nghe")}
            >
              <Volume2 size={14} />
            </button>
            <button
              onClick={() => speak(answer, lang.code, 0.5)}
              className="c-btn c-btn-secondary c-btn-sm"
              title={t("Play at half speed", "Phát chậm 0,5×")}
            >
              <Gauge size={14} />
              0,5×
            </button>
          </div>
        )}
      </div>

      {/* ── Chỗ trả lời ─────────────────────────────────────────────────── */}
      {(mode === "fill" || mode === "listen") && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="c-input flex-1 text-center text-lg"
            value={typed}
            onChange={(e) =>
              setTyped(lowercaseAnswers ? e.target.value.toLowerCase() : e.target.value)
            }
            onKeyDown={(e) => e.key === "Enter" && submitTyped()}
            disabled={checked !== null || busy}
            placeholder={t("your answer", "đáp án của bạn")}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={submitTyped}
            disabled={!typed.trim() || checked !== null || busy}
            className="c-btn c-btn-primary"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : t("Check", "Kiểm tra")}
          </button>
        </div>
      )}

      {mode === "choice" && (
        <div className="grid grid-cols-1 gap-2">
          {options.map((opt, i) => {
            const isRight = opt === card.back;
            const show = checked !== null;
            return (
              <button
                key={i}
                onClick={() => {
                  if (checked !== null || busy) return;
                  setPicked(i);
                  settle(isRight);
                }}
                disabled={checked !== null || busy}
                className={`c-btn justify-start text-left ${
                  show && isRight
                    ? "c-btn-success"
                    : show && picked === i
                      ? "c-btn-danger"
                      : "c-btn-secondary"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {mode === "tone" && lang && (
        <div className="flex flex-wrap justify-center gap-2">
          {toneLabels(lang.code).map((label, i) => {
            const value = String(i + 1);
            // Từ nhiều âm tiết ("2-1") thì lấy thanh của âm đầu.
            const right = (card.tone ?? "").split("-")[0].trim() === value;
            const show = checked !== null;
            return (
              <button
                key={label}
                onClick={() => {
                  if (checked !== null || busy) return;
                  setPicked(i);
                  settle(right);
                }}
                disabled={checked !== null || busy}
                className={`c-btn c-btn-lg min-w-[72px] justify-center ${
                  show && right
                    ? "c-btn-success"
                    : show && picked === i
                      ? "c-btn-danger"
                      : "c-btn-secondary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {mode === "write" && (
        <div className="flex flex-col items-center gap-3">
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            onPointerDown={(e) => draw(e, true)}
            onPointerMove={(e) => draw(e, false)}
            onPointerUp={() => { drawing.current = false; }}
            onPointerLeave={() => { drawing.current = false; }}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] touch-none w-full max-w-[320px] aspect-square"
          />
          {/* Không có chấm nét bút tự động — người học tự đối chiếu với chữ mẫu
              rồi tự đánh giá. Chấm nét thật cần thư viện thứ tự nét riêng. */}
          <div className="flex gap-2">
            <button onClick={clearCanvas} className="c-btn c-btn-secondary c-btn-sm">
              <Eraser size={14} />
              {t("Clear", "Xoá")}
            </button>
            <button
              onClick={() => settle(false)}
              disabled={checked !== null || busy}
              className="c-btn c-btn-danger c-btn-sm"
            >
              <X size={14} />
              {t("Missed it", "Chưa viết được")}
            </button>
            <button
              onClick={() => settle(true)}
              disabled={checked !== null || busy}
              className="c-btn c-btn-success c-btn-sm"
            >
              <Check size={14} />
              {t("Got it right", "Viết đúng")}
            </button>
          </div>
        </div>
      )}

      {/* ── Kết quả ─────────────────────────────────────────────────────── */}
      {checked !== null && (
        <div className={`c-alert ${checked ? "c-alert-success" : "c-alert-error"}`}>
          {checked ? <Check size={18} className="icon" /> : <X size={18} className="icon" />}
          <div className="flex-1">
            <strong>{checked ? t("Correct", "Đúng rồi") : t("Not quite", "Chưa đúng")}</strong>
            {!checked && (
              <p className="mt-0.5">
                {t("Answer", "Đáp án")}: <strong>{answer}</strong>
                {card.phonetic && ` · ${card.phonetic}`}
              </p>
            )}
            {card.example && (
              <p className="mt-1 text-sm opacity-80">
                {card.example}
                {card.exampleTranslation && ` — ${card.exampleTranslation}`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
