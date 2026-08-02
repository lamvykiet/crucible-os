"use client";

import { Plus, CreditCard, Clock, Tag, Settings, PieChart } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import { useState, useEffect } from "react";
import { CalendarX } from "lucide-react";
import DebtModal from "./DebtModal";

interface DebtInfo {
  id: string;
  name: string;
  startDate: string;
  principal: number;
  remaining: number;
  monthlyPayment: number;
  interestRate: number;
  dueDate: string;
  remainingMonths: number;
  paidPercentage: number;
  type: string;
}

interface DueItem {
  name: string;
  type: string;
  day: number;
  amount: number;
}

interface DebtsData {
  totalOutstanding: number;
  monthlyPayment: number;
  principalPaid: number;
  active: number;
  settled: number;
  dueThisMonth: DueItem[];
  debtsList: DebtInfo[];
  hasData: boolean;
}

const EMPTY: DebtsData = {
  totalOutstanding: 0,
  monthlyPayment: 0,
  principalPaid: 0,
  active: 0,
  settled: 0,
  dueThisMonth: [],
  debtsList: [],
  hasData: false,
};

const formatVND = (amount: number) => new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

export default function DebtsTab() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [refreshKey, setRefreshKey] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DebtsData>(EMPTY);
  
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      try {
        const monthParam = selectedMonth || new Date().toISOString().slice(0, 7);
        const res = await fetch(`/api/finance/debts?month=${monthParam}`, { signal: controller.signal });
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
    totalOutstanding, monthlyPayment, principalPaid, active, settled,
    dueThisMonth, debtsList, hasData
  } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{t("Debts & Loans", "Nợ & Khoản vay")}</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{t("Mortgage, auto loan, and other debts", "Vay mua nhà, mua xe và các khoản nợ khác")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button 
            onClick={() => setIsDebtModalOpen(true)}
            className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} /> {t("Add Debt", "Thêm khoản nợ")}
          </button>
        </div>
      </div>

      <DebtModal 
        isOpen={isDebtModalOpen} 
        onClose={() => setIsDebtModalOpen(false)} 
        onSuccess={() => setRefreshKey(prev => prev + 1)} 
      />

      {/* Main Cards Row */}
      {!hasData && !isLoading ? (
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <CalendarX size={32} />
          </div>
          <p className="text-lg font-bold text-[var(--color-text)]">
            {t("No debts recorded yet", "Chưa ghi nhận khoản nợ nào trong hệ thống")}
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
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Total Outstanding", "Tổng dư nợ")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-warning)] ml-13 pl-13">{formatVND(totalOutstanding)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-warning)] flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Monthly Payment", "Trả hàng tháng")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] ml-13 pl-13">{formatVND(monthlyPayment)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center">
                  <Tag size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Principal Paid", "Đã trả (gốc)")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-success)] ml-13 pl-13">{formatVND(principalPaid)}</div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-success)] flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Active / Settled", "Đang hoạt động / Đã tất toán")}</div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] ml-13 pl-13">{active} / {settled}</div>
            </div>
          </div>

          {/* Charts & Due Dates Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col">
              <h3 className="font-bold text-[var(--color-text)] mb-6 text-sm">{t("Debt by Type", "Dư nợ theo loại")}</h3>
              <div className="flex-1 flex items-center justify-center text-[var(--color-text-faint)] text-sm">
                 {t("No data available", "Chưa có dữ liệu")}
              </div>
            </div>
            
            <div className="md:col-span-2 bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
              <h3 className="font-bold text-[var(--color-text)] mb-6 text-sm">{t("Due This Month", "Sắp đến hạn tháng này")}</h3>
              {dueThisMonth.length === 0 ? (
                <div className="text-sm text-[var(--color-text-faint)] mt-4">{t("No debts due this month", "Không có khoản nợ nào đến hạn trong tháng này")}</div>
              ) : (
                <div className="space-y-4">
                  {dueThisMonth.map((due, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-[var(--color-border)] border-dashed">
                      <div className="flex items-center gap-4">
                        <div className="text-xs text-[var(--color-text-faint)] font-mono">{t("Day", "Ngày")} {due.day}</div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text)]">{due.name}</div>
                          <div className="text-xs text-[var(--color-text-faint)]">{due.type}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-[var(--color-warning)]">{formatVND(due.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Danh sách khoản nợ */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm mt-8">
            <h3 className="font-bold text-[var(--color-text)] mb-6 text-sm">{t("Debt List", "Danh sách khoản nợ")}</h3>
            
            <div className="space-y-6">
              {debtsList.length === 0 ? (
                <div className="text-sm text-[var(--color-text-faint)]">{t("No debts available", "Chưa có danh sách nợ")}</div>
              ) : (
                debtsList.map(debt => (
                  <div key={debt.id} className="border border-[var(--color-border)] rounded-xl p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="bg-[var(--color-success-tint)] text-[var(--color-success)] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider mb-2 inline-block">{debt.type}</span>
                        <h4 className="font-bold text-[var(--color-text)] text-lg">{debt.name}</h4>
                        <p className="text-xs text-[var(--color-text-faint)] mt-1">{t("started", "bắt đầu")} {debt.startDate}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[var(--color-warning)] text-lg">{formatVND(debt.remaining)}</div>
                        <div className="text-xs text-[var(--color-text-faint)] mt-1">/ {t("principal", "gốc")} {formatVND(debt.principal)}</div>
                      </div>
                    </div>

                    <div className="w-full bg-[var(--color-surface-2)] rounded-full h-1.5 mb-6">
                      <div className="bg-[var(--color-success)] h-1.5 rounded-full" style={{ width: `${debt.paidPercentage}%` }}></div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--color-text-muted)] mb-6 border-b border-[var(--color-border)] pb-4">
                      <div>{t("Monthly Payment:", "Trả hàng tháng:")} <strong className="text-[var(--color-text)]">{formatVND(debt.monthlyPayment)}</strong></div>
                      <div>{t("Interest Rate:", "Lãi suất:")} <strong className="text-[var(--color-text)]">{debt.interestRate}%/{t("yr", "năm")}</strong></div>
                      <div>{t("Due Date:", "Đến hạn:")} <strong className="text-[var(--color-text)]">{t("day", "ngày")} {debt.dueDate}</strong></div>
                      <div>{t("Remaining:", "Còn")} <strong className="text-[var(--color-text)]">~{debt.remainingMonths} {t("months", "tháng")}</strong></div>
                      <div>{t("Paid:", "Đã trả:")} <strong className="text-[var(--color-text)]">{debt.paidPercentage}%</strong></div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white c-btn-sm rounded-md shadow-sm">{t("Record Payment", "Ghi nhận thanh toán")}</button>
                      <button className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] c-btn-sm rounded-md">{t("Schedule", "Lịch trả nợ")}</button>
                      <button className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] c-btn-sm rounded-md">{t("Edit", "Sửa")}</button>
                      <button className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] c-btn-sm rounded-md">{t("Mark as Settled", "Đánh dấu đã tất toán")}</button>
                      <button className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-error)] hover:bg-[var(--color-error-tint)] c-btn-sm rounded-md">{t("Delete", "Xóa")}</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
