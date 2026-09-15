"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useCategories } from "@/lib/useCategories";

// Tỷ trọng chi tiêu của MỘT ngày theo nhóm danh mục.
//
// Đi cặp với DayTransactionsCard ở đầu Dashboard: thẻ kia liệt kê từng khoản,
// thẻ này trả lời "tiền hôm nay đổ vào nhóm nào nhiều nhất". Chỉ tính khoản
// Chi — thu nhập và chuyển khoản không phải chi tiêu.

interface DayTx {
  type: string;
  categoryGroup: string;
  totalAmount: number;
}

interface Slice {
  key: string;
  name: string;
  amount: number;
  color: string;
}

// Bảng màu phân loại, dùng theo thứ tự cố định — không xoay vòng. Đã chạy bộ
// kiểm màu trên đúng nền của Crucible (sáng #F6F0E4, tối #291C0E): đạt dải độ
// sáng, độ bão hoà, tách màu cho người mù màu (ΔE ≥ 8,4) và sàn thị lực thường.
//
// Ở chế độ sáng, cam/xanh ngọc/vàng/hồng dưới 3:1 so với nền, nên biểu đồ BẮT
// BUỘC có nhãn chữ đi kèm — danh sách bên cạnh chính là phần đó, đừng bỏ.
//
// Đã thử một bảng màu trầm tông nâu cho hợp giao diện: trượt, vì độ bão hoà quá
// thấp và tím/xanh ngọc trùng nhau với người mù màu đỏ–lục.
const SERIES = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"],
};
const OTHER_COLOR = "var(--color-text-faint)";

const formatVND = (amount: number) =>
  new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

const formatPct = (part: number, total: number) => {
  const pct = (part / total) * 100;
  return pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`;
};

function SliceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  total: number;
}) {
  const slice = payload?.[0]?.payload as Slice | undefined;
  if (!active || !slice) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-sm text-xs">
      <p className="font-bold text-[var(--color-text)]">{slice.name}</p>
      <p className="text-[var(--color-text-muted)] tabular-nums mt-0.5">
        {formatVND(slice.amount)} · {formatPct(slice.amount, total)}
      </p>
    </div>
  );
}

interface Props {
  /** YYYY-MM-DD */
  date: string;
  refreshKey?: number;
  /** Tiêu đề thay thế; mặc định là ngày. */
  title?: string;
}

export default function TodaySpendingShare({ date, refreshKey = 0, title }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { label } = useCategories("Expense");
  const [data, setData] = useState<{ date: string; transactions: DayTx[] } | null>(null);
  // Lưu mã lỗi, dịch lúc render — cùng lý do như DayTransactionsCard.
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const res = await fetch(`/api/finance/day?date=${date}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setData({ date, transactions: json.data.transactions });
          setErrorCode(null);
        } else {
          setErrorCode(json.error || "load");
        }
      } catch (e) {
        if (!ignore && (e as Error).name !== "AbortError") setErrorCode("load");
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [date, refreshKey]);

  const isLoading = !errorCode && (!data || data.date !== date);

  // Cộng theo nhóm, lớn trước. Quá 6 nhóm thì 5 nhóm đầu giữ màu riêng, phần
  // đuôi gộp thành "Khác" màu xám — không sinh thêm màu thứ 7.
  const palette = SERIES[theme];
  const byGroup = new Map<string, number>();
  for (const tx of data?.transactions ?? []) {
    if (tx.type?.trim().toLowerCase() !== "expense") continue;
    byGroup.set(tx.categoryGroup, (byGroup.get(tx.categoryGroup) || 0) + tx.totalAmount);
  }
  const ranked = [...byGroup.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, amount]) => s + amount, 0);

  const head = ranked.length > palette.length ? ranked.slice(0, palette.length - 1) : ranked;
  const slices: Slice[] = head.map(([group, amount], i) => ({
    key: group || "__none",
    name: group ? label(group) : t("No group", "Chưa có nhóm"),
    amount,
    color: palette[i],
  }));
  if (ranked.length > head.length) {
    slices.push({
      key: "__other",
      name: `${t("Other", "Khác")} (${ranked.length - head.length})`,
      amount: ranked.slice(head.length).reduce((s, [, amount]) => s + amount, 0),
      color: OTHER_COLOR,
    });
  }

  const heading =
    title ??
    new Date(`${date}T00:00:00Z`).toLocaleDateString("vi-VN", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "numeric",
    });

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div className="p-5 border-b border-[var(--color-border)]">
        <h3 className="c-h5 text-[var(--color-text)] truncate">
          {t("Spending share", "Tỷ trọng chi tiêu")} · {heading}
        </h3>
        <p className="text-xs text-[var(--color-text-faint)] mt-1">
          {t("by category group", "theo nhóm danh mục")}
        </p>
      </div>

      {errorCode && (
        <div className="p-5 text-sm text-[var(--color-error)]">
          {errorCode === "load" ? t("Could not load", "Không tải được") : errorCode}
        </div>
      )}

      {!errorCode && isLoading && (
        <div className="p-5 text-sm text-[var(--color-text-faint)]">
          {t("Loading...", "Đang tải...")}
        </div>
      )}

      {!errorCode && !isLoading && slices.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">
          {t("No spending recorded for this day.", "Ngày này chưa ghi khoản chi nào.")}
        </div>
      )}

      {!errorCode && !isLoading && slices.length > 0 && (
        // Donut trên, nhãn dưới — kể cả màn rộng. Thẻ chỉ chiếm nửa hàng, đặt cạnh
        // nhau thì donut 208px ăn hết chỗ và tên nhóm bị cắt còn 0 ký tự.
        <div className="p-5 flex flex-col gap-5">
          <div className="relative h-52 w-52 max-w-full mx-auto flex-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="68%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  // Khe 2px màu nền giữa các lát — để các lát liền màu vẫn tách được.
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<SliceTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-faint)]">
                {t("Total", "Tổng chi")}
              </span>
              <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                {formatVND(total)}
              </span>
            </div>
          </div>

          {/* Nhãn chữ cho từng lát — màu không bao giờ là cách duy nhất để đọc. */}
          <ul className="min-w-0 space-y-2">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-3 text-sm">
                <span
                  className="w-3 h-3 rounded-sm flex-none"
                  style={{ background: s.color }}
                  aria-hidden
                />
                <span className="flex-1 min-w-0 truncate text-[var(--color-text-muted)]" title={s.name}>
                  {s.name}
                </span>
                <span className="font-bold tabular-nums text-[var(--color-text)]">
                  {formatPct(s.amount, total)}
                </span>
                <span className="w-24 text-right tabular-nums text-[var(--color-text-faint)] text-xs">
                  {formatVND(s.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
