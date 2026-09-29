"use client";

import { useState, useEffect } from "react";
import {
  DollarSign, Clock, Users, Tag, Target, TrendingUp, TrendingDown, ArrowDownLeft,
  AlertCircle, CalendarX,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend,
} from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import TransactionModal from "./TransactionModal";
import PendingReviewButton from "./PendingReviewButton";
import { thisMonthLocalIso } from "@/lib/localDate";
import PeriodComparison from "./PeriodComparison";
import StackedMonthTooltip from "./StackedMonthTooltip";
import { compactMoney } from "@/lib/formatMoney";

// Toàn bộ số liệu đến từ /api/finance/income.
// Trước đây tab này chạy trên 4 mảng hardcode và cả tên công ty ("SHINHAN
// FINANCE", "MIRAE ASSET") lẫn các ô "Tháng cao nhất" đều là số viết cứng.

interface SeriesPoint { name: string; amount: number }
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
  yearTotal: 0, prevYearTotal: 0, avgPerMonth: 0, prevAvgPerMonth: 0,
  monthsWithIncome: 0, highestMonth: null, lowestMonth: null,
  bySupplier: [], sourceComparison: [],
  concentration: { sourceCount: 0, topShare: 0, topTwoShare: 0, withoutTop: 0 },
  sourceMonthly: [], sourceKeys: [],
  largestSource: null, hasData: false,
};

const formatVND = (amount: number) =>
  new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

export default function IncomeTab() {
  const { t, language } = useLanguage();
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
    year, monthlyIncome, monthlySeries, annualTotals, yearTotal, prevYearTotal,
    avgPerMonth, prevAvgPerMonth, highestMonth, lowestMonth, bySupplier,
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

        <div className="flex flex-col items-center justify-center h-80 gap-4 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm">
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

  const maxSupplier = bySupplier[0]?.amount || 1;

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

      {/* Main Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {t("Monthly Income", "Thu nhập tháng")}
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-success)]">{formatVND(monthlyIncome)}</div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-success)] flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {t("Total Income", "Tổng thu nhập")} {year}
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-success)]">{formatVND(yearTotal)}</div>
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {prevYearTotal > 0
              ? `${year - 1}: ${formatVND(prevYearTotal)}`
              : t("no data for previous year", `chưa có dữ liệu năm ${year - 1}`)}
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
              <Users size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {t("Avg Income/Month", "Thu nhập BQ/tháng")} {year}
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)]">{formatVND(avgPerMonth)}</div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
              <Tag size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {t("Avg Income/Month", "Thu nhập BQ/tháng")} {year - 1}
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-text)]">
            {prevAvgPerMonth > 0 ? formatVND(prevAvgPerMonth) : "—"}
          </div>
        </div>
      </div>

      <PeriodComparison
        metrics={["income", "net", "count"]}
        refreshKey={refreshKey}
      />

      {/* Phân tích nguồn thu */}
      <div>
        <h3 className="c-h3 text-[var(--color-text)] mb-6 mt-8">
          {t("Income Analysis", "Phân tích nguồn thu")} — {year}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
                <Target size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Largest Source", "Nguồn thu lớn nhất")}
              </div>
            </div>
            <div className="text-xl font-bold text-[var(--color-text)] tracking-tight truncate">
              {largestSource?.name || "—"}
            </div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">
              {largestSource
                ? t(
                    `accounts for ${largestSource.share}% of ${year} income`,
                    `chiếm ${largestSource.share}% thu nhập năm ${year}`
                  )
                : "—"}
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Highest Month", "Tháng cao nhất")}
              </div>
            </div>
            <div className="text-xl font-bold text-[var(--color-success)] tracking-tight">
              {highestMonth ? formatVND(highestMonth.amount) : "—"}
            </div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{highestMonth?.month || "—"}</div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
                <TrendingDown size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Lowest Month", "Tháng thấp nhất")}
              </div>
            </div>
            <div className="text-xl font-bold text-[var(--color-text)] tracking-tight">
              {lowestMonth ? formatVND(lowestMonth.amount) : "—"}
            </div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{lowestMonth?.month || "—"}</div>
          </div>
        </div>
      </div>

      {/* Xu hướng */}
      <h3 className="c-h3 text-[var(--color-text)] mb-6 mt-8">
        {t("Trends", "Xu hướng")}
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)] mb-6">
            {t("Monthly Income Trend (12 Months)", "Xu hướng thu nhập theo tháng (12 tháng)")}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--color-text-faint)" }} angle={-35} textAnchor="end" height={50} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-text-faint)" }} tickFormatter={(v) => compactMoney(Number(v), language === "vi")} />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Bar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)] mb-6">
            {t("Total Annual Income", "Tổng thu nhập theo năm")}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annualTotals}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-text-faint)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-text-faint)" }} tickFormatter={(v) => compactMoney(Number(v), language === "vi")} />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Bar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cơ cấu nguồn thu theo tháng — trả lời "tháng đó tiền về từ đâu",
            thứ mà một cột tổng không nói được. */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm lg:col-span-2">
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("Income mix by month", "Cơ cấu nguồn thu theo tháng")}
          </h3>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t(
              "columns: what each source brought in · line: the month total",
              "cột: từng nguồn góp bao nhiêu · đường: tổng thu tháng đó"
            )}
          </p>
          {sourceKeys.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("No income in the last 12 months.", "12 tháng qua chưa có khoản thu nào.")}
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sourceMonthly} className="c-chart-multi">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--color-text-faint)" }} angle={-35} textAnchor="end" height={50} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-text-faint)" }} tickFormatter={(v) => compactMoney(Number(v), language === "vi")} width={50} />
                  <Tooltip
                    content={
                      <StackedMonthTooltip
                        otherKey={OTHER_SOURCE_KEY}
                        otherLabel={t("Other sources", "Nguồn khác")}
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  {sourceKeys.map((key, i) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="src"
                      name={key === OTHER_SOURCE_KEY ? t("Other sources", "Nguồn khác") : key}
                      // Màu khúc cột do .c-series-* trong globals.css quyết định;
                      // `fill` ở đây chỉ để tô ô chú giải. Xem chú thích ở
                      // ExpenseTab: luật chung ép mọi cột về --chart-1.
                      className={key === OTHER_SOURCE_KEY ? "c-series-other" : `c-series-${i + 1}`}
                      fill={key === OTHER_SOURCE_KEY ? "var(--color-border-strong)" : `var(--chart-${i + 1})`}
                      stroke="var(--color-surface)"
                      strokeWidth={1}
                      maxBarSize={44}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="total"
                    name={t("Month total", "Tổng tháng")}
                    stroke="var(--color-text)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 2.5, fill: "var(--color-text)" }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* So sánh từng nguồn với chính nó của năm ngoái. Nguồn đã dừng hẳn
            cũng nằm trong danh sách: chỗ hụt đi là thứ dễ bỏ sót nhất vì nó
            không còn dòng nào để nhìn thấy. */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm lg:col-span-2">
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("Source by source", "So sánh từng nguồn thu")} — {year} {t("vs", "so với")} {year - 1}
          </h3>
          {concentration.sourceCount > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-5">
              {t(`${concentration.sourceCount} sources`, `${concentration.sourceCount} nguồn`)}
              {" · "}
              {t(
                `largest is ${concentration.topShare}%`,
                `nguồn lớn nhất chiếm ${concentration.topShare}%`
              )}
              {concentration.sourceCount > 1 &&
                ` · ${t(
                  `top two ${concentration.topTwoShare}%`,
                  `hai nguồn lớn nhất ${concentration.topTwoShare}%`
                )}`}
              {/* Nói thẳng rủi ro phụ thuộc bằng số tiền còn lại, thay vì một
                  chỉ số tập trung mà đọc xong vẫn phải tự diễn giải. */}
              {concentration.topShare >= 50 && (
                <span className="text-[var(--color-warning)]">
                  {" · "}
                  {t(
                    `without it, ${year} income is ${formatVND(concentration.withoutTop)}`,
                    `mất nguồn này thì thu nhập ${year} còn ${formatVND(concentration.withoutTop)}`
                  )}
                </span>
              )}
            </p>
          )}

          {sourceComparison.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("No income recorded yet.", "Chưa ghi khoản thu nào.")}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {sourceComparison.map((s) => {
                const isNew = s.prevAmount === 0 && s.amount > 0;
                const isGone = s.amount === 0 && s.prevAmount > 0;
                return (
                  <li key={s.name} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className={`min-w-0 truncate font-bold ${
                          isGone ? "text-[var(--color-text-faint)]" : "text-[var(--color-text)]"
                        }`}
                        title={s.name}
                      >
                        {s.name}
                      </span>
                      <span className="flex-none tabular-nums font-bold text-[var(--color-text)]">
                        {formatVND(s.amount)}
                        {s.share > 0 && (
                          <span className="ml-2 text-xs font-normal text-[var(--color-text-faint)]">
                            {s.share}%
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--color-success)] transition-all"
                        style={{
                          width: `${maxSupplier > 0 ? Math.max(2, (s.amount / maxSupplier) * 100) : 0}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      {isNew ? (
                        <span className="font-bold text-[var(--color-success)]">
                          {t("new this year", "nguồn mới năm nay")}
                        </span>
                      ) : isGone ? (
                        <span className="font-bold text-[var(--color-warning)]">
                          {t(
                            `stopped — ${formatVND(s.prevAmount)} in ${year - 1}`,
                            `đã dừng — năm ${year - 1} thu ${formatVND(s.prevAmount)}`
                          )}
                        </span>
                      ) : (
                        <span
                          className={
                            s.delta > 0
                              ? "text-[var(--color-success)]"
                              : s.delta < 0
                                ? "text-[var(--color-error)]"
                                : ""
                          }
                        >
                          {s.delta > 0 ? "↗" : s.delta < 0 ? "↘" : "→"}{" "}
                          {s.pct !== null
                            ? `${s.pct > 0 ? "+" : ""}${s.pct}%`
                            : t("unchanged", "không đổi")}{" "}
                          <span className="text-[var(--color-text-faint)]">
                            ({s.delta > 0 ? "+" : ""}
                            {formatVND(s.delta)} {t("vs", "so")} {year - 1})
                          </span>
                        </span>
                      )}

                      {s.months > 0 && (
                        <span>
                          {t(`paid in ${s.months} months`, `có thu ${s.months} tháng`)} ·{" "}
                          {t("avg", "BQ")} {formatVND(s.avgPerActiveMonth)}
                        </span>
                      )}
                      {s.lastMonth && (
                        <span>
                          {t("last", "gần nhất")}: {s.lastMonth}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
