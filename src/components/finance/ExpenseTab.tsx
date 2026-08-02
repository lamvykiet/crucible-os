"use client";

import { Calendar, Plus, CreditCard, Clock, LineChart as LineChartIcon, Tag } from "lucide-react";
import { BarChart, Bar, LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import { useState, useEffect } from "react";
import { CalendarX } from "lucide-react";

interface CategorySlice { name: string; amount: number }
interface SeriesPoint { name: string; amount: number }
interface TransactionInfo { id: string; date: string; supplier: string; amount: number; category: string }

interface ExpenseData {
  monthlyExpense: number;
  avgDailyExpense: number;
  eomForecast: number;
  categoriesCount: number;
  categoryBreakdown: CategorySlice[];
  dailySeries: SeriesPoint[];
  monthlySeries: SeriesPoint[];
  topMerchants: CategorySlice[];
  recentTransactions: TransactionInfo[];
  hasData: boolean;
}

const EMPTY: ExpenseData = {
  monthlyExpense: 0, avgDailyExpense: 0, eomForecast: 0, categoriesCount: 0,
  categoryBreakdown: [], dailySeries: [], monthlySeries: [],
  topMerchants: [], recentTransactions: [], hasData: false,
};

const formatVND = (amount: number) => new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

export default function ExpenseTab() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ExpenseData>(EMPTY);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      try {
        const monthParam = selectedMonth || new Date().toISOString().slice(0, 7);
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
  }, [selectedMonth]);

  const {
    monthlyExpense, avgDailyExpense, eomForecast, categoriesCount,
    categoryBreakdown, dailySeries, monthlySeries,
    topMerchants, recentTransactions, hasData
  } = data;

  const maxCategory = categoryBreakdown[0]?.amount || 1;
  const maxMerchant = topMerchants[0]?.amount || 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{t("Expense", "Chi tiêu")}</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{t("Categories & spending trends", "Danh mục & xu hướng chi tiêu")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 shadow-sm">
            <Plus size={16} /> {t("Add Expense", "Thêm chi tiêu")}
          </button>
        </div>
      </div>

      {/* Main Cards Row */}
      {!hasData && !isLoading ? (
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <CalendarX size={32} />
          </div>
          <p className="text-lg font-bold text-[var(--color-text)]">
            {t("No expenses recorded yet", "Chưa ghi nhận khoản chi tiêu nào trong tháng này")}
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center h-64 text-[var(--color-success)]">
          <span className="animate-spin text-4xl leading-none">⍥</span>
          <span className="ml-3 font-bold">{t("Loading data...", "Đang tải dữ liệu...")}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Monthly Expense", "Chi tiêu tháng")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-warning)] ml-13 pl-13">{formatVND(monthlyExpense)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Avg Daily Expense", "Chi tiêu TB/ngày")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] ml-13 pl-13">{formatVND(avgDailyExpense)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
                  <LineChartIcon size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("End of Month Forecast", "Dự báo cuối tháng")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] ml-13 pl-13">{formatVND(eomForecast)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
                  <Tag size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Categories", "Số danh mục")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] ml-13 pl-13">{categoriesCount}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col">
              <h3 className="font-bold text-[var(--color-text)] mb-6 text-sm">{t("Expense by Category", "Chi tiêu theo nhóm")}</h3>
              {categoryBreakdown.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[var(--color-text-faint)] text-sm">
                  {t("No data available", "Chưa có dữ liệu")}
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {categoryBreakdown.map((c) => (
                    <div key={c.name}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs font-bold text-[var(--color-text-muted)] truncate">{c.name}</span>
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
            
            <div className="md:col-span-2 bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
              <h3 className="font-bold text-[var(--color-text)] mb-6 text-sm">{t("Daily Expense Trend", "Xu hướng chi theo ngày")}</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                    <Line type="monotone" dataKey="amount" stroke="#fb923c" strokeWidth={3} dot={{ r: 3, fill: "#fb923c" }} activeDot={{ r: 6 }} name={t("Expense", "Chi tiêu")} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
            <h3 className="font-bold text-[var(--color-text)] mb-6 text-sm">{t("Monthly Expense Trend (12 Months)", "Xu hướng chi theo tháng (12 tháng)")}</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} angle={-35} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} tickFormatter={(value) => `${Math.round(value/1_000_000)}m`} />
                  <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                  <Bar dataKey="amount" fill="#fb923c" radius={[4, 4, 0, 0]} barSize={40} name={t("Expense", "Chi tiêu")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
              <h3 className="font-bold text-[var(--color-text)] mb-4 text-sm">{t("Top Merchants", "Top nhà cung cấp")}</h3>
              {topMerchants.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-sm">{t("No data available.", "Chưa có dữ liệu.")}</p>
              ) : (
                <div className="space-y-4 mt-4">
                  {topMerchants.map(m => (
                    <div key={m.name}>
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs font-bold text-[var(--color-text-muted)] truncate">{m.name}</span>
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
              <h3 className="font-bold text-[var(--color-text)] mb-4 text-sm">{t("Recent Transactions", "Giao dịch chi tiêu gần đây")}</h3>
              {recentTransactions.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-sm">{t("No expenses this month.", "Chưa có giao dịch chi tiêu tháng này.")}</p>
              ) : (
                <div className="space-y-3 mt-4">
                  {recentTransactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-border)]">
                      <div>
                        <div className="text-sm font-bold text-[var(--color-text)]">{t.supplier}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">{t.date} · {t.category}</div>
                      </div>
                      <div className="text-sm font-bold text-[var(--color-warning)]">{formatVND(t.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
