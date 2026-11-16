"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Đồng hồ điểm có câu trạng thái (skill `suong-som-design` 7.4, demo
 * `1991-new-design/demo/suong-som/pins-17-11.html`, P11 17/11/2026).
 *
 * Nửa vòng trên tấm nền kem: rãnh `--viz-ghost`, phần đạt `--viz-accent`
 * (xám-mực là mặc định của dữ liệu, docs/bieu-do.md); có ngưỡng thì một vạch
 * 3px `--bad`. Dưới vòng: số lớn Playfair → câu trạng thái 2–4 chữ → một dòng
 * gợi ý có số. Câu trạng thái do TRANG tính từ dữ liệu, ngưỡng ghi ngay cạnh
 * hàm tính — component này chỉ vẽ.
 *
 * `insufficient`: rãnh nét đứt, số là "?", câu "Chưa đủ dữ liệu", `hint` nói
 * cần thêm gì, `action` là bước tiếp theo. Đừng vẽ số 0 khi chưa có dữ liệu.
 */

const R = 82;
const CX = 100;
const CY = 100;
/** Cung nửa trên từ trái (18,100) sang phải (182,100). */
const ARC = `M${CX - R} ${CY}a${R} ${R} 0 0 1 ${2 * R} 0`;

export interface ScoreGaugeDelta {
  /** Đã kèm ▲/▼ hoặc +/− (dấu âm là "−"). */
  text: string;
  tone: "good" | "bad" | "flat";
  /** Giải thích cho trình đọc màn hình ("so với nhịp ngày"). */
  title?: string;
}

export interface ScoreGaugeAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export default function ScoreGauge({
  value,
  max = 100,
  display,
  label,
  state,
  hint,
  delta,
  threshold,
  insufficient = false,
  action,
  ariaLabel,
  className = "",
}: {
  value: number;
  max?: number;
  /** Chữ của số giữa vòng ("82%"). Mặc định là `value`. */
  display?: string;
  /** Overline — hiện VIẾT HOA bằng CSS. */
  label: ReactNode;
  /** Câu trạng thái 2–4 chữ, tính từ dữ liệu. */
  state: string;
  /** Một dòng có số ("Còn 10,3 tr ₫ cho 14 ngày"). */
  hint?: ReactNode;
  delta?: ScoreGaugeDelta | null;
  /** Vị trí vạch ngưỡng, cùng thang với `value`. */
  threshold?: number | null;
  insufficient?: boolean;
  action?: ScoreGaugeAction | null;
  /** Câu đầy đủ cho `role="img"`. Mặc định ghép từ `label` + số + `state`. */
  ariaLabel?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const shown = insufficient ? "?" : (display ?? String(value));
  const stateText = insufficient ? t("Not enough data", "Chưa đủ dữ liệu") : state;
  const aria =
    ariaLabel ??
    (insufficient ? stateText : `${typeof label === "string" ? `${label}: ` : ""}${shown} — ${stateText}`);

  // Vạch ngưỡng: đoạn 10px vuông góc với cung, đặt ở góc tương ứng.
  let tick: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (!insufficient && threshold != null && max > 0) {
    const f = Math.max(0, Math.min(1, threshold / max));
    const a = Math.PI * (1 - f);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    tick = {
      x1: CX + (R - 12) * cos,
      y1: CY - (R - 12) * sin,
      x2: CX + (R + 12) * cos,
      y2: CY - (R + 12) * sin,
    };
  }

  return (
    <div className={`c-gauge ${insufficient ? "is-empty" : ""} ${className}`}>
      <div className="c-gauge-top">
        <span className="c-overline c-gauge-label">{label}</span>
        {delta && !insufficient && (
          <span className={`c-delta ${delta.tone}`} title={delta.title}>
            {delta.text}
            {delta.title && <span className="sr-only"> {delta.title}</span>}
          </span>
        )}
      </div>
      <div className="c-gauge-dial">
      <svg viewBox="0 0 200 110" className="c-gauge-svg" role="img" aria-label={aria}>
        <path
          d={ARC}
          fill="none"
          strokeWidth={16}
          strokeLinecap="round"
          className={insufficient ? "c-gauge-track dashed" : "c-gauge-track"}
          strokeDasharray={insufficient ? "2 10" : undefined}
        />
        {!insufficient && frac > 0 && (
          <path
            d={ARC}
            fill="none"
            strokeWidth={16}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${frac * 100} 100`}
            className="c-gauge-fill"
          />
        )}
        {tick && (
          <line {...tick} strokeWidth={3} strokeLinecap="round" className="c-gauge-tick" />
        )}
      </svg>
      <div className="c-gauge-value" aria-hidden>
        {shown}
      </div>
      </div>
      <div className="c-gauge-state">{stateText}</div>
      {(hint || action) && (
        <p className="c-gauge-hint">
          {hint}
          {action && (
            <>
              {hint ? " · " : ""}
              {action.href ? (
                <Link href={action.href}>{action.label}</Link>
              ) : (
                <button type="button" onClick={action.onClick}>
                  {action.label}
                </button>
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
}
