"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { todayLocalIso } from "@/lib/localDate";
import PeriodBreakdownModal from "./PeriodBreakdownModal";

// So sánh tuần này / tháng này / năm nay với kỳ liền trước và cùng kỳ năm ngoái.
//
// Dùng chung cho cả năm tab Finance; mỗi tab chọn chỉ số cần xem qua prop
// `metrics`. Số liệu lấy từ /api/finance/compare — cách tính kỳ chỉ có một bản,
// đặt ở src/lib/periods.ts.
//
// Chiều "tốt" của mỗi chỉ số khác nhau: thu nhập tăng là tốt, chi tiêu tăng là
// xấu. Tô màu theo chiều tăng/giảm thuần sẽ nói ngược, nên mỗi chỉ số mang cờ
// `goodWhenUp` riêng.

type PeriodKind = "week" | "month" | "year";

export type MetricKey =
  | "income"
  | "expense"
  | "cashOut"
  | "debtService"
  | "debtPrincipal"
  | "net"
  | "count";

interface Delta {
  abs: number;
  pct: number | null;
}

interface Bucket {
  label: string;
  from: string;
  to: string;
  complete: boolean;
  income: number;
  expense: number;
  debtPrincipal: number;
  cashOut: number;
  debtService: number;
  net: number;
  count: number;
}

interface CompareData {
  period: PeriodKind;
  elapsedDays: number;
  isComplete: boolean;
  lastYearIsFullPeriod: boolean;
  current: Bucket;
  previous: Bucket;
  lastYear: Bucket;
  deltas: {
    previous: Record<string, Delta>;
    lastYear: Record<string, Delta>;
  };
}

const formatVND = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

/**
 * `goodWhenUp`: tăng là tin tốt hay tin xấu.
 *
 * `hintEn`/`hintVi`: công thức, hiện ngay dưới tên chỉ số. "Còn lại" và "Tiền
 * ra" là hai chỗ hay bị hiểu nhầm nhất — nhìn con số không đoán được nó đã trừ
 * những gì, mà chênh lệch giữa chúng chính là phần trả gốc nợ.
 */
const METRIC_META: Record<
  MetricKey,
  { en: string; vi: string; goodWhenUp: boolean; isCount?: boolean; hintEn?: string; hintVi?: string }
> = {
  income: { en: "Income", vi: "Thu nhập", goodWhenUp: true },
  expense: { en: "Spending", vi: "Chi tiêu", goodWhenUp: false },
  cashOut: {
    en: "Cash out", vi: "Tiền ra", goodWhenUp: false,
    hintEn: "spending + principal repaid", hintVi: "chi tiêu + trả gốc",
  },
  debtService: {
    en: "Debt payments", vi: "Trả nợ", goodWhenUp: false,
    hintEn: "principal + interest", hintVi: "gốc + lãi",
  },
  debtPrincipal: { en: "Principal repaid", vi: "Trả gốc", goodWhenUp: true },
  net: {
    en: "Net", vi: "Còn lại", goodWhenUp: true,
    hintEn: "income − cash out", hintVi: "thu nhập − tiền ra",
  },
  count: { en: "Transactions", vi: "Số giao dịch", goodWhenUp: true, isCount: true },
};

interface Props {
  metrics: MetricKey[];
  title?: string;
  /** Đổi giá trị để buộc tải lại sau khi ghi giao dịch mới. */
  refreshKey?: number;
}

export default function PeriodComparison({ metrics, title, refreshKey = 0 }: Props) {
  const { t } = useLanguage();
  const [kind, setKind] = useState<PeriodKind>("month");
  const [data, setData] = useState<CompareData | null>(null);
  const [failed, setFailed] = useState(false);
  // Dòng đang mở bảng chi tiết. Rỗng là chưa mở.
  const [openMetric, setOpenMetric] = useState<MetricKey | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/finance/compare?period=${kind}&date=${todayLocalIso()}`
        );
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setData(json.data);
          setFailed(false);
        } else {
          setFailed(true);
        }
      } catch {
        if (!ignore) setFailed(true);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [kind, refreshKey]);

  const isLoading = !failed && (!data || data.period !== kind);

  const tabs: [PeriodKind, string][] = [
    ["week", t("This week", "Tuần này")],
    ["month", t("This month", "Tháng này")],
    ["year", t("This year", "Năm nay")],
  ];

  const cell = (delta: Delta | undefined, goodWhenUp: boolean, isCount?: boolean) => {
    if (!delta) return <span className="text-[var(--color-text-faint)]">—</span>;
    const flat = delta.abs === 0;
    const up = delta.abs > 0;
    const good = flat ? null : up === goodWhenUp;
    const color = flat
      ? "text-[var(--color-text-faint)]"
      : good
        ? "text-[var(--color-success)]"
        : "text-[var(--color-error)]";
    const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
    return (
      <span className={`inline-flex items-center gap-1 tabular-nums ${color}`}>
        <Icon size={14} className="shrink-0" />
        <span>
          {/* `pct` rỗng nghĩa là kỳ gốc bằng 0. Nhưng nếu kỳ này CŨNG bằng 0
              thì không có gì mới cả — ghi "mới" ở đó là nói sai. */}
          {delta.pct !== null
            ? `${delta.pct > 0 ? "+" : ""}${delta.pct}%`
            : flat
              ? t("unchanged", "không đổi")
              : t("new", "mới")}
        </span>
        <span className="hidden sm:inline text-[var(--color-text-faint)]">
          ({up ? "+" : ""}
          {isCount ? delta.abs : formatVND(delta.abs)})
        </span>
      </span>
    );
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div className="p-5 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
        <h3 className="c-h5 text-[var(--color-text)]">
          {title ?? t("Compared with earlier periods", "So với các kỳ trước")}
        </h3>
        <div className="flex gap-1.5">
          {tabs.map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`min-h-11 md:min-h-9 px-4 rounded-lg text-sm font-bold transition-colors ${
                kind === k
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {failed && (
        <p className="p-5 text-sm text-[var(--color-error)]">
          {t("Could not load comparison", "Không tải được phần so sánh")}
        </p>
      )}
      {isLoading && !failed && (
        <p className="p-5 text-sm text-[var(--color-text-faint)]">
          {t("Loading...", "Đang tải...")}
        </p>
      )}

      {!failed && !isLoading && data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left font-bold">
                    {data.current.label}
                  </th>
                  <th className="px-3 py-3 text-right font-bold whitespace-nowrap">
                    {t("now", "kỳ này")}
                  </th>
                  <th className="px-3 py-3 text-right font-bold whitespace-nowrap">
                    {t("vs", "so")} {data.previous.label}
                  </th>
                  <th className="px-5 py-3 text-right font-bold whitespace-nowrap">
                    {data.lastYearIsFullPeriod
                      ? `${t("vs all of", "so cả")} ${data.lastYear.label}`
                      : `${t("vs", "so")} ${data.lastYear.label}`}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {metrics.map((m) => {
                  const meta = METRIC_META[m];
                  const value = data.current[m];
                  return (
                    // Bấm cả dòng để xem những giao dịch làm nên con số đó.
                    // Không thêm nút riêng: cả dòng chỉ có đúng một việc này.
                    <tr
                      key={m}
                      onClick={() => setOpenMetric(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenMetric(m);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${t(meta.en, meta.vi)} — ${t("see the transactions behind this number", "xem các giao dịch làm nên con số này")}`}
                      className="cursor-pointer hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface-2)] focus:outline-none transition-colors"
                    >
                      <td className="px-5 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                        {t(meta.en, meta.vi)}
                        {meta.hintVi && (
                          <span className="block text-[10px] text-[var(--color-text-faint)] normal-case">
                            {t(meta.hintEn!, meta.hintVi)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-[var(--color-text)] whitespace-nowrap">
                        {meta.isCount ? value : formatVND(value)}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {cell(data.deltas.previous[m], meta.goodWhenUp, meta.isCount)}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {cell(data.deltas.lastYear[m], meta.goodWhenUp, meta.isCount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Nói rõ đang so trên bao nhiêu ngày. Không có dòng này thì "giảm
              40%" đọc như thành tích, trong khi thật ra kỳ này mới đi được
              nửa chặng. */}
          <p className="px-5 py-3 text-xs text-[var(--color-text-faint)] border-t border-[var(--color-border)]">
            {t("Tap a row to see the transactions behind it. ", "Bấm vào một dòng để xem các giao dịch làm nên con số đó. ")}
            {data.isComplete
              ? t("full period compared", "so trọn kỳ")
              : t(
                  `first ${data.elapsedDays} days of each period, so the comparison is like-for-like`,
                  `so cùng ${data.elapsedDays} ngày đầu của mỗi kỳ cho công bằng`
                )}
            {data.lastYearIsFullPeriod &&
              t(
                "; the last column is the whole previous year",
                "; cột cuối là trọn năm trước"
              )}
          </p>
        </>
      )}

      {data && openMetric && (
        <PeriodBreakdownModal
          isOpen
          onClose={() => setOpenMetric(null)}
          metric={openMetric}
          metricLabel={t(METRIC_META[openMetric].en, METRIC_META[openMetric].vi)}
          periodLabel={data.current.label}
          from={data.current.from}
          to={data.current.to}
          expected={data.current[openMetric]}
          isCount={METRIC_META[openMetric].isCount}
        />
      )}
    </div>
  );
}
