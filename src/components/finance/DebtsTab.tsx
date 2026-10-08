"use client";

import { Plus } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import { useState, useEffect } from "react";
import { CalendarX } from "lucide-react";
import DebtModal from "./DebtModal";
import DebtScheduleModal from "./DebtScheduleModal";
import { thisMonthLocalIso } from "@/lib/localDate";
import PeriodComparison from "./PeriodComparison";
import DebtOverview from "./DebtOverview";
import { formatVND } from "@/lib/formatMoney";
import { VIZ } from "@/lib/viz";

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

export default function DebtsTab() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => thisMonthLocalIso());
  const [refreshKey, setRefreshKey] = useState(0);
  const [scheduleFor, setScheduleFor] = useState<{ id: string; name: string; filter: "all" | "projected" } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DebtsData>(EMPTY);
  
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      try {
        const monthParam = selectedMonth || thisMonthLocalIso();
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

  // Bốn ô tổng cũ (dư nợ, trả hàng tháng, đã trả gốc, đang/đã tất toán) nay do
  // `DebtOverview` lo, và nó đọc thẳng lịch trả nợ nên nói được cả ngày hết nợ
  // lẫn tiền lãi còn phải trả — hai thứ bốn ô kia không có.
  const { dueThisMonth, debtsList, hasData } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="c-h2 c-page-title text-[var(--color-text)]">{t("Debts & Loans", "Nợ & Khoản vay")}</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{t("Mortgage, auto loan, and other debts", "Vay mua nhà, mua xe và các khoản nợ khác")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button 
            onClick={() => setIsDebtModalOpen(true)}
            aria-label={t("Add Debt", "Thêm khoản nợ")}
            title={t("Add Debt", "Thêm khoản nợ")}
            className="c-btn c-btn-primary shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
          >
            <Plus size={16} /> <span className="hidden md:inline">{t("Add Debt", "Thêm khoản nợ")}</span>
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
        <div className="flex flex-col items-center justify-center h-80 gap-4 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)]">
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
          {/* Bức tranh nợ trước, chi tiết từng khoản sau. Màn hình cũ mở lên
              là bốn ô số rồi một bảng rồi một danh sách — đúng dữ liệu nhưng
              không trả lời câu nào, nên nhìn vào chỉ thấy rối. */}
          <DebtOverview refreshKey={refreshKey} />

          {dueThisMonth.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
              <h3 className="c-h5 text-[var(--color-text)] mb-4">
                {t("Due this month", "Đến hạn trong tháng này")}
              </h3>
              <ul className="divide-y divide-[var(--color-border)]">
                {dueThisMonth.map((due, idx) => (
                  <li key={idx} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs tabular-nums text-[var(--color-text-faint)] flex-none">
                        {t("day", "ngày")} {due.day}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-[var(--color-text)] truncate">
                          {due.name}
                        </span>
                        <span className="block text-xs text-[var(--color-text-faint)]">{due.type}</span>
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-[var(--color-warning)]">
                      {formatVND(due.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Danh sách khoản nợ */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
            <h3 className="c-h5 text-[var(--color-text)] mb-6">
              {t("Loan by loan", "Theo dõi từng khoản vay")}
            </h3>
            
            {/* `flex gap` chứ không `space-y-6`: globals.css gán nhịp khối lớn
                của trang cho mọi `.space-y-6` trong `.c-main`, kể cả trong thẻ. */}
            <div className="flex flex-col gap-4">
              {debtsList.length === 0 ? (
                <div className="text-sm text-[var(--color-text-faint)]">{t("No debts available", "Chưa có danh sách nợ")}</div>
              ) : (
                debtsList.map(debt => (
                  <div key={debt.id} className="border border-[var(--color-border)] rounded-2xl p-4 md:p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="bg-[var(--color-success-tint)] text-[var(--color-success)] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider mb-2 inline-block">{debt.type}</span>
                        <h4 className="c-h4 text-[var(--color-text)]">{debt.name}</h4>
                        <p className="text-xs text-[var(--color-text-faint)] mt-1">{t("started", "bắt đầu")} {debt.startDate}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[var(--color-warning)] text-lg">{formatVND(debt.remaining)}</div>
                        <div className="text-xs text-[var(--color-text-faint)] mt-1">/ {t("principal", "gốc")} {formatVND(debt.principal)}</div>
                      </div>
                    </div>

                    {/* Thanh tiến độ: rãnh xám, phần đã trả màu nhấn, luôn có chữ ghi số
                        ngay dưới — màu trạng thái để dành cho tốt/xấu, không cho "đã đi được bao xa". */}
                    <div className="mb-6 flex flex-col gap-1.5">
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: VIZ.ghost }} aria-hidden>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(0, Math.min(100, debt.paidPercentage))}%`,
                            minWidth: debt.paidPercentage > 0 ? 4 : 0,
                            background: VIZ.accent,
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-[var(--color-text)]">
                        {t(`${debt.paidPercentage}% of principal repaid`, `Đã trả ${debt.paidPercentage}% gốc`)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--color-text-muted)] mb-6 border-b border-[var(--color-border)] pb-4">
                      <div>{t("Monthly Payment:", "Trả hàng tháng:")} <strong className="text-[var(--color-text)]">{formatVND(debt.monthlyPayment)}</strong></div>
                      <div>{t("Interest Rate:", "Lãi suất:")} <strong className="text-[var(--color-text)]">{debt.interestRate}%/{t("yr", "năm")}</strong></div>
                      <div>{t("Due Date:", "Đến hạn:")} <strong className="text-[var(--color-text)]">{t("day", "ngày")} {debt.dueDate}</strong></div>
                      <div>{t("Remaining:", "Còn")} <strong className="text-[var(--color-text)]">~{debt.remainingMonths} {t("months", "tháng")}</strong></div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setScheduleFor({ id: debt.id, name: debt.name, filter: "projected" })}
                        className="c-btn c-btn-primary c-btn-sm shadow-sm"
                      >
                        {t("Record Payment", "Ghi nhận thanh toán")}
                      </button>
                      <button
                        onClick={() => setScheduleFor({ id: debt.id, name: debt.name, filter: "all" })}
                        className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] c-btn-sm rounded-md"
                      >
                        {t("Schedule", "Lịch trả nợ")}
                      </button>
                      <button className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] c-btn-sm rounded-md">{t("Edit", "Sửa")}</button>
                      <button className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] c-btn-sm rounded-md">{t("Mark as Settled", "Đánh dấu đã tất toán")}</button>
                      <button className="c-btn bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-error)] hover:bg-[var(--color-error-tint)] c-btn-sm rounded-md">{t("Delete", "Xóa")}</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <PeriodComparison
            title="Trả nợ so với các kỳ trước"
            metrics={["debtService", "debtPrincipal", "cashOut"]}
            refreshKey={refreshKey}
          />
        </>
      )}

      <DebtScheduleModal
        debtId={scheduleFor?.id ?? null}
        debtName={scheduleFor?.name}
        initialFilter={scheduleFor?.filter ?? "all"}
        onClose={() => setScheduleFor(null)}
        onChanged={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
