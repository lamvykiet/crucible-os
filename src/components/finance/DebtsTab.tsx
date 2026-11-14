"use client";

import { CalendarClock, CalendarX, Landmark, Plus } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import { useState, useEffect } from "react";
import DebtModal from "./DebtModal";
import DebtScheduleModal from "./DebtScheduleModal";
import { thisMonthLocalIso } from "@/lib/localDate";
import PeriodComparison from "./PeriodComparison";
import DebtOverview from "./DebtOverview";
import { formatVND } from "@/lib/formatMoney";
import { VIZ } from "@/lib/viz";
import SectionHeader from "@/components/charts/SectionHeader";

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
            className="c-btn c-btn-primary w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
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
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 md:p-8 flex flex-col items-center gap-2 text-center">
          <div className="mb-2 w-12 h-12 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center" aria-hidden>
            <CalendarX size={22} />
          </div>
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("No debts recorded yet", "Chưa ghi khoản nợ nào")}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-xl">
            {t(
              "Add a loan with its principal, rate and due day to see the payoff date and the interest still to pay.",
              "Thêm khoản vay kèm gốc, lãi suất và ngày đến hạn để thấy ngày hết nợ và tiền lãi còn phải trả."
            )}
          </p>
          <button onClick={() => setIsDebtModalOpen(true)} className="mt-3 c-btn c-btn-primary">
            <Plus size={16} /> {t("Add Debt", "Thêm khoản nợ")}
          </button>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
      ) : (
        <>
          {/* Bức tranh nợ trước, chi tiết từng khoản sau. Màn hình cũ mở lên
              là bốn ô số rồi một bảng rồi một danh sách — đúng dữ liệu nhưng
              không trả lời câu nào, nên nhìn vào chỉ thấy rối. */}
          <DebtOverview refreshKey={refreshKey} />

          {dueThisMonth.length > 0 && (
            <div className="flex flex-col gap-5">
              <SectionHeader
                icon={<CalendarClock size={20} />}
                title={t("Due this month", "Đến hạn trong tháng này")}
              />
              <ul className="bg-[var(--color-surface)] rounded-2xl px-5 md:px-6 py-2 border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {dueThisMonth.map((due, idx) => (
                  <li key={idx} className="flex justify-between items-center gap-3 py-3.5">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs tabular-nums text-[var(--color-text-faint)] flex-none">
                        {t("day", "ngày")} {due.day}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--color-text)] truncate">
                          {due.name}
                        </span>
                        <span className="block text-xs text-[var(--color-text-faint)]">{due.type}</span>
                      </span>
                    </div>
                    {/* Số tiền đến hạn là số MỨC — màu mực, không tô cảnh báo. */}
                    <span className="flex-none text-sm font-bold tabular-nums whitespace-nowrap text-[var(--color-text)]">
                      {formatVND(due.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Danh sách khoản nợ — mỗi khoản một thẻ trên tấm nền, không lồng
              thẻ trong thẻ. `flex gap` chứ không `space-y-6`: globals.css gán
              nhịp khối lớn của trang cho mọi `.space-y-6` trong `.c-main`. */}
          <div className="flex flex-col gap-5">
            <SectionHeader
              icon={<Landmark size={20} />}
              title={t("Loan by loan", "Theo dõi từng khoản vay")}
            />

            <div className="flex flex-col gap-4">
              {debtsList.length === 0 ? (
                <div className="text-sm text-[var(--color-text-faint)]">{t("No debts available", "Chưa có danh sách nợ")}</div>
              ) : (
                debtsList.map(debt => (
                  <div key={debt.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 md:p-6 flex flex-col gap-4 min-w-0">
                    <div className="flex flex-wrap justify-between items-start gap-x-4 gap-y-3">
                      <div className="min-w-0">
                        <span className="c-overline text-[var(--color-text-muted)]">{debt.type}</span>
                        <h4 className="c-h4 mt-1 text-[var(--color-text)]">{debt.name}</h4>
                        <p className="text-xs text-[var(--color-text-faint)] mt-1">{t("started", "bắt đầu")} {debt.startDate}</p>
                      </div>
                      <div className="sm:text-right">
                        <div className="c-overline text-[var(--color-text-muted)]">{t("Outstanding", "Dư nợ")}</div>
                        <div className="mt-1 c-metric-value-sm whitespace-nowrap text-[var(--color-text)]">{formatVND(debt.remaining)}</div>
                        <div className="text-xs tabular-nums text-[var(--color-text-faint)] mt-1">/ {t("principal", "gốc")} {formatVND(debt.principal)}</div>
                      </div>
                    </div>

                    {/* Thanh tiến độ: rãnh xám, phần đã trả màu nhấn, luôn có chữ ghi số
                        ngay dưới — màu trạng thái để dành cho tốt/xấu, không cho "đã đi được bao xa". */}
                    <div className="flex flex-col gap-1.5">
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
                      <span className="text-xs font-semibold tabular-nums text-[var(--color-text)]">
                        {t(`${debt.paidPercentage}% of principal repaid`, `Đã trả ${debt.paidPercentage}% gốc`)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-4">
                      <div>{t("Monthly Payment:", "Trả hàng tháng:")} <strong className="tabular-nums whitespace-nowrap text-[var(--color-text)]">{formatVND(debt.monthlyPayment)}</strong></div>
                      <div>{t("Interest Rate:", "Lãi suất:")} <strong className="tabular-nums text-[var(--color-text)]">{debt.interestRate}%/{t("yr", "năm")}</strong></div>
                      <div>{t("Due Date:", "Đến hạn:")} <strong className="text-[var(--color-text)]">{t("day", "ngày")} {debt.dueDate}</strong></div>
                      <div>{t("Remaining:", "Còn")} <strong className="tabular-nums text-[var(--color-text)]">~{debt.remainingMonths} {t("months", "tháng")}</strong></div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setScheduleFor({ id: debt.id, name: debt.name, filter: "projected" })}
                        className="c-btn c-btn-primary c-btn-sm min-h-11"
                      >
                        {t("Record Payment", "Ghi nhận thanh toán")}
                      </button>
                      <button
                        onClick={() => setScheduleFor({ id: debt.id, name: debt.name, filter: "all" })}
                        className="c-btn c-btn-secondary c-btn-sm min-h-11"
                      >
                        {t("Schedule", "Lịch trả nợ")}
                      </button>
                      <button className="c-btn c-btn-secondary c-btn-sm min-h-11">{t("Edit", "Sửa")}</button>
                      <button className="c-btn c-btn-secondary c-btn-sm min-h-11">{t("Mark as Settled", "Đánh dấu đã tất toán")}</button>
                      <button className="c-btn c-btn-tertiary c-btn-sm min-h-11">{t("Delete", "Xóa")}</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <PeriodComparison
            title={t("Debt payments vs. earlier periods", "Trả nợ so với các kỳ trước")}
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
