"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND } from "@/lib/formatMoney";
import { VIZ } from "@/lib/viz";
import ChartCard from "@/components/charts/ChartCard";

// Tỷ trọng chi tiêu của MỘT ngày theo nhóm danh mục.
//
// Đi cặp với DayTransactionsCard ở đầu Dashboard: thẻ kia liệt kê từng khoản,
// thẻ này trả lời "tiền hôm nay đổ vào nhóm nào nhiều nhất". Chỉ tính khoản
// Chi — thu nhập và chuyển khoản không phải chi tiêu.
//
// Bản trước là donut sáu màu. Mắt người so độ dài tốt hơn so góc nhiều lần, và
// sáu màu thì người đọc phải dò chú giải mới biết lát nào là gì — nên giờ là
// cột ngang xếp hạng (docs/bieu-do.md §2): nhóm lớn nhất mang màu nhấn vì tiêu
// đề nói về nó, các nhóm còn lại xám. Số và % nằm ngay trên dòng, không cần
// chú giải.

interface DayTx {
  type: string;
  categoryGroup: string;
  totalAmount: number;
}

interface Row {
  key: string;
  name: string;
  amount: number;
}

/** Quá chừng này nhóm thì phần đuôi gộp thành "Khác" — danh sách chỉ để đọc lướt. */
const MAX_ROWS = 6;

const formatPct = (part: number, total: number) => {
  const pct = (part / total) * 100;
  return pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`;
};

interface Props {
  /** YYYY-MM-DD */
  date: string;
  refreshKey?: number;
  /** Tiêu đề thay thế; mặc định là ngày. */
  title?: string;
}

export default function TodaySpendingShare({ date, refreshKey = 0, title }: Props) {
  const { t } = useLanguage();
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

  // Cộng theo nhóm, lớn trước. Quá MAX_ROWS nhóm thì giữ MAX_ROWS - 1 nhóm đầu,
  // phần đuôi gộp thành "Khác".
  const byGroup = new Map<string, number>();
  for (const tx of data?.transactions ?? []) {
    if (tx.type?.trim().toLowerCase() !== "expense") continue;
    byGroup.set(tx.categoryGroup, (byGroup.get(tx.categoryGroup) || 0) + tx.totalAmount);
  }
  const ranked = [...byGroup.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, amount]) => s + amount, 0);

  const head = ranked.length > MAX_ROWS ? ranked.slice(0, MAX_ROWS - 1) : ranked;
  const rows: Row[] = head.map(([group, amount]) => ({
    key: group || "__none",
    name: group ? label(group) : t("No group", "Chưa có nhóm"),
    amount,
  }));
  if (ranked.length > head.length) {
    rows.push({
      key: "__other",
      name: `${t("Other", "Khác")} (${ranked.length - head.length})`,
      amount: ranked.slice(head.length).reduce((s, [, amount]) => s + amount, 0),
    });
  }
  // Thước chung là nhóm lớn nhất, không phải tổng: cột dài nhất chạm mép phải,
  // các cột khác so được với nó bằng mắt.
  const scale = Math.max(1, ...rows.map((r) => r.amount));

  const rawHeading =
    title ??
    new Date(`${date}T00:00:00Z`).toLocaleDateString("vi-VN", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "numeric",
    });
  // "thứ hai, 5/10" đứng đầu câu tiêu đề thì phải viết hoa.
  const heading = rawHeading.charAt(0).toUpperCase() + rawHeading.slice(1);

  // --- Câu kết luận ---------------------------------------------------------
  const top = rows[0];
  const ready = !errorCode && !isLoading && top !== undefined;
  const headline = !ready
    ? `${t("Spending share", "Tỷ trọng chi tiêu")} · ${heading}`
    : rows.length === 1
      ? t(`${heading}: all spending went to ${top.name}`, `${heading}: mọi khoản chi đều vào ${top.name}`)
      : t(
          `${heading}: ${top.name} took ${formatPct(top.amount, total)} of spending`,
          `${heading}: ${top.name} chiếm ${formatPct(top.amount, total)} tổng chi`
        );
  const subtitle = ready
    ? t(
        `Spending by category group · total ${formatVND(total)}`,
        `Chi theo nhóm danh mục · tổng ${formatVND(total)}`
      )
    : t("by category group", "theo nhóm danh mục");

  return (
    <ChartCard title={headline} subtitle={subtitle}>
      {errorCode && (
        <p className="text-sm text-[var(--color-error)]">
          {errorCode === "load" ? t("Could not load", "Không tải được") : errorCode}
        </p>
      )}

      {!errorCode && isLoading && (
        <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
      )}

      {!errorCode && !isLoading && rows.length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
          {t("No spending recorded for this day.", "Ngày này chưa ghi khoản chi nào.")}
        </p>
      )}

      {ready && (
        <ul className="flex flex-col gap-3 min-w-0">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-col gap-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className={`min-w-0 truncate text-[var(--color-text)] ${i === 0 ? "font-bold" : ""}`}
                  title={r.name}
                >
                  {r.name}
                </span>
                <span className="flex-none tabular-nums">
                  <span className="font-bold text-[var(--color-text)]">{formatVND(r.amount)}</span>
                  <span className="ml-2 inline-block w-9 text-right text-xs text-[var(--color-text-faint)]">
                    {formatPct(r.amount, total)}
                  </span>
                </span>
              </div>
              <div className="relative h-3 w-full" aria-hidden>
                <div
                  className="absolute inset-y-0 left-0 rounded-r-[4px]"
                  style={{
                    width: `${(r.amount / scale) * 100}%`,
                    minWidth: 3,
                    background: i === 0 ? VIZ.accent : r.key === "__other" ? VIZ.other : VIZ.muted,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
