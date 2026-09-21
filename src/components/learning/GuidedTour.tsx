"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export interface TourStep {
  /** Giá trị của thuộc tính `data-tour` trên phần tử cần trỏ tới. */
  target: string;
  titleEn: string;
  titleVi: string;
  bodyEn: string;
  bodyVi: string;
}

interface Props {
  steps: TourStep[];
  /** Khoá lưu trong localStorage, để tour đã xem rồi thì thôi không hiện lại. */
  storageKey: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

/** Không có gì để theo dõi: cờ đã-xem chỉ đổi khi chính người dùng đóng tour. */
const noSubscribe = () => () => {};

/**
 * Tour này đã xem chưa.
 *
 * localStorage không tồn tại trên máy chủ, nên đọc nó lúc render sẽ lệch
 * hydration, còn đọc trong `useEffect` thì phải `setState` ngay trong thân
 * effect — thứ mà react-hooks chặn. `useSyncExternalStore` cho phép trả hai ảnh
 * chụp khác nhau cho hai phía: máy chủ luôn coi như "đã xem" nên HTML dựng sẵn
 * không bao giờ chứa lớp phủ.
 */
function useTourSeen(key: string) {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return localStorage.getItem(key) !== null;
      } catch {
        // Chế độ riêng tư chặn localStorage: cứ coi như chưa xem.
        return false;
      }
    },
    () => true
  );
}

/**
 * Tour hướng dẫn lần đầu.
 *
 * Khoét sáng đúng phần tử đang nói tới rồi đặt lời giải thích ngay cạnh, thay
 * vì một hộp thoại giữa màn hình bắt người đọc tự đoán "cái đó nằm đâu".
 *
 * Trạng thái đã-xem lưu ở localStorage chứ không xuống máy chủ: đây là thứ của
 * riêng từng trình duyệt, và nếu localStorage bị chặn thì tour hiện lại — phiền
 * một chút, nhưng không làm hỏng gì.
 */
export default function GuidedTour({ steps, storageKey }: Props) {
  const { t } = useLanguage();

  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [box, setBox] = useState<Box | null>(null);

  const seen = useTourSeen(storageKey);
  const open = !seen && !dismissed;

  const step = steps[index];

  /** Đo phần tử đích. Nó có thể chưa render xong nên phải đo lại khi cuộn/co giãn. */
  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [step]);

  useEffect(() => {
    if (!open) return;

    // Đo sau khi trình duyệt vẽ xong, không đo ngay trong thân effect: lúc đó
    // phần tử đích có thể chưa vào đúng vị trí, và đo được số cũ thì khung sáng
    // sẽ trỏ lệch chỗ.
    const raf = requestAnimationFrame(measure);

    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, measure]);

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      // Không ghi được thì lần sau tour hiện lại — chấp nhận được.
    }
  };

  if (!open || !step) return null;

  const percent = Math.round(((index + 1) / steps.length) * 100);
  const last = index === steps.length - 1;

  // Đặt lời giải thích dưới phần tử, trừ khi dưới không còn chỗ thì lật lên trên.
  const below = box ? box.top + box.height + PAD : 0;
  const roomBelow = typeof window !== "undefined" ? window.innerHeight - below : 0;
  const flip = box !== null && roomBelow < 220;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      {/* Nền mờ, khoét sáng phần tử đích bằng viền phát sáng rất rộng */}
      <div className="absolute inset-0 bg-black/55" onClick={close} />
      {box && (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-200"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,.55)",
            outline: "2px solid var(--color-primary)",
          }}
        />
      )}

      {/* Lời giải thích */}
      <div
        className="absolute c-card c-elev-lg p-5 w-[min(360px,calc(100vw-32px))] space-y-3"
        style={
          box
            ? {
                top: flip ? Math.max(16, box.top - PAD - 200) : below,
                left: Math.min(Math.max(16, box.left), (typeof window !== "undefined" ? window.innerWidth : 400) - 376),
              }
            : { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <p className="c-card-kicker">{t(step.titleEn, step.titleVi)}</p>
          <button
            onClick={close}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
            aria-label={t("Close tour", "Đóng hướng dẫn")}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {t(step.bodyEn, step.bodyVi)}
        </p>

        <div className="flex items-center gap-3 pt-1">
          {/* Vòng tiến độ vẽ bằng conic-gradient, không kéo thêm thư viện */}
          <div
            className="w-10 h-10 rounded-full grid place-content-center flex-none"
            style={{
              background: `conic-gradient(var(--color-primary) ${percent}%, var(--color-surface-2) ${percent}%)`,
            }}
          >
            <span className="w-7 h-7 rounded-full bg-[var(--color-surface)] grid place-content-center text-[10px] font-bold tabular-nums">
              {percent}%
            </span>
          </div>

          <span className="c-stat-label flex-1 tabular-nums">
            {index + 1}/{steps.length}
          </span>

          {!last && (
            <button onClick={close} className="c-btn c-btn-tertiary c-btn-sm">
              {t("Skip", "Bỏ qua")}
            </button>
          )}
          <button
            onClick={() => (last ? close() : setIndex((i) => i + 1))}
            className="c-btn c-btn-primary c-btn-sm"
          >
            {last ? t("Done", "Xong") : t("Next", "Tiếp")}
          </button>
        </div>
      </div>
    </div>
  );
}
