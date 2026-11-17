"use client";

import { displayTokens } from "@/lib/sentences/types";
import type { SentenceMode, SentencePiece } from "@/lib/sentences";

export interface PracticeSentence {
  en: string;
  vi: string;
  chunks: SentencePiece[];
  keys: SentencePiece[];
  ref: { setId: string; index: number };
  cleared: boolean;
  attempts: number;
}

export interface OpenedSet {
  id: string;
  title: string;
  level: string;
  source: "builtin" | "ai" | "mine";
  sentences: PracticeSentence[];
}

/** Kết quả một câu trong lượt — để màn tổng kết và nút "làm lại câu sai". */
export interface SentenceOutcome {
  sentence: PracticeSentence;
  /** Tự làm trọn, không gợi ý, không xem đáp án. */
  clean: boolean;
  /** Qua câu (có thể đã xin gợi ý từng chữ). */
  perfect: boolean;
  hints: number;
}

/**
 * Ghi kết quả một câu xuống máy chủ. Không chặn người học: lỗi mạng thì chỉ
 * báo ở console, bài vẫn đi tiếp — mất một dòng tiến độ còn hơn kẹt giữa bài.
 */
export async function postResult(args: {
  languageId: string;
  mode: SentenceMode;
  sentence: PracticeSentence;
  perfect: boolean;
  hints: number;
  typed: string;
  /** Thứ đã hiện cho người học, để ghi vào sổ lỗi sai. */
  prompt?: string;
  answer?: string;
  sessionEnd: boolean;
}) {
  try {
    await fetch("/api/learning/sentences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        languageId: args.languageId,
        mode: args.mode,
        setId: args.sentence.ref.setId,
        index: args.sentence.ref.index,
        perfect: args.perfect,
        hints: args.hints,
        typed: args.typed,
        prompt: args.prompt ?? args.sentence.vi,
        answer: args.answer ?? args.sentence.en,
        sessionEnd: args.sessionEnd,
      }),
    });
  } catch (err) {
    console.error("Không ghi được kết quả câu:", err);
  }
}

/**
 * Dải ô che chữ của đáp án — mỗi chữ một ô, rộng theo độ dài chữ.
 *
 * Kiểu luyentu.com: gõ đúng tới đâu, ô lật ra tới đó. `revealAll` dùng khi đã
 * xong câu hoặc bấm xem đáp án. `marks` (sau khi nộp sai) tô đỏ ô sai.
 */
export function WordSlots({
  text,
  revealed,
  revealAll = false,
  marks,
  dense = false,
}: {
  text: string;
  revealed: number;
  revealAll?: boolean;
  marks?: boolean[];
  dense?: boolean;
}) {
  const words = displayTokens(text);
  return (
    <div className={`flex flex-wrap ${dense ? "gap-1" : "gap-1.5"}`} aria-label="answer slots">
      {words.map((w, i) => {
        const open = revealAll || i < revealed;
        const wrong = marks && marks[i] === false;
        return (
          <span
            key={`${i}-${w}`}
            className={`inline-flex items-center justify-center rounded-full border px-3 h-9 text-[15px] font-medium transition-colors ${
              wrong
                ? "border-[var(--color-error)] text-[var(--color-error)] bg-[var(--color-error-tint)]"
                : open
                  ? "border-[var(--color-success)] text-[var(--color-text)] bg-[var(--color-success-tint)]"
                  : "border-[var(--color-border)] text-[var(--color-text-faint)] bg-[var(--color-surface-2)]"
            }`}
            style={{ minWidth: `${Math.max(2.2, w.length * 0.62 + 1.4)}em` }}
          >
            {open || wrong ? w : "•".repeat(Math.min(w.replace(/[^\p{L}\p{N}']/gu, "").length || 1, 12))}
          </span>
        );
      })}
    </div>
  );
}

/** Phím tắt hiển thị: ⌃ Space. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="c-kbd">{children}</span>;
}
