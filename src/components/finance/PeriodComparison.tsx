"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { todayLocalIso } from "@/lib/localDate";
import PeriodBreakdownModal from "./PeriodBreakdownModal";
import { formatVND } from "@/lib/formatMoney";
import { VIZ } from "@/lib/viz";
import { SeriesKey, Delta } from "@/components/charts/ChartCard";

// So sánh tuần này / tháng này / năm nay với kỳ liền trước và cùng kỳ năm ngoái.
//
// Dùng chung cho cả năm tab Finance; mỗi tab chọn chỉ số cần xem qua prop
// `metrics`. Số liệu lấy từ /api/finance/compare — cách tính kỳ chỉ có một bản,
// đặt ở src/lib/periods.ts.
//
// Chiều "tốt" của mỗi chỉ số khác nhau: thu nhập tăng là tốt, chi tiêu tăng là
// xấu. Tô màu theo chiều tăng/giảm thuần sẽ nói ngược, nên mỗi chỉ số mang cờ
// `goodWhenUp` riêng.
//
// Dạng: mỗi chỉ số một dòng kiểu bullet (thanh kỳ này + vạch mốc kỳ trước) như
// MonthBreakdown, thay cho bảng bốn cột. Tiêu đề là câu kết luận của chỉ số
// đầu tiên; `title` của nơi gọi xuống dòng mô tả. Xem docs/bieu-do.md.

type PeriodKind = "week" | "month" | "year";

export type MetricKey =
  | "income"
  | "expense"
  | "cashOut"
  | "debtService"
  | "debtPrincipal"
  | "net"
  | "count";

interface DeltaVal {
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
    previous: Record<string, DeltaVal>;
    lastYear: Record<string, DeltaVal>;
  };
}

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

  const seg = (on: boolean) =>
    `flex-1 md:flex-none inline-flex items-center justify-center px-4 min-h-10 rounded-full text-xs font-bold transition-colors ${
      on ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
    }`;

  const fmt = (m: MetricKey, v: number) => (METRIC_META[m].isCount ? String(v) : formatVND(v));
  /** Hai kỳ cùng 0 thì là "không đổi", không phải "mới" — `pct` rỗng khi kỳ gốc bằng 0. */
  const pctOf = (d: DeltaVal | undefined) => (!d ? null : d.abs === 0 ? 0 : d.pct);

  // --- Câu kết luận: chỉ số ĐẦU TIÊN của tab, so kỳ liền trước ---------------
  let headline: string = title ?? t("Compared with earlier periods", "So với các kỳ trước");
  const lead = metrics[0];
  if (data && !isLoading && lead) {
    const meta = METRIC_META[lead];
    const name = t(meta.en, meta.vi);
    const now = data.current[lead];
    const before = data.previous[lead];
    const p = pctOf(data.deltas.previous[lead]);
    const curL = data.current.label;
    const prevL = data.previous.label;
    headline =
      now === 0 && before === 0
        ? t(`No ${name.toLowerCase()} in ${curL} or ${prevL} yet`, `${name} ${curL} và ${prevL} đều chưa có`)
        : p === null
          ? t(`${name} ${curL}: ${fmt(lead, now)} — nothing in ${prevL} to compare`, `${name} ${curL}: ${fmt(lead, now)} — ${prevL} chưa có gì để so`)
          : p === 0
            ? t(`${name} is level with ${prevL}`, `${name} ngang ${prevL}`)
            : t(
                `${name} is ${p > 0 ? "up" : "down"} ${Math.abs(p)}% on ${prevL}`,
                `${name} ${p > 0 ? "tăng" : "giảm"} ${Math.abs(p)}% so ${prevL}`
              );
  }

  // Thước chung cho các chỉ số tiền (để thanh so được với nhau giữa các dòng);
  // số giao dịch có thước riêng vì khác đơn vị.
  const scaleFor = (m: MetricKey) => {
    if (!data) return 1;
    const group = metrics.filter((x) => !!METRIC_META[x].isCount === !!METRIC_META[m].isCount);
    return Math.max(1, ...group.flatMap((x) => [data.current[x], data.previous[x]]));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Bộ chọn kỳ: một hàng phía trên, ngoài thẻ */}
      <div className="flex gap-1 p-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] self-stretch md:self-start">
        {tabs.map(([k, lbl]) => (
          <button key={k} onClick={() => setKind(k)} className={seg(kind === k)}>
            {lbl}
          </button>
        ))}
      </div>

      <section className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] flex flex-col gap-4 min-w-0">
        <header>
          <h4 className="c-h5 text-[var(--color-text)] text-balance">{headline}</h4>
          {data && !isLoading && (
            <p className="text-xs text-[var(--color-text-faint)] mt-1">
              {title ? `${title} · ` : ""}
              {t(`${data.current.label} against ${data.previous.label} and ${data.lastYear.label}`, `${data.current.label} so với ${data.previous.label} và ${data.lastYear.label}`)}
            </p>
          )}
        </header>

        {failed && (
          <p className="text-sm text-[var(--color-error)]">
            {t("Could not load comparison", "Không tải được phần so sánh")}
          </p>
        )}
        {isLoading && !failed && (
          <p className="text-sm text-[var(--color-text-faint)]">
            {t("Loading...", "Đang tải...")}
          </p>
        )}

        {!failed && !isLoading && data && (
          <>
            <SeriesKey
              items={[
                { label: data.current.label, color: VIZ.muted, shape: "bar" },
                { label: data.previous.label, color: VIZ.ink, shape: "tick" },
              ]}
            />

            <ul className="-mx-2 flex flex-col">
              {metrics.map((m) => {
                const meta = METRIC_META[m];
                const now = data.current[m];
                const before = data.previous[m];
                const name = t(meta.en, meta.vi);
                return (
                  // Bấm cả dòng để xem những giao dịch làm nên con số đó.
                  // Không thêm nút riêng: cả dòng chỉ có đúng một việc này.
                  <li key={m} className="border-b border-[var(--color-border)] last:border-b-0">
                    <button
                      onClick={() => setOpenMetric(m)}
                      aria-label={`${name} — ${t("see the transactions behind this number", "xem các giao dịch làm nên con số này")}`}
                      className="w-full text-left px-2 py-3 rounded-lg hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface-2)] focus:outline-none transition-colors grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_10rem] items-center gap-x-4 gap-y-1.5"
                    >
                      <span className="min-w-0">
                        <span className={`block text-sm truncate text-[var(--color-text)] ${m === lead ? "font-bold" : ""}`}>{name}</span>
                        {meta.hintVi && (
                          <span className="block text-[10px] text-[var(--color-text-faint)]">
                            {t(meta.hintEn!, meta.hintVi)}
                          </span>
                        )}
                      </span>
                      <span className="order-3 col-span-2 md:order-none md:col-span-1">
                        <Bullet
                          now={now}
                          before={before}
                          scale={scaleFor(m)}
                          color={m === lead ? VIZ.accent : VIZ.muted}
                        />
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold tabular-nums text-[var(--color-text)]">{fmt(m, now)}</span>
                        <span className="block">
                          <Delta
                            pct={pctOf(data.deltas.previous[m])}
                            upIsGood={meta.goodWhenUp}
                            vs={t(`vs ${data.previous.label}`, `so ${data.previous.label}`)}
                          />
                        </span>
                        <span className="block">
                          <Delta
                            pct={pctOf(data.deltas.lastYear[m])}
                            upIsGood={meta.goodWhenUp}
                            vs={
                              data.lastYearIsFullPeriod
                                ? t(`vs all of ${data.lastYear.label}`, `so cả ${data.lastYear.label}`)
                                : t(`vs ${data.lastYear.label}`, `so ${data.lastYear.label}`)
                            }
                          />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Nói rõ đang so trên bao nhiêu ngày. Không có dòng này thì "giảm
                40%" đọc như thành tích, trong khi thật ra kỳ này mới đi được
                nửa chặng. */}
            <p className="text-[11px] text-[var(--color-text-faint)]">
              {t("Tap a row to see the transactions behind it. ", "Bấm vào một dòng để xem các giao dịch làm nên con số đó. ")}
              {data.isComplete
                ? t("full period compared", "so trọn kỳ")
                : t(
                    `first ${data.elapsedDays} days of each period, so the comparison is like-for-like`,
                    `so cùng ${data.elapsedDays} ngày đầu của mỗi kỳ cho công bằng`
                  )}
              {data.lastYearIsFullPeriod &&
                t(
                  "; the last comparison is the whole previous year",
                  "; mốc so cuối là trọn năm trước"
                )}
            </p>
          </>
        )}
      </section>

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

/**
 * Một thanh kỳ này + vạch mốc kỳ trước, cùng thước `scale` (kiểu bullet, như
 * MonthBreakdown). Số âm ("Còn lại" âm) không vẽ được thành thanh — để trống,
 * con số bên phải đã mang dấu.
 */
function Bullet({ now, before, scale, color }: { now: number; before: number; scale: number; color: string }) {
  const pos = (v: number) => `${(Math.max(0, v) / scale) * 100}%`;
  return (
    <div className="relative h-5 w-full" aria-hidden>
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-r-[4px]"
        style={{ width: pos(now), minWidth: now > 0 ? 3 : 0, background: color }}
      />
      {before > 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 rounded-full"
          style={{ left: `calc(${pos(before)} - 1px)`, background: VIZ.ink }}
        />
      )}
    </div>
  );
}
