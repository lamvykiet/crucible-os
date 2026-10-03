"use client";

import { useState, useEffect } from "react";
import {
  Calendar, Receipt, DollarSign, CreditCard, ArrowLeftRight, Target,
  Clock, PieChart, AlertCircle, TrendingUp, CalendarX, ListChecks, CalendarDays,
  Banknote, CalendarClock, Scale,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Bar, Legend,
} from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import TransactionModal from "./TransactionModal";
import ScanInvoiceModal from "./ScanInvoiceModal";
import PendingReviewButton from "./PendingReviewButton";
import DayTransactionsCard from "./DayTransactionsCard";
import TodaySpendingShare from "./TodaySpendingShare";
import IncompleteDataModal from "./IncompleteDataModal";
import PeriodComparison from "./PeriodComparison";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { thisMonthLocalIso, todayLocalIso } from "@/lib/localDate";
import { compactMoney } from "@/lib/formatMoney";
import { formatVND } from "@/lib/formatMoney";
import { monthAxis } from "./MonthAxisTick";

// Mọi con số trên trang này đến từ /api/finance/dashboard.
// Trước đây `dailyData` và `ytdData` là hai mảng hardcode nuôi 2 biểu đồ chính,
// nên biểu đồ không hề đổi khi người dùng chọn tháng khác.

interface DailyPoint { name: string; expense: number; ma7: number }
interface YtdPoint {
  name: string; income: number; expense: number;
  /** Trả gốc nợ trong tháng — tiền ra nhưng không phải chi tiêu. */
  debtPrincipal: number;
  /** Tổng tiền thật sự rời tài khoản: chi tiêu + trả gốc. */
  cashOut: number;
  cumulativeIncome: number; cumulativeExpense: number;
}
interface CategorySlice { group: string; amount: number }
interface BudgetRow { group: string; budget: number; actual: number; remaining: number }

interface DashboardData {
  month: string;
  monthlyIncome: number;
  monthlyExpense: number;
  /** Tiền ra = chi tiêu + trả gốc. Khác chi tiêu, xem chú thích ở route. */
  cashOut: number;
  debtPrincipal: number;
  /** Nghĩa vụ trả nợ tháng: gốc + lãi. */
  debtService: number;
  /** Trả nợ / thu nhập, %. `null` khi chưa ghi thu nhập. */
  debtServiceRatio: number | null;
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
  /** Các ngày trong tháng đã có ít nhất một giao dịch. */
  daysWithData: number[];
  upcoming: {
    month: string; principal: number; interest: number; payment: number;
    items: { name: string; dueDate: string; payment: number }[];
  }[];
  unclassified: { type: string; count: number }[];
}

const EMPTY: DashboardData = {
  month: "", monthlyIncome: 0, monthlyExpense: 0, cashOut: 0, debtPrincipal: 0,
  debtService: 0, debtServiceRatio: null,
  netCashFlow: 0, savingsRate: 0,
  dailyIncome: 0, dailyExpense: 0, dailyCashFlow: 0, avgDailyExpense: 0, eomForecast: 0,
  dailySeries: [], ytdSeries: [], categoryBreakdown: [], budgetVsActual: [],
  totalBudget: 0, totalActualExpense: 0, transactionCount: 0, hasData: false,
  latestMonthWithData: null, elapsedDays: 0, daysInMonth: 0, daysWithData: [],
  upcoming: [], unclassified: [],
};

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface DashboardTabProps {
  /** Bấm "xem chi tiết" thì chuyển sang tab con tương ứng. */
  onNavigate?: (tab: string) => void;
}

export default function DashboardTab({ onNavigate }: DashboardTabProps) {
  const { t, language } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => thisMonthLocalIso());

  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<"api" | "network" | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [transactionType, setTransactionType] = useState<"Expense" | "Income" | "Transfer">("Expense");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isIncompleteOpen, setIsIncompleteOpen] = useState(false);
  const [gaps, setGaps] = useState({
    missingSubGroup: 0, unknownPayment: 0, noItems: 0, pendingDrafts: 0,
  });

  // Tài sản và nợ — mảng duy nhất của Finance mà Dashboard chưa nói tới, trong
  // khi đó mới là thứ trả lời "tôi đang đứng ở đâu". Lấy thẳng từ hai endpoint
  // mà tab Tài sản và tab Nợ vẫn dùng, thay vì nhân bản cách tính khấu hao và
  // dư nợ sang route dashboard — hai bản sao là hai con số khác nhau.
  const [worth, setWorth] = useState<{
    assets: number; assetCount: number; debt: number; debtCount: number; monthlyPayment: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchDashboardData = async () => {
      setIsLoading(true);
      setErrorCode(null);
      setApiMessage(null);
      try {
        const monthParam = selectedMonth || thisMonthLocalIso();
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

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const monthParam = selectedMonth || thisMonthLocalIso();
        const [a, d] = await Promise.all([
          fetch("/api/finance/assets", { signal: controller.signal }).then((r) => r.json()),
          fetch(`/api/finance/debts?month=${monthParam}`, { signal: controller.signal }).then((r) => r.json()),
        ]);
        if (ignore) return;
        if (a?.success && d?.success) {
          setWorth({
            assets: a.data?.totals?.worth || 0,
            assetCount: a.data?.totals?.count || 0,
            debt: d.data?.totalOutstanding || 0,
            debtCount: d.data?.active || 0,
            monthlyPayment: d.data?.monthlyPayment || 0,
          });
        }
      } catch {
        // Khối này là phần phụ: hỏng thì ẩn đi, không chặn cả trang Dashboard.
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [selectedMonth, refreshKey]);

  // Số liệu "còn thiếu gì" tính trên TOÀN BỘ lịch sử, không theo tháng đang
  // xem, nên tách khỏi lần fetch dashboard ở trên.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/finance/incomplete", { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => { if (j?.success) setGaps(j.data.counts); })
      .catch(() => { /* thẻ tự ẩn khi mọi số bằng 0 */ });
    return () => controller.abort();
  }, [refreshKey]);

  const {
    monthlyIncome, monthlyExpense, cashOut, debtPrincipal, debtService,
    debtServiceRatio, netCashFlow, savingsRate,
    dailyIncome, dailyExpense, dailyCashFlow, avgDailyExpense, eomForecast,
    dailySeries, ytdSeries, categoryBreakdown, budgetVsActual,
    totalBudget, hasData, latestMonthWithData, elapsedDays, daysInMonth,
    daysWithData, upcoming, unclassified,
  } = data;

  const todayIso = todayLocalIso();
  const isCurrentMonth = selectedMonth === todayIso.slice(0, 7);

  // Ngày đang soi: hôm nay nếu đang xem tháng này, còn tháng cũ thì lấy ngày
  // gần nhất có dữ liệu — mở tháng 6 mà hiện "hôm nay" thì vô nghĩa.
  const lastDayWithData = daysWithData.length ? daysWithData[daysWithData.length - 1] : null;
  const focusDate = isCurrentMonth
    ? todayIso
    : lastDayWithData
      ? `${selectedMonth}-${String(lastDayWithData).padStart(2, "0")}`
      : null;

  // Ngày chưa ghi sổ. Tháng đang chạy thì chỉ tính tới hôm nay — mấy ngày chưa
  // tới mà đếm là "chưa ghi" thì thành lời trách vô lý.
  const daysToCheck = isCurrentMonth ? elapsedDays : daysInMonth;
  const recorded = new Set(daysWithData);
  const blankDays: number[] = [];
  for (let d = 1; d <= daysToCheck; d++) if (!recorded.has(d)) blankDays.push(d);

  const gapTotal = gaps.missingSubGroup + gaps.unknownPayment + gaps.pendingDrafts;

  /**
   * Bốn tỷ lệ mà bất kỳ ai thẩm định tài chính cũng hỏi đến, kèm ngưỡng.
   *
   * Con số trần trụi không nói được nó tốt hay xấu: 38% là cao hay thấp? Nên
   * mỗi dòng mang theo ngưỡng của chính nó và một câu kết luận. Ngưỡng lấy theo
   * thông lệ cho vay tiêu dùng: trả nợ dưới 36% thu nhập, tiết kiệm trên 20%,
   * nợ dưới 50% giá trị tài sản.
   */
  const band = (v: number | null, good: number, warn: number, lowerIsBetter: boolean) => {
    if (v === null) return null;
    if (lowerIsBetter) return v <= good ? "good" : v <= warn ? "warn" : "bad";
    return v >= good ? "good" : v >= warn ? "warn" : "bad";
  };

  // Tháng đang chạy bị loại khỏi mọi tỷ lệ bên dưới. Nó mới đi được vài ngày
  // nên chi tiêu chưa ghi đủ, và để chung vào thì ra kết luận đẹp giả: tháng
  // 9 đang cho "tiết kiệm 91%" chỉ vì mới ghi 1,8 triệu chi trong khi mười một
  // tháng trước đều quanh 25 triệu.
  const completedMonths = isCurrentMonth ? ytdSeries.slice(0, -1) : ytdSeries;
  const income12 = completedMonths.reduce((sum, m) => sum + m.income, 0);
  const cashOut12 = completedMonths.reduce((sum, m) => sum + m.cashOut, 0);
  const avgMonthlyIncome12 =
    completedMonths.length > 0 ? income12 / completedMonths.length : 0;
  const savings12 =
    income12 > 0 ? Math.round(((income12 - cashOut12) / income12) * 100) : null;
  const overspentMonths = completedMonths.filter((m) => m.cashOut > m.income).length;

  // Nghĩa vụ trả nợ lấy theo LỊCH TRẢ NỢ, không theo số đã ghi sổ trong tháng.
  // Tháng nào chưa kịp ghi thì số đã ghi bằng 0, và tỷ lệ sẽ hiện 0% màu xanh —
  // xanh vì chưa nhập liệu, không phải vì hết nợ.
  const dtiScheduled =
    worth && avgMonthlyIncome12 > 0
      ? Math.round((worth.monthlyPayment / avgMonthlyIncome12) * 100)
      : null;

  const healthRows: {
    key: string;
    label: string;
    hint: string;
    display: string;
    band: "good" | "warn" | "bad" | null;
    note: string;
  }[] = [
    {
      key: "dti",
      label: t("Debt payments vs income", "Trả nợ trên thu nhập"),
      hint: t("safe under 36%", "an toàn dưới 36%"),
      display: dtiScheduled === null ? "—" : `${dtiScheduled}%`,
      band: band(dtiScheduled, 36, 50, true),
      note:
        !worth
          ? t("loading…", "đang tải…")
          : avgMonthlyIncome12 === 0
            ? t("no income in the last 12 months", "12 tháng qua chưa ghi thu nhập")
            : t(
                `${formatVND(worth.monthlyPayment)} due each month against ${formatVND(Math.round(avgMonthlyIncome12))} average income`,
                `phải trả ${formatVND(worth.monthlyPayment)}/tháng trên thu nhập bình quân ${formatVND(Math.round(avgMonthlyIncome12))}`
              ),
    },
    {
      key: "savings",
      label: t("Savings rate, 12 months", "Tỷ lệ tiết kiệm 12 tháng"),
      hint: t("healthy above 20%", "khoẻ khi trên 20%"),
      display: savings12 === null ? "—" : `${savings12}%`,
      band: band(savings12, 20, 10, false),
      note:
        savings12 === null
          ? t("no income in the last 12 months", "12 tháng qua chưa ghi thu nhập")
          : savings12 < 0
            ? t(
                `cash out exceeded income by ${formatVND(cashOut12 - income12)}`,
                `tiền ra vượt thu nhập ${formatVND(cashOut12 - income12)}`
              )
            : t("income kept after all cash out", "phần thu nhập giữ lại sau mọi khoản tiền ra"),
    },
    {
      key: "leverage",
      label: t("Debt vs assets", "Dư nợ trên tài sản"),
      hint: t("safe under 50%", "an toàn dưới 50%"),
      display:
        worth && worth.assets > 0
          ? `${Math.round((worth.debt / worth.assets) * 100)}%`
          : "—",
      band:
        worth && worth.assets > 0
          ? band(Math.round((worth.debt / worth.assets) * 100), 50, 80, true)
          : null,
      note: !worth
        ? t("loading…", "đang tải…")
        : worth.assets > 0
          ? t(
              `${formatVND(worth.debt)} owed against ${formatVND(worth.assets)} owned`,
              `nợ ${formatVND(worth.debt)} trên tài sản ${formatVND(worth.assets)}`
            )
          : t("no assets recorded yet", "chưa ghi tài sản nào"),
    },
    {
      key: "overspent",
      label: t("Months spending beat income", "Số tháng chi vượt thu"),
      hint: isCurrentMonth
        ? t("completed months only", "chỉ tính tháng đã trọn")
        : t("over the last 12 months", "trong 12 tháng gần nhất"),
      display:
        completedMonths.length === 0
          ? "—"
          : `${overspentMonths}/${completedMonths.length}`,
      band:
        completedMonths.length === 0
          ? null
          : band(
              Math.round((overspentMonths / completedMonths.length) * 100),
              25,
              50,
              true
            ),
      note:
        completedMonths.length === 0
          ? t("not enough history yet", "chưa đủ dữ liệu")
          : t("cash out above income, including principal", "tiền ra vượt thu nhập, đã tính cả trả gốc"),
    },
  ];

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
            <h3 className="c-h3 c-page-title text-[var(--color-text)]">Dashboard</h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{t("Your financial overview", "Tổng quan tài chính")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            <button 
              onClick={() => {
                setTransactionType("Income");
                setIsTransactionModalOpen(true);
              }}
              aria-label={t("Add Income", "Thu nhập")}
              title={t("Add Income", "Thu nhập")}
              className="c-btn c-btn-success shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
            >
              <ArrowDownLeft size={16} /> <span className="hidden md:inline">{t("Add Income", "Thu nhập")}</span>
            </button>
            <button 
              onClick={() => {
                setTransactionType("Expense");
                setIsTransactionModalOpen(true);
              }}
              aria-label={t("Add Expense", "Chi phí")}
              title={t("Add Expense", "Chi phí")}
              className="c-btn c-btn-accent shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
            >
              <ArrowUpRight size={16} /> <span className="hidden md:inline">{t("Add Expense", "Chi phí")}</span>
            </button>
            <button 
              onClick={() => setIsScanModalOpen(true)}
              aria-label={t("Scan Invoice", "Quét hóa đơn")}
              title={t("Scan Invoice", "Quét hóa đơn")}
              className="c-btn c-btn-secondary shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
            >
              <Receipt size={16} className="text-[var(--color-success)]" /> <span className="hidden md:inline">{t("Scan Invoice", "Quét hóa đơn")}</span>
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

  // Đối chiếu ngân sách với TIỀN RA, không phải chi tiêu: ngân sách nhóm nợ đặt
  // bằng cả kỳ trả (gốc + lãi) nên so với riêng phần lãi thì tháng nào cũng báo
  // dùng chưa tới một nửa hạn mức.
  const budgetUsedPct =
    totalBudget > 0 ? Math.round((cashOut / totalBudget) * 100) : null;
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
  const monthMostlyGone = daysToCheck / (daysInMonth || 31) > 0.5;
  const zeroSpendBudgets = monthMostlyGone
    ? budgetVsActual.filter((b) => b.budget > 0 && b.actual === 0)
    : [];

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Xem chú thích ở nhánh "chưa có dữ liệu" phía trên — cùng một header. */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h3 className="c-h3 c-page-title text-[var(--color-text)]">Dashboard</h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t("Your financial overview", "Tổng quan tài chính")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button 
            onClick={() => {
              setTransactionType("Income");
              setIsTransactionModalOpen(true);
            }}
            aria-label={t("Add Income", "Thu nhập")}
            title={t("Add Income", "Thu nhập")}
            className="c-btn c-btn-success shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
          >
            <ArrowDownLeft size={16} /> <span className="hidden md:inline">{t("Add Income", "Thu nhập")}</span>
          </button>
          <button 
            onClick={() => {
              setTransactionType("Expense");
              setIsTransactionModalOpen(true);
            }}
            aria-label={t("Add Expense", "Chi phí")}
            title={t("Add Expense", "Chi phí")}
            className="c-btn c-btn-accent shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
          >
            <ArrowUpRight size={16} /> <span className="hidden md:inline">{t("Add Expense", "Chi phí")}</span>
          </button>
          <button 
            onClick={() => setIsScanModalOpen(true)}
            aria-label={t("Scan Invoice", "Quét hóa đơn")}
            title={t("Scan Invoice", "Quét hóa đơn")}
            className="c-btn c-btn-secondary shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
          >
            <Receipt size={16} className="text-[var(--color-success)]" /> <span className="hidden md:inline">{t("Scan Invoice", "Quét hóa đơn")}</span>
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
      <IncompleteDataModal
        isOpen={isIncompleteOpen}
        onClose={() => setIsIncompleteOpen(false)}
        onSaved={() => setRefreshKey((prev) => prev + 1)}
      />

      {/* Mục đầu tiên: hôm nay chi gì (trái) và tỷ trọng theo nhóm (phải).
          Xem tháng đã qua thì hai thẻ theo ngày cuối cùng có ghi sổ. */}
      {focusDate ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <DayTransactionsCard
            date={focusDate}
            refreshKey={refreshKey}
            title={isCurrentMonth ? t("Today", "Hôm nay") : undefined}
            onAddTransaction={() => {
              setTransactionType("Expense");
              setIsTransactionModalOpen(true);
            }}
          />
          <TodaySpendingShare
            date={focusDate}
            refreshKey={refreshKey}
            title={isCurrentMonth ? t("Today", "Hôm nay") : undefined}
          />
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5">
          <h3 className="c-h5 text-[var(--color-text)]">{t("Daily detail", "Chi tiết theo ngày")}</h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {t("No transactions in this month at all.", "Tháng này chưa có giao dịch nào.")}
          </p>
        </div>
      )}

      {/* Tháng này. Mỗi mục lớn của Dashboard đều có lối đi tiếp sang tab con:
          trang này để NẮM, tab con để ĐÀO. */}
      <div className="flex flex-wrap items-end justify-between gap-3 -mb-2">
        <h3 className="c-h3 text-[var(--color-text)] flex items-center gap-3">
          <Calendar size={24} /> {t("This month", "Tháng này")}
        </h3>
        {onNavigate && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate("income")}
              className="c-btn c-btn-secondary c-btn-sm min-h-11 md:min-h-9"
            >
              {t("Income", "Thu nhập")} <ArrowUpRight size={14} />
            </button>
            <button
              onClick={() => onNavigate("expense")}
              className="c-btn c-btn-secondary c-btn-sm min-h-11 md:min-h-9"
            >
              {t("Spending", "Chi tiêu")} <ArrowUpRight size={14} />
            </button>
            <button
              onClick={() => onNavigate("history")}
              className="c-btn c-btn-secondary c-btn-sm min-h-11 md:min-h-9"
            >
              {t("All transactions", "Toàn bộ giao dịch")} <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* md:grid-cols-4 cũ ép mỗi thẻ còn 96px ở 768px (số tiền cần 155px) vì
          vùng nội dung tablet chỉ rộng ~440px sau khi trừ sidebar 248px. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
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
          {/* Nói rõ dòng tiền đã trừ cả trả gốc — trước đây thẻ này lấy thu trừ
              chi tiêu rồi gọi là dòng tiền, bỏ sót nguyên phần gốc. */}
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {t("income − cash out", "thu − tiền ra")} {formatVND(cashOut)}
          </div>
        </div>

        {/* Tiền ra: thứ cần biết để chuẩn bị tiền mặt, khác với chi tiêu */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-error-tint)] text-[var(--color-error)] flex items-center justify-center flex-none">
              <Banknote size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {t("Cash out", "Tiền ra thực tế")}
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--color-error)]">{formatVND(cashOut)}</div>
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {t("spending", "chi tiêu")} {formatVND(monthlyExpense)}
            {debtPrincipal > 0 && ` + ${t("principal", "trả gốc")} ${formatVND(debtPrincipal)}`}
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
                {formatVND(cashOut)} / {formatVND(totalBudget)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* md:grid-cols-4 cũ ép mỗi thẻ còn 96px ở 768px (số tiền cần 155px) vì
          vùng nội dung tablet chỉ rộng ~440px sau khi trừ sidebar 248px. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
              <PieChart size={20} />
            </div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Savings Rate", "Tỷ lệ tiết kiệm")}</div>
          </div>
          {/* Không kẹp về 0 nữa — tháng bội chi phải nhìn thấy được */}
          {/* Chưa ghi đồng thu nhập nào thì tỷ lệ tiết kiệm không tính được.
              Hiện "0%" ở đây đọc như "tiêu sạch những gì kiếm được", trong khi
              sự thật là chưa có gì để chia. */}
          <div className={`text-2xl font-bold ${monthlyIncome === 0 ? "text-[var(--color-text-faint)]" : savingsRate < 0 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"}`}>
            {monthlyIncome === 0 ? "—" : `${savingsRate}%`}
          </div>
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {monthlyIncome === 0
              ? t("no income recorded this month", "chưa ghi thu nhập tháng này")
              : savingsRate < 0
                ? t("overspending this month", "tháng này chi vượt thu")
                : t("retained income", "phần thu nhập giữ lại")}
          </div>
        </div>

        {/* Gánh nặng trả nợ. Khoản này bắt buộc, không cắt giảm được như tiền
            ăn uống — nên phải soi riêng chứ không trộn vào tổng chi. */}
        {debtService > 0 && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${
                  debtServiceRatio !== null && debtServiceRatio > 100
                    ? "bg-[var(--color-error-tint)] text-[var(--color-error)]"
                    : "bg-[var(--color-info-tint)] text-[var(--color-info)]"
                }`}
              >
                <Scale size={20} />
              </div>
              <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Debt vs income", "Trả nợ / thu nhập")}
              </div>
            </div>
            <div
              className={`text-2xl font-bold ${
                debtServiceRatio === null
                  ? "text-[var(--color-text-faint)]"
                  : debtServiceRatio > 100
                    ? "text-[var(--color-error)]"
                    : debtServiceRatio > 50
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-text)]"
              }`}
            >
              {debtServiceRatio === null ? "—" : `${debtServiceRatio}%`}
            </div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">
              {debtServiceRatio === null
                ? t("no income recorded this month", "chưa ghi thu nhập tháng này")
                : `${formatVND(debtService)} / ${formatVND(monthlyIncome)}`}
            </div>
          </div>
        )}
      </div>

      {/* Tài sản & Nợ. Hai con số tổng của cả Finance nằm ở đây: đang sở hữu
          bao nhiêu và đang nợ bao nhiêu. Trước đây phải mở hai tab khác nhau
          mới biết, nên Dashboard đọc xong vẫn chưa nắm được mình đứng ở đâu. */}
      {worth && (worth.assets > 0 || worth.debt > 0) && (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <h3 className="c-h3 text-[var(--color-text)] flex items-center gap-3">
              <Scale size={24} /> {t("Assets & Debt", "Tài sản & Nợ")}
            </h3>
            {onNavigate && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onNavigate("assets")}
                  className="c-btn c-btn-secondary c-btn-sm min-h-11 md:min-h-9"
                >
                  {t("Assets", "Tài sản")} <ArrowUpRight size={14} />
                </button>
                <button
                  onClick={() => onNavigate("debts")}
                  className="c-btn c-btn-secondary c-btn-sm min-h-11 md:min-h-9"
                >
                  {t("Debts", "Nợ")} <ArrowUpRight size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Giá trị ròng trừ TOÀN BỘ dư nợ, không chỉ phần nợ gắn với tài
                sản — vay tín chấp vẫn là tiền phải trả. */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] flex items-center justify-center flex-none">
                  <Scale size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {t("Net worth", "Giá trị ròng")}
                </div>
              </div>
              <div
                className={`text-2xl font-bold ${
                  worth.assets - worth.debt < 0
                    ? "text-[var(--color-error)]"
                    : "text-[var(--color-text)]"
                }`}
              >
                {formatVND(worth.assets - worth.debt)}
              </div>
              <div className="text-xs text-[var(--color-text-faint)] mt-1">
                {t("assets − debt", "tài sản − dư nợ")}
              </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center flex-none">
                  <Banknote size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {t("Assets today", "Tài sản hôm nay")}
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-success)]">
                {formatVND(worth.assets)}
              </div>
              <div className="text-xs text-[var(--color-text-faint)] mt-1">
                {worth.assetCount} {t("items, after depreciation", "món, đã trừ khấu hao")}
              </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-error-tint)] text-[var(--color-error)] flex items-center justify-center flex-none">
                  <CreditCard size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {t("Debt outstanding", "Dư nợ còn lại")}
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-error)]">
                {formatVND(worth.debt)}
              </div>
              <div className="text-xs text-[var(--color-text-faint)] mt-1">
                {worth.debtCount} {t("loans still running", "khoản đang trả")}
              </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center flex-none">
                  <CalendarClock size={20} />
                </div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {t("Repayment / month", "Trả nợ mỗi tháng")}
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)]">
                {formatVND(worth.monthlyPayment)}
              </div>
              <div className="text-xs text-[var(--color-text-faint)] mt-1">
                {monthlyIncome > 0
                  ? t(
                      `${Math.round((worth.monthlyPayment / monthlyIncome) * 100)}% of this month's income`,
                      `${Math.round((worth.monthlyPayment / monthlyIncome) * 100)}% thu nhập tháng này`
                    )
                  : t("no income recorded this month", "chưa ghi thu nhập tháng này")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sức khoẻ tài chính và khả năng chi trả. Dashboard cũ nói "bao nhiêu",
          hai khối này nói "như vậy là ổn hay không ổn" — phần mà người đọc vẫn
          phải tự suy ra, và thường suy sai theo hướng lạc quan. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("Financial health", "Sức khoẻ tài chính")}
          </h3>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
            {t(
              "each line carries the threshold a lender would use",
              "mỗi dòng kèm ngưỡng mà bên cho vay vẫn dùng để thẩm định"
            )}
          </p>
          <ul className="divide-y divide-[var(--color-border)]">
            {healthRows.map((r) => (
              <li key={r.key} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-[var(--color-text)]">{r.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{r.note}</p>
                </div>
                <div className="flex-none text-right">
                  <div
                    className={`text-xl font-bold tabular-nums ${
                      r.band === "good"
                        ? "text-[var(--color-success)]"
                        : r.band === "warn"
                          ? "text-[var(--color-warning)]"
                          : r.band === "bad"
                            ? "text-[var(--color-error)]"
                            : "text-[var(--color-text-faint)]"
                    }`}
                  >
                    {r.display}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">{r.hint}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("Can each month pay for itself?", "Từng tháng có tự trả nổi không?")}
          </h3>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
            {t(
              "columns: money out, split into spending and principal · line: income",
              "cột: tiền ra, tách chi tiêu và trả gốc · đường: thu nhập"
            )}
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ytdSeries} className="c-chart-multi">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" {...monthAxis(ytdSeries.map((d) => d.name))} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-text-faint)" }} tickFormatter={(v) => compactMoney(Number(v), language === "vi")} width={50} />
                <Tooltip formatter={(v, n) => [formatVND(Number(v) || 0), n]} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                {/* Chi tiêu và trả gốc chồng lên nhau vì cùng là tiền rời tài
                    khoản, nhưng tách khúc: phần trả gốc KHÔNG cắt được khi thu
                    hụt, phần chi tiêu thì có. */}
                <Bar dataKey="expense" stackId="out" name={t("Spending", "Chi tiêu")} className="c-series-2" fill="var(--chart-2)" stroke="var(--color-surface)" strokeWidth={1} maxBarSize={36} />
                <Bar dataKey="debtPrincipal" stackId="out" name={t("Principal repaid", "Trả gốc")} className="c-series-1" fill="var(--chart-1)" stroke="var(--color-surface)" strokeWidth={1} maxBarSize={36} />
                {/* Đường thu nhập: cột nào vượt qua đường là tháng đó không tự
                    trả nổi, phải bù từ tiền để dành hoặc vay thêm. */}
                <Line type="monotone" dataKey="income" name={t("Income", "Thu nhập")} stroke="var(--color-text)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2.5, fill: "var(--color-text)" }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
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
            <div className="c-metric-value text-[var(--color-success)]">{formatVND(dailyIncome)}</div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{t("today", "hôm nay")}</div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
                <CreditCard size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Daily Expense", "Chi tiêu ngày")}</div>
            </div>
            <div className="c-metric-value text-[var(--color-warning)]">{formatVND(dailyExpense)}</div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{t("today", "hôm nay")}</div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center">
                <ArrowLeftRight size={16} />
              </div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Daily Cash Flow", "Dòng tiền ngày")}</div>
            </div>
            <div className={`c-metric-value ${dailyCashFlow < 0 ? "text-[var(--color-error)]" : "text-[var(--color-info)]"}`}>
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
            <div className="c-metric-value text-[var(--color-text)]">{formatVND(avgDailyExpense)}</div>
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
            <div className="c-metric-value text-[var(--color-text)]">{formatVND(eomForecast)}</div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{t("at current rate", "theo nhịp chi hiện tại")}</div>
          </div>
        </div>
      </div>

      {/* Còn thiếu gì: ngày chưa ghi sổ, nợ sắp trả, dữ liệu cần bổ sung. Thẻ
          "Hôm nay" đã lên đầu trang. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Ngày chưa ghi sổ. Đây là lỗ hổng lớn nhất và cũng là thứ khó tự
              nhận ra nhất: mọi biểu đồ vẫn vẽ đẹp trên phần dữ liệu ít ỏi. */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center">
                <CalendarDays size={16} />
              </div>
              <h3 className="c-h5 text-[var(--color-text)]">{t("Days not recorded", "Ngày chưa ghi sổ")}</h3>
            </div>
            {blankDays.length === 0 ? (
              <p className="text-sm text-[var(--color-success)]">
                {t("Every day so far has at least one record.", "Mọi ngày đã qua đều có ít nhất một khoản.")}
              </p>
            ) : (
              <>
                <p className="text-2xl font-bold text-[var(--color-warning)]">
                  {blankDays.length}
                  <span className="text-base font-normal text-[var(--color-text-faint)]">/{daysToCheck}</span>
                </p>
                <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-3">
                  {t("days with nothing recorded", "ngày không có khoản nào")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {blankDays.map((d) => (
                    <span
                      key={d}
                      className="min-w-8 h-8 px-2 flex items-center justify-center rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] tabular-nums"
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  {t(
                    "Charts below only cover the days that were recorded.",
                    "Các biểu đồ bên dưới chỉ phản ánh những ngày đã ghi."
                  )}
                </p>
              </>
            )}
          </div>

          {/* Sắp phải trả — trả lời "tháng tới cần chuẩn bị bao nhiêu tiền".
              Số lấy từ lịch trả nợ từng kỳ chứ không từ `Debt.monthlyPayment`,
              vì kỳ trả thật đổi theo số ngày và dư nợ mỗi tháng. */}
          {upcoming.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-error-tint)] text-[var(--color-error)] flex items-center justify-center flex-none">
                  <CalendarClock size={16} />
                </div>
                <h3 className="c-h5 text-[var(--color-text)]">
                  {t("Debt coming due", "Sắp phải trả nợ")}
                </h3>
              </div>
              <p className="text-2xl font-bold text-[var(--color-error)]">
                {formatVND(upcoming[0].payment)}
              </p>
              <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-3">
                {t("in", "trong")} {upcoming[0].month} · {t("principal", "gốc")}{" "}
                {formatVND(upcoming[0].principal)} + {t("interest", "lãi")}{" "}
                {formatVND(upcoming[0].interest)}
              </p>
              <ul className="space-y-1.5">
                {upcoming.slice(0, 6).map((u) => (
                  <li key={u.month} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">{u.month}</span>
                    <span className="font-bold tabular-nums text-[var(--color-text)]">
                      {formatVND(u.payment)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                {t("next 6 months", "sáu tháng tới")}:{" "}
                <b>{formatVND(upcoming.reduce((s, u) => s + u.payment, 0))}</b>
              </p>
            </div>
          )}

          {/* Dữ liệu cần bổ sung — gom mọi lỗ hổng đã biết vào một chỗ bấm được */}
          {gapTotal > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center">
                  <ListChecks size={16} />
                </div>
                <h3 className="c-h5 text-[var(--color-text)]">{t("Data to fill in", "Dữ liệu cần bổ sung")}</h3>
              </div>
              <ul className="space-y-2 text-sm">
                {gaps.missingSubGroup > 0 && (
                  <li>
                    <button
                      onClick={() => setIsIncompleteOpen(true)}
                      className="w-full text-left flex items-center justify-between gap-3 rounded-lg px-3 min-h-11 bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text)]"
                    >
                      <span>{t("missing sub-category", "thiếu danh mục con")}</span>
                      <span className="font-bold tabular-nums">{gaps.missingSubGroup}</span>
                    </button>
                  </li>
                )}
                {gaps.unknownPayment > 0 && (
                  <li className="flex items-center justify-between gap-3 px-3 min-h-11 text-[var(--color-text-muted)]">
                    <span>{t("payment method unknown", "chưa rõ cách thanh toán")}</span>
                    <span className="font-bold tabular-nums">{gaps.unknownPayment}</span>
                  </li>
                )}
                {gaps.pendingDrafts > 0 && (
                  <li className="flex items-center justify-between gap-3 px-3 min-h-11 text-[var(--color-warning)]">
                    <span>{t("scanned receipts awaiting review", "hoá đơn quét chờ duyệt")}</span>
                    <span className="font-bold tabular-nums">{gaps.pendingDrafts}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
      </div>

      <PeriodComparison
        metrics={["income", "expense", "cashOut", "debtService", "net"]}
        refreshKey={refreshKey}
      />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="c-h5 text-[var(--color-text)] mb-6">
            {t("Daily Spending Trend (with 7-day MA)", "Xu hướng chi theo ngày (Kèm MA 7-ngày)")}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-text-faint)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-text-faint)" }} tickFormatter={(v) => compactMoney(Number(v), language === "vi")} />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Line type="monotone" dataKey="expense" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3, fill: "var(--chart-1)" }} activeDot={{ r: 6 }} name={t("Daily Expense", "Chi tiêu hằng ngày")} />
                <Line type="monotone" dataKey="ma7" stroke="var(--chart-3)" strokeWidth={2} dot={false} name="7-day MA" />
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
                        // Màu ô lấy từ token chứ không viết cứng: bản đồ nhiệt
                        // là thứ duy nhất trong Dashboard tự pha màu theo độ
                        // đậm, nên nó phải đổi theo bảng màu đang dùng.
                        backgroundColor:
                          cell.expense > 0
                            ? `rgba(var(--heat-rgb), ${0.15 + intensity * 0.85})`
                            : "var(--heat-empty)",
                        color:
                          intensity > 0.5
                            ? "var(--heat-fg-strong)"
                            : "var(--color-text-faint)",
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
              {/* Hai gradient cũ (colorIncome / colorExpense) là code chết:
                  globals.css tô mọi `.recharts-area-area` bằng --chart-1 nên
                  cả hai vùng ra CÙNG một màu, chỉ viền là khác. Bỏ gradient,
                  xin màu riêng qua .c-chart-multi giống biểu đồ cột chồng. */}
              <AreaChart data={ytdSeries} className="c-chart-multi">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" {...monthAxis(ytdSeries.map((d) => d.name))} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-text-faint)" }} tickFormatter={(v) => compactMoney(Number(v), language === "vi")} />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Area type="monotone" dataKey="cumulativeIncome" className="c-series-1" stroke="var(--chart-1)" strokeWidth={3} fill="var(--chart-1)" name={t("Cumulative Income", "Luỹ kế Thu")} />
                <Area type="monotone" dataKey="cumulativeExpense" className="c-series-3" stroke="var(--chart-3)" strokeWidth={3} fill="var(--chart-3)" name={t("Cumulative Expense", "Luỹ kế Chi")} />
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
            {/* Trả nợ vượt thu nhập: phần chênh phải lấy từ tiết kiệm hoặc vay
                thêm. Đây là cảnh báo nặng nhất trong bảng nên đặt lên đầu. */}
            {debtServiceRatio !== null && debtServiceRatio > 100 && (
              <div className="bg-[var(--color-error-tint)] border border-[var(--color-error)] text-[var(--color-error)] rounded-xl p-4 text-sm font-medium flex items-start gap-3">
                <Scale size={16} className="flex-none mt-0.5" />
                <span>
                  <b>
                    {t("Debt payments exceed income", "Tiền trả nợ vượt quá thu nhập")}
                  </b>
                  {": "}
                  {formatVND(debtService)} / {formatVND(monthlyIncome)} ={" "}
                  {debtServiceRatio}%.{" "}
                  {t(
                    "The gap has to come from savings or new borrowing.",
                    "Phần chênh phải lấy từ tiết kiệm hoặc vay thêm."
                  )}
                </span>
              </div>
            )}
            {debtServiceRatio !== null && debtServiceRatio > 50 && debtServiceRatio <= 100 && (
              <div className="bg-[var(--color-warning-tint)] border border-[var(--color-warning)] text-[var(--color-warning)] rounded-xl p-4 text-sm font-medium flex items-start gap-3">
                <Scale size={16} className="flex-none mt-0.5" />
                <span>
                  {t("Debt takes", "Trả nợ chiếm")} <b>{debtServiceRatio}%</b>{" "}
                  {t("of this month's income", "thu nhập tháng này")} (
                  {formatVND(debtService)}).
                </span>
              </div>
            )}
            {savingsRate < 0 && (
              <div className="bg-[var(--color-warning-tint)] border border-[var(--color-warning)] text-[var(--color-warning)] rounded-xl p-4 text-sm font-medium flex items-center gap-3">
                <TrendingUp size={16} className="flex-none" />
                {t("Spending exceeded income this month.", "Tháng này chi vượt thu.")}
              </div>
            )}
            {/* Chiều ngược lại của "vượt ngân sách", và thường đúng hơn: một
                nhóm đặt ngân sách mà cuối tháng vẫn bằng 0 gần như luôn là
                thiếu ghi chứ không phải không tiêu. Chỉ nhắc khi tháng đã đi
                được quá nửa, không thì đầu tháng nhóm nào cũng bằng 0. */}
            {zeroSpendBudgets.length > 0 && (
              <div className="bg-[var(--color-warning-tint)] border border-[var(--color-warning)] text-[var(--color-warning)] rounded-xl p-4 text-sm font-medium flex items-start gap-3">
                <CalendarX size={16} className="flex-none mt-0.5" />
                <span>
                  {t(
                    "Budgeted but nothing spent yet — likely unrecorded: ",
                    "Có ngân sách mà chưa chi đồng nào, nhiều khả năng là chưa ghi: "
                  )}
                  <b>{zeroSpendBudgets.map((b) => b.group).join(", ")}</b>
                </span>
              </div>
            )}
            {unclassified.length > 0 && (
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-xl p-4 text-sm font-medium flex items-center gap-3">
                <Receipt size={16} className="flex-none" />
                {t("Not counted as income/expense:", "Không tính vào thu/chi:")}{" "}
                {unclassified.map((u) => `${u.type} (${u.count})`).join(", ")}
              </div>
            )}
            {overBudget.length === 0 && savingsRate >= 0 && unclassified.length === 0 && zeroSpendBudgets.length === 0 && (debtServiceRatio === null || debtServiceRatio <= 50) && (
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
