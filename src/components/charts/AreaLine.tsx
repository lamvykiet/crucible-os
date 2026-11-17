"use client";

import type { ReactNode } from "react";

/**
 * Đường một chuỗi theo tháng của hệ Kính (demo `.area`): đường mực mảnh, vùng
 * đổ nhạt phía dưới, điểm CUỐI là chấm màu nhấn có vạch đứt xuống trục và nhãn
 * số ở đầu mút; một mốc ngang nét đứt (ví dụ 0, hoặc cùng kỳ năm ngoái). Không
 * lưới dày, không legend — nhãn ghi thẳng trên đường.
 *
 * Chỉ VẼ; nơi gọi tính số và nhãn. SVG co giãn `preserveAspectRatio="none"` với
 * nét `non-scaling-stroke`, còn chấm/nhãn là phần tử HTML đặt theo %.
 */
export interface AreaPoint {
  x: string;
  v: number;
}

export default function AreaLine({
  points,
  baseline,
  yTicks,
  endLabel,
  endSub,
  ariaLabel,
}: {
  points: AreaPoint[];
  baseline?: { value: number; label: string };
  yTicks?: { value: number; label: string }[];
  endLabel: ReactNode;
  endSub?: ReactNode;
  ariaLabel: string;
}) {
  const W = 1000, H = 240, pad = 12;
  const vals = points.map((p) => p.v);
  let lo = Math.min(...vals, baseline?.value ?? Infinity);
  let hi = Math.max(...vals, baseline?.value ?? -Infinity);
  if (!isFinite(lo) || !isFinite(hi)) return null;
  if (hi === lo) { hi += 1; lo -= 1; }
  const span = hi - lo;
  lo -= span * 0.12;
  hi += span * 0.12;
  const n = points.length;
  const X = (i: number) => pad + (n === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const Y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const pts = points.map((p, i) => [X(i), Y(p.v)] as const);

  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  const last = pts[pts.length - 1];
  const L = (last[0] / W) * 100;
  const T = (last[1] / H) * 100;

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="c-area">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="c-area-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ink)" stopOpacity=".06" />
              <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks?.map((t) => (
            <line key={t.value} x1="0" x2={W} y1={Y(t.value)} y2={Y(t.value)} stroke="var(--grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${d} L${last[0]},${H} L${pts[0][0]},${H}Z`} fill="url(#c-area-g)" />
          {baseline && (
            <line x1="0" x2={W} y1={Y(baseline.value)} y2={Y(baseline.value)} stroke="var(--dash)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
          <path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
        </svg>
        {yTicks?.map((t) => (
          <span key={t.value} className="yl" style={{ bottom: `${((t.value - lo) / (hi - lo)) * 100}%` }}>{t.label}</span>
        ))}
        {baseline && (
          <span className="yl" style={{ right: 0, left: "auto", top: `${(Y(baseline.value) / H) * 100}%`, paddingBottom: 0, transform: "translateY(4px)" }}>
            {baseline.label}
          </span>
        )}
        <div className="vline" style={{ left: `${L}%`, top: `${T}%` }} />
        <div className="pt" style={{ left: `${L}%`, top: `${T}%` }} />
        <div className="tip" style={{ left: `${L}%`, top: `${T}%` }}>
          {endLabel}
          {endSub && <small>{endSub}</small>}
        </div>
      </div>
      <div className="c-mx" aria-hidden>
        {points.map((p, i) => (
          <span key={`${p.x}-${i}`} className={i === n - 1 ? "on" : ""}>{p.x}</span>
        ))}
      </div>
    </div>
  );
}
