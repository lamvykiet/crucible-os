"use client";

import type { LucideIcon } from "lucide-react";

/**
 * Vòng cung rời (docs/bieu-do.md mục 8): 100% vòng = `total`; mỗi cung = phần của
 * một nhóm, đầu bo tròn, có khe; phần chưa dùng chỉ còn rãnh `--bar2`. Bong bóng
 * icon ở đầu mỗi cung, số lớn ở giữa. Màu cung theo `--rg-1..6`.
 *
 * Tổng các cung vượt `total` thì vòng co về tổng các cung (không cuộn vòng hai
 * lần); số ở giữa do nơi gọi truyền nên vẫn nói đúng con số thật.
 */
export interface RingGroup {
  key: string;
  name: string;
  value: number;
  color: number;
  icon: LucideIcon;
}

const R = 90, W = 18, CX = 120;
const CAP = ((W / 2) / R) * (180 / Math.PI);
const GAP = 3.2;
const pt = (a: number, r: number): [number, number] => {
  const t = ((a - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(t), CX + r * Math.sin(t)];
};

export default function SegRing({
  groups,
  total,
  centerNum,
  centerUnit,
  caption,
  pace,
  ariaLabel,
  small,
}: {
  groups: RingGroup[];
  total: number;
  centerNum: string;
  centerUnit?: string;
  caption: string;
  /** 0–1: vạch mực "hôm nay đang ở đâu trong kỳ". */
  pace?: number | null;
  ariaLabel: string;
  small?: boolean;
}) {
  const sum = groups.reduce((s, g) => s + g.value, 0);
  const whole = Math.max(total, sum) || 1;
  let a0 = 0;
  const arcs: React.ReactNode[] = [];
  const beads: React.ReactNode[] = [];

  groups.forEach((g) => {
    const len = (g.value / whole) * 360;
    const s0 = a0 + CAP + GAP / 2;
    const s1 = Math.max(a0 + len - CAP - GAP / 2, s0 + 0.1);
    a0 += len;
    if (len >= 359) {
      arcs.push(<circle key={g.key} cx={CX} cy={CX} r={R} fill="none" stroke={`var(--rg-${g.color})`} strokeWidth={W} />);
    } else {
      const [x0, y0] = pt(s0, R);
      const [x1, y1] = pt(s1, R);
      arcs.push(
        <path
          key={g.key}
          d={`M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${s1 - s0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`}
          fill="none"
          stroke={`var(--rg-${g.color})`}
          strokeWidth={W}
          strokeLinecap="round"
        />
      );
    }
    const [bx, by] = pt(len >= 359 ? 0 : s0, R);
    const Icon = g.icon;
    beads.push(
      <g key={`b-${g.key}`}>
        <circle cx={bx} cy={by} r={W / 2 + 1.5} fill={`var(--rg-${g.color})`} />
        <g transform={`translate(${(bx - 7).toFixed(2)} ${(by - 7).toFixed(2)})`} color="var(--rg-ink)">
          <Icon width={14} height={14} strokeWidth={1.9} />
        </g>
      </g>
    );
  });

  let tick: React.ReactNode = null;
  if (pace != null && pace >= 0 && pace <= 1) {
    const [x0, y0] = pt(pace * 360, R - W / 2 - 5);
    const [x1, y1] = pt(pace * 360, R + W / 2 + 5);
    tick = <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />;
  }

  return (
    <div className={`c-ringbox ${small ? "sm" : ""}`} role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 240 240" aria-hidden>
        <circle className="trk" cx={CX} cy={CX} r={R} fill="none" strokeWidth={W} />
        {arcs}
        {beads}
        {tick}
      </svg>
      <div className="c-ring-ctr" aria-hidden>
        <div className="c-ring-n">
          {centerNum}
          {centerUnit && <small>{centerUnit}</small>}
        </div>
        <div className="c-ring-c">{caption}</div>
      </div>
    </div>
  );
}
