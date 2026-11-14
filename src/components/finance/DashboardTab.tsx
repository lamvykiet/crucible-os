"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  Calendar, Receipt, DollarSign, CreditCard, ArrowLeftRight, Target,
  PiggyBank, AlertCircle, TrendingUp, CalendarX, ListChecks, CalendarDays,
  Banknote, CalendarClock, Scale, RefreshCw, CheckCircle2,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Cell, ReferenceLine,
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
import { ArrowDownLeft, ArrowUpRight, Store } from "lucide-react";
import MonthBreakdown from "./MonthBreakdown";
import { thisMonthLocalIso, todayLocalIso } from "@/lib/localDate";
import { compactMoney } from "@/lib/formatMoney";
import { formatVND } from "@/lib/formatMoney";
import { monthAxis } from "./MonthAxisTick";
import WeekPanel from "./WeekPanel";
import { VIZ, GRID, BAR, STACK_GAP, LINE, TOOLTIP, TOOLTIP_LINE, xAxis, yAxis, labelAt, pctChange, soft, refLabel } from "@/lib/viz";
import ChartCard from "@/components/charts/ChartCard";
import MetricCard, { type MetricTone } from "@/components/charts/MetricCard";
import SectionHeader from "@/components/charts/SectionHeader";
import RankBar, { RankList } from "@/components/charts/RankBar";

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
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** "2026-10" → "10/2026" */
const mLabel = (k: string) => {
  const [y, m] = k.split("-");
  return m ? `${m}/${y}` : k;
};

/** Dáng chung của trạng thái rỗng trong thẻ. */
const EMPTY_NOTE = "py-6 text-center text-sm text-[var(--color-text-muted)]";

/** Một MỤC của trang: tiêu đề mục đi liền nội dung của nó (gần nhau = cùng nhóm). */
const SECTION = "flex flex-col gap-[var(--block-gap)]";

/**
 * Số tiền trong `MetricCard`: không xuống dòng, và co cỡ chữ theo bề ngang THẺ
 * (thẻ phải mang `@container`). Lưới 2 cột ở khổ 375px cho mỗi thẻ ~166px; số
 * "123.400.000 ₫" ở cỡ gốc 26px thì rớt chữ "₫" xuống dòng riêng. `1em` là cỡ
 * của `.c-metric-value` bên ngoài, nên trên máy tính con số giữ nguyên cỡ.
 */
function Fit({ children }: { children: ReactNode }) {
  return <span className="block whitespace-nowrap text-[length:clamp(15px,10.5cqi,1em)]">{children}</span>;
}

/** Một dòng cảnh báo: icon mang màu (đỏ = xấu, xanh = tốt, xám = ghi nhận), chữ màu mực. */
function AlertRow({ tone, icon, children }: { tone: "bad" | "good" | "note"; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0 flex items-start gap-3 text-sm text-[var(--color-text)]">
      <span
        className={`flex-none mt-0.5 ${
          tone === "bad"
            ? "text-[var(--color-error)]"
            : tone === "good"
              ? "text-[var(--color-success)]"
              : "text-[var(--color-text-faint)]"
        }`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

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

  // --- Đầu trang: MỘT bản cho cả nhánh có dữ liệu lẫn nhánh tháng trống -------
  const openAdd = (type: "Expense" | "Income") => {
    setTransactionType(type);
    setIsTransactionModalOpen(true);
  };
  const bump = () => setRefreshKey((prev) => prev + 1);
  const monthTag = mLabel(selectedMonth || data.month);

  // Điện thoại: hai hàng CÓ CHỦ Ý — chọn tháng + hàng chờ duyệt ở trên, ba nút
  // hành động chia đều bề ngang ở dưới, có chữ. Bản trước là năm nút icon trong
  // một hàng `flex-wrap`: nút chờ duyệt rớt xuống hàng riêng, và không nút nào
  // là nút chính. Dấu `!` trên padding là bắt buộc — `.c-btn` nằm ngoài @layer.
  const actionBtn = "c-btn h-11 min-w-0 px-2! [&>svg]:shrink-0 md:h-auto md:px-5! md:py-2.5!";
  const pageHeader = (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="c-h2 c-page-title text-[var(--color-text)]">{t("Overview", "Tổng quan")}</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t(
            "Today, this week, this month — and where you stand",
            "Hôm nay, tuần này, tháng này — và mình đang đứng ở đâu"
          )}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:items-center md:gap-3">
        <div className="col-span-2 min-w-0">
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
        <div className="flex justify-end md:order-last">
          <PendingReviewButton refreshKey={refreshKey} onProcessed={bump} />
        </div>
        <button
          onClick={() => openAdd("Expense")}
          title={t("Add expense", "Thêm chi phí")}
          className={`${actionBtn} c-btn-primary`}
        >
          <ArrowUpRight size={16} />
          <span className="md:hidden">{t("Expense", "Chi phí")}</span>
          <span className="hidden md:inline">{t("Add expense", "Thêm chi phí")}</span>
        </button>
        <button
          onClick={() => openAdd("Income")}
          title={t("Add income", "Thêm thu nhập")}
          className={`${actionBtn} c-btn-secondary`}
        >
          <ArrowDownLeft size={16} />
          <span className="md:hidden">{t("Income", "Thu nhập")}</span>
          <span className="hidden md:inline">{t("Add income", "Thêm thu nhập")}</span>
        </button>
        <button
          onClick={() => setIsScanModalOpen(true)}
          title={t("Scan a receipt", "Quét hoá đơn")}
          className={`${actionBtn} c-btn-secondary`}
        >
          <Receipt size={16} />
          <span className="md:hidden">{t("Scan", "Quét")}</span>
          <span className="hidden md:inline">{t("Scan a receipt", "Quét hoá đơn")}</span>
        </button>
      </div>
    </div>
  );

  const modals = (
    <>
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setScannedData(null);
        }}
        onSuccess={bump}
        defaultType={transactionType}
        initialData={scannedData}
      />
      <ScanInvoiceModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onSuccess={() => {
          setIsScanModalOpen(false);
          bump();
        }}
      />
    </>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center gap-3 h-64 text-sm text-[var(--color-text-muted)]">
        <RefreshCw size={18} className="animate-spin" aria-hidden />
        {t("Loading data...", "Đang tải dữ liệu...")}
      </div>
    );
  }

  if (errorCode) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <AlertCircle size={28} className="text-[var(--color-error)]" aria-hidden />
        <p className="text-sm font-bold text-[var(--color-text)]">
          {errorCode === "network"
            ? t("Could not reach the server.", "Không kết nối được tới máy chủ.")
            : apiMessage ||
              t("Could not load the overview.", "Không tải được dữ liệu tổng quan.")}
        </p>
        <button onClick={bump} className="c-btn c-btn-secondary c-btn-sm min-h-11">
          <RefreshCw size={14} /> {t("Try again", "Thử lại")}
        </button>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-8 animate-in fade-in">
        {pageHeader}
        {modals}

        <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] flex flex-col items-center gap-4 py-12! text-center">
          <span className="w-14 h-14 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center" aria-hidden>
            <CalendarX size={26} />
          </span>
          <div>
            <p className="c-h4 text-[var(--color-text)]">
              {t(`Nothing recorded in ${monthTag}`, `Tháng ${monthTag} chưa có giao dịch nào`)}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {t(
                "Add the first one or scan a receipt with the buttons above.",
                "Ghi khoản đầu tiên hoặc quét một hoá đơn bằng các nút phía trên."
              )}
            </p>
          </div>
          {latestMonthWithData && latestMonthWithData !== selectedMonth && (
            <button
              onClick={() => setSelectedMonth(latestMonthWithData)}
              className="c-btn c-btn-secondary min-h-11"
            >
              {t("Go to", "Xem tháng")} {mLabel(latestMonthWithData)}
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

  // --- Biểu đồ: câu kết luận tính từ dữ liệu (docs/bieu-do.md §1) -----------
  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);

  // Tháng có tự trả nổi không: chỉ xét tháng đã trọn (xem completedMonths).
  const overspentSet = new Set(completedMonths.filter((m) => m.cashOut > m.income).map((m) => m.name));
  const payHeadline =
    completedMonths.length === 0
      ? t("Can each month pay for itself?", "Từng tháng có tự trả nổi không?")
      : overspentMonths === 0
        ? t(
            `All ${completedMonths.length} finished months paid for themselves`,
            `Cả ${completedMonths.length} tháng đã trọn đều tự trả nổi`
          )
        : t(
            `Cash out beat income in ${overspentMonths} of the last ${completedMonths.length} months`,
            `${overspentMonths}/${completedMonths.length} tháng gần nhất tiền ra vượt thu nhập`
          );

  // Nhịp chi: trung bình 7 ngày ở ngày cuối so với trung bình cả tháng.
  const lastDaily = dailySeries[dailySeries.length - 1];
  const ma7Now = lastDaily ? Math.round(lastDaily.ma7) : 0;
  const pacePct = pctChange(ma7Now, avgDailyExpense);
  const last7 = isCurrentMonth ? t("Last 7 days", "7 ngày gần nhất") : t("The month's last 7 days", "7 ngày cuối tháng");
  const dailyHeadline =
    !lastDaily || (ma7Now === 0 && avgDailyExpense === 0)
      ? t("Daily spending", "Chi tiêu theo ngày")
      : pacePct === null || Math.abs(pacePct) < 5
        ? t(
            `Spending pace steady at ${money(ma7Now)} a day`,
            `Nhịp chi đều quanh ${money(ma7Now)}/ngày`
          )
        : t(
            `${last7}: ${money(ma7Now)} a day — ${Math.abs(pacePct)}% ${pacePct > 0 ? "above" : "below"} the month's average`,
            `${last7} chi ${money(ma7Now)}/ngày — ${pacePct > 0 ? "cao" : "thấp"} hơn trung bình tháng ${Math.abs(pacePct)}%`
          );

  const peakDay = heatmap.reduce<(typeof heatmap)[number] | null>(
    (best, h) => (h.expense > 0 && (!best || h.expense > best.expense) ? h : best),
    null
  );
  const heatHeadline = peakDay
    ? t(
        `Biggest day: ${peakDay.day}/${Number(monthStr)} — ${money(peakDay.expense)}`,
        `Ngày chi nhiều nhất: ${peakDay.day}/${Number(monthStr)} — ${money(peakDay.expense)}`
      )
    : t("Spending by day", "Chi tiêu theo ngày");

  // Luỹ kế 12 tháng: khoảng cách cuối cùng giữa hai đường.
  const lastYtd = ytdSeries[ytdSeries.length - 1];
  const cumGap = lastYtd ? lastYtd.cumulativeIncome - lastYtd.cumulativeExpense : 0;
  const incomeOnTop = !lastYtd || lastYtd.cumulativeIncome >= lastYtd.cumulativeExpense;
  const cumHeadline =
    !lastYtd || (lastYtd.cumulativeIncome === 0 && lastYtd.cumulativeExpense === 0)
      ? t("12-month running totals", "Luỹ kế thu / chi 12 tháng")
      : cumGap >= 0
        ? t(`Over 12 months, income ran ${money(cumGap)} ahead of spending`, `12 tháng qua thu vượt chi ${money(cumGap)}`)
        : t(`Over 12 months, spending ran ${money(-cumGap)} ahead of income`, `12 tháng qua chi vượt thu ${money(-cumGap)}`);

  // Phân bổ chi tiêu: nhóm lớn nhất và tỷ trọng của nó.
  const catTotal = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const catShare = (n: number) => (catTotal > 0 ? Math.round((n / catTotal) * 100) : 0);
  const topCat = categoryBreakdown[0];
  const catHeadline = topCat
    ? t(
        `${topCat.group} is ${catShare(topCat.amount)}% of ${monthTag} spending`,
        `${topCat.group} chiếm ${catShare(topCat.amount)}% chi tiêu ${monthTag}`
      )
    : t("Expense distribution", "Phân bổ chi tiêu");

  // Ngân sách: nhóm vượt nhiều nhất lên đầu, rồi tới nhóm dùng gần hết.
  const budgetRows = [...budgetVsActual].sort(
    (a, b) => (b.budget > 0 ? b.actual / b.budget : 0) - (a.budget > 0 ? a.actual / a.budget : 0)
  );
  const worstOver = [...overBudget].sort((a, b) => a.remaining - b.remaining)[0];
  const budgetHeadline =
    budgetVsActual.length === 0
      ? t("Budget tracking", "Theo dõi ngân sách")
      : worstOver
        ? t(
            `${overBudget.length} group${overBudget.length > 1 ? "s" : ""} over budget — ${worstOver.group} by ${money(-worstOver.remaining)}`,
            `${overBudget.length} nhóm vượt ngân sách — nặng nhất ${worstOver.group}, vượt ${money(-worstOver.remaining)}`
          )
        : t(
            `All ${budgetVsActual.length} budgeted groups are within limits`,
            `Cả ${budgetVsActual.length} nhóm có ngân sách đều còn trong hạn mức`
          );

  // --- Màu của con số (luật v3) ----------------------------------------------
  // Số MỨC (thu, chi, dư nợ, giá trị) là màu mực. Đỏ/xanh chỉ khi con số TỰ NÓ
  // là tin xấu/tốt: dòng tiền âm, vượt ngân sách, giá trị ròng âm. Bản trước tô
  // thu nhập xanh kể cả khi bằng 0, chi tiêu màu thổ hoàng, tiền ra luôn đỏ —
  // sáu thẻ sáu màu, không còn màu nào báo được điều gì.
  const badIf = (cond: boolean): MetricTone => (cond ? "bad" : "neutral");
  const showDebtRatio = debtService > 0;
  const netWorth = worth ? worth.assets - worth.debt : 0;

  const ratedHealth = healthRows.filter((r) => r.band !== null);
  const goodHealth = ratedHealth.filter((r) => r.band === "good").length;
  const healthHeadline =
    ratedHealth.length === 0
      ? t("Financial health", "Sức khoẻ tài chính")
      : goodHealth === ratedHealth.length
        ? t(`All ${ratedHealth.length} ratios are within their thresholds`, `Cả ${ratedHealth.length} tỷ lệ đều trong ngưỡng`)
        : t(
            `${goodHealth} of ${ratedHealth.length} ratios are within their thresholds`,
            `${goodHealth}/${ratedHealth.length} tỷ lệ đang trong ngưỡng`
          );
  const bandWord = (b: "good" | "warn" | "bad" | null) =>
    b === "good" ? t("on target", "đạt") : b === "warn" ? t("watch", "cần chú ý") : b === "bad" ? t("off target", "chưa đạt") : "";

  // Cảnh báo: đếm đúng các điều kiện đang hiện bên dưới, để tiêu đề thẻ là một
  // câu kết luận thay cho "Cảnh báo & Gợi ý".
  const debtAlert = debtServiceRatio !== null && debtServiceRatio > 50;
  const alertCount =
    overBudget.length +
    (debtAlert ? 1 : 0) +
    (savingsRate < 0 ? 1 : 0) +
    (zeroSpendBudgets.length > 0 ? 1 : 0) +
    (unclassified.length > 0 ? 1 : 0);
  const alertHeadline =
    alertCount === 0
      ? t(`No alerts for ${monthTag}`, `Tháng ${monthTag} không có cảnh báo nào`)
      : t(
          `${alertCount} thing${alertCount > 1 ? "s" : ""} to look at in ${monthTag}`,
          `${alertCount} điều cần xem trong tháng ${monthTag}`
        );

  // Ba thẻ "còn thiếu gì" — số thẻ đổi theo dữ liệu, lưới đổi theo để không
  // thẻ nào mồ côi một hàng.
  const gapCards = 1 + (upcoming.length > 0 ? 1 : 0) + (gapTotal > 0 ? 1 : 0);

  const navBtn = (tab: string, label: string) => (
    <button
      key={tab + label}
      onClick={() => onNavigate?.(tab)}
      className="c-btn c-btn-secondary c-btn-sm min-h-11 md:min-h-9"
    >
      {label} <ArrowUpRight size={14} />
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in">
      {pageHeader}
      {modals}
      <IncompleteDataModal
        isOpen={isIncompleteOpen}
        onClose={() => setIsIncompleteOpen(false)}
        onSaved={bump}
      />

      {/* Mục đầu tiên: hôm nay chi gì (trái) và tỷ trọng theo nhóm (phải).
          Xem tháng đã qua thì hai thẻ theo ngày cuối cùng có ghi sổ. */}
      {focusDate ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <DayTransactionsCard
            date={focusDate}
            refreshKey={refreshKey}
            title={isCurrentMonth ? t("Today", "Hôm nay") : undefined}
            onAddTransaction={() => openAdd("Expense")}
          />
          <TodaySpendingShare
            date={focusDate}
            refreshKey={refreshKey}
            title={isCurrentMonth ? t("Today", "Hôm nay") : undefined}
          />
        </div>
      ) : (
        <ChartCard title={t("Daily detail", "Chi tiết theo ngày")}>
          <p className={EMPTY_NOTE}>{t("No transactions in this month at all.", "Tháng này chưa có giao dịch nào.")}</p>
        </ChartCard>
      )}

      {/* Tuần này. Nằm giữa thẻ "Hôm nay" và khối tháng vì sổ thường được ghi
          vào buổi tối: lúc đó cái cần là hôm nay tiêu gì, hôm qua tiêu gì, tuần
          này đang đi về đâu — chứ chưa phải cả tháng. */}
      <section className={SECTION}>
        <SectionHeader
          icon={<CalendarDays size={20} />}
          title={t("This week", "Tuần này")}
          actions={onNavigate && navBtn("history", t("All transactions", "Toàn bộ giao dịch"))}
        />
        <WeekPanel refreshKey={refreshKey} />
      </section>

      {/* Tháng này. Mỗi mục lớn của trang đều có lối đi tiếp sang tab con:
          trang này để NẮM, tab con để ĐÀO. */}
      <section className={SECTION}>
        <SectionHeader
          icon={<Calendar size={20} />}
          title={isCurrentMonth ? t("This month", "Tháng này") : t(`Month ${monthTag}`, `Tháng ${monthTag}`)}
          actions={
            onNavigate && (
              <>
                {navBtn("income", t("Income", "Thu nhập"))}
                {navBtn("expense", t("Spending", "Chi tiêu"))}
                {navBtn("history", t("All transactions", "Toàn bộ giao dịch"))}
              </>
            )
          }
        />

        {/* MỘT lưới cân: 2 cột trên điện thoại, 3 cột trên máy tính (6 thẻ).
            Có thẻ "Trả nợ / thu nhập" thì thành 7 — khi đó lưới 4 cột và thẻ
            dòng tiền ròng chiếm hai cột, nên vẫn không thẻ nào mồ côi. Bản trước
            là 5 thẻ trong lưới 4 cột cộng 1 thẻ ở lưới riêng: hai thẻ lẻ hàng. */}
        <div className={`grid grid-cols-2 gap-4 ${showDebtRatio ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          <MetricCard
            className="@container"
            icon={<DollarSign size={18} />}
            label={t("Income", "Thu nhập")}
            value={<Fit>{formatVND(monthlyIncome)}</Fit>}
          />
          <MetricCard
            className="@container"
            icon={<CreditCard size={18} />}
            label={t("Spending", "Chi tiêu")}
            value={<Fit>{formatVND(monthlyExpense)}</Fit>}
          />
          {/* Nói rõ dòng tiền đã trừ cả trả gốc — trước đây thẻ này lấy thu trừ
              chi tiêu rồi gọi là dòng tiền, bỏ sót nguyên phần gốc. */}
          <MetricCard
            className={`@container ${showDebtRatio ? "col-span-2" : ""}`}
            icon={<ArrowLeftRight size={18} />}
            label={t("Net cash flow", "Dòng tiền ròng")}
            tone={badIf(netCashFlow < 0)}
            value={<Fit>{formatVND(netCashFlow)}</Fit>}
            note={
              <span className="tabular-nums">
                {t("income − cash out", "thu − tiền ra")} {formatVND(cashOut)}
              </span>
            }
          />
          {/* Tiền ra: thứ cần biết để chuẩn bị tiền mặt, khác với chi tiêu */}
          <MetricCard
            className="@container"
            icon={<Banknote size={18} />}
            label={t("Cash out", "Tiền ra thực tế")}
            value={<Fit>{formatVND(cashOut)}</Fit>}
            note={
              <span className="tabular-nums">
                {t("spending", "chi tiêu")} {money(monthlyExpense)}
                {debtPrincipal > 0 && ` + ${t("principal", "trả gốc")} ${money(debtPrincipal)}`}
              </span>
            }
          />
          <MetricCard
            className="@container"
            icon={<Target size={18} />}
            label={t("Budget used", "Ngân sách đã dùng")}
            tone={budgetUsedPct === null ? "faint" : badIf(budgetUsedPct > 100)}
            value={budgetUsedPct === null ? "—" : `${budgetUsedPct}%`}
            note={
              budgetUsedPct === null ? (
                t("no budget set for this month", "chưa đặt ngân sách tháng")
              ) : (
                <span className="tabular-nums">
                  {money(cashOut)} / {money(totalBudget)}
                </span>
              )
            }
          >
            {budgetUsedPct !== null && (
              <RankBar
                value={cashOut}
                scale={Math.max(cashOut, totalBudget)}
                mark={totalBudget}
                color={budgetUsedPct > 100 ? VIZ.accent : VIZ.muted}
              />
            )}
          </MetricCard>
          {/* Không kẹp về 0 — tháng bội chi phải nhìn thấy được. Chưa ghi đồng
              thu nhập nào thì tỷ lệ không tính được: hiện "0%" đọc như "tiêu
              sạch những gì kiếm được", trong khi sự thật là chưa có gì để chia. */}
          <MetricCard
            className="@container"
            icon={<PiggyBank size={18} />}
            label={t("Savings rate", "Tỷ lệ tiết kiệm")}
            tone={monthlyIncome === 0 ? "faint" : badIf(savingsRate < 0)}
            value={monthlyIncome === 0 ? "—" : `${savingsRate}%`}
            note={
              monthlyIncome === 0
                ? t("no income recorded this month", "chưa ghi thu nhập tháng này")
                : savingsRate < 0
                  ? t("overspending this month", "tháng này chi vượt thu")
                  : t("retained income", "phần thu nhập giữ lại")
            }
          />
          {/* Gánh nặng trả nợ. Khoản này bắt buộc, không cắt giảm được như tiền
              ăn uống — nên phải soi riêng chứ không trộn vào tổng chi. */}
          {showDebtRatio && (
            <MetricCard
              className="@container"
              icon={<Scale size={18} />}
              label={t("Debt vs income", "Trả nợ / thu nhập")}
              tone={debtServiceRatio === null ? "faint" : badIf(debtServiceRatio > 100)}
              value={debtServiceRatio === null ? "—" : `${debtServiceRatio}%`}
              note={
                debtServiceRatio === null ? (
                  t("no income recorded this month", "chưa ghi thu nhập tháng này")
                ) : (
                  <span className="tabular-nums">
                    {money(debtService)} / {money(monthlyIncome)}
                  </span>
                )
              }
            />
          )}
        </div>
      </section>

      {/* Chi vào đâu, thu từ đâu. Thẻ phía trên nói "tháng này chi bao nhiêu";
          khối này nói "chi cho AI, cho NHÓM nào" — và so với tháng trước, cùng
          tháng năm trước, luỹ kế năm nay với cùng kỳ năm trước. */}
      <section className={SECTION}>
        <SectionHeader
          icon={<Store size={20} />}
          title={t("Where it goes, where it comes from", "Chi vào đâu, thu từ đâu")}
        />
        <MonthBreakdown month={selectedMonth || thisMonthLocalIso()} refreshKey={refreshKey} />
      </section>

      {/* Tài sản & Nợ. Hai con số tổng của cả Finance nằm ở đây: đang sở hữu
          bao nhiêu và đang nợ bao nhiêu. Trước đây phải mở hai tab khác nhau
          mới biết, nên đọc xong trang này vẫn chưa nắm được mình đứng ở đâu. */}
      {worth && (worth.assets > 0 || worth.debt > 0) && (
        <section className={SECTION}>
          <SectionHeader
            icon={<Scale size={20} />}
            title={t("Assets & Debt", "Tài sản & Nợ")}
            actions={
              onNavigate && (
                <>
                  {navBtn("assets", t("Assets", "Tài sản"))}
                  {navBtn("debts", t("Debts", "Nợ"))}
                </>
              )
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Giá trị ròng trừ TOÀN BỘ dư nợ, không chỉ phần nợ gắn với tài
                sản — vay tín chấp vẫn là tiền phải trả. */}
            <MetricCard
              className="@container"
              icon={<Scale size={18} />}
              label={t("Net worth", "Giá trị ròng")}
              tone={badIf(netWorth < 0)}
              value={<Fit>{formatVND(netWorth)}</Fit>}
              note={t("assets − debt", "tài sản − dư nợ")}
            />
            <MetricCard
              className="@container"
              icon={<Banknote size={18} />}
              label={t("Assets today", "Tài sản hôm nay")}
              value={<Fit>{formatVND(worth.assets)}</Fit>}
              note={`${worth.assetCount} ${t("items, after depreciation", "món, đã trừ khấu hao")}`}
            />
            <MetricCard
              className="@container"
              icon={<CreditCard size={18} />}
              label={t("Debt outstanding", "Dư nợ còn lại")}
              value={<Fit>{formatVND(worth.debt)}</Fit>}
              note={`${worth.debtCount} ${t("loans still running", "khoản đang trả")}`}
            />
            <MetricCard
              className="@container"
              icon={<CalendarClock size={18} />}
              label={t("Repayment / month", "Trả nợ mỗi tháng")}
              value={<Fit>{formatVND(worth.monthlyPayment)}</Fit>}
              note={
                monthlyIncome > 0
                  ? t(
                      `${Math.round((worth.monthlyPayment / monthlyIncome) * 100)}% of this month's income`,
                      `${Math.round((worth.monthlyPayment / monthlyIncome) * 100)}% thu nhập tháng này`
                    )
                  : t("no income recorded this month", "chưa ghi thu nhập tháng này")
              }
            />
          </div>
        </section>
      )}

      {/* Sức khoẻ tài chính và khả năng chi trả. Các thẻ trên nói "bao nhiêu",
          hai khối này nói "như vậy là ổn hay không ổn" — phần mà người đọc vẫn
          phải tự suy ra, và thường suy sai theo hướng lạc quan. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ChartCard
          title={healthHeadline}
          subtitle={t(
            "Financial health · each line carries the threshold a lender would use",
            "Sức khoẻ tài chính · mỗi dòng kèm ngưỡng mà bên cho vay vẫn dùng để thẩm định"
          )}
        >
          <ul className="divide-y divide-[var(--color-border)]">
            {healthRows.map((r) => (
              <li key={r.key} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text)]">{r.label}</p>
                  <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{r.note}</p>
                </div>
                <div className="flex-none text-right">
                  {/* Xanh/đỏ chỉ cho hai đầu "đạt" và "chưa đạt"; mức giữa là
                      màu mực kèm chữ — thổ hoàng không mang nghĩa tốt/xấu. */}
                  <div
                    className={`c-metric-value-sm ${
                      r.band === "good"
                        ? "text-[var(--color-success)]"
                        : r.band === "bad"
                          ? "text-[var(--color-error)]"
                          : r.band === "warn"
                            ? "text-[var(--color-text)]"
                            : "text-[var(--color-text-faint)]"
                    }`}
                  >
                    {r.display}
                  </div>
                  <div className="text-xs text-[var(--color-text-faint)] mt-0.5">
                    {r.band && <b className="text-[var(--color-text-muted)]">{bandWord(r.band)} · </b>}
                    {r.hint}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title={payHeadline}
          subtitle={t(
            "Cash out per month — spending plus principal repaid — against income, last 12 months",
            "Tiền ra mỗi tháng — chi tiêu cộng trả gốc — so với thu nhập, 12 tháng gần nhất"
          )}
          keys={[
            { label: t("Spending", "Chi tiêu"), color: VIZ.muted, shape: "bar" },
            { label: t("Principal repaid", "Trả gốc"), color: soft(VIZ.muted), shape: "bar" },
            ...(overspentMonths > 0
              ? [{ label: t("Month cash out beat income", "Tháng tiền ra vượt thu"), color: VIZ.accent, shape: "bar" as const }]
              : []),
            { label: t("Income", "Thu nhập"), color: VIZ.ink, shape: "line" },
          ]}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ytdSeries} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...monthAxis(ytdSeries.map((d) => d.name))} />
                <YAxis {...yAxis(money)} />
                <Tooltip {...TOOLTIP} formatter={(v, n) => [formatVND(Number(v) || 0), n]} labelFormatter={(l) => mLabel(String(l))} />
                {/* Chi tiêu và trả gốc chồng lên nhau vì cùng là tiền rời tài
                    khoản, nhưng tách khúc: phần trả gốc KHÔNG cắt được khi thu
                    hụt, phần chi tiêu thì có. Tháng đã trọn mà tiền ra vượt thu
                    mang màu nhấn — đó là những tháng tiêu đề nói tới. */}
                <Bar dataKey="expense" stackId="out" name={t("Spending", "Chi tiêu")} fill={VIZ.muted} maxBarSize={BAR.maxBarSize} {...STACK_GAP}>
                  {ytdSeries.map((m) => (
                    <Cell key={m.name} fill={overspentSet.has(m.name) ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
                <Bar dataKey="debtPrincipal" stackId="out" name={t("Principal repaid", "Trả gốc")} fill={soft(VIZ.muted)} {...BAR} {...STACK_GAP}>
                  {ytdSeries.map((m) => (
                    <Cell key={m.name} fill={soft(overspentSet.has(m.name) ? VIZ.accent : VIZ.muted)} />
                  ))}
                </Bar>
                {/* Đường thu nhập: cột nào vượt qua đường là tháng đó không tự
                    trả nổi, phải bù từ tiền để dành hoặc vay thêm. */}
                <Line dataKey="income" name={t("Income", "Thu nhập")} stroke={VIZ.ink} {...LINE} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Chỉ số hôm nay. 2 cột dưới 1280px (thẻ cuối chiếm trọn hàng), 5 cột
          từ đó trở lên — 5 thẻ trong lưới 3 cột thì lẻ hai thẻ. */}
      <section className={SECTION}>
        <SectionHeader icon={<Calendar size={20} />} title={t("Today's metrics", "Chỉ số hôm nay")} />
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <MetricCard
            className="@container"
            size="sm"
            icon={<DollarSign size={16} />}
            label={t("Daily income", "Thu nhập ngày")}
            value={<Fit>{formatVND(dailyIncome)}</Fit>}
            note={t("today", "hôm nay")}
          />
          <MetricCard
            className="@container"
            size="sm"
            icon={<CreditCard size={16} />}
            label={t("Daily spending", "Chi tiêu ngày")}
            value={<Fit>{formatVND(dailyExpense)}</Fit>}
            note={t("today", "hôm nay")}
          />
          <MetricCard
            className="@container"
            size="sm"
            icon={<ArrowLeftRight size={16} />}
            label={t("Daily cash flow", "Dòng tiền ngày")}
            tone={badIf(dailyCashFlow < 0)}
            value={<Fit>{formatVND(dailyCashFlow)}</Fit>}
            note={t("today", "hôm nay")}
          />
          <MetricCard
            className="@container"
            size="sm"
            icon={<Calendar size={16} />}
            label={t("Avg daily spending", "Chi TB mỗi ngày")}
            value={<Fit>{formatVND(avgDailyExpense)}</Fit>}
            note={`${t("over", "qua")} ${elapsedDays} ${t("days", "ngày")}`}
          />
          <MetricCard
            className="@container col-span-2 xl:col-span-1"
            size="sm"
            icon={<TrendingUp size={16} />}
            label={t("End-of-month forecast", "Dự báo chi cuối tháng")}
            value={<Fit>{formatVND(eomForecast)}</Fit>}
            note={t("estimate, at the current daily rate", "ước tính, theo nhịp chi hiện tại")}
          />
        </div>
      </section>

      {/* Còn thiếu gì: ngày chưa ghi sổ, nợ sắp trả, dữ liệu cần bổ sung. Thẻ
          "Hôm nay" đã lên đầu trang. */}
      <div
        className={`grid grid-cols-1 gap-6 items-start ${
          gapCards === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
        }`}
      >
        {/* Ngày chưa ghi sổ. Đây là lỗ hổng lớn nhất và cũng là thứ khó tự
            nhận ra nhất: mọi biểu đồ vẫn vẽ đẹp trên phần dữ liệu ít ỏi. */}
        <MetricCard
          size="sm"
          icon={<CalendarDays size={16} />}
          label={t("Days not recorded", "Ngày chưa ghi sổ")}
          tone={blankDays.length === 0 ? "good" : "neutral"}
          value={
            <>
              {blankDays.length}
              <span className="text-base text-[var(--color-text-faint)]">/{daysToCheck}</span>
            </>
          }
          note={
            blankDays.length === 0
              ? t("Every day so far has at least one record.", "Mọi ngày đã qua đều có ít nhất một khoản.")
              : t("days with nothing recorded", "ngày không có khoản nào")
          }
        >
          {blankDays.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {blankDays.map((d) => (
                  <span
                    key={d}
                    className="min-w-8 h-8 px-2 flex items-center justify-center rounded-lg bg-[var(--color-surface-2)] text-xs font-bold text-[var(--color-text-muted)] tabular-nums"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-faint)]">
                {t(
                  "Charts below only cover the days that were recorded.",
                  "Các biểu đồ bên dưới chỉ phản ánh những ngày đã ghi."
                )}
              </p>
            </>
          )}
        </MetricCard>

        {/* Sắp phải trả — trả lời "tháng tới cần chuẩn bị bao nhiêu tiền".
            Số lấy từ lịch trả nợ từng kỳ chứ không từ `Debt.monthlyPayment`,
            vì kỳ trả thật đổi theo số ngày và dư nợ mỗi tháng. */}
        {upcoming.length > 0 && (
          <MetricCard
            className="@container"
            size="sm"
            icon={<CalendarClock size={16} />}
            label={t("Debt coming due", "Sắp phải trả nợ")}
            aside={mLabel(upcoming[0].month)}
            value={<Fit>{formatVND(upcoming[0].payment)}</Fit>}
            note={
              <span className="tabular-nums">
                {t("principal", "gốc")} {money(upcoming[0].principal)} + {t("interest", "lãi")}{" "}
                {money(upcoming[0].interest)}
              </span>
            }
          >
            <ul className="flex flex-col gap-1.5">
              {upcoming.slice(0, 6).map((u) => (
                <li key={u.month} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-[var(--color-text-muted)] tabular-nums">{mLabel(u.month)}</span>
                  <span className="font-bold tabular-nums whitespace-nowrap text-[var(--color-text)]">
                    {formatVND(u.payment)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--color-text-faint)]">
              {t("next 6 months", "sáu tháng tới")}:{" "}
              <b className="tabular-nums whitespace-nowrap text-[var(--color-text)]">
                {formatVND(upcoming.reduce((s, u) => s + u.payment, 0))}
              </b>
            </p>
          </MetricCard>
        )}

        {/* Dữ liệu cần bổ sung — gom mọi lỗ hổng đã biết vào một chỗ bấm được */}
        {gapTotal > 0 && (
          <MetricCard
            size="sm"
            icon={<ListChecks size={16} />}
            label={t("Data to fill in", "Dữ liệu cần bổ sung")}
            value={gapTotal}
            note={t("items across the whole ledger", "mục, tính trên toàn bộ sổ")}
          >
            <ul className="flex flex-col gap-1.5 text-sm">
              {gaps.missingSubGroup > 0 && (
                <li>
                  <button
                    onClick={() => setIsIncompleteOpen(true)}
                    className="w-full text-left flex items-center justify-between gap-3 rounded-xl px-3 min-h-11 bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text)]"
                  >
                    <span>{t("missing sub-category", "thiếu danh mục con")}</span>
                    <span className="flex items-center gap-1.5 font-bold tabular-nums">
                      {gaps.missingSubGroup} <ArrowUpRight size={14} className="text-[var(--color-text-faint)]" />
                    </span>
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
                <li className="flex items-center justify-between gap-3 px-3 min-h-11 text-[var(--color-text-muted)]">
                  <span>{t("scanned receipts awaiting review", "hoá đơn quét chờ duyệt")}</span>
                  <span className="font-bold tabular-nums">{gaps.pendingDrafts}</span>
                </li>
              )}
            </ul>
          </MetricCard>
        )}
      </div>

      <PeriodComparison
        metrics={["income", "expense", "cashOut", "debtService", "net"]}
        refreshKey={refreshKey}
      />

      {/* Nhịp chi theo ngày + bản đồ nhiệt */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <ChartCard
          className="lg:col-span-2"
          title={dailyHeadline}
          subtitle={t(
            `Spending per day, ${monthTag} · line = 7-day average · dashed = month average`,
            `Chi mỗi ngày, ${monthTag} · đường = trung bình 7 ngày · nét đứt = trung bình tháng`
          )}
          keys={[
            { label: t("Each day", "Từng ngày"), color: VIZ.ghost, shape: "bar" },
            { label: t("7-day average", "Trung bình 7 ngày"), color: VIZ.accent, shape: "line" },
          ]}
        >
          {/* Cột ngày lùi về màu nhạt — từng ngày lên xuống thất thường, thứ
              cần đọc là đường trung bình 7 ngày, nên chỉ đường đó mang màu nhấn
              và ghi số ở điểm cuối. */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailySeries} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis
                  dataKey="name"
                  {...xAxis}
                  tickFormatter={(v) => String(Number(v))}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis {...yAxis(money)} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v, n) => [formatVND(Math.round(Number(v) || 0)), n]}
                  labelFormatter={(l) => `${Number(l)}/${Number(monthStr)}`}
                />
                {avgDailyExpense > 0 && (
                  <ReferenceLine
                    y={avgDailyExpense}
                    stroke={VIZ.muted}
                    strokeDasharray="4 3"
                    label={refLabel(`${t("month avg", "TB tháng")} ${money(avgDailyExpense)}`)}
                  />
                )}
                <Bar dataKey="expense" name={t("Spending", "Chi tiêu")} fill={VIZ.ghost} {...BAR} />
                <Line
                  dataKey="ma7"
                  name={t("7-day average", "Trung bình 7 ngày")}
                  stroke={VIZ.accent}
                  {...LINE}
                  label={labelAt(dailySeries.length - 1, money, { anchor: "end" })}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={heatHeadline}
          subtitle={t("One square per day — the darker, the more spent", "Mỗi ô một ngày — càng đậm càng chi nhiều")}
        >
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className="text-[10px] uppercase text-[var(--color-text-faint)] text-center">{t(WEEKDAYS_EN[i], d)}</div>
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
                      title={`${cell.day}/${Number(monthStr)}: ${formatVND(cell.expense)}`}
                      className="aspect-square rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums cursor-default"
                      style={{
                        // Màu ô lấy từ token chứ không viết cứng: bản đồ nhiệt
                        // là thứ duy nhất trên trang tự pha màu theo độ đậm,
                        // nên nó phải đổi theo bảng màu đang dùng. Một sắc độ
                        // duy nhất (tuần tự), không phải bảng nhiều màu.
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
        </ChartCard>
      </div>

      {/* Luỹ kế 12 tháng + phân bổ theo nhóm */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Bản cũ là hai vùng tô đậm chồng nhau — vùng sau che vùng trước và
            mắt đọc diện tích chứ không đọc khoảng cách. Hai đường mảnh, tên và
            số ghi thẳng ở đầu mút: khoảng hở giữa chúng chính là câu chuyện.
            Thu là đường XÁM (bối cảnh), chi là đường màu nhấn — `VIZ.ink` và
            `VIZ.accent` của hệ v3 đều là nâu, đặt cạnh nhau không phân biệt được. */}
        <ChartCard
          title={cumHeadline}
          subtitle={t(
            `Running totals from ${mLabel(ytdSeries[0]?.name ?? "")} · spending excludes principal repaid`,
            `Cộng dồn từ ${mLabel(ytdSeries[0]?.name ?? "")} · chi tiêu chưa gồm trả gốc`
          )}
          keys={[
            { label: t("Income", "Thu"), color: VIZ.muted, shape: "line" },
            { label: t("Spending", "Chi"), color: VIZ.accent, shape: "line" },
          ]}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ytdSeries} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...monthAxis(ytdSeries.map((d) => d.name))} />
                <YAxis {...yAxis(money)} />
                <Tooltip {...TOOLTIP_LINE} formatter={(v, n) => [formatVND(Number(v) || 0), n]} labelFormatter={(l) => mLabel(String(l))} />
                <Line
                  dataKey="cumulativeIncome"
                  name={t("Cumulative income", "Luỹ kế thu")}
                  stroke={VIZ.muted}
                  {...LINE}
                  label={labelAt(ytdSeries.length - 1, (v) => `${t("In", "Thu")} ${money(v)}`, { anchor: "end", dy: incomeOnTop ? -8 : 16 })}
                />
                <Line
                  dataKey="cumulativeExpense"
                  name={t("Cumulative spending", "Luỹ kế chi")}
                  stroke={VIZ.accent}
                  {...LINE}
                  label={labelAt(ytdSeries.length - 1, (v) => `${t("Out", "Chi")} ${money(v)}`, { anchor: "end", dy: incomeOnTop ? 16 : -8 })}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={catHeadline}
          subtitle={
            categoryBreakdown.length > 0
              ? t(`Spending by category, ${monthTag} · total ${formatVND(catTotal)}`, `Chi theo nhóm, ${monthTag} · tổng ${formatVND(catTotal)}`)
              : t(`Spending by category, ${monthTag}`, `Chi theo nhóm, ${monthTag}`)
          }
        >
          {categoryBreakdown.length === 0 ? (
            <p className={EMPTY_NOTE}>{t("No expenses this month", "Chưa có chi tiêu trong tháng")}</p>
          ) : (
            <div className="max-h-72 overflow-y-auto pr-2">
              <RankList
                format={formatVND}
                scale={maxCategory}
                rows={categoryBreakdown.map((c, i) => ({
                  key: c.group,
                  name: c.group,
                  amount: c.amount,
                  note: `${catShare(c.amount)}%`,
                  strong: i === 0,
                  color: i === 0 ? VIZ.accent : VIZ.muted,
                }))}
              />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Cảnh báo + ngân sách */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ChartCard title={alertHeadline} subtitle={t("Alerts & insights", "Cảnh báo & gợi ý")}>
          <ul className="divide-y divide-[var(--color-border)]">
            {/* Trả nợ vượt thu nhập: phần chênh phải lấy từ tiết kiệm hoặc vay
                thêm. Đây là cảnh báo nặng nhất trong bảng nên đứng đầu. */}
            {debtServiceRatio !== null && debtServiceRatio > 100 && (
              <AlertRow tone="bad" icon={<Scale size={16} />}>
                <b>{t("Debt payments exceed income", "Tiền trả nợ vượt quá thu nhập")}</b>
                {": "}
                {formatVND(debtService)} / {formatVND(monthlyIncome)} = {debtServiceRatio}%.{" "}
                {t(
                  "The gap has to come from savings or new borrowing.",
                  "Phần chênh phải lấy từ tiết kiệm hoặc vay thêm."
                )}
              </AlertRow>
            )}
            {overBudget.map((b) => (
              <AlertRow key={b.group} tone="bad" icon={<Target size={16} />}>
                <b>{b.group}</b> {t("is over budget by", "vượt ngân sách")} {formatVND(-b.remaining)}
              </AlertRow>
            ))}
            {debtServiceRatio !== null && debtServiceRatio > 50 && debtServiceRatio <= 100 && (
              <AlertRow tone="note" icon={<Scale size={16} />}>
                {t("Debt takes", "Trả nợ chiếm")} <b>{debtServiceRatio}%</b>{" "}
                {t("of this month's income", "thu nhập tháng này")} ({formatVND(debtService)}).
              </AlertRow>
            )}
            {savingsRate < 0 && (
              <AlertRow tone="bad" icon={<TrendingUp size={16} />}>
                {t("Spending exceeded income this month.", "Tháng này chi vượt thu.")}
              </AlertRow>
            )}
            {/* Chiều ngược lại của "vượt ngân sách", và thường đúng hơn: một
                nhóm đặt ngân sách mà cuối tháng vẫn bằng 0 gần như luôn là
                thiếu ghi chứ không phải không tiêu. Chỉ nhắc khi tháng đã đi
                được quá nửa, không thì đầu tháng nhóm nào cũng bằng 0. */}
            {zeroSpendBudgets.length > 0 && (
              <AlertRow tone="note" icon={<CalendarX size={16} />}>
                {t(
                  "Budgeted but nothing spent yet — likely unrecorded: ",
                  "Có ngân sách mà chưa chi đồng nào, nhiều khả năng là chưa ghi: "
                )}
                <b>{zeroSpendBudgets.map((b) => b.group).join(", ")}</b>
              </AlertRow>
            )}
            {unclassified.length > 0 && (
              <AlertRow tone="note" icon={<Receipt size={16} />}>
                {t("Not counted as income/expense:", "Không tính vào thu/chi:")}{" "}
                {unclassified.map((u) => `${u.type} (${u.count})`).join(", ")}
              </AlertRow>
            )}
            {alertCount === 0 && (
              <AlertRow tone="good" icon={<CheckCircle2 size={16} />}>
                {t("Everything looks healthy this month.", "Tháng này mọi chỉ số đều ổn.")}
              </AlertRow>
            )}
          </ul>
        </ChartCard>

        {/* Kiểu bullet: thanh = đã chi, vạch = hạn mức, mỗi dòng một thước
            riêng (hạn mức các nhóm chênh nhau cả chục lần). Thanh xám; nhóm
            vượt hạn mức mang màu nhấn và ghi rõ vượt bao nhiêu bằng chữ. */}
        <ChartCard
          title={budgetHeadline}
          subtitle={t(
            `Spent per budgeted group, ${monthTag} · tick = budget`,
            `Đã chi theo nhóm có ngân sách, ${monthTag} · vạch = hạn mức`
          )}
          keys={
            budgetVsActual.length > 0
              ? [
                  { label: t("Spent", "Đã chi"), color: VIZ.muted, shape: "bar" },
                  ...(overBudget.length > 0
                    ? [{ label: t("Over budget", "Vượt hạn mức"), color: VIZ.accent, shape: "bar" as const }]
                    : []),
                  { label: t("Budget", "Hạn mức"), color: VIZ.ink, shape: "tick" },
                ]
              : undefined
          }
        >
          {budgetVsActual.length === 0 ? (
            <p className={EMPTY_NOTE}>{t("No monthly budget set.", "Chưa đặt ngân sách cho tháng này.")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {budgetRows.map((b) => {
                const over = b.remaining < 0;
                return (
                  <li key={b.group} className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className={`min-w-0 truncate text-[var(--color-text)] ${over ? "font-bold" : ""}`} title={b.group}>
                        {b.group}
                      </span>
                      <span className="flex-none text-right tabular-nums whitespace-nowrap">
                        <span className="font-bold text-[var(--color-text)]">{formatVND(b.actual)}</span>
                        <span className="text-xs text-[var(--color-text-faint)]"> / {money(b.budget)}</span>
                      </span>
                    </div>
                    <RankBar
                      value={b.actual}
                      scale={Math.max(1, b.actual, b.budget)}
                      color={over ? VIZ.accent : VIZ.muted}
                      mark={b.budget}
                    />
                    <span className={`text-xs tabular-nums ${over ? "font-bold text-[var(--color-error)]" : "text-[var(--color-text-faint)]"}`}>
                      {over
                        ? t(`over by ${money(-b.remaining)}`, `vượt ${money(-b.remaining)}`)
                        : t(`${money(b.remaining)} left`, `còn ${money(b.remaining)}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
