/**
 * Vòng nhỏ 32px = tiến độ MỘT đại lượng (đã chi / ngân sách của nhóm), không phải
 * cơ cấu. Rãnh `--bar`, phần đạt tô theo `tone`, vạch mực = nhịp ngày (bỏ với
 * đại lượng không có nhịp). Trạng thái chữ nằm cạnh vòng (xem `BudgetStatus`),
 * không dựa riêng vào màu.
 */
export type RingTone = "ok" | "warn" | "over" | "good";

const C = 2 * Math.PI * 13;
const SW = 5;
const COLOR: Record<RingTone, string> = {
  ok: "var(--acc)",
  warn: "var(--warn)",
  over: "var(--bad)",
  good: "var(--good)",
};

export default function ProgressRing({
  fraction,
  pace,
  tone,
  ariaLabel,
}: {
  fraction: number;
  pace?: number | null;
  tone: RingTone;
  ariaLabel: string;
}) {
  const full = fraction >= 1;
  const d = full ? C : Math.max(fraction * C - SW, 0.1);
  const off = full ? 0 : -SW / 2;
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={ariaLabel}>
      <circle className="trk" cx={16} cy={16} r={13} fill="none" strokeWidth={SW} />
      {fraction > 0 && (
        <circle
          cx={16} cy={16} r={13} fill="none" stroke={COLOR[tone]} strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={`${d} ${C}`} strokeDashoffset={off} transform="rotate(-90 16 16)"
        />
      )}
      {pace != null && (
        <line x1={16} y1={0.5} x2={16} y2={7.5} stroke="var(--ink)" strokeWidth={1.75} transform={`rotate(${pace * 360} 16 16)`} />
      )}
    </svg>
  );
}
