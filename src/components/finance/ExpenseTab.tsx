"use client";

import { Calendar, Plus, CreditCard, LineChart as LineChartIcon, Tag, Receipt, ChevronDown, AlertCircle, ListChecks } from "lucide-react";
import { BarChart, Bar, LineChart as RechartsLineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import { useState, useEffect } from "react";
import { CalendarX } from "lucide-react";
import TransactionModal from "./TransactionModal";
import ScanInvoiceModal from "./ScanInvoiceModal";
import PendingReviewButton from "./PendingReviewButton";
import DayTransactionsCard from "./DayTransactionsCard";
import IncompleteDataModal from "./IncompleteDataModal";
import PeriodComparison from "./PeriodComparison";
import { thisMonthLocalIso } from "@/lib/localDate";

interface CategorySlice { name: string; amount: number }
interface SeriesPoint { name: string; amount: number }
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
  dailySeries: SeriesPoint[];
  monthlySeries: SeriesPoint[];
  topMerchants: CategorySlice[];
  recentTransactions: TransactionInfo[];
  hasData: boolean;
}

const EMPTY: ExpenseData = {
  totals: { day: 0, month: 0, year: 0 },
  categoryBreakdowns: { day: [], month: [], year: [] },
  avgDailyExpense: 0, eomForecast: 0, categoriesCount: 0,
  dailySeries: [], monthlySeries: [],
  topMerchants: [], recentTransactions: [], hasData: false,
};

const formatVND = (amount: number) => new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

// Colors for the donut chart
const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f43f5e', '#f59e0b', '#64748b', '#84cc16'];

export default function ExpenseTab() {
  const { t } = useLanguage();
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
    dailySeries, monthlySeries,
    topMerchants, recentTransactions, hasData
  } = data;

  const currentTotal = totals[timeRange] || 0;
  const currentCategoryBreakdown = categoryBreakdowns[timeRange] || [];
  const maxMerchant = topMerchants[0]?.amount || 1;

  const getRangeLabel = () => {
    if (timeRange === "day") return t("Daily Expense", "Chi tiêu ngày");
    if (timeRange === "year") return t("Yearly Expense", "Chi tiêu năm");
    return t("Monthly Expense", "Chi tiêu tháng");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="c-h2 text-[var(--color-text)]">{t("Expense", "Chi tiêu")}</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{t("Categories & spending trends", "Danh mục & xu hướng chi tiêu")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="c-btn c-btn-accent shadow-sm"
          >
            <Plus size={16} /> {t("Add Expense", "Thêm chi tiêu")}
          </button>
          <button 
            onClick={() => setIsScanModalOpen(true)}
            className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Receipt size={16} className="text-[var(--color-success)]" /> {t("Scan Invoice", "Quét hóa đơn")}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center flex-none">
                    <CreditCard size={20} />
                  </div>
                  <div className="relative group">
                    <select 
                      value={timeRange} 
                      onChange={(e) => setTimeRange(e.target.value as any)}
                      className="appearance-none bg-transparent text-base md:text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] uppercase tracking-wider focus:outline-none cursor-pointer pr-4"
                    >
                      <option value="day">{t("Daily Expense", "Chi tiêu ngày")}</option>
                      <option value="month">{t("Monthly Expense", "Chi tiêu tháng")}</option>
                      <option value="year">{t("Yearly Expense", "Chi tiêu năm")}</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none group-hover:text-[var(--color-text)]" />
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-warning)] truncate">{formatVND(currentTotal)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Avg Daily Expense", "Chi tiêu TB/ngày")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)]">{formatVND(avgDailyExpense)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
                  <LineChartIcon size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("End of Month Forecast", "Dự báo cuối tháng")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)]">{formatVND(eomForecast)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
                  <Tag size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Categories", "Số danh mục")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)]">{categoriesCount}</div>
            </div>
          </div>

          <PeriodComparison
            metrics={["expense", "cashOut", "debtService", "count"]}
            refreshKey={refreshKey}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col">
              <h3 className="c-h5 text-[var(--color-text)] mb-2">{t("Expense by Category", "Chi tiêu theo nhóm")}</h3>
              <p className="text-xs text-[var(--color-text-faint)] mb-6">({getRangeLabel()})</p>
              
              <div className="h-64 w-full flex-1 relative">
                {currentCategoryBreakdown.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full border-[12px] border-[var(--color-surface-2)] flex items-center justify-center">
                      <span className="text-4xl font-bold text-[var(--color-surface-2)]">0</span>
                    </div>
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currentCategoryBreakdown.length > 0 ? currentCategoryBreakdown : [{ name: "Empty", amount: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="amount"
                      nameKey="name"
                      stroke="none"
                      fill={currentCategoryBreakdown.length > 0 ? undefined : "transparent"}
                    >
                      {currentCategoryBreakdown.length > 0 && currentCategoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    {currentCategoryBreakdown.length > 0 && (
                      <Tooltip 
                        formatter={(value) => formatVND(Number(value))}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    )}
                    {currentCategoryBreakdown.length > 0 && (
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="md:col-span-2 bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
              <h3 className="c-h5 text-[var(--color-text)] mb-6">{t("Daily Expense Trend", "Xu hướng chi theo ngày")}</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={50} />
                    <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                    <Line type="monotone" dataKey="amount" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3, fill: "#f43f5e" }} activeDot={{ r: 6 }} name={t("Expense", "Chi tiêu")} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
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
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
            <h3 className="c-h5 text-[var(--color-text)] mb-6">{t("Monthly Expense Trend (12 Months)", "Xu hướng chi theo tháng (12 tháng)")}</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} angle={-35} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} tickFormatter={(value) => `${Math.round(value/1_000_000)}m`} width={50} />
                  <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                  <Bar dataKey="amount" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} name={t("Expense", "Chi tiêu")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
              <h3 className="c-h5 text-[var(--color-text)] mb-4">{t("Top Merchants", "Top nhà cung cấp")}</h3>
              {topMerchants.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-sm">{t("No data available.", "Chưa có dữ liệu.")}</p>
              ) : (
                <div className="space-y-4 mt-4">
                  {topMerchants.map(m => (
                    <div key={m.name}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="min-w-0 text-xs font-bold text-[var(--color-text-muted)] break-words">{m.name}</span>
                        <span className="text-xs font-bold text-[var(--color-text)] flex-none ml-3">{formatVND(m.amount)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-info)] transition-all"
                          style={{ width: `${Math.max(2, (m.amount / maxMerchant) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm md:col-span-2">
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
                <div className="space-y-3 mt-4">
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
                          <div className="shrink-0 text-sm font-bold text-[var(--color-warning)] tabular-nums">{formatVND(tx.amount)}</div>
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
