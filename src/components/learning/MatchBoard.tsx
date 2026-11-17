"use client";

import { useMemo, useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak } from "@/lib/speech";
import { seededShuffle, type StudyCard } from "./ExerciseCard";

export interface MatchResult {
  id: string;
  /** Ghép đúng ngay, không lần nào chọn nhầm dính tới thẻ này. */
  correct: boolean;
}

/**
 * Ghép cặp từ với nghĩa — học từ chế độ "Ghép cặp" của luyentu.com.
 *
 * Một lượt vài thẻ, hai cột: từ bên trái, nghĩa (đã xáo) bên phải. Chọn một ô
 * mỗi bên; đúng thì cặp đó khoá lại, sai thì CẢ HAI thẻ dính nhầm bị tính là
 * chưa thuộc. Xáo theo id thẻ (không theo Math.random) để render lại không
 * làm cột nghĩa nhảy chỗ dưới con trỏ.
 */
export default function MatchBoard({
  cards,
  onDone,
  busy,
}: {
  cards: StudyCard[];
  onDone: (results: MatchResult[]) => void;
  busy: boolean;
}) {
  const { t } = useLanguage();
  const seed = cards.map((c) => c.id).join("|");
  const right = useMemo(() => seededShuffle(cards, seed), [cards, seed]);

  const [pickL, setPickL] = useState<string | null>(null);
  const [pickR, setPickR] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string[]>([]);

  const termOf = (c: StudyCard) => c.term || c.front;

  const tryPair = (l: string | null, r: string | null) => {
    if (!l || !r) return;
    if (l === r) {
      const nextMatched = new Set(matched).add(l);
      setMatched(nextMatched);
      const card = cards.find((c) => c.id === l);
      if (card?.language?.code) speak(termOf(card), card.language.code);
      setPickL(null);
      setPickR(null);
      if (nextMatched.size === cards.length) {
        window.setTimeout(() => onDone(cards.map((c) => ({ id: c.id, correct: !missed.has(c.id) }))), 450);
      }
    } else {
      setMissed((m) => new Set(m).add(l).add(r));
      setFlash([l, r]);
      window.setTimeout(() => setFlash([]), 450);
      setPickL(null);
      setPickR(null);
    }
  };

  const cell = (id: string, side: "L" | "R", label: string) => {
    const done = matched.has(id);
    const picked = side === "L" ? pickL === id : pickR === id;
    const wrong = flash.includes(id) && (side === "L" ? flash[0] === id : flash[1] === id);
    return (
      <button
        key={`${side}-${id}`}
        disabled={done || busy}
        onClick={() => {
          if (side === "L") { setPickL(id); tryPair(id, pickR); }
          else { setPickR(id); tryPair(pickL, id); }
        }}
        className={`w-full min-h-[56px] rounded-2xl border px-4 py-3 text-left text-[15px] transition-colors ${
          done
            ? "border-[var(--color-success)] bg-[var(--color-success-tint)] text-[var(--color-text-muted)]"
            : wrong
              ? "border-[var(--color-error)] bg-[var(--color-error-tint)]"
              : picked
                ? "border-[var(--color-primary)] bg-[var(--glass-pill)] font-medium"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 c-help">
        <Shuffle size={15} />
        {t(
          "Pick a word, then its meaning. A wrong pair counts against both cards.",
          "Chọn một từ rồi chọn nghĩa của nó. Ghép nhầm thì cả hai thẻ dính nhầm bị tính là chưa thuộc."
        )}
        {busy && <Loader2 size={15} className="animate-spin ml-auto" />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">{cards.map((c) => cell(c.id, "L", termOf(c)))}</div>
        <div className="space-y-2">{right.map((c) => cell(c.id, "R", c.back))}</div>
      </div>
      <p className="c-stat-label tabular-nums">
        {t(`${matched.size}/${cards.length} matched`, `đã ghép ${matched.size}/${cards.length}`)}
      </p>
    </div>
  );
}
