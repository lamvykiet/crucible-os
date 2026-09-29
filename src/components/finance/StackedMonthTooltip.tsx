"use client";

// Chú giải cho biểu đồ cột chồng theo tháng: mỗi khúc bao nhiêu tiền VÀ chiếm
// bao nhiêu phần trăm tháng đó.
//
// Chú giải mặc định của recharts chỉ đưa số tiền, nên vẫn phải tự nhẩm mới biết
// tháng vọt lên là do khoản nào. Dùng chung cho tab Chi tiêu (theo nhóm) và tab
// Thu nhập (theo nguồn) — hai biểu đồ cùng một lối đọc thì nên cùng một chú
// giải.

const formatVND = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

interface Props {
  active?: boolean;
  payload?: readonly { dataKey?: string | number; value?: number; color?: string }[];
  label?: string;
  /** Khoá của phần đã gộp, và chữ hiển thị cho nó. */
  otherKey: string;
  otherLabel: string;
}

export default function StackedMonthTooltip({
  active,
  payload,
  label,
  otherKey,
  otherLabel,
}: Props) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => p.dataKey !== "total" && (p.value || 0) > 0);
  const totalRow = payload.find((p) => p.dataKey === "total");
  const total = Number(
    totalRow?.value ?? rows.reduce((sum, r) => sum + (r.value || 0), 0)
  );
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-sm text-xs">
      <p className="font-bold text-[var(--color-text)]">{label}</p>
      <p className="font-bold tabular-nums text-[var(--color-text)] mb-1.5">
        {formatVND(total)}
      </p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={String(r.dataKey)} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-none"
              style={{ background: r.color }}
              aria-hidden
            />
            <span className="flex-1 min-w-0 truncate text-[var(--color-text-muted)]">
              {r.dataKey === otherKey ? otherLabel : String(r.dataKey)}
            </span>
            <span className="tabular-nums font-bold text-[var(--color-text)]">
              {total > 0 ? Math.round(((r.value || 0) / total) * 100) : 0}%
            </span>
            <span className="tabular-nums text-[var(--color-text-faint)]">
              {formatVND(r.value || 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
