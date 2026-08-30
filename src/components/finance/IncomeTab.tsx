"use client";

import { useState, useEffect } from "react";
import {
  Plus, DollarSign, Clock, Users, Tag, Target, TrendingUp, TrendingDown,
  AlertCircle, CalendarX,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import TransactionModal from "./TransactionModal";
import PendingReviewButton from "./PendingReviewButton";
import { thisMonthLocalIso } from "@/lib/localDate";
import PeriodComparison from "./PeriodComparison";

// Toàn bộ số liệu đến từ /api/finance/income.
// Trước đây tab này chạy trên 4 mảng hardcode và cả tên công ty ("SHINHAN
// FINANCE", "MIRAE ASSET") lẫn các ô "Tháng cao nhất" đều là số viết cứng.

interface SeriesPoint { name: string; amount: number }
interface SupplierSlice { name: string; amount: number; share: number }
interface MonthPeak { month: string; amount: number }

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
  largestSource: SupplierSlice | null;
  hasData: boolean;
}

const EMPTY: IncomeData = {
  month: "", year: 0, monthlyIncome: 0, monthlySeries: [], annualTotals: [],
  yearTotal: 0, prevYearTotal: 0, avgPerMonth: 0, prevAvgPerMonth: 0,
  monthsWithIncome: 0, highestMonth: null, lowestMonth: null,
  bySupplier: [], largestSource: null, hasData: false,
};

const formatVND = (amount: number) =>
  new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

export default function IncomeTab() {
  const { t } = useLanguage();
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
              className="c-btn c-btn-success shadow-sm"
            >
              <Plus size={16} /> {t("Add Income", "Thêm thu nhập")}
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
            className="c-btn c-btn-success shadow-sm"
          >
            <Plus size={16} /> {t("Add Income", "Thêm thu nhập")}
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} angle={-35} textAnchor="end" height={50} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `${Math.round(v / 1_000_000)}m`} />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Bar dataKey="amount" fill="#99d8c9" radius={[4, 4, 0, 0]} barSize={20} />
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `${Math.round(v / 1_000_000)}m`} />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Bar dataKey="amount" fill="#74a9cf" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm lg:col-span-2">
          <h3 className="c-h5 text-[var(--color-text)] mb-6">
            {t("Income by Source", "Thu nhập theo nguồn")} — {year}
          </h3>
          {bySupplier.length === 0 ? (
            <div className="text-sm text-[var(--color-text-faint)]">{t("No data", "Chưa có dữ liệu")}</div>
          ) : (
            <div className="space-y-3">
              {bySupplier.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-bold text-[var(--color-text-muted)] truncate">{s.name}</span>
                    <span className="text-xs font-bold text-[var(--color-text)] flex-none ml-3">
                      {formatVND(s.amount)} · {s.share}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-success)] transition-all"
                      style={{ width: `${Math.max(2, (s.amount / maxSupplier) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
