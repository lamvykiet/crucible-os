"use client";

import type { ReactNode } from "react";

/**
 * Mặt đồng hồ bấm giờ trong widget kính trên phông cảnh (skill
 * `suong-som-design` 7.6, demo pins-17-11.html, P12 17/11/2026).
 *
 * Vòng ngoài r82 nét 8px (`--action` là phần đã chạy), lõi r62 nền tối
 * `--dial-core`, 8 vạch chia, giờ 30px chữ `--dial-ink`, dòng phụ "/ 25 PHÚT".
 * Nút tròn 56px do trang truyền vào qua `controls` (`.c-dial-btn`).
 *
 * Chỉ VẼ. Đếm giờ, ghi phiên… vẫn nằm nguyên ở component của trang
 * (`FocusTimer`, `Pomodoro`). Đặt trong `<SceneSummary>` (children) để nằm
 * trên phông cảnh, không trên tấm nền kem.
 */
const TICKS = "M100 46v6M154 100h-6M100 154v-6M46 100h6M138 62l-4 4M138 138l-4-4M62 138l4-4M62 62l4 4";

export default function FocusDial({
  title,
  subtitle,
  status,
  fraction,
  time,
  caption,
  ariaLabel,
  controls,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Dòng báo kết quả ("Đã ghi 25 phút.") — đọc qua `role="status"`. */
  status?: string | null;
  /** 0–1, phần đã chạy. */
  fraction: number;
  /** "32:08" */
  time: string;
  /** "/ 50 PHÚT" — CSS viết hoa. */
  caption: string;
  ariaLabel: string;
  controls: ReactNode;
}) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <section className="c-glass c-dial-w" aria-label={title}>
      <div className="c-dial-head">
        <div className="min-w-0">
          <p className="c-w-t">{title}</p>
          {subtitle && <p className="c-w-s">{subtitle}</p>}
        </div>
      </div>
      <div className="c-dial-body">
        <svg viewBox="0 0 200 200" className="c-dial" role="timer" aria-label={ariaLabel}>
          <circle cx="100" cy="100" r="82" fill="none" strokeWidth="8" className="c-dial-track" />
          {f > 0 && (
            <circle
              cx="100" cy="100" r="82" fill="none" strokeWidth="8" strokeLinecap="round"
              pathLength={100} strokeDasharray={`${f * 100} 100`}
              transform="rotate(-90 100 100)" className="c-dial-fill"
            />
          )}
          <circle cx="100" cy="100" r="62" className="c-dial-core" />
          <path d={TICKS} fill="none" strokeWidth="2" strokeLinecap="round" className="c-dial-ticks" />
          <text x="100" y="106" textAnchor="middle" className="c-dial-time">{time}</text>
          <text x="100" y="128" textAnchor="middle" className="c-dial-cap">{caption}</text>
        </svg>
        <div className="c-dial-ctrl">{controls}</div>
      </div>
      {status && (
        <p className="c-w-s text-center" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
