"use client";

import { useState, useEffect } from "react";
import {
  Calendar, Receipt, DollarSign, CreditCard, ArrowLeftRight, Target,
  Clock, PieChart, AlertCircle, TrendingUp, CalendarX,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import TransactionModal from "./TransactionModal";
import ScanInvoiceModal from "./ScanInvoiceModal";
import PendingReviewButton from "./PendingReviewButton";
import { Plus } from "lucide-react";

// Mọi con số trên trang này đến từ /api/finance/dashboard.
// Trước đây `dailyData` và `ytdData` là hai mảng hardcode nuôi 2 biểu đồ chính,
// nên biểu đồ không hề đổi khi người dùng chọn tháng khác.

interface DailyPoint { name: string; expense: number; ma7: number }
interface YtdPoint {
  name: string; income: number; expense: number;
  cumulativeIncome: number; cumulativeExpense: number;
}
interface CategorySlice { group: string; amount: number }
interface BudgetRow { group: string; budget: number; actual: number; remaining: number }

interface DashboardData {
  month: string;
  monthlyIncome: number;
  monthlyExpense: number;
  netCashFlow: number;
  savingsRate: number;
  dailyIncome: number;
  dailyExpense: number;
  dailyCashFlow: number;
  avgDailyExpense: number;
  eomForecast: number;
  dailySeries: DailyPoint[];
  ytdSeries: YtdPoint[];
  categoryBreakdown: CategorySlice[];
  budgetVsActual: BudgetRow[];
  totalBudget: number;
  totalActualExpense: number;
  transactionCount: number;
  hasData: boolean;
  latestMonthWithData: string | null;
  elapsedDays: number;
  daysInMonth: number;
  unclassified: { type: string; count: number }[];
}

const EMPTY: DashboardData = {
  month: "", monthlyIncome: 0, monthlyExpense: 0, netCashFlow: 0, savingsRate: 0,
  dailyIncome: 0, dailyExpense: 0, dailyCashFlow: 0, avgDailyExpense: 0, eomForecast: 0,
  dailySeries: [], ytdSeries: [], categoryBreakdown: [], budgetVsActual: [],
  totalBudget: 0, totalActualExpense: 0, transactionCount: 0, hasData: false,
  latestMonthWithData: null, elapsedDays: 0, daysInMonth: 0, unclassified: [],
};

const formatVND = (amount: number) =>
  new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function DashboardTab() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<"api" | "network" | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [transactionType, setTransactionType] = useState<"Expense" | "Income" | "Transfer">("Expense");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDashboardData = async () => {
      setIsLoading(true);
      setErrorCode(null);
      setApiMessage(null);
      try {
        const monthParam = selectedMonth || new Date().toISOString().slice(0, 7);
        const res = await fetch(`/api/finance/dashboard?month=${monthParam}`, {
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

    fetchDashboardData();
    return () => controller.abort();
  }, [selectedMonth, refreshKey]);

  const {
    monthlyIncome, monthlyExpense, netCashFlow, savingsRate,
    dailyIncome, dailyExpense, dailyCashFlow, avgDailyExpense, eomForecast,
    dailySeries, ytdSeries, categoryBreakdown, budgetVsActual,
    totalBudget, hasData, latestMonthWithData, elapsedDays, unclassified,
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
            : apiMessage ||
              t("Could not load dashboard data.", "Không tải được dữ liệu dashboard.")}
        </p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-8 animate-in fade-in">
        {/* Trước là `flex justify-between items-center` không có biến thể mobile:
            trên màn hẹp tiêu đề bị ép còn vài ký tự mỗi dòng và nhóm nút đè lên
            nó. Xếp chồng dưới 768px, giống các tab Expense/Debts. */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h3 className="c-h3 text-[var(--color-text)]">Dashboard</h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{t("Your financial overview", "Tổng quan tài chính")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            <button 
              onClick={() => {
                setTransactionType("Income");
                setIsTransactionModalOpen(true);
              }}
              className="c-btn c-btn-success shadow-sm"
            >
              <Plus size={16} /> {t("Add Income", "Thu nhập")}
            </button>
            <button 
              onClick={() => {
                setTransactionType("Expense");
                setIsTransactionModalOpen(true);
              }}
              className="c-btn c-btn-accent shadow-sm"
            >
              <Plus size={16} /> {t("Add Expense", "Chi phí")}
            </button>
            <button 
              onClick={() => setIsScanModalOpen(true)}
              className="c-btn c-btn-secondary shadow-sm"
            >
              <Receipt size={16} className="text-[var(--color-success)]" /> {t("Scan Invoice", "Quét hóa đơn")}
            </button>
            <PendingReviewButton refreshKey={refreshKey} onProcessed={() => setRefreshKey(prev => prev + 1)} />
          </div>
        </div>
        
        <TransactionModal 
          isOpen={isTransactionModalOpen}
          onClose={() => {
            setIsTransactionModalOpen(false);
            setScannedData(null);
          }}
          onSuccess={() => setRefreshKey(prev => prev + 1)}
          defaultType={transactionType}
          initialData={scannedData}
        />
        <ScanInvoiceModal 
          isOpen={isScanModalOpen} 
          onClose={() => setIsScanModalOpen(false)} 
          onSuccess={() => {
            setIsScanModalOpen(false);
            setRefreshKey(prev => prev + 1);
          }} 
        />
        
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <CalendarX size={32} />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--color-text)]">
              {t("No transactions this month", "Chưa có giao dịch trong tháng này")}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {selectedMonth}
              {" — "}
              {t(
                "nothing has been imported for this period yet.",
                "chưa import dữ liệu cho kỳ này."
              )}
            </p>
          </div>
          {latestMonthWithData && latestMonthWithData !== selectedMonth && (
            <button
              onClick={() => setSelectedMonth(latestMonthWithData)}
              className="mt-2 bg-[var(--color-success-tint)] text-[var(--color-success)] hover:bg-[color-mix(in_srgb,var(--color-success)_24%,transparent)] rounded-full px-5 py-2.5 text-sm font-bold transition-colors shadow-sm"
            >
              {t("Go to", "Xem tháng")} {latestMonthWithData}
            </button>
          )}
        </div>
      </div>
    );
  }

  const budgetUsedPct =
    totalBudget > 0 ? Math.round((monthlyExpense / totalBudget) * 100) : null;
  const maxCategory = categoryBreakdown[0]?.amount || 1;

  // Heatmap theo thứ trong tuần, dựng từ chính dailySeries (dữ liệu thật).
  const [yearStr, monthStr] = (selectedMonth || data.month).split("-");
  const heatmap = dailySeries.map((d) => {
    const day = parseInt(d.name, 10);
    const weekday = new Date(
      Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, day)
    ).getUTCDay();
    return { day, weekday, expense: d.expense };
  });
  const maxDaily = Math.max(1, ...heatmap.map((h) => h.expense));
  const weeks: (typeof heatmap[number] | null)[][] = [];
  {
    let week: (typeof heatmap[number] | null)[] = new Array(7).fill(null);
    for (const cell of heatmap) {
      if (cell.weekday === 0 && week.some(Boolean)) {
        weeks.push(week);
        week = new Array(7).fill(null);
      }
      week[cell.weekday] = cell;
    }
    if (week.some(Boolean)) weeks.push(week);
  }

  const overBudget = budgetVsActual.filter((b) => b.remaining < 0);

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Xem chú thích ở nhánh "chưa có dữ liệu" phía trên — cùng một header. */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h3 className="c-h3 text-[var(--color-text)]">Dashboard</h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t("Your financial overview", "Tổng quan tài chính")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button 
            onClick={() => {
              setTransactionType("Income");
              setIsTransactionModalOpen(true);
            }}
            className="c-btn c-btn-success shadow-sm"
          >
            <Plus size={16} /> {t("Add Income", "Thu nhập")}
          </button>
          <button 
            onClick={() => {
              setTransactionType("Expense");
              setIsTransactionModalOpen(true);
            }}
            className="c-btn c-btn-accent shadow-sm"
          >
            <Plus size={16} /> {t("Add Expense", "Chi phí")}
          </button>
          <button 
            onClick={() => setIsScanModalOpen(true)}
            className="c-btn c-btn-secondary shadow-sm"
          >
            <Receipt size={16} className="text-[var(--color-success)]" /> {t("Scan Invoice", "Quét hóa đơn")}
          </button>
          <PendingReviewButton refreshKey={refreshKey} onProcessed={() => setRefreshKey(prev => prev + 1)} />
        </div>
      </div>

      <TransactionModal 
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setScannedData(null);
        }}
        onSuccess={() => setRefreshKey(prev => prev + 1)}
        defaultType={transactionType}
        initialData={scannedData}
      />
      <ScanInvoiceModal 
        isOpen={isScanModalOpen} 
        onClose={() => setIsScanModalOpen(false)} 
        onSuccess={() => {
          setIsScanModalOpen(false);
          setRefreshKey(prev => prev + 1);
        }} 
      />

      {/* Main Cards Row 1 */}
      {/* md:grid-cols-4 cũ ép mỗi thẻ còn 96px ở 768px (số tiền cần 155px) vì
          vùng nội dung tablet chỉ rộng ~440px sau khi trừ sidebar 248px. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Monthly Income", "Thu nhập tháng")}</div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-success)]">{formatVND(monthlyIncome)}</div>
        </div>
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
              <CreditCard size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Monthly Expense", "Chi tiêu tháng")}</div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-warning)]">{formatVND(monthlyExpense)}</div>
        </div>
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center">
              <ArrowLeftRight size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Net Cash Flow", "Dòng tiền ròng")}</div>
          </div>
          <div className={`text-2xl font-bold ${netCashFlow < 0 ? "text-[var(--color-error)]" : "text-[var(--color-info)]"}`}>
            {formatVND(netCashFlow)}
          </div>
        </div>
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
              <Target size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Actual vs Budget (BVA)</div>
          </div>
          {budgetUsedPct === null ? (
            <>
              <div className="text-2xl font-bold text-[var(--color-text)]">—</div>
              <div className="text-xs text-[var(--color-text-faint)] mt-1">{t("no budget set", "chưa đặt ngân sách tháng")}</div>
            </>
          ) : (
            <>
              <div className={`text-2xl font-bold ${budgetUsedPct > 100 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"}`}>
                {budgetUsedPct}%
              </div>
              <div className="text-xs text-[var(--color-text-faint)] mt-1">
                {formatVND(monthlyExpense)} / {formatVND(totalBudget)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* md:grid-cols-4 cũ ép mỗi thẻ còn 96px ở 768px (số tiền cần 155px) vì
          vùng nội dung tablet chỉ rộng ~440px sau khi trừ sidebar 248px. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
              <PieChart size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Savings Rate", "Tỷ lệ tiết kiệm")}</div>
          </div>
          {/* Không kẹp về 0 nữa — tháng bội chi phải nhìn thấy được */}
          <div className={`text-2xl font-bold ${savingsRate < 0 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"}`}>
            {savingsRate}%
          </div>
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {savingsRate < 0
              ? t("overspending this month", "tháng này chi vượt thu")
              : t("retained income", "phần thu nhập giữ lại")}
          </div>
        </div>
      </div>

      {/* Chỉ số hôm nay */}
      <div>
        <h3 className="c-h3 text-[var(--color-text)] flex items-center gap-3 mb-6">
          <Calendar size={24} /> {t("Today's Metrics", "Chỉ số hôm nay")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
                <DollarSign size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Daily Income", "Thu nhập ngày")}</div>
            </div>
            <div className="text-lg font-bold text-[var(--color-success)]">{formatVND(dailyIncome)}</div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{t("today", "hôm nay")}</div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
                <CreditCard size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Daily Expense", "Chi tiêu ngày")}</div>
            </div>
            <div className="text-lg font-bold text-[var(--color-warning)]">{formatVND(dailyExpense)}</div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{t("today", "hôm nay")}</div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center">
                <ArrowLeftRight size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Daily Cash Flow", "Dòng tiền ngày")}</div>
            </div>
            <div className={`text-lg font-bold ${dailyCashFlow < 0 ? "text-[var(--color-error)]" : "text-[var(--color-info)]"}`}>
              {formatVND(dailyCashFlow)}
            </div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{t("today", "hôm nay")}</div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
                <Calendar size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Avg Daily Expense", "Chi tiêu TB/Ngày")}</div>
            </div>
            <div className="text-lg font-bold text-[var(--color-text)]">{formatVND(avgDailyExpense)}</div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">
              {t("over", "qua")} {elapsedDays} {t("days", "ngày")}
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("End of Month Forecast", "Dự báo chi cuối tháng")}</div>
            </div>
            <div className="text-lg font-bold text-[var(--color-text)]">{formatVND(eomForecast)}</div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{t("at current rate", "theo nhịp chi hiện tại")}</div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)] mb-6">
            {t("Daily Spending Trend (with 7-day MA)", "Xu hướng chi theo ngày (Kèm MA 7-ngày)")}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Line type="monotone" dataKey="expense" stroke="#5eead4" strokeWidth={3} dot={{ r: 3, fill: "#5eead4" }} activeDot={{ r: 6 }} name={t("Daily Expense", "Chi tiêu hằng ngày")} />
                <Line type="monotone" dataKey="ma7" stroke="#fb923c" strokeWidth={2} dot={false} name="7-day MA" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)] mb-6">
            {t("Weekly Spending Heatmap", "Nhiệt đồ chi tiêu theo tuần")}
          </h3>
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-7 gap-1.5 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-[10px] font-bold text-[var(--color-text-faint)] text-center">{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5">
                {week.map((cell, ci) => {
                  if (!cell) return <div key={ci} className="aspect-square rounded-md bg-[var(--color-surface-2)]" />;
                  const intensity = cell.expense / maxDaily;
                  return (
                    <div
                      key={ci}
                      title={`${cell.day}: ${formatVND(cell.expense)}`}
                      className="aspect-square rounded-md flex items-center justify-center text-[9px] font-bold transition-transform hover:scale-110 cursor-default"
                      style={{
                        backgroundColor:
                          cell.expense > 0
                            ? `rgba(251, 146, 60, ${0.15 + intensity * 0.85})`
                            : "#f9fafb",
                        color: intensity > 0.5 ? "#fff" : "#9ca3af",
                      }}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)] mb-6">
            {t("12-Month Cumulative Income vs Expense", "Luỹ kế Thu / Chi 12 tháng")}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ytdSeries}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `${Math.round(v / 1_000_000)}m`} />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Area type="monotone" dataKey="cumulativeIncome" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" name={t("Cumulative Income", "Luỹ kế Thu")} />
                <Area type="monotone" dataKey="cumulativeExpense" stroke="#fb923c" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" name={t("Cumulative Expense", "Luỹ kế Chi")} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)] mb-6">
            {t("Expense Distribution", "Phân bổ chi tiêu")}
          </h3>
          {categoryBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-[var(--color-text-faint)] text-sm">
              {t("No expenses this month", "Chưa có chi tiêu trong tháng")}
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {categoryBreakdown.map((c) => (
                <div key={c.group}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-bold text-[var(--color-text-muted)] truncate">{c.group}</span>
                    <span className="text-xs font-bold text-[var(--color-text)] flex-none ml-3">{formatVND(c.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-warning)] transition-all"
                      style={{ width: `${Math.max(2, (c.amount / maxCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Widgets Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col">
          <h3 className="c-h5 text-[var(--color-text)] mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-[var(--color-success)]" /> {t("Alerts & Insights", "Cảnh báo & Gợi ý")}
          </h3>
          <div className="space-y-3">
            {overBudget.map((b) => (
              <div key={b.group} className="bg-[var(--color-error-tint)] border border-[var(--color-error)] text-[var(--color-error)] rounded-xl p-4 text-sm font-medium flex items-center gap-3">
                <Target size={16} className="flex-none" />
                <span>
                  <b>{b.group}</b> {t("is over budget by", "vượt ngân sách")} {formatVND(-b.remaining)}
                </span>
              </div>
            ))}
            {savingsRate < 0 && (
              <div className="bg-[var(--color-warning-tint)] border border-[var(--color-warning)] text-[var(--color-warning)] rounded-xl p-4 text-sm font-medium flex items-center gap-3">
                <TrendingUp size={16} className="flex-none" />
                {t("Spending exceeded income this month.", "Tháng này chi vượt thu.")}
              </div>
            )}
            {unclassified.length > 0 && (
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-xl p-4 text-sm font-medium flex items-center gap-3">
                <Receipt size={16} className="flex-none" />
                {t("Not counted as income/expense:", "Không tính vào thu/chi:")}{" "}
                {unclassified.map((u) => `${u.type} (${u.count})`).join(", ")}
              </div>
            )}
            {overBudget.length === 0 && savingsRate >= 0 && unclassified.length === 0 && (
              <div className="bg-[var(--color-success-tint)] border border-[var(--color-success)] text-[var(--color-success)] rounded-xl p-4 text-sm font-medium">
                {t("Everything looks healthy this month.", "Tháng này mọi chỉ số đều ổn.")}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col">
          <h3 className="c-h5 text-[var(--color-text)] mb-4 flex items-center gap-2">
            <Clock size={18} className="text-[var(--color-success)]" /> {t("Budget Tracking", "Theo dõi Ngân sách")}
          </h3>
          {budgetVsActual.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)]">
              {t("No monthly budget set.", "Chưa đặt ngân sách cho tháng này.")}
            </div>
          ) : (
            <div className="space-y-4">
              {budgetVsActual.map((b) => {
                const pct = b.budget > 0 ? Math.min(100, (b.actual / b.budget) * 100) : 0;
                const over = b.remaining < 0;
                return (
                  <div key={b.group}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-bold text-[var(--color-text-muted)]">{b.group}</span>
                      <span className={`text-xs font-bold ${over ? "text-[var(--color-error)]" : "text-[var(--color-text)]"}`}>
                        {formatVND(b.actual)} / {formatVND(b.budget)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? "bg-[var(--color-error)]" : "bg-[var(--color-success)]"}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
