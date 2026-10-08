"use client";

import { Calendar, Receipt, ChevronDown, AlertCircle, ListChecks, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import { useState, useEffect } from "react";
import { CalendarDays, CalendarRange, CalendarCheck } from "lucide-react";
import TransactionModal from "./TransactionModal";
import ScanInvoiceModal from "./ScanInvoiceModal";
import WeekPanel from "./WeekPanel";
import PendingReviewButton from "./PendingReviewButton";
import DayTransactionsCard from "./DayTransactionsCard";
import IncompleteDataModal from "./IncompleteDataModal";
import PeriodComparison from "./PeriodComparison";
import ExpenseGroupAnalysis from "./ExpenseGroupAnalysis";
import StackedMonthTooltip from "./StackedMonthTooltip";
import { thisMonthLocalIso } from "@/lib/localDate";
import { compactMoney } from "@/lib/formatMoney";
import { formatVND } from "@/lib/formatMoney";
import { VIZ, GRID, yAxis, xAxis, BAR, STACK_GAP, TOOLTIP, pctChange, catColor, refLabel, barLabelAt, drawnIndex } from "@/lib/viz";
import ChartCard, { StatTile } from "@/components/charts/ChartCard";
import { monthAxis } from "./MonthAxisTick";

// Biểu đồ trong tab này theo docs/bieu-do.md: tiêu đề là câu kết luận tính từ
// dữ liệu, cột xám, chỉ điểm mà câu đó nói tới mang màu nhấn, ghi số ở MỘT chỗ.

const OTHER_KEY = "__other";
/** Số nhóm hiện riêng trong thẻ "theo nhóm"; phần đuôi gộp thành "Khác". */
const RANK_SHOW = 6;

interface CategorySlice { name: string; amount: number }
interface SeriesPoint { name: string; amount: number }
/** Điểm có kèm SỐ giao dịch, không chỉ số tiền. */
interface CountedPoint { name: string; amount: number; count: number }
interface TransactionInfo {
  id: string;
  date: string;
  supplier: string;
  amount: number;
  category: string;
  subGroup: string;
  paymentMethod: string;
  itemCount: number;
  missing: { subGroup: boolean; paymentMethod: boolean; items: boolean };
}

interface ExpenseData {
  totals: {
    day: number;
    month: number;
    year: number;
  };
  categoryBreakdowns: {
    day: CategorySlice[];
    month: CategorySlice[];
    year: CategorySlice[];
  };
  avgDailyExpense: number;
  eomForecast: number;
  categoriesCount: number;
  dailySeries: CountedPoint[];
  /** Ngày trong tháng (01–31), gộp 12 tháng gần nhất. */
  dayOfMonth: CountedPoint[];
  /** Tổng chi theo năm, mọi năm đã có dữ liệu. */
  yearlySeries: CountedPoint[];
  monthlySeries: SeriesPoint[];
  /** Mỗi dòng: { name, total, "<tên nhóm>": số tiền... } cho 12 tháng. */
  monthlyBreakdown: Record<string, string | number>[];
  /** Các nhóm được vẽ, đúng thứ tự; "__other" là phần đuôi đã gộp. */
  monthlyCategoryKeys: string[];
  topMerchants: CategorySlice[];
  recentTransactions: TransactionInfo[];
  hasData: boolean;
}

const EMPTY: ExpenseData = {
  totals: { day: 0, month: 0, year: 0 },
  categoryBreakdowns: { day: [], month: [], year: [] },
  avgDailyExpense: 0, eomForecast: 0, categoriesCount: 0,
  dailySeries: [], dayOfMonth: [], yearlySeries: [],
  monthlySeries: [], monthlyBreakdown: [], monthlyCategoryKeys: [],
  topMerchants: [], recentTransactions: [], hasData: false,
};

/** Vị trí giá trị lớn nhất; -1 khi mảng rỗng hoặc không có giá trị dương. */
function argmax(values: number[]) {
  let at = -1;
  let best = 0;
  values.forEach((v, i) => {
    if (v > best) {
      best = v;
      at = i;
    }
  });
  return at;
}

/** Trục ngày 01–31: chỉ ghi ngày 1, 5, 10, 15… — 31 nhãn không vừa khổ 375px. */
const dayTick = (d: string | number) => {
  const n = Number(d);
  return n === 1 || n % 5 === 0 ? String(n) : "";
};

/** "2026-10" → "T10" / "Oct" */
const monthShort = (k: string, vi: boolean) => {
  const m = Number(k.slice(5, 7));
  if (!m) return k;
  return vi ? `T${m}` : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
};

interface RankRow {
  key: string;
  name: string;
  amount: number;
  color: string;
  strong?: boolean;
  note?: string;
}

/**
 * Cột ngang xếp hạng (vẽ bằng div): tên và số ở dòng trên, thanh mảnh ở dòng
 * dưới — vừa cả thẻ hẹp một phần ba lẫn khổ 375px, số luôn thấy trọn.
 */
function RankList({ rows, scale }: { rows: RankRow[]; scale: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`min-w-0 truncate text-sm text-[var(--color-text)] ${r.strong ? "font-bold" : ""}`}
              title={r.name}
            >
              {r.name}
            </span>
            <span className="flex-none text-sm font-bold tabular-nums text-[var(--color-text)]">
              {formatVND(r.amount)}
              {r.note && <span className="ml-1.5 text-xs font-normal text-[var(--color-text-faint)]">{r.note}</span>}
            </span>
          </div>
          <div className="h-3 w-full" aria-hidden>
            <div
              className="h-full rounded-r-[4px]"
              style={{
                width: `${(Math.max(0, r.amount) / Math.max(1, scale)) * 100}%`,
                minWidth: r.amount > 0 ? 3 : 0,
                background: r.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Nhãn tổng tháng trên đỉnh cột chồng, chỉ ở MỘT cột. Gắn vào khúc trên cùng
 * có giá trị của cột đó, nên `y` là đỉnh cả chồng.
 */
function stackTotalAt(index: number, total: number, format: (v: number) => string) {
  const render = (props: { index?: number; x?: number | string; y?: number | string; width?: number | string }) => {
    if (props.index !== index) return null;
    const x = Number(props.x) + Number(props.width ?? 0) / 2;
    const y = Number(props.y) - 8;
    return (
      <text x={x} y={y} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--color-text)">
        {format(total)}
      </text>
    );
  };
  return render;
}

export default function ExpenseTab() {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
  const { label } = useCategories("Expense");
  const [selectedMonth, setSelectedMonth] = useState(() => thisMonthLocalIso());
  const [timeRange, setTimeRange] = useState<"day" | "month" | "year">("month");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Ngày đang mở chi tiết, chọn bằng cách bấm vào một điểm trên biểu đồ ngày.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isIncompleteOpen, setIsIncompleteOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ExpenseData>(EMPTY);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      try {
        const monthParam = selectedMonth || thisMonthLocalIso();
        const res = await fetch(`/api/finance/expense?month=${monthParam}`, { signal: controller.signal });
        const result = await res.json().catch(() => null);
        if (res.ok && result?.success) {
          setData({ ...EMPTY, ...result.data });
        } else {
          setData(EMPTY);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setData(EMPTY);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [selectedMonth, refreshKey]);

  const {
    totals, categoryBreakdowns, avgDailyExpense, eomForecast, categoriesCount,
    monthlyBreakdown, monthlyCategoryKeys,
    dailySeries, dayOfMonth, yearlySeries,
    topMerchants, recentTransactions,
  } = data;

  const currentTotal = totals[timeRange] || 0;
  const currentCategoryBreakdown = categoryBreakdowns[timeRange] || [];
  const mm = monthShort(selectedMonth, vi);
  const year = selectedMonth.slice(0, 4);
  const isThisMonth = selectedMonth === thisMonthLocalIso();
  const groupName = (k: string) => (k === OTHER_KEY ? t("Other", "Khác") : label(k));

  // --- Bốn con số -----------------------------------------------------------
  const paceHeadline =
    totals.month <= 0
      ? t(`No spending recorded in ${mm} ${year}`, `${mm}/${year} chưa ghi khoản chi nào`)
      : isThisMonth
        ? t(
            `${money(totals.month)} spent in ${mm} so far — on pace for ${money(eomForecast)}`,
            `${mm} đã chi ${money(totals.month)} — đà này cuối tháng khoảng ${money(eomForecast)}`
          )
        : t(`${money(totals.month)} spent in ${mm} ${year}`, `${mm}/${year} chi ${money(totals.month)}`);

  // --- Theo nhóm (thay cho bánh donut) -------------------------------------
  const sliceSum = currentCategoryBreakdown.reduce((s, c) => s + c.amount, 0);
  const shareOf = (v: number) => (sliceSum > 0 ? Math.round((v / sliceSum) * 100) : 0);
  const rangeVi = timeRange === "day" ? "chi trong ngày" : timeRange === "year" ? `chi năm ${year}` : `chi ${mm}`;
  const rangeEn = timeRange === "day" ? "the day's spending" : timeRange === "year" ? `${year} spending` : `${mm} spending`;
  const topSlice = currentCategoryBreakdown[0];
  const categoryHeadline = topSlice
    ? t(
        `${label(topSlice.name)} takes ${shareOf(topSlice.amount)}% of ${rangeEn}`,
        `${label(topSlice.name)} chiếm ${shareOf(topSlice.amount)}% ${rangeVi}`
      )
    : t("Nothing spent in this range", "Khoảng này chưa chi gì");
  const shownSlices = currentCategoryBreakdown.slice(0, RANK_SHOW);
  const restSlices = currentCategoryBreakdown.slice(RANK_SHOW);
  const categoryRows: RankRow[] = shownSlices.map((c, i) => ({
    key: c.name,
    name: label(c.name),
    amount: c.amount,
    color: i === 0 ? VIZ.accent : VIZ.muted,
    strong: i === 0,
    note: `${shareOf(c.amount)}%`,
  }));
  if (restSlices.length > 0) {
    const rest = restSlices.reduce((s, c) => s + c.amount, 0);
    categoryRows.push({
      key: OTHER_KEY,
      name: t(`Other (${restSlices.length})`, `Khác (${restSlices.length} nhóm)`),
      amount: rest,
      color: VIZ.other,
      note: `${shareOf(rest)}%`,
    });
  }
  const categoryScale = Math.max(1, ...categoryRows.map((r) => r.amount));

  // --- Từng ngày trong tháng -------------------------------------------------
  const peakDay = argmax(dailySeries.map((d) => d.amount));
  const dailyHeadline =
    peakDay < 0
      ? t(`No spending recorded in ${mm} yet`, `${mm} chưa ghi khoản chi nào`)
      : t(
          `The ${Number(dailySeries[peakDay].name)}${ordinal(Number(dailySeries[peakDay].name))} was the biggest day — ${money(dailySeries[peakDay].amount)}, against ${money(avgDailyExpense)} on an average day`,
          `Ngày ${Number(dailySeries[peakDay].name)} chi nhiều nhất — ${money(dailySeries[peakDay].amount)}, trong khi trung bình ${money(avgDailyExpense)} một ngày`
        );

  const peakCount = argmax(dailySeries.map((d) => d.count));
  const txCount = dailySeries.reduce((s, d) => s + d.count, 0);
  const activeDays = dailySeries.filter((d) => d.count > 0).length;
  const countHeadline =
    peakCount < 0
      ? t(`No transactions in ${mm} yet`, `${mm} chưa có giao dịch nào`)
      : t(
          `${txCount} transactions over ${activeDays} days — the busiest was the ${Number(dailySeries[peakCount].name)}${ordinal(Number(dailySeries[peakCount].name))} with ${dailySeries[peakCount].count}`,
          `${txCount} giao dịch trong ${activeDays} ngày — đông nhất là ngày ${Number(dailySeries[peakCount].name)} với ${dailySeries[peakCount].count} khoản`
        );

  const peakDom = argmax(dayOfMonth.map((d) => d.amount));
  const domSum = dayOfMonth.reduce((s, d) => s + Math.max(0, d.amount), 0);
  const domHeadline =
    peakDom < 0
      ? t("No spending in the last 12 months", "12 tháng qua chưa có khoản chi nào")
      : t(
          `The ${Number(dayOfMonth[peakDom].name)}${ordinal(Number(dayOfMonth[peakDom].name))} of the month costs the most — ${Math.round((dayOfMonth[peakDom].amount / Math.max(1, domSum)) * 100)}% of a year's spending lands on it`,
          `Ngày ${Number(dayOfMonth[peakDom].name)} hằng tháng tốn nhất — ${Math.round((dayOfMonth[peakDom].amount / Math.max(1, domSum)) * 100)}% chi tiêu cả năm rơi vào ngày này`
        );

  // --- 12 tháng theo nhóm ----------------------------------------------------
  const curMonthIdx = monthlyBreakdown.length - 1;
  const groupTotals = monthlyCategoryKeys.map((k) =>
    monthlyBreakdown.reduce((s, row) => s + (Number(row[k]) || 0), 0)
  );
  const allGroups = groupTotals.reduce((s, v) => s + v, 0);
  const leadKey = monthlyCategoryKeys.find((k) => k !== OTHER_KEY);
  const leadShare =
    leadKey && allGroups > 0 ? Math.round((groupTotals[monthlyCategoryKeys.indexOf(leadKey)] / allGroups) * 100) : 0;
  const monthlyHeadline = leadKey
    ? t(
        `${groupName(leadKey)} is the biggest slice of the last 12 months — ${leadShare}% of spending`,
        `${groupName(leadKey)} là phần lớn nhất 12 tháng qua — ${leadShare}% tổng chi`
      )
    : t("No expenses in the last 12 months", "12 tháng qua chưa có khoản chi nào");
  const curRow = monthlyBreakdown[curMonthIdx];
  const curMonthTotal = curRow ? Number(curRow.total) || 0 : 0;
  // Khúc trên cùng CÓ GIÁ TRỊ của cột tháng đang xem — nhãn tổng gắn vào đó.
  const topKeyAtCur = curRow
    ? [...monthlyCategoryKeys].reverse().find((k) => (Number(curRow[k]) || 0) > 0)
    : undefined;
  const lastKey = monthlyCategoryKeys[monthlyCategoryKeys.length - 1];

  // --- Theo năm ----------------------------------------------------------------
  const lastYearIdx = yearlySeries.length - 1;
  const ly = yearlySeries[lastYearIdx];
  const prevY = yearlySeries[lastYearIdx - 1];
  const running = ly && ly.name === String(new Date().getFullYear());
  const yearlyHeadline = !ly
    ? t("No spending recorded yet", "Chưa ghi khoản chi nào")
    : prevY && prevY.amount > 0
      ? running
        ? t(
            `${ly.name} so far: ${money(ly.amount)} — ${Math.round((ly.amount / prevY.amount) * 100)}% of all of ${prevY.name}`,
            `${ly.name} tới nay: ${money(ly.amount)} — bằng ${Math.round((ly.amount / prevY.amount) * 100)}% cả năm ${prevY.name}`
          )
        : t(
            `${ly.name} spending: ${money(ly.amount)}, ${signedPct(pctChange(ly.amount, prevY.amount))} on ${prevY.name}`,
            `Năm ${ly.name} chi ${money(ly.amount)}, ${signedPct(pctChange(ly.amount, prevY.amount))} so ${prevY.name}`
          )
      : t(`${ly.name}: ${money(ly.amount)} spent`, `Năm ${ly.name} chi ${money(ly.amount)}`);

  // --- Nơi chi -------------------------------------------------------------------
  const merchantTop = topMerchants[0];
  const merchantHeadline = merchantTop
    ? totals.month > 0
      ? t(
          `${merchantTop.name} is where the most went in ${mm} — ${Math.round((merchantTop.amount / totals.month) * 100)}% of spending`,
          `${merchantTop.name} là nơi chi nhiều nhất ${mm} — ${Math.round((merchantTop.amount / totals.month) * 100)}% tổng chi`
        )
      : t(`${merchantTop.name} is where the most went in ${mm}`, `${merchantTop.name} là nơi chi nhiều nhất ${mm}`)
    : t("Top merchants", "Nơi chi nhiều nhất");
  const merchantRows: RankRow[] = topMerchants.map((m, i) => ({
    key: m.name,
    name: m.name,
    amount: m.amount,
    color: i === 0 ? VIZ.accent : VIZ.muted,
    strong: i === 0,
  }));

  function ordinal(n: number) {
    if (vi) return "";
    const s = n % 100;
    if (s >= 11 && s <= 13) return "th";
    return ["th", "st", "nd", "rd"][n % 10] ?? "th";
  }
  function signedPct(p: number | null) {
    if (p === null) return t("new", "mới");
    return `${p > 0 ? "+" : ""}${p}%`;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="c-h2 c-page-title text-[var(--color-text)]">{t("Expense", "Chi tiêu")}</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{t("Categories & spending trends", "Danh mục & xu hướng chi tiêu")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button
            onClick={() => setIsModalOpen(true)}
            aria-label={t("Add Expense", "Thêm chi tiêu")}
            title={t("Add Expense", "Thêm chi tiêu")}
            className="c-btn c-btn-accent shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
          >
            <ArrowUpRight size={16} /> <span className="hidden md:inline">{t("Add Expense", "Thêm chi tiêu")}</span>
          </button>
          <button
            onClick={() => setIsScanModalOpen(true)}
            aria-label={t("Scan Invoice", "Quét hóa đơn")}
            title={t("Scan Invoice", "Quét hóa đơn")}
            className="c-btn c-btn-secondary shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
          >
            <Receipt size={16} className="text-[var(--color-success)]" /> <span className="hidden md:inline">{t("Scan Invoice", "Quét hóa đơn")}</span>
          </button>
          <PendingReviewButton refreshKey={refreshKey} onProcessed={() => setRefreshKey(k => k + 1)} />
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setScannedData(null);
        }}
        onSuccess={() => setRefreshKey(k => k + 1)}
        initialData={scannedData}
      />
      <ScanInvoiceModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onSuccess={() => {
          setIsScanModalOpen(false);
          setRefreshKey(k => k + 1);
        }}
      />
      <IncompleteDataModal
        isOpen={isIncompleteOpen}
        onClose={() => setIsIncompleteOpen(false)}
        onSaved={() => setRefreshKey(k => k + 1)}
      />

      {/* Main Cards Row */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64 text-[var(--color-success)]">
          <span className="animate-spin text-4xl leading-none">⍥</span>
          <span className="ml-3 font-bold">{t("Loading data...", "Đang tải dữ liệu...")}</span>
        </div>
      ) : (
        <>
          {/* Bốn con số: một ô chính (theo khoảng đang chọn), ba ô bối cảnh. */}
          <section className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] flex flex-col gap-4 min-w-0">
            <header>
              <h4 className="c-h5 text-[var(--color-text)] text-balance">{paceHeadline}</h4>
              <p className="text-xs text-[var(--color-text-faint)] mt-1">
                {isThisMonth
                  ? t(
                      "forecast = average day so far × days in the month",
                      "dự báo = trung bình một ngày tới nay × số ngày trong tháng"
                    )
                  : t(`spending in ${mm}/${year}`, `chi tiêu ${mm}/${year}`)}
              </p>
            </header>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <StatTile
                emphasis
                label={
                  <span className="relative inline-flex items-center">
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value as "day" | "month" | "year")}
                      aria-label={t("Range", "Khoảng thời gian")}
                      className="appearance-none bg-transparent text-base md:text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none cursor-pointer pr-4"
                    >
                      <option value="day">{t("Daily Expense", "Chi tiêu ngày")}</option>
                      <option value="month">{t("Monthly Expense", "Chi tiêu tháng")}</option>
                      <option value="year">{t("Yearly Expense", "Chi tiêu năm")}</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
                  </span>
                }
                value={formatVND(currentTotal)}
              />
              <StatTile label={t("Avg per day", "Trung bình/ngày")} value={formatVND(avgDailyExpense)} />
              <StatTile label={t("End of month forecast", "Dự báo cuối tháng")} value={formatVND(eomForecast)} />
              <StatTile label={t("Categories used", "Số nhóm đã chi")} value={categoriesCount} />
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {/* Theo nhóm: cột ngang xếp hạng thay cho bánh donut — so độ dài
                thanh dễ hơn so góc lát bánh, và tên dài không phải chen vào
                chú giải dưới đáy. */}
            <ChartCard
              title={categoryHeadline}
              subtitle={t(`Spending by category · ${rangeEn}`, `Chi theo nhóm · ${rangeVi}`)}
            >
              {categoryRows.length === 0 ? (
                <p className="text-sm text-[var(--color-text-faint)]">
                  {t("No spending in this range yet.", "Khoảng này chưa có khoản chi nào.")}
                </p>
              ) : (
                <RankList rows={categoryRows} scale={categoryScale} />
              )}
            </ChartCard>

            {/* Từng ngày: cột xám, ngày chi nhiều nhất màu nhấn + ghi số;
                đường trung bình ghi nhãn tại chỗ. Không trục Y, không lưới. */}
            <ChartCard
              className="md:col-span-2"
              title={dailyHeadline}
              subtitle={t(`Spending per day, ${mm}/${year} · dashed line = daily average`, `Chi mỗi ngày, ${mm}/${year} · nét đứt = trung bình một ngày`)}
            >
              {dailySeries.length === 0 ? (
                <p className="text-sm text-[var(--color-text-faint)]">
                  {t("No days to show yet.", "Chưa có ngày nào để hiện.")}
                </p>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailySeries} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                      <XAxis dataKey="name" {...xAxis} interval={0} tickFormatter={dayTick} />
                      <Tooltip
                        {...TOOLTIP}
                        formatter={(v) => [formatVND(Number(v) || 0), t("Spent", "Đã chi")]}
                        labelFormatter={(d) => t(`Day ${Number(d)}`, `Ngày ${Number(d)}`)}
                      />
                      {avgDailyExpense > 0 && (
                        <ReferenceLine
                          y={avgDailyExpense}
                          stroke={VIZ.muted}
                          strokeDasharray="4 3"
                          label={refLabel(`${t("avg", "TB")} ${money(avgDailyExpense)}`)}
                        />
                      )}
                      <Bar dataKey="amount" {...BAR} fill={VIZ.muted} label={barLabelAt(dailySeries, "amount", peakDay, money)}>
                        {dailySeries.map((d, i) => (
                          <Cell key={d.name} fill={i === peakDay ? VIZ.accent : VIZ.muted} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Bảng so sánh kỳ xuống dưới hai biểu đồ: hai biểu đồ là thứ nhìn
              trước, bảng số là thứ tra sau. */}
          <PeriodComparison
            metrics={["expense", "cashOut", "debtService", "count"]}
            refreshKey={refreshKey}
          />

          <div className="flex items-end gap-3 mt-10 -mb-2">
            <h3 className="c-h3 text-[var(--color-text)] flex items-center gap-3">
              <CalendarDays size={22} /> {t("By day", "Theo ngày")}
            </h3>
            <span className="flex-1 border-b border-[var(--color-border)] mb-3" />
          </div>

          {/* Chi tiết từng ngày tách thành mục riêng. Trước đây nó nằm nhét
              dưới biểu đồ xu hướng, nên một thẻ vừa là biểu đồ vừa là bảng tra
              cứu — hai việc khác nhau trong cùng một khung. */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
            <h3 className="c-h5 text-[var(--color-text)]">
              {t("Day by day", "Chi tiết theo ngày")}
            </h3>
            <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
              {t(
                "days with spending are highlighted",
                "ngày đã có chi tiêu được tô đậm"
              )}
            </p>
            {/* Chọn ngày bằng dải nút thay vì bấm vào điểm trên biểu đồ: chấm
                chỉ rộng 3px, trên điện thoại gần như không trúng. Nút thật thì
                đủ 44px, và ngày đã có chi tiêu được tô đậm để dễ nhắm. */}
            <div className="mt-6">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                {t("Pick a day to see its transactions", "Chọn một ngày để xem chi tiết")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dailySeries.map((d) => {
                  const iso = `${selectedMonth}-${d.name}`;
                  const active = selectedDay === iso;
                  const hasSpend = d.amount > 0;
                  return (
                    <button
                      key={d.name}
                      onClick={() => setSelectedDay(active ? null : iso)}
                      className={`min-w-11 h-11 px-2 flex items-center justify-center rounded-lg text-xs font-bold tabular-nums border transition-colors ${
                        active
                          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
                          : hasSpend
                            ? "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-info)]"
                            : "bg-transparent text-[var(--color-text-faint)] border-[var(--color-border)] hover:border-[var(--color-info)]"
                      }`}
                    >
                      {Number(d.name)}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDay && (
              <div className="mt-6">
                <DayTransactionsCard
                  date={selectedDay}
                  refreshKey={refreshKey}
                  onAddTransaction={() => setIsModalOpen(true)}
                />
                <button
                  onClick={() => setSelectedDay(null)}
                  className="mt-3 min-h-11 px-1 text-xs text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
                >
                  {t("Close day detail", "Đóng chi tiết ngày")}
                </button>
              </div>
            )}
          </div>

          {/* Ba lát cắt về NHỊP: theo ngày, theo ngày trong tháng, theo năm. */}
          <ChartCard
            title={countHeadline}
            subtitle={t(
              `Transactions per day, ${mm}/${year} · spending alone cannot tell one big purchase from twenty small ones`,
              `Số giao dịch mỗi ngày, ${mm}/${year} · chỉ nhìn số tiền thì không phân biệt được một khoản lớn với hai mươi khoản nhỏ`
            )}
          >
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="name" {...xAxis} interval={0} tickFormatter={dayTick} />
                  <Tooltip
                    {...TOOLTIP}
                    formatter={(v, n, item) => [
                      `${v} ${t("transactions", "giao dịch")} · ${formatVND(
                        Number((item?.payload as { amount?: number })?.amount) || 0
                      )}`,
                      t("Count", "Số giao dịch"),
                    ]}
                    labelFormatter={(d) => t(`Day ${Number(d)}`, `Ngày ${Number(d)}`)}
                  />
                  <Bar dataKey="count" {...BAR} fill={VIZ.muted} label={barLabelAt(dailySeries, "count", peakCount, (v) => String(v))}>
                    {dailySeries.map((d, i) => (
                      <Cell key={d.name} fill={i === peakCount ? VIZ.accent : VIZ.muted} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title={domHeadline}
            subtitle={t(
              "Spending by day of the month, last 12 months stacked — fixed-date bills show up as spikes",
              "Chi theo ngày trong tháng, cộng dồn 12 tháng — khoản rơi vào ngày cố định sẽ nhô lên thành cột"
            )}
          >
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfMonth} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="name" {...xAxis} interval={0} tickFormatter={dayTick} />
                  <Tooltip
                    {...TOOLTIP}
                    formatter={(v, n, item) => [
                      `${formatVND(Number(v) || 0)} · ${
                        (item?.payload as { count?: number })?.count || 0
                      } ${t("transactions", "giao dịch")}`,
                      t("Spending", "Số tiền"),
                    ]}
                    labelFormatter={(d) => t(`Day ${Number(d)}`, `Ngày ${Number(d)}`)}
                  />
                  <Bar dataKey="amount" {...BAR} fill={VIZ.muted} label={barLabelAt(dayOfMonth, "amount", peakDom, money)}>
                    {dayOfMonth.map((d, i) => (
                      <Cell key={d.name} fill={i === peakDom ? VIZ.accent : VIZ.muted} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="flex items-end gap-3 mt-10 -mb-2">
            <h3 className="c-h3 text-[var(--color-text)] flex items-center gap-3">
              <CalendarRange size={22} /> {t("By week", "Theo tuần")}
            </h3>
            <span className="flex-1 border-b border-[var(--color-border)] mb-3" />
          </div>

          <WeekPanel refreshKey={refreshKey} compact />

          <div className="flex items-end gap-3 mt-10 -mb-2">
            <h3 className="c-h3 text-[var(--color-text)] flex items-center gap-3">
              <Calendar size={22} /> {t("By month", "Theo tháng")}
            </h3>
            <span className="flex-1 border-b border-[var(--color-border)] mb-3" />
          </div>

          {/* Cột chồng 12 tháng: các nhóm CHÍNH LÀ đối tượng so sánh, nên bốn
              nhóm lớn nhất (API xếp theo tổng cả 12 tháng — thứ tự cố định)
              mỗi nhóm một màu phân loại, phần đuôi gộp "Khác". Bỏ đường tổng
              nét đứt: tổng đã là đỉnh cột, chỉ ghi số ở tháng đang xem. */}
          <ChartCard
            title={monthlyHeadline}
            subtitle={t(
              `Spending per month by category, 12 months to ${mm}/${year} · number = ${mm} total`,
              `Chi mỗi tháng theo nhóm, 12 tháng tới ${mm}/${year} · số trên cột = tổng ${mm}`
            )}
            keys={monthlyCategoryKeys.map((k, i) => ({
              label: groupName(k),
              color: k === OTHER_KEY ? VIZ.other : catColor(i),
              shape: "bar" as const,
            }))}
          >
            {monthlyCategoryKeys.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("No expenses in the last 12 months.", "12 tháng qua chưa có khoản chi nào.")}
              </p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBreakdown} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="name" {...monthAxis(monthlyBreakdown.map((d) => String(d.name)))} />
                    <YAxis {...yAxis(money)} />
                    <Tooltip {...TOOLTIP} content={<StackedMonthTooltip otherKey={OTHER_KEY} otherLabel={t("Other", "Khác")} />} />
                    {monthlyCategoryKeys.map((key, i) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        stackId="cat"
                        name={groupName(key)}
                        fill={key === OTHER_KEY ? VIZ.other : catColor(i)}
                        {...STACK_GAP}
                        maxBarSize={BAR.maxBarSize}
                        radius={key === lastKey ? BAR.radius : 0}
                        label={key === topKeyAtCur ? stackTotalAt(drawnIndex(monthlyBreakdown, key, curMonthIdx), curMonthTotal, money) : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <div className="flex items-end gap-3 mt-10 -mb-2">
            <h3 className="c-h3 text-[var(--color-text)] flex items-center gap-3">
              <CalendarCheck size={22} /> {t("By year", "Theo năm")}
            </h3>
            <span className="flex-1 border-b border-[var(--color-border)] mb-3" />
          </div>

          <ChartCard
            title={yearlyHeadline}
            subtitle={t(
              "Total spending per year, every year on record · the current year is still running",
              "Tổng chi mỗi năm, mọi năm đã có dữ liệu · năm nay vẫn đang chạy nên chưa trọn"
            )}
          >
            {yearlySeries.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                {t("No spending recorded yet.", "Chưa ghi khoản chi nào.")}
              </p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlySeries} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                    <XAxis dataKey="name" {...xAxis} />
                    <Tooltip
                      {...TOOLTIP}
                      formatter={(v, n, item) => [
                        `${formatVND(Number(v) || 0)} · ${
                          (item?.payload as { count?: number })?.count || 0
                        } ${t("transactions", "giao dịch")}`,
                        t("Spending", "Số tiền"),
                      ]}
                    />
                    <Bar dataKey="amount" {...BAR} fill={VIZ.muted} label={barLabelAt(yearlySeries, "amount", lastYearIdx, money)}>
                      {yearlySeries.map((y, i) => (
                        <Cell key={y.name} fill={i === lastYearIdx ? VIZ.accent : VIZ.muted} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ExpenseGroupAnalysis refreshKey={refreshKey} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ChartCard
              title={merchantHeadline}
              subtitle={t(`Top 5 merchants, ${mm}/${year}`, `5 nơi chi nhiều nhất, ${mm}/${year}`)}
            >
              {topMerchants.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-sm">
                  {t(
                    "No spending recorded this month yet — scan a receipt or add one by hand.",
                    "Tháng này chưa ghi khoản chi nào — quét hoá đơn hoặc thêm tay một khoản."
                  )}
                </p>
              ) : (
                <RankList rows={merchantRows} scale={Math.max(1, merchantTop?.amount ?? 1)} />
              )}
            </ChartCard>

            <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] md:col-span-2">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="c-h5 text-[var(--color-text)]">{t("Recent Transactions", "Giao dịch chi tiêu gần đây")}</h3>
                <button
                  onClick={() => setIsIncompleteOpen(true)}
                  className="text-xs flex items-center gap-1.5 bg-[var(--color-surface-2)] px-4 min-h-11 md:min-h-0 md:px-3 md:py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text)]"
                >
                  <ListChecks size={14} />
                  {t("Fill in sub-categories", "Bổ sung danh mục con")}
                </button>
              </div>
              {recentTransactions.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-sm">{t("No expenses this month.", "Chưa có giao dịch chi tiêu tháng này.")}</p>
              ) : (
                <div className="flex flex-col gap-3 mt-4">
                  {/* Biến vòng lặp đặt tên `tx`, không phải `t` — `t` là hàm dịch,
                      đặt trùng thì không gọi được t() bên trong dòng nào cả. */}
                  {recentTransactions.map(tx => {
                    const gaps = [
                      tx.missing.subGroup && t("no sub-category", "thiếu danh mục con"),
                      tx.missing.paymentMethod && t("no payment method", "thiếu cách trả"),
                      tx.missing.items && t("no line items", "chưa có dòng hàng"),
                    ].filter(Boolean) as string[];
                    return (
                      <div key={tx.id} className="bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-border)] transition-colors hover:border-[var(--color-info)]">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[var(--color-text)] truncate" title={tx.supplier}>{tx.supplier}</div>
                            <div className="text-xs text-[var(--color-text-muted)] mt-1">
                              {tx.date} · {tx.category}{tx.subGroup ? ` · ${tx.subGroup}` : ""}
                            </div>
                          </div>
                          <div className="shrink-0 text-sm font-bold text-[var(--color-text)] tabular-nums">{formatVND(tx.amount)}</div>
                        </div>
                        {gaps.length > 0 && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-warning)]">
                            <AlertCircle size={13} className="shrink-0" />
                            {gaps.join(" · ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
