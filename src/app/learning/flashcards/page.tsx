"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Brain, RotateCcw, Check, X, ThumbsUp, Loader2, AlertCircle, Trash2, PartyPopper,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { DomainStat } from "@/lib/learningStats";

interface Card {
  id: string;
  front: string;
  back: string;
  state: number;
  reps: number;
  domain: string | null;
  intervals: Record<string, string>;
}

type Mode = "detail" | "quick";

/**
 * Ôn tập thẻ ghi nhớ theo lịch FSRS.
 *
 * Bản cũ có ba thẻ viết cứng ngay trong file (Glassmorphism, FSRS, Supabase),
 * và cả bốn nút "Quên / Khó / Tốt / Dễ" đều gọi đúng một hàm chuyển thẻ — chấm
 * điểm không hề ảnh hưởng tới bất cứ thứ gì. Các nhãn "(1m) (10m) (1d) (4d)"
 * cũng viết cứng, không liên quan tới thẻ đang xem.
 *
 * Bản này thêm hai thứ mà một hub đa lĩnh vực cần:
 *  - Lọc theo lĩnh vực (`?domain=`), để ngồi xuống ôn đúng một mảng thay vì bị
 *    trộn thuật ngữ tài chính với từ vựng tiếng Anh trong cùng một chồng thẻ.
 *  - Chế độ "Nhanh": chỉ Quên / Nhớ. Bốn mức của FSRS là chính xác nhưng bắt
 *    phải cân nhắc mỗi thẻ; lúc chỉ có năm phút thì hai lựa chọn xong nhanh hơn.
 */
function FlashcardSession() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const domain = searchParams.get("domain")?.trim() || null;

  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, newCount: 0, dueCount: 0 });
  const [reviewed, setReviewed] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<Mode>("detail");
  const [domains, setDomains] = useState<DomainStat[]>([]);

  // "Đang tải" là suy ra chứ không phải một biến trạng thái riêng: mẻ thẻ trên
  // màn hình hoặc thuộc đúng bộ lọc hiện tại, hoặc là của bộ lọc cũ và phải bị
  // coi là chưa có. Đặt cờ trong thân effect thì đổi lĩnh vực sẽ loé thẻ cũ một
  // nhịp trước khi cờ kịp bật.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = `${reloadKey}:${domain ?? ""}`;
  const loading = loadedFor !== requestKey;

  // Danh sách lĩnh vực để chuyển qua lại. Lấy một lần, không phụ thuộc bộ lọc —
  // nếu lấy theo bộ lọc thì chọn xong sẽ không còn lĩnh vực nào để bấm sang.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/overview", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setDomains(
          (json.domains as DomainStat[]).filter((d) => d.domain.trim() && d.cardCount > 0)
        );
      })
      .catch(() => {
        // Không có danh sách lĩnh vực thì vẫn ôn được, chỉ là không chuyển nhanh.
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    const query = domain ? `?domain=${encodeURIComponent(domain)}` : "";

    fetch(`/api/learning/flashcards${query}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được thẻ");
        setCards(json.cards);
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
  }, [requestKey, domain]);

  const current = cards[index] ?? null;

  /** Đổi lĩnh vực qua URL để tải lại trang hoặc chia sẻ link vẫn giữ nguyên bộ lọc. */
  const pickDomain = (next: string | null) => {
    router.replace(next ? `/learning/flashcards?domain=${encodeURIComponent(next)}` : "/learning/flashcards");
  };

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
      {/* Thanh điều khiển phiên ôn */}
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
            <button
              className={`c-seg-opt ${mode === "detail" ? "active" : ""}`}
              onClick={() => setMode("detail")}
            >
              {t("Detailed", "Chi tiết")}
            </button>
            <button
              className={`c-seg-opt ${mode === "quick" ? "active" : ""}`}
              onClick={() => setMode("quick")}
            >
              {t("Quick", "Nhanh")}
            </button>
          </div>
        </div>

        {/* Chuyển lĩnh vực. Ẩn khi chỉ có một mảng — lúc đó bộ lọc là thừa. */}
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
                    "Open a document in the Knowledge Hub and use Studio → Flashcards to create some.",
                    "Mở một tài liệu ở Knowledge Hub rồi dùng Studio → Thẻ ghi nhớ để tạo."
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
            {domain && (
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
              <div className="absolute inset-0 backface-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[32px] shadow-lg flex items-center justify-center p-8 text-center">
                <h2 className="c-h2 text-[var(--color-text)]">{current.front}</h2>
                <div className="absolute bottom-6 text-xs uppercase tracking-widest opacity-40 font-semibold">
                  {t("Click or press Space", "Bấm hoặc nhấn Space")}
                </div>
                {current.state === 0 && (
                  <span className="absolute top-5 left-5 c-chip text-[10px] py-1">
                    {t("New", "Thẻ mới")}
                  </span>
                )}
                {current.domain && (
                  <span className="absolute top-5 right-5 c-stat-label">{current.domain}</span>
                )}
              </div>

              <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[32px] shadow-xl flex items-center justify-center p-10 text-center overflow-y-auto">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{current.back}</p>
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
                    <span className="text-[10px] text-[var(--color-text-faint)]">
                      {current.intervals[g]}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              /* Chế độ nhanh vẫn ghi vào FSRS như thường: Quên = mức 1, Nhớ = mức 3.
                 Không có đường tắt nào bỏ qua thuật toán — chỉ là ít lựa chọn hơn. */
              <div className="flex items-center gap-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    grade(1);
                  }}
                  disabled={grading}
                  className="c-btn c-btn-danger c-btn-lg min-w-[160px] justify-center"
                >
                  <X size={20} />
                  {t("Forgot", "Quên")}
                  <span className="text-xs opacity-60">←</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    grade(3);
                  }}
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
