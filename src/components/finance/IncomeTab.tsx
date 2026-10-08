"use client";

import { useState, useEffect } from "react";
import { ArrowDownLeft, AlertCircle, CalendarX } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, ReferenceLine,
} from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import TransactionModal from "./TransactionModal";
import PendingReviewButton from "./PendingReviewButton";
import { thisMonthLocalIso } from "@/lib/localDate";
import PeriodComparison from "./PeriodComparison";
import StackedMonthTooltip from "./StackedMonthTooltip";
import { compactMoney, formatVND } from "@/lib/formatMoney";
import { VIZ, GRID, yAxis, xAxis, BAR, LINE, STACK_GAP, TOOLTIP, TOOLTIP_LINE, labelAt, pctChange } from "@/lib/viz";
import ChartCard, { SeriesKey, Delta, StatTile } from "@/components/charts/ChartCard";
import { monthAxis } from "./MonthAxisTick";
import IncomeCareer from "./IncomeCareer";

// Toàn bộ số liệu đến từ /api/finance/income.
// Trước đây tab này chạy trên 4 mảng hardcode và cả tên công ty ("SHINHAN
// FINANCE", "MIRAE ASSET") lẫn các ô "Tháng cao nhất" đều là số viết cứng.
//
// Biểu đồ theo docs/bieu-do.md: tiêu đề mỗi thẻ là câu kết luận tính từ dữ
// liệu; cột xám, chỉ điểm mà câu đó nói tới mang màu nhấn; nhãn ghi thẳng lên
// dữ liệu thay cho chú giải dưới đáy.

interface SeriesPoint { name: string; amount: number }
/** Luỹ kế theo tháng; `null` ở tháng chưa tới. */
interface CumulativePoint { name: string; thisYear: number | null; lastYear: number | null }
/** Trung bình một tháng trong năm, gộp mọi năm có dữ liệu. */
interface SeasonPoint { name: string; avg: number; years: number }
interface SupplierSlice { name: string; amount: number; share: number }
interface MonthPeak { month: string; amount: number }

/** Một nguồn thu, đặt cạnh chính nó của năm ngoái. */
interface SourceRow {
  name: string;
  amount: number;
  prevAmount: number;
  share: number;
  delta: number;
  /** `null` khi năm ngoái bằng 0 — nguồn mới, không phải "tăng 100%". */
  pct: number | null;
  months: number;
  count: number;
  avgPerActiveMonth: number;
  lastMonth: string | null;
}

interface Concentration {
  sourceCount: number;
  topShare: number;
  topTwoShare: number;
  /** Thu nhập năm nay nếu bỏ nguồn lớn nhất ra. */
  withoutTop: number;
}

const OTHER_SOURCE_KEY = "__other";

interface IncomeData {
  month: string;
  year: number;
  monthlyIncome: number;
  monthlySeries: SeriesPoint[];
  annualTotals: SeriesPoint[];
  cumulative: CumulativePoint[];
  seasonality: SeasonPoint[];
  yearTotal: number;
  prevYearTotal: number;
  avgPerMonth: number;
  prevAvgPerMonth: number;
  monthsWithIncome: number;
  highestMonth: MonthPeak | null;
  lowestMonth: MonthPeak | null;
  bySupplier: SupplierSlice[];
  sourceComparison: SourceRow[];
  concentration: Concentration;
  /** Mỗi dòng: { name, total, "<tên nguồn>": số tiền... } cho 12 tháng. */
  sourceMonthly: Record<string, string | number>[];
  /** Các nguồn được vẽ, đúng thứ tự; "__other" là phần đuôi đã gộp. */
  sourceKeys: string[];
  largestSource: SupplierSlice | null;
  hasData: boolean;
}

const EMPTY: IncomeData = {
  month: "", year: 0, monthlyIncome: 0, monthlySeries: [], annualTotals: [],
  cumulative: [], seasonality: [],
  yearTotal: 0, prevYearTotal: 0, avgPerMonth: 0, prevAvgPerMonth: 0,
  monthsWithIncome: 0, highestMonth: null, lowestMonth: null,
  bySupplier: [], sourceComparison: [],
  concentration: { sourceCount: 0, topShare: 0, topTwoShare: 0, withoutTop: 0 },
  sourceMonthly: [], sourceKeys: [],
  largestSource: null, hasData: false,
};

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" → "10/2026" */
const mLabel = (k: string) => (k.length >= 7 ? `${k.slice(5, 7)}/${k.slice(0, 4)}` : k);
/** "10" (hoặc 10) → "tháng 10" / "October"-ngắn "Oct" */
const calMonth = (mm: string | number, vi: boolean) => {
  const n = Number(mm);
  return vi ? `tháng ${n}` : MONTHS_EN[n - 1] ?? String(mm);
};

/** Nhãn số trên MỌI cột — chỉ dùng cho biểu đồ ít cột (theo năm), nơi nhãn
 *  thay được trục Y. Cột `strong` in đậm, còn lại chữ nhạt. */
function barLabels(format: (v: number) => string, strong: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (props: any) => {
    if (props.value === undefined || props.value === null || !Number(props.value)) return null;
    const x = Number(props.x) + Number(props.width || 0) / 2;
    return (
      <text
        x={x}
        y={Number(props.y) - 8}
        textAnchor="middle"
        fontSize={11}
        fontWeight={props.index === strong ? 700 : 500}
        fill={props.index === strong ? "var(--color-text)" : "var(--color-text-muted)"}
      >
        {format(Number(props.value))}
      </text>
    );
  };
  return render;
}

/** Nhãn ở đầu mút một đường, thay cho chú giải: "2026 · 120tr". Đặt trên hoặc
 *  dưới điểm cuối để hai đường kết thúc gần nhau không đè nhãn lên nhau. */
function endLabel(index: number, text: (v: number) => string, place: "above" | "below", strong: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (props: any) => {
    if (props.index !== index || props.value === undefined || props.value === null) return null;
    return (
      <text
        x={Number(props.x)}
        y={Number(props.y) + (place === "below" ? 18 : -10)}
        // Điểm ở ba tháng đầu: chữ chạy sang phải, đừng đâm vào trục Y.
        textAnchor={index <= 2 ? "start" : "end"}
        fontSize={11}
        fontWeight={strong ? 700 : 600}
        fill={strong ? "var(--color-text)" : "var(--color-text-muted)"}
      >
        {text(Number(props.value))}
      </text>
    );
  };
  return render;
}

/** Một thanh kỳ này + vạch mốc kỳ trước trên cùng một thước (bullet). */
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

export default function IncomeTab() {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
  const [selectedMonth, setSelectedMonth] = useState(() => thisMonthLocalIso());

  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<"api" | "network" | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [data, setData] = useState<IncomeData>(EMPTY);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setErrorCode(null);
      setApiMessage(null);
      try {
        const monthParam = selectedMonth || thisMonthLocalIso();
        const res = await fetch(`/api/finance/income?month=${monthParam}`, {
          signal: controller.signal,
        });
        const result = await res.json().catch(() => null);

        if (!res.ok || !result?.success) {
          setErrorCode("api");
          setApiMessage(typeof result?.error === "string" ? result.error : null);
          setData(EMPTY);
          return;
        }
        setData({ ...EMPTY, ...result.data });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setErrorCode("network");
        setData(EMPTY);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [selectedMonth, refreshKey]);

  const {
    month, year, monthlyIncome, monthlySeries, annualTotals, cumulative, seasonality, yearTotal, prevYearTotal,
    avgPerMonth, prevAvgPerMonth, highestMonth, lowestMonth,
    sourceComparison, concentration, sourceMonthly, sourceKeys,
    largestSource, hasData,
  } = data;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-[var(--color-success)]">
        <span className="animate-spin text-4xl leading-none">⍥</span>
        <span className="ml-3 font-bold">{t("Loading data...", "Đang tải dữ liệu...")}</span>
      </div>
    );
  }

  if (errorCode) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <AlertCircle size={32} className="text-[var(--color-error)]" />
        <p className="font-bold text-[var(--color-text)]">
          {errorCode === "network"
            ? t("Could not reach the server.", "Không kết nối được tới máy chủ.")
            : apiMessage || t("Could not load income data.", "Không tải được dữ liệu thu nhập.")}
        </p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="c-h2 c-page-title text-[var(--color-text)]">
              {t("Income", "Thu nhập")}
            </h2>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">
              {t("Income sources & trends", "Nguồn thu & xu hướng thu nhập")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            <button
              onClick={() => setIsIncomeModalOpen(true)}
              aria-label={t("Add Income", "Thêm thu nhập")}
              title={t("Add Income", "Thêm thu nhập")}
              className="c-btn c-btn-success shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
            >
              <ArrowDownLeft size={16} /> <span className="hidden md:inline">{t("Add Income", "Thêm thu nhập")}</span>
            </button>
            <PendingReviewButton refreshKey={refreshKey} onProcessed={() => setRefreshKey(prev => prev + 1)} />
          </div>
        </div>

        <TransactionModal
          isOpen={isIncomeModalOpen}
          onClose={() => setIsIncomeModalOpen(false)}
          onSuccess={() => setRefreshKey(prev => prev + 1)}
          defaultType="Income"
        />

        <div className="flex flex-col items-center justify-center h-80 gap-4 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <CalendarX size={32} />
          </div>
          <p className="text-lg font-bold text-[var(--color-text)]">
            {t("No income recorded yet", "Chưa ghi nhận khoản thu nhập nào trong tháng này")}
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Câu kết luận cho từng thẻ — tính từ dữ liệu, không viết cứng.
  // ==========================================================================

  const selM = mLabel(month || monthlySeries[monthlySeries.length - 1]?.name || "");

  // --- 12 tháng: tháng đang chọn so với trung bình 12 tháng ----------------
  const curIdx = monthlySeries.length - 1;
  const prevMonthAmount = monthlySeries[curIdx - 1]?.amount ?? 0;
  const avg12 = monthlySeries.length
    ? Math.round(monthlySeries.reduce((s, p) => s + p.amount, 0) / monthlySeries.length)
    : 0;
  const vsAvg = pctChange(monthlyIncome, avg12);
  const trendHeadline =
    monthlyIncome <= 0
      ? t(`No income recorded in ${selM}`, `${selM} chưa ghi khoản thu nào`)
      : vsAvg === null || Math.abs(vsAvg) < 5
        ? t(`${selM} brought in ${money(monthlyIncome)}, in line with the 12-month average`, `${selM} thu ${money(monthlyIncome)}, ngang trung bình 12 tháng`)
        : vsAvg > 0
          ? t(`${selM} brought in ${money(monthlyIncome)} — ${vsAvg}% above the 12-month average`, `${selM} thu ${money(monthlyIncome)} — cao hơn trung bình 12 tháng ${vsAvg}%`)
          : t(`${selM} brought in ${money(monthlyIncome)} — ${Math.abs(vsAvg)}% below the 12-month average`, `${selM} thu ${money(monthlyIncome)} — thấp hơn trung bình 12 tháng ${Math.abs(vsAvg)}%`);

  // --- Theo năm: năm nào thu nhiều nhất ------------------------------------
  const bestYearIdx = annualTotals.reduce((b, p, i, arr) => (p.amount > (arr[b]?.amount ?? -Infinity) ? i : b), 0);
  const bestYear = annualTotals[bestYearIdx];
  const annualHeadline =
    !bestYear || annualTotals.length < 2
      ? t("Income by year", "Thu nhập theo năm")
      : bestYear.name === String(year)
        ? t(`${year} is already your best year — ${money(bestYear.amount)}`, `${year} đã là năm thu nhiều nhất — ${money(bestYear.amount)}`)
        : t(`${bestYear.name} is still your best year — ${money(bestYear.amount)}`, `${bestYear.name} vẫn là năm thu nhiều nhất — ${money(bestYear.amount)}`);
  // Ít cột thì ghi số lên từng cột và bỏ trục Y; nhiều cột thì để trục.
  const labelEveryYear = annualTotals.length <= 8;

  // --- Luỹ kế: năm nay đang đi nhanh hay chậm hơn năm ngoái -----------------
  const cumIdx = cumulative.reduce((acc, p, i) => (p.thisYear !== null ? i : acc), -1);
  const thisCum = cumIdx >= 0 ? cumulative[cumIdx].thisYear ?? 0 : 0;
  const lastCumSame = cumIdx >= 0 ? cumulative[cumIdx].lastYear ?? 0 : 0;
  const hasLastYear = prevYearTotal > 0;
  const paceHeadline = !hasLastYear
    ? t(`${year} so far: ${money(thisCum)} — no ${year - 1} to compare yet`, `Năm ${year} tới nay: ${money(thisCum)} — chưa có năm ${year - 1} để so`)
    : cumIdx === 11
      ? (() => {
          const p = pctChange(thisCum, prevYearTotal) ?? 0;
          return p >= 0
            ? t(`${year} earned ${p}% more than ${year - 1}`, `Cả năm ${year} thu nhiều hơn ${year - 1} ${p}%`)
            : t(`${year} earned ${Math.abs(p)}% less than ${year - 1}`, `Cả năm ${year} thu ít hơn ${year - 1} ${Math.abs(p)}%`);
        })()
      : thisCum >= prevYearTotal
        ? t(`${year} income has already passed all of ${year - 1}`, `Thu nhập ${year} đã vượt cả năm ${year - 1}`)
        : (() => {
            const p = pctChange(thisCum, lastCumSame);
            if (p === null) return t(`${year} is ahead of the same point in ${year - 1}`, `${year} đang đi trước cùng kỳ ${year - 1}`);
            if (Math.abs(p) < 3) return t(`${year} is keeping pace with ${year - 1}`, `${year} đang đi ngang cùng kỳ ${year - 1}`);
            return p > 0
              ? t(`${year} is ${p}% ahead of the same point in ${year - 1}`, `${year} đang đi trước cùng kỳ ${year - 1} ${p}%`)
              : t(`${year} is ${Math.abs(p)}% behind the same point in ${year - 1}`, `${year} đang chậm hơn cùng kỳ ${year - 1} ${Math.abs(p)}%`);
          })();
  // Hai đường kết thúc gần nhau (tháng 9 trở đi) thì một nhãn lên, một nhãn
  // xuống — đường nào cao hơn ở cuối thì nhãn nằm trên.
  const endsClose = cumIdx >= 8;
  const thisAbove = !endsClose || !hasLastYear || thisCum >= prevYearTotal;

  // --- Mùa vụ: tháng nào trong năm thường thu cao ---------------------------
  const seasonWithData = seasonality.filter((s) => s.years > 0);
  const seasonMean = seasonWithData.length
    ? seasonality.reduce((s, p) => s + p.avg, 0) / seasonality.length
    : 0;
  const seasonTopIdx = seasonality.reduce((b, p, i, arr) => (p.avg > (arr[b]?.avg ?? -Infinity) ? i : b), 0);
  const seasonTop = seasonality[seasonTopIdx];
  const seasonYears = Math.max(0, ...seasonality.map((s) => s.years));
  const seasonRatio = seasonTop && seasonMean > 0 ? seasonTop.avg / seasonMean : 0;
  const ratioText = seasonRatio.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: 1 });
  const seasonHeadline =
    !seasonTop || seasonTop.avg <= 0
      ? t("Which months pay best", "Tháng nào trong năm thường thu cao")
      : seasonRatio >= 1.3
        ? t(
            `${calMonth(seasonTop.name, false)} usually pays best — ${ratioText}× an average month`,
            `${calMonth(seasonTop.name, true).replace(/^t/, "T")} thường thu cao nhất — gấp ${ratioText} lần tháng trung bình`
          )
        : t("Income is fairly even across the year", "Thu nhập khá đều giữa các tháng trong năm");

  // --- Cơ cấu nguồn theo tháng: tiền về chủ yếu từ đâu ----------------------
  const namedSources = sourceKeys.filter((k) => k !== OTHER_SOURCE_KEY);
  const sumOf = (k: string) => sourceMonthly.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const windowTotal = sourceMonthly.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const topSource = [...namedSources].sort((a, b) => sumOf(b) - sumOf(a))[0];
  const topSourceShare = topSource && windowTotal > 0 ? Math.round((sumOf(topSource) / windowTotal) * 100) : 0;
  const mixHeadline =
    topSource && topSourceShare > 0
      ? t(`${topSource} brought in ${topSourceShare}% of the last 12 months`, `${topSource} mang về ${topSourceShare}% thu nhập 12 tháng qua`)
      : t("Income mix by month", "Cơ cấu nguồn thu theo tháng");
  // Nguồn trọng tâm nằm sát đáy để các tháng so được với nhau trên cùng một gốc.
  const stackOrder = topSource ? [topSource, ...sourceKeys.filter((k) => k !== topSource)] : sourceKeys;
  const sourceName = (k: string) => (k === OTHER_SOURCE_KEY ? t("Other sources", "Nguồn khác") : k);

  // --- Từng nguồn: mức phụ thuộc -------------------------------------------
  const sourcesHeadline = !largestSource
    ? t(`Source by source — ${year} vs ${year - 1}`, `So sánh từng nguồn thu — ${year} so với ${year - 1}`)
    : concentration.topShare >= 50
      ? t(`${largestSource.name} alone is ${concentration.topShare}% of ${year} income`, `Riêng ${largestSource.name} đã chiếm ${concentration.topShare}% thu nhập ${year}`)
      : t(
          `${concentration.sourceCount} sources; the largest, ${largestSource.name}, is ${concentration.topShare}%`,
          `${concentration.sourceCount} nguồn thu, lớn nhất là ${largestSource.name} với ${concentration.topShare}%`
        );
  const sourceScale = Math.max(1, ...sourceComparison.map((s) => Math.max(s.amount, s.prevAmount)));

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="c-h2 text-[var(--color-text)]">
            {t("Income", "Thu nhập")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("Income sources & trends", "Nguồn thu & xu hướng thu nhập")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button
            onClick={() => setIsIncomeModalOpen(true)}
            aria-label={t("Add Income", "Thêm thu nhập")}
            title={t("Add Income", "Thêm thu nhập")}
            className="c-btn c-btn-success shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
          >
            <ArrowDownLeft size={16} /> <span className="hidden md:inline">{t("Add Income", "Thêm thu nhập")}</span>
          </button>
          <PendingReviewButton refreshKey={refreshKey} onProcessed={() => setRefreshKey(prev => prev + 1)} />
        </div>
      </div>

      <TransactionModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        onSuccess={() => setRefreshKey(prev => prev + 1)}
        defaultType="Income"
      />

      {/* Bốn con số chính: tháng đang chọn là ô chính, ba ô còn lại là bối cảnh. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatTile
          emphasis
          label={t(`Income ${selM}`, `Thu nhập ${selM}`)}
          value={formatVND(monthlyIncome)}
          delta={
            curIdx >= 1 ? (
              <Delta pct={pctChange(monthlyIncome, prevMonthAmount)} upIsGood vs={t("vs last month", "so tháng trước")} />
            ) : undefined
          }
        />
        <StatTile
          label={t(`${year} so far`, `Năm ${year} tới nay`)}
          value={formatVND(yearTotal)}
          note={
            prevYearTotal > 0
              ? t(`all of ${year - 1}: ${money(prevYearTotal)}`, `cả năm ${year - 1}: ${money(prevYearTotal)}`)
              : t("no data for previous year", `chưa có dữ liệu năm ${year - 1}`)
          }
        />
        <StatTile
          label={t(`Avg per month ${year}`, `BQ/tháng ${year}`)}
          value={formatVND(avgPerMonth)}
          delta={
            prevAvgPerMonth > 0 ? (
              <Delta pct={pctChange(avgPerMonth, prevAvgPerMonth)} upIsGood vs={t(`vs ${year - 1}`, `so ${year - 1}`)} />
            ) : undefined
          }
        />
        <StatTile
          label={t(`Avg per month ${year - 1}`, `BQ/tháng ${year - 1}`)}
          value={prevAvgPerMonth > 0 ? formatVND(prevAvgPerMonth) : "—"}
        />
      </div>

      {/* Sự nghiệp — khối này KHÔNG theo tháng báo cáo, nó đọc cả lịch sử.
          Đặt ngay sau bốn ô tổng vì "chỗ nào trả khá hơn" mới là câu hỏi lớn,
          còn tháng này thu bao nhiêu chỉ là một dòng trong đó. */}
      <div>
        <h3 className="c-h3 text-[var(--color-text)] mb-2 mt-8">
          {t("Career & employers", "Sự nghiệp & nơi đã làm")}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          {t(
            "the whole history, not the selected month",
            "toàn bộ lịch sử, không phụ thuộc tháng đang chọn"
          )}
        </p>
        <IncomeCareer refreshKey={refreshKey} />
      </div>

      {/* Phân tích nguồn thu */}
      <div>
        <h3 className="c-h3 text-[var(--color-text)] mb-6 mt-8">
          {t("Income Analysis", "Phân tích nguồn thu")} — {year}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile
            emphasis
            label={t("Largest source", "Nguồn thu lớn nhất")}
            value={<span className="block truncate">{largestSource?.name || "—"}</span>}
            note={
              largestSource
                ? t(`${largestSource.share}% of ${year} income`, `chiếm ${largestSource.share}% thu nhập năm ${year}`)
                : undefined
            }
          />
          <StatTile
            label={t("Highest month", "Tháng cao nhất")}
            value={highestMonth ? formatVND(highestMonth.amount) : "—"}
            note={highestMonth ? mLabel(highestMonth.month) : undefined}
          />
          <StatTile
            label={t("Lowest month", "Tháng thấp nhất")}
            value={lowestMonth ? formatVND(lowestMonth.amount) : "—"}
            note={lowestMonth ? mLabel(lowestMonth.month) : undefined}
          />
        </div>
      </div>

      {/* Xu hướng */}
      <h3 className="c-h3 text-[var(--color-text)] mb-6 mt-8">
        {t("Trends", "Xu hướng")}
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 12 tháng: cột xám, tháng đang chọn màu nhấn + ghi số; đường trung
            bình 12 tháng nét đứt ghi nhãn tại chỗ. */}
        <ChartCard
          title={trendHeadline}
          subtitle={t(
            `Income per month, 12 months to ${selM} · dashed line = 12-month average`,
            `Thu nhập mỗi tháng, 12 tháng tới ${selM} · nét đứt = trung bình 12 tháng`
          )}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...monthAxis(monthlySeries.map((d) => d.name))} />
                <YAxis {...yAxis(money)} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v) => [formatVND(Number(v) || 0), t("Income", "Thu nhập")]}
                  labelFormatter={(l) => mLabel(String(l))}
                />
                {avg12 > 0 && (
                  <ReferenceLine
                    y={avg12}
                    stroke={VIZ.muted}
                    strokeDasharray="4 3"
                    label={{ value: `${t("avg", "TB")} ${money(avg12)}`, position: "insideTopLeft", fontSize: 10, fill: "var(--color-text-faint)" }}
                  />
                )}
                <Bar dataKey="amount" fill={VIZ.muted} {...BAR} label={labelAt(curIdx, money)}>
                  {monthlySeries.map((p, i) => (
                    <Cell key={p.name} fill={i === curIdx ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Theo năm: năm thu nhiều nhất mang màu nhấn; ít cột nên ghi số lên
            từng cột và bỏ trục Y. */}
        <ChartCard
          title={annualHeadline}
          subtitle={t(
            `Total income per calendar year${annualTotals.some((p) => p.name === String(year)) ? ` · ${year} is year to date` : ""}`,
            `Tổng thu nhập mỗi năm${annualTotals.some((p) => p.name === String(year)) ? ` · ${year} tính tới hiện tại` : ""}`
          )}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annualTotals} margin={{ top: 20, right: 4, left: labelEveryYear ? 4 : 0, bottom: 0 }}>
                {!labelEveryYear && <CartesianGrid {...GRID} />}
                <XAxis dataKey="name" {...xAxis} interval={0} />
                {!labelEveryYear && <YAxis {...yAxis(money)} />}
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v) => [formatVND(Number(v) || 0), t("Income", "Thu nhập")]}
                />
                <Bar
                  dataKey="amount"
                  fill={VIZ.muted}
                  {...BAR}
                  label={labelEveryYear ? barLabels(money, bestYearIdx) : labelAt(bestYearIdx, money)}
                >
                  {annualTotals.map((p, i) => (
                    <Cell key={p.name} fill={i === bestYearIdx ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Luỹ kế năm nay đặt cạnh năm ngoái. Tổng năm chỉ nói kết quả khi đã
            hết năm; đường luỹ kế nói đang đi nhanh hay chậm hơn ngay từ giữa
            năm, lúc còn kịp làm gì đó. Nhãn ở đầu mút thay cho chú giải. */}
        <ChartCard
          title={paceHeadline}
          subtitle={t(
            `Cumulative income, Jan to Dec · ${year} against ${year - 1}`,
            `Thu nhập luỹ kế từ tháng 1 · ${year} so với ${year - 1}`
          )}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulative} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis
                  dataKey="name"
                  {...xAxis}
                  interval={0}
                  tickFormatter={(v) => String(Number(v))}
                />
                <YAxis {...yAxis(money)} />
                <Tooltip
                  {...TOOLTIP_LINE}
                  formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                  labelFormatter={(l) => calMonth(String(l), vi)}
                />
                {hasLastYear && (
                  <Line
                    {...LINE}
                    dataKey="lastYear"
                    name={String(year - 1)}
                    stroke={VIZ.muted}
                    connectNulls
                    isAnimationActive={false}
                    label={endLabel(11, (v) => `${year - 1} · ${money(v)}`, thisAbove ? "below" : "above", false)}
                  />
                )}
                <Line
                  {...LINE}
                  dataKey="thisYear"
                  name={String(year)}
                  stroke={VIZ.accent}
                  connectNulls={false}
                  isAnimationActive={false}
                  label={cumIdx >= 0 ? endLabel(cumIdx, (v) => `${year} · ${money(v)}`, thisAbove ? "above" : "below", true) : undefined}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Thưởng Tết và thưởng cuối năm rơi vào tháng cố định. Nhìn một năm thì
            chúng chỉ là cột vọt lên bất thường; gộp mọi năm mới thành quy luật
            — và quy luật đó mới là thứ lập kế hoạch được. */}
        <ChartCard
          title={seasonHeadline}
          subtitle={
            seasonYears >= 2
              ? t(
                  `Average income for each calendar month, ${seasonYears} years of data`,
                  `Trung bình thu nhập từng tháng trong năm, gộp ${seasonYears} năm dữ liệu`
                )
              : t(
                  "Average income for each calendar month · only one year of data, not yet a pattern",
                  "Trung bình thu nhập từng tháng trong năm · mới có một năm dữ liệu, chưa thành quy luật"
                )
          }
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasonality} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...xAxis} interval={0} tickFormatter={(v) => String(Number(v))} />
                <YAxis {...yAxis(money)} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v) => [formatVND(Number(v) || 0), t("Average", "Trung bình")]}
                  labelFormatter={(l) => calMonth(String(l), vi)}
                />
                <Bar
                  dataKey="avg"
                  name={t("Average", "Trung bình")}
                  fill={VIZ.muted}
                  {...BAR}
                  label={seasonTop && seasonTop.avg > 0 ? labelAt(seasonTopIdx, money) : undefined}
                >
                  {seasonality.map((p, i) => (
                    <Cell key={p.name} fill={i === seasonTopIdx && p.avg > 0 ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Cơ cấu nguồn thu theo tháng — trả lời "tháng đó tiền về từ đâu",
            thứ mà một cột tổng không nói được. Nguồn lớn nhất mang màu nhấn
            và nằm sát đáy; các nguồn còn lại xám, tách bằng khe nền. Màu
            danh tính từng công ty nằm ở khối Sự nghiệp — ở đây chỉ một câu
            hỏi: phụ thuộc nguồn chính tới đâu. */}
        <ChartCard
          className="lg:col-span-2"
          title={mixHeadline}
          subtitle={t(
            `Income per month by source, 12 months to ${selM} · hover a column for the split`,
            `Thu nhập mỗi tháng theo nguồn, 12 tháng tới ${selM} · rê vào cột để xem từng nguồn`
          )}
          keys={
            topSource
              ? [
                  { label: topSource, color: VIZ.accent, shape: "bar" },
                  ...(stackOrder.length > 1
                    ? [{ label: t("Other sources", "Các nguồn còn lại"), color: VIZ.muted, shape: "bar" as const }]
                    : []),
                ]
              : undefined
          }
        >
          {sourceKeys.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("No income in the last 12 months.", "12 tháng qua chưa có khoản thu nào.")}
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceMonthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" {...monthAxis(sourceMonthly.map((d) => String(d.name)))} />
                  <YAxis {...yAxis(money)} />
                  <Tooltip
                    {...TOOLTIP}
                    content={
                      <StackedMonthTooltip
                        otherKey={OTHER_SOURCE_KEY}
                        otherLabel={t("Other sources", "Nguồn khác")}
                      />
                    }
                  />
                  {stackOrder.map((key, i) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="src"
                      name={sourceName(key)}
                      fill={key === topSource ? VIZ.accent : VIZ.muted}
                      {...STACK_GAP}
                      maxBarSize={BAR.maxBarSize}
                      radius={i === stackOrder.length - 1 ? BAR.radius : 0}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* So sánh từng nguồn với chính nó của năm ngoái (thanh = năm nay, vạch
            = cả năm ngoái). Nguồn đã dừng hẳn cũng nằm trong danh sách: chỗ hụt
            đi là thứ dễ bỏ sót nhất vì nó không còn dòng nào để nhìn thấy. */}
        <ChartCard
          className="lg:col-span-2"
          title={sourcesHeadline}
          subtitle={t(
            `Each source in ${year} so far · tick = all of ${year - 1}`,
            `Từng nguồn năm ${year} tới nay · vạch = cả năm ${year - 1}`
          )}
          footnote={
            concentration.sourceCount > 1 ? (
              <>
                {t(
                  `Top two sources: ${concentration.topTwoShare}%.`,
                  `Hai nguồn lớn nhất: ${concentration.topTwoShare}%.`
                )}
                {/* Nói thẳng rủi ro phụ thuộc bằng số tiền còn lại, thay vì
                    một chỉ số tập trung mà đọc xong vẫn phải tự diễn giải. */}
                {concentration.topShare >= 50 && (
                  <>
                    {" "}
                    {t(`Without the largest, ${year} income is `, `Mất nguồn lớn nhất thì thu nhập ${year} còn `)}
                    <b className="tabular-nums text-[var(--color-text)]">{formatVND(concentration.withoutTop)}</b>.
                  </>
                )}
              </>
            ) : undefined
          }
        >
          {sourceComparison.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("No income recorded yet.", "Chưa ghi khoản thu nào.")}
            </p>
          ) : (
            <>
              <SeriesKey
                items={[
                  { label: String(year), color: VIZ.muted, shape: "bar" },
                  { label: String(year - 1), color: VIZ.ink, shape: "tick" },
                ]}
              />
              <ul className="-mx-2 flex flex-col">
                {sourceComparison.map((s) => {
                  const isNew = s.prevAmount === 0 && s.amount > 0;
                  const isGone = s.amount === 0 && s.prevAmount > 0;
                  const highlight = s.name === largestSource?.name && s.amount > 0;
                  return (
                    <li
                      key={s.name}
                      className="border-b border-[var(--color-border)] last:border-b-0 px-2 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_9rem] items-center gap-x-4 gap-y-1"
                    >
                      <span className="min-w-0 flex flex-col">
                        <span
                          className={`text-sm truncate ${
                            isGone
                              ? "text-[var(--color-text-faint)]"
                              : highlight
                                ? "font-bold text-[var(--color-text)]"
                                : "text-[var(--color-text)]"
                          }`}
                          title={s.name}
                        >
                          {s.name}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-faint)] truncate">
                          {s.months > 0
                            ? t(
                                `paid in ${s.months} months · avg ${money(s.avgPerActiveMonth)}`,
                                `có thu ${s.months} tháng · BQ ${money(s.avgPerActiveMonth)}`
                              )
                            : null}
                          {s.months > 0 && s.lastMonth ? " · " : null}
                          {s.lastMonth ? t(`last ${mLabel(s.lastMonth)}`, `gần nhất ${mLabel(s.lastMonth)}`) : null}
                        </span>
                      </span>
                      <span className="order-3 col-span-2 md:order-none md:col-span-1">
                        <Bullet
                          now={s.amount}
                          before={s.prevAmount}
                          scale={sourceScale}
                          color={highlight ? VIZ.accent : VIZ.muted}
                        />
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold tabular-nums text-[var(--color-text)]">
                          {formatVND(s.amount)}
                          {s.share > 0 && (
                            <span className="ml-1.5 text-[11px] font-normal text-[var(--color-text-faint)]">{s.share}%</span>
                          )}
                        </span>
                        <span className="block">
                          {isGone ? (
                            <span className="text-[11px] text-[var(--color-text-faint)]">
                              {t(`stopped · ${money(s.prevAmount)} in ${year - 1}`, `đã dừng · ${year - 1} thu ${money(s.prevAmount)}`)}
                            </span>
                          ) : isNew ? (
                            <Delta pct={null} upIsGood vs={t("this year", "năm nay")} />
                          ) : (
                            <Delta pct={s.pct} upIsGood vs={t(`vs ${money(s.prevAmount)}`, `từ ${money(s.prevAmount)}`)} />
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </ChartCard>
      </div>

      <PeriodComparison
        metrics={["income", "net", "count"]}
        refreshKey={refreshKey}
      />
    </div>
  );
}
