"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Brain, RotateCcw, Check, X, ThumbsUp, Loader2, AlertCircle, Trash2, PartyPopper } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Card {
  id: string;
  front: string;
  back: string;
  state: number;
  reps: number;
  domain: string | null;
  intervals: Record<string, string>;
}

/**
 * Ôn tập thẻ ghi nhớ theo lịch FSRS.
 *
 * Bản cũ có ba thẻ viết cứng ngay trong file (Glassmorphism, FSRS, Supabase),
 * và cả bốn nút "Quên / Khó / Tốt / Dễ" đều gọi đúng một hàm chuyển thẻ — chấm
 * điểm không hề ảnh hưởng tới bất cứ thứ gì. Các nhãn "(1m) (10m) (1d) (4d)"
 * cũng viết cứng, không liên quan tới thẻ đang xem.
 */
export default function FlashcardPage() {
  const { t } = useLanguage();

  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, newCount: 0, dueCount: 0 });
  const [reviewed, setReviewed] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/learning/flashcards", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được thẻ");
        setCards(json.cards);
        setStats({ total: json.total, newCount: json.newCount, dueCount: json.dueCount });
        setIndex(0);
        setFlipped(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const current = cards[index] ?? null;

  const grade = useCallback(
    async (value: 1 | 2 | 3 | 4) => {
      if (!current || grading) return;
      setGrading(true);
      setError(null);
      try {
        const res = await fetch("/api/learning/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: current.id, grade: value }),
        });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.error || "Không lưu được kết quả");

        setReviewed((n) => n + 1);
        setFlipped(false);
        // Thẻ chấm "Quên" hoặc "Khó" quay lại cuối hàng để ôn tiếp trong phiên;
        // đúng tinh thần các bước học ngắn của FSRS.
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
    [current, grading, index]
  );

  const removeCard = async () => {
    if (!current) return;
    if (!window.confirm(t("Delete this card permanently?", "Xoá vĩnh viễn thẻ này?"))) return;
    await fetch(`/api/learning/flashcards?id=${current.id}`, { method: "DELETE" }).catch(() => {});
    setCards((prev) => prev.filter((_, i) => i !== index));
    setIndex(0);
    setFlipped(false);
  };

  // Bàn phím: cách ôn nhanh nhất là không phải rời tay khỏi phím.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        grade(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, flipped, grade]);

  const buttons = [
    { g: 1 as const, label: t("Forgot", "Quên"), icon: X, color: "error" },
    { g: 2 as const, label: t("Hard", "Khó"), icon: RotateCcw, color: "warning" },
    { g: 3 as const, label: t("Good", "Tốt"), icon: Check, color: "success" },
    { g: 4 as const, label: t("Easy", "Dễ"), icon: ThumbsUp, color: "info" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] gap-3 text-[var(--color-text-muted)]">
        <Loader2 size={22} className="animate-spin" />
        <span className="font-bold text-sm">{t("Loading cards...", "Đang tải thẻ...")}</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center mb-2">
        <h1
          className="c-h2 flex items-center justify-center gap-3 mb-2"
        >
          <Brain className="text-[var(--color-success)]" size={32} />
          {t("Review Today", "Ôn Tập Hôm Nay")}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {cards.length > 0
            ? t(`${cards.length} left · ${reviewed} done`, `Còn ${cards.length} thẻ · đã ôn ${reviewed}`)
            : t(`${stats.total} cards in total`, `Tổng cộng ${stats.total} thẻ`)}
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error w-full">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {!current ? (
        <div className="flex flex-col items-center gap-4 text-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
            {stats.total === 0 ? <Brain size={32} /> : <PartyPopper size={32} />}
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--color-text)]">
              {stats.total === 0
                ? t("No cards yet", "Chưa có thẻ nào")
                : t("Nothing due right now", "Chưa tới hạn ôn thẻ nào")}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-md">
              {stats.total === 0
                ? t(
                    "Open a document in the Knowledge Hub and use Studio → Flashcards to create some.",
                    "Mở một tài liệu ở Knowledge Hub rồi dùng Studio → Thẻ ghi nhớ để tạo."
                  )
                : t(
                    "Come back later, or add more cards from a document.",
                    "Quay lại sau, hoặc tạo thêm thẻ từ một tài liệu."
                  )}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/knowledge" className="c-btn c-btn-primary c-btn-sm">
              {t("Go to Knowledge Hub", "Tới Knowledge Hub")}
            </Link>
            {stats.total > 0 && (
              <button onClick={() => setReloadKey((k) => k + 1)} className="c-btn c-btn-secondary c-btn-sm">
                {t("Refresh", "Tải lại")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="w-full h-80 perspective-1000 cursor-pointer" onClick={() => setFlipped((f) => !f)}>
            <div
              className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                flipped ? "rotate-y-180" : ""
              }`}
            >
              <div className="absolute inset-0 backface-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[32px] shadow-lg flex items-center justify-center p-8 text-center">
                <h2
                  className="c-h2 text-[var(--color-primary)]"
                >
                  {current.front}
                </h2>
                <div className="absolute bottom-6 text-xs uppercase tracking-widest opacity-40 font-semibold">
                  {t("Click or press Space", "Bấm hoặc nhấn Space")}
                </div>
                {current.state === 0 && (
                  <span className="absolute top-5 left-5 c-chip text-[10px] py-1">{t("New", "Thẻ mới")}</span>
                )}
              </div>

              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[32px] shadow-xl flex items-center justify-center p-10 text-center overflow-y-auto">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{current.back}</p>
              </div>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 mt-6 transition-opacity duration-300 ${
              flipped ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {buttons.map(({ g, label, icon: Icon, color }) => (
              <button
                key={g}
                onClick={(e) => {
                  e.stopPropagation();
                  grade(g);
                }}
                disabled={grading}
                className={`flex flex-col items-center gap-2 text-[var(--color-${color})] hover:opacity-80 transition-opacity disabled:opacity-40`}
              >
                <div
                  className={`w-14 h-14 rounded-full bg-[var(--color-${color}-tint)] flex items-center justify-center`}
                >
                  {grading ? <Loader2 size={22} className="animate-spin" /> : <Icon size={24} />}
                </div>
                <span className="text-xs font-semibold">{label}</span>
                {/* Khoảng cách thật do FSRS tính cho CHÍNH thẻ này. */}
                <span className="text-[10px] text-[var(--color-text-faint)]">{current.intervals[g]}</span>
              </button>
            ))}
          </div>

          <button
            onClick={removeCard}
            className="mt-4 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-error)] flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={13} /> {t("Delete this card", "Xoá thẻ này")}
          </button>
        </>
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
