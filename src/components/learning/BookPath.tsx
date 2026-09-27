"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, AlertCircle, Check, BookOpen, Repeat, Feather, Info } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import BookBuilder from "./BookBuilder";

interface Step {
  step: number;
  label: string;
  kind: "grammar" | "vocabulary" | "review";
  title: string;
  section: string | null;
  wordCount: number;
  opened: boolean;
  done: boolean;
}

interface BookInfo {
  id: string;
  title: string;
  level: string;
  note: string;
  provenance: string;
  steps: Step[];
}

/** Cao mỗi nhịp và đường kính nút — hai số này quyết định toàn bộ hình đường. */
const ROW = 104;
const NODE = 66;

const ICONS = { grammar: Feather, vocabulary: BookOpen, review: Repeat };

/**
 * Đường học của một cuốn sách.
 *
 * Mỗi bước là một unit. Cách bày theo đường uốn lượn thay vì danh sách dọc là
 * có lý do: nhìn một cái là biết mình đang ở đâu giữa cả cuốn, còn bao nhiêu
 * bước, và bài ôn rơi vào chỗ nào — thứ mà danh sách cuộn dọc không nói ra.
 *
 * Toạ độ tính bằng PIXEL chứ không phần trăm, và đo bề ngang thật bằng
 * `ResizeObserver`. Dùng phần trăm thì nét đứt của đường nối bị kéo giãn theo
 * bề ngang màn hình, mỗi khổ một kiểu.
 */
export default function BookPath({
  bookId,
  onOpenStep,
}: {
  bookId: string;
  onOpenStep: (step: number) => void;
}) {
  const { t } = useLanguage();

  const [book, setBook] = useState<BookInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  const boxRef = useRef<HTMLDivElement | null>(null);

  /**
   * Đo bề ngang NGAY lúc phần tử gắn vào cây, không chờ `ResizeObserver`.
   *
   * Trình duyệt ngưng `ResizeObserver` và `requestAnimationFrame` khi trang nằm
   * ở tab nền hoặc bị che. Chỉ dựa vào observer thì mở trang ở tab nền là đường
   * học trắng trơn cho tới khi người dùng chuyển sang tab đó — đã gặp đúng cảnh
   * này khi chạy thử. Hàm ref thì chạy ngay ở lúc commit, không phụ thuộc hai
   * thứ kia; observer bên dưới chỉ lo phần đổi cỡ về sau.
   */
  const attachBox = useCallback((node: HTMLDivElement | null) => {
    boxRef.current = node;
    if (node) setWidth(node.getBoundingClientRect().width);
  }, []);
  const loading = loadedFor !== bookId;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/books?bookId=${encodeURIComponent(bookId)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không đọc được sách");
        setBook(json.book);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(bookId);
      });
    return () => controller.abort();
  }, [bookId]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(box);

    return () => ro.disconnect();
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 c-help">
        <Loader2 size={16} className="animate-spin" />
        {t("Loading…", "Đang tải…")}
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="c-alert c-alert-error">
        <AlertCircle size={18} className="icon" />
        <p className="flex-1">{error ?? t("Book not found", "Không tìm thấy sách")}</p>
      </div>
    );
  }

  const steps = book.steps;
  const doneCount = steps.filter((s) => s.done).length;

  // Bước "đang tới": bước chưa xong đầu tiên. Đó là chỗ người học nên bấm tiếp.
  const currentStep = steps.find((s) => !s.done)?.step ?? null;

  // Biên độ lượn: hẹp lại trên màn nhỏ để nút không chạm mép.
  const amp = Math.max(0, Math.min(110, width / 2 - NODE / 2 - 18));
  const cx = width / 2;
  const pos = (i: number) => ({
    x: cx + Math.sin(i * 0.78) * amp,
    y: ROW / 2 + i * ROW,
  });
  const height = steps.length * ROW;

  return (
    <div className="space-y-5">
      <div className="c-card c-elev-md p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="c-h4">{book.title}</p>
            <p className="c-help">{book.note}</p>
          </div>
          <span className="c-chip c-chip-outline flex-none">{book.level}</span>
        </div>
        <div className="c-progress">
          <span style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }} />
        </div>
        <p className="c-stat-label tabular-nums">
          {t(`${doneCount} of ${steps.length} units done`, `Xong ${doneCount}/${steps.length} unit`)}
        </p>
      </div>

      <BookBuilder bookId={bookId} />

      <div ref={attachBox} className="relative" style={{ height }}>
        {/* Đường nối vẽ trước, nằm dưới các nút */}
        {width > 0 && (
          <svg
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            <polyline
              points={steps.map((_, i) => { const p = pos(i); return `${p.x},${p.y}`; }).join(" ")}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={3}
              strokeDasharray="7 9"
              strokeLinecap="round"
            />
          </svg>
        )}

        {width > 0 &&
          steps.map((s, i) => {
            const p = pos(i);
            const Icon = ICONS[s.kind];
            const isCurrent = s.step === currentStep;
            const isReview = s.kind === "review";

            return (
              <div
                key={s.step}
                className="absolute"
                style={{ left: p.x - NODE / 2, top: p.y - NODE / 2, width: NODE }}
              >
                <button
                  onClick={() => onOpenStep(s.step)}
                  aria-label={t(`Unit ${s.label}: ${s.title}`, `Unit ${s.label}: ${s.title}`)}
                  className={`w-full grid place-content-center rounded-full border-2 transition-colors ${
                    s.done
                      ? "bg-[var(--color-success-tint)] border-[var(--color-success)] text-[var(--color-success)]"
                      : isCurrent
                        ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                        : isReview
                          ? "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-faint)]"
                          : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                  style={{ height: NODE }}
                >
                  {s.done ? (
                    <Check size={24} />
                  ) : (
                    <span className="flex flex-col items-center gap-0.5">
                      <Icon size={15} />
                      <span className="text-[13px] font-bold tabular-nums">{s.label}</span>
                    </span>
                  )}
                </button>

                {/* Tên unit đặt dưới nút, bó về một dòng rưỡi cho đường khỏi rối */}
                <p
                  className={`mt-1.5 text-[11px] leading-tight text-center line-clamp-2 ${
                    isCurrent ? "font-bold text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {s.title}
                </p>
              </div>
            );
          })}
      </div>

      <details className="c-card p-4">
        <summary className="c-stat-label cursor-pointer flex items-center gap-2">
          <Info size={13} />
          {t("What comes from the book", "Phần nào lấy từ sách")}
        </summary>
        <p className="c-help mt-3">{book.provenance}</p>
      </details>
    </div>
  );
}
