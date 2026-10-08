"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart, LineChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Plus, Pencil, Link2, Unlink, Hammer, TrendingDown, TrendingUp, Loader2, RotateCcw,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { todayLocalIso } from "@/lib/localDate";
import { monthAxis } from "./MonthAxisTick";
import { VIZ, GRID, yAxis, BAR, LINE, TOOLTIP, TOOLTIP_LINE } from "@/lib/viz";
import ChartCard, { StatTile } from "@/components/charts/ChartCard";
import TransactionModal from "./TransactionModal";
import ProjectModal, { emptyProject, type ProjectDraft } from "./ProjectModal";
import AttachTransactionsModal from "./AttachTransactionsModal";
import { CostPanel, LedgerPanel, CogsTransferModal, type CogsData, type LedgerView } from "./ProjectCostPanels";
import { costCategoryOf } from "@/lib/projectCost";

// Hiệu quả dự án: đã bỏ vào bao nhiêu, thu về bao nhiêu, bao giờ hoà vốn.
//
// Dữ liệu không nhập riêng ở đây — nó là chính các khoản chi/thu trong sổ, có
// gắn "Chi cho dự án" / "Doanh thu của dự án" ở hộp thoại ghi giao dịch. Trang
// này chỉ gom lại và trả lời theo thứ tự người ta hỏi: lời hay lỗ → bao giờ
// hoà vốn → mỗi tháng thế nào → tiền đi đâu, đến từ ai.

interface Totals {
  cost: number;
  revenue: number;
  profit: number;
  roiPct: number | null;
  recoveryPct: number | null;
  marginPct: number | null;
  budget: number | null;
  budgetUsedPct: number | null;
  costCount: number;
  revenueCount: number;
  firstDate: string | null;
  lastDate: string | null;
}

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  budget: number | null;
  startDate: string | null;
  notes: string | null;
  totals: Totals;
}

interface ProjectTxRow {
  id: string;
  date: string;
  type: string;
  supplier: string;
  categoryGroup: string;
  subGroup: string | null;
  totalAmount: number;
  notes: string | null;
  items: { productName: string; quantity: number; unitPrice: number; totalPrice: number }[];
  /** Phần của giao dịch thuộc dự án này (sau khi chia %). */
  projectAmount: number;
  projectPercentage: number;
  costCategories: string[];
  [key: string]: unknown;
}

interface Analysis {
  project: ProjectSummary;
  totals: Totals;
  breakEven: {
    reachedMonth: string | null;
    shortfall: number;
    avgMonthlyProfit: number;
    paceMonths: number;
    monthsToGo: number | null;
  };
  monthly: {
    name: string;
    cost: number;
    revenue: number;
    profit: number;
    cumCost: number;
    cumRevenue: number;
    cumProfit: number;
  }[];
  costByCategory: { group: string; subGroup: string | null; amount: number; count: number }[];
  revenueBySource: { name: string; amount: number; count: number }[];
  topItems: { name: string; amount: number; quantity: number; count: number }[];
  transactions: ProjectTxRow[];
  cogs: CogsData;
  ledger: LedgerView[];
  ledgerCount: number;
}

/** "2026-09" → "09/2026" */
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${m}/${y}`;
};

const dayLabel = (iso: string) => iso.split("-").reverse().join("/");

/** Tháng/năm sau `months` tháng nữa, dạng "03/2027" — mốc hoà vốn ước tính. */
function monthAfter(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Thanh tiến độ: rãnh `VIZ.ghost`, phần đã đi màu nhấn. Luôn đi kèm chữ ghi số. */
function Meter({ pct, color = VIZ.accent }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: VIZ.ghost }} aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${w}%`, minWidth: w > 0 ? 4 : 0, background: color }} />
    </div>
  );
}

/** Thanh xếp hạng ngang (không rãnh): dài theo `value / max`, đầu bo 4px như `BAR_H`. */
function RankBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? (Math.max(0, value) / max) * 100 : 0;
  return (
    <div className="h-3 w-full" aria-hidden>
      <div className="h-full rounded-r-[4px]" style={{ width: `${w}%`, minWidth: value > 0 ? 3 : 0, background: color }} />
    </div>
  );
}

/**
 * Nhãn ở ĐIỂM CUỐI của một đường: tên chuỗi + số, căn phải về điểm cuối.
 * `above` = đường nằm trên thì nhãn đặt trên, đường dưới thì nhãn đặt dưới —
 * hai nhãn không đè nhau khi hai đường sát nhau.
 */
function endLabel(index: number, text: (v: number) => string, above: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (props: any) => {
    if (props.index !== index || props.value === undefined || props.value === null) return null;
    return (
      <text
        x={Number(props.x)}
        y={Number(props.y) + (above ? -10 : 18)}
        textAnchor="end"
        fontSize={11}
        fontWeight={700}
        fill="var(--color-text)"
      >
        {text(Number(props.value))}
      </text>
    );
  };
  return render;
}

export default function ProjectsTab() {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [listFailed, setListFailed] = useState(false);

  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [txModal, setTxModal] = useState<{ initialData: Record<string, unknown>; type: "Expense" | "Income" } | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // --- Danh sách dự án -----------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/finance/projects", { signal: controller.signal });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        const list = json.data as ProjectSummary[];
        setListFailed(false);
        setError("");
        setProjects(list);
        // Giữ dự án đang xem nếu nó còn; không thì lấy dự án đầu (đang chạy
        // được xếp lên trước).
        setSelectedId((cur) => (cur && list.some((p) => p.id === cur) ? cur : list[0]?.id ?? null));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // KHÔNG đặt danh sách rỗng: màn hình sẽ nói "chưa có dự án nào"
          // trong khi dự án vẫn còn đó, chỉ là lần tải này hỏng.
          setListFailed(true);
        }
      }
    })();
    return () => controller.abort();
  }, [refreshKey, t]);

  // --- Phân tích dự án đang chọn ------------------------------------------
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/finance/projects/${encodeURIComponent(selectedId)}?today=${todayLocalIso()}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setData(json.data);
        setError("");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setData(null);
          setError((err as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [selectedId, refreshKey]);

  const unlink = async (txId: string) => {
    if (!selectedId) return;
    await fetch(`/api/finance/projects/${encodeURIComponent(selectedId)}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionIds: [txId], attach: false }),
    }).catch(() => null);
    refresh();
  };

  const STATUS_LABELS: Record<string, string> = {
    active: t("Running", "Đang chạy"),
    paused: t("Paused", "Tạm dừng"),
    closed: t("Closed", "Đã đóng"),
  };

  // Chỉ tin `data` khi nó đúng là của dự án đang chọn: vừa xoá dự án hay vừa
  // bấm sang dự án khác thì `data` cũ vẫn còn trong state tới khi tải xong.
  const current = data && data.project.id === selectedId ? data : null;
  const project = current?.project;
  const editProject = () =>
    project &&
    setProjectDraft({
      id: project.id,
      name: project.name,
      status: project.status,
      budget: project.budget,
      startDate: project.startDate ?? "",
      notes: project.notes ?? "",
    });

  // ------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* Header */}
      {/* Nút "+" đứng cùng hàng tiêu đề kể cả trên điện thoại — xếp dọc thì nó
          rơi xuống một dòng riêng, chừa một khoảng trống lớn trước thẻ dự án. */}
      <div className="flex flex-row items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="c-h2 c-page-title text-[var(--color-text)]">{t("Projects", "Dự án")}</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t(
              "Money put in, money earned back, and when it breaks even",
              "Vốn đã bỏ vào, doanh thu thu về, và bao giờ hoà vốn"
            )}
          </p>
        </div>
        <button
          onClick={() => setProjectDraft(emptyProject())}
          aria-label={t("New project", "Dự án mới")}
          title={t("New project", "Dự án mới")}
          className="c-btn c-btn-primary shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5! shrink-0"
        >
          <Plus size={16} /> <span className="hidden md:inline">{t("New project", "Dự án mới")}</span>
        </button>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] rounded-xl p-3">{error}</p>
      )}

      {/* Chọn dự án — chỉ hiện khi có từ hai dự án trở lên. */}
      {projects && projects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`shrink-0 px-4 min-h-11 rounded-full text-sm font-bold border transition-colors ${
                p.id === selectedId
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]"
              }`}
            >
              {p.name}
              {p.status !== "active" && (
                <span className="ml-1.5 font-normal opacity-70">· {STATUS_LABELS[p.status] ?? p.status}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {listFailed && !projects ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-10">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("Could not load your projects.", "Không tải được danh sách dự án.")}
          </p>
          <button onClick={refresh} className="c-btn c-btn-tertiary c-btn-sm">
            <RotateCcw size={14} /> {t("Retry", "Thử lại")}
          </button>
        </div>
      ) : projects === null || (loading && !current) ? (
        <div className="flex justify-center items-center h-64 text-[var(--color-text-faint)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="ml-3 text-sm font-bold">{t("Loading data...", "Đang tải dữ liệu...")}</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 text-center bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-10">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <Hammer size={30} />
          </div>
          <p className="text-lg font-bold text-[var(--color-text)]">{t("No projects yet", "Chưa có dự án nào")}</p>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md">
            {t(
              "Create one, then tag spending and income to it when you record them.",
              "Tạo một dự án, rồi khi ghi chi phí hay doanh thu thì chọn dự án đó ở ô “Chi cho dự án” / “Doanh thu của dự án”."
            )}
          </p>
          <button onClick={() => setProjectDraft(emptyProject())} className="c-btn c-btn-primary c-btn-pill">
            <Plus size={16} /> {t("New project", "Dự án mới")}
          </button>
        </div>
      ) : current && project ? (
        <ProjectBody
          data={current}
          statusLabel={STATUS_LABELS[project.status] ?? project.status}
          money={money}
          onEditProject={editProject}
          onTransfer={() => setTransferOpen(true)}
          onAddCost={() => setTxModal({ type: "Expense", initialData: { type: "Expense", projectSplits: [{ projectId: project.id, costCategory: "RAW_MATERIAL", percentage: 100 }] } })}
          onAddRevenue={() => setTxModal({ type: "Income", initialData: { type: "Income", projectSplits: [{ projectId: project.id, costCategory: "REVENUE", percentage: 100 }] } })}
          onAttach={() => setAttachOpen(true)}
          onEditTx={(tx) => setTxModal({ type: tx.type === "Income" ? "Income" : "Expense", initialData: tx })}
          onUnlink={unlink}
        />
      ) : null}

      {projectDraft && (
        <ProjectModal
          isOpen
          draft={projectDraft}
          onClose={() => setProjectDraft(null)}
          onSaved={(id) => {
            if (id) setSelectedId(id);
            else setSelectedId(null);
            refresh();
          }}
        />
      )}

      {project && current && (
        <CogsTransferModal
          isOpen={transferOpen}
          projectId={project.id}
          wip={current.cogs.totalWip}
          cogs={current.cogs.totalCogs}
          onClose={() => setTransferOpen(false)}
          onDone={refresh}
        />
      )}

      {project && (
        <AttachTransactionsModal
          isOpen={attachOpen}
          projectId={project.id}
          projectName={project.name}
          onClose={() => setAttachOpen(false)}
          onAttached={refresh}
        />
      )}

      <TransactionModal
        isOpen={!!txModal}
        onClose={() => setTxModal(null)}
        onSuccess={refresh}
        defaultType={txModal?.type ?? "Expense"}
        initialData={txModal?.initialData}
        projectsRefreshKey={refreshKey}
      />
    </div>
  );
}

// ==========================================================================

interface BodyProps {
  data: Analysis;
  statusLabel: string;
  money: (n: number) => string;
  onEditProject: () => void;
  onTransfer: () => void;
  onAddCost: () => void;
  onAddRevenue: () => void;
  onAttach: () => void;
  onEditTx: (tx: ProjectTxRow) => void;
  onUnlink: (txId: string) => void;
}

function ProjectBody({
  data,
  statusLabel,
  money,
  onEditProject,
  onTransfer,
  onAddCost,
  onAddRevenue,
  onAttach,
  onEditTx,
  onUnlink,
}: BodyProps) {
  const { t } = useLanguage();
  const { project, totals, breakEven, monthly, revenueBySource, topItems, transactions, cogs, ledger, ledgerCount } = data;
  const hasMoney = totals.cost !== 0 || totals.revenue !== 0;
  const profitable = totals.profit >= 0;
  const recovery = Math.max(0, Math.min(100, totals.recoveryPct ?? 0));

  // --- Câu kết luận: tình trạng thu hồi vốn --------------------------------
  // Câu người ta hỏi đầu tiên về một dự án: đã lấy lại được bao nhiêu vốn,
  // còn thiếu bao nhiêu. Tính từ dữ liệu; chưa bỏ vốn thì nói đúng như vậy.
  const shortfall = breakEven.shortfall > 0 ? breakEven.shortfall : Math.max(0, totals.cost - totals.revenue);
  const recoveryTitle =
    totals.cost <= 0
      ? totals.revenue > 0
        ? t(`${money(totals.revenue)} earned, no capital recorded yet`, `Đã thu ${money(totals.revenue)}, chưa ghi khoản vốn nào`)
        : t("No capital put in yet", "Chưa bỏ vốn vào dự án này")
      : breakEven.reachedMonth
        ? t(
            `Broke even in ${monthLabel(breakEven.reachedMonth)} — ${money(totals.profit)} profit so far`,
            `Đã hoà vốn từ ${monthLabel(breakEven.reachedMonth)} — lãi ${money(totals.profit)} tới nay`
          )
        : t(
            `${totals.recoveryPct ?? 0}% of capital recovered — ${money(shortfall)} to go`,
            `Đã thu hồi ${totals.recoveryPct ?? 0}% vốn — còn thiếu ${money(shortfall)}`
          );

  const breakEvenTile = breakEven.reachedMonth
    ? {
        value: t("Broke even", "Đã hoà vốn"),
        note: t(`since ${monthLabel(breakEven.reachedMonth)}`, `từ tháng ${monthLabel(breakEven.reachedMonth)}`),
      }
    : totals.cost <= 0
      ? { value: "—", note: t("nothing invested yet", "chưa bỏ vốn") }
      : breakEven.monthsToGo
        ? {
            value: t(`~${breakEven.monthsToGo} months`, `~${breakEven.monthsToGo} tháng nữa`),
            note: t(
              `around ${monthAfter(breakEven.monthsToGo)}, at the last ${breakEven.paceMonths} months' pace (${money(breakEven.avgMonthlyProfit)}/mo)`,
              `khoảng ${monthAfter(breakEven.monthsToGo)}, nếu giữ nhịp lãi ${breakEven.paceMonths} tháng gần nhất (${money(breakEven.avgMonthlyProfit)}/tháng)`
            ),
          }
        : {
            value: t("Not yet", "Chưa ước được"),
            note: t("no profitable month yet to estimate from", "chưa có tháng nào lãi để ước ngày hoà vốn"),
          };

  // Màu trạng thái chỉ trên con số lãi/lỗ, và nhãn ô đã nói bằng chữ là lãi hay lỗ.
  const profitClass =
    totals.profit > 0 ? "text-[var(--color-success)]" : totals.profit < 0 ? "text-[var(--color-error)]" : "";

  // --- Đường hoà vốn ------------------------------------------------------
  const months = monthly.map((m) => m.name);
  const lastIdx = monthly.length - 1;
  const lastRow = monthly[lastIdx];
  const lineMax = Math.max(1, ...monthly.map((m) => Math.max(m.cumCost, m.cumRevenue)));
  // Hai điểm cuối sát nhau thì nhãn đường dưới xuống dưới, kẻo hai nhãn đè nhau.
  const endsClose = lastRow ? Math.abs(lastRow.cumRevenue - lastRow.cumCost) < lineMax * 0.12 : false;
  const revenueOnTop = lastRow ? lastRow.cumRevenue >= lastRow.cumCost : true;
  const singleDot = (color: string) => (monthly.length === 1 ? { r: 3, fill: color, strokeWidth: 0 } : false);
  const roadTitle = breakEven.reachedMonth
    ? t(`Revenue has stayed above capital since ${monthLabel(breakEven.reachedMonth)}`, `Doanh thu vượt vốn từ ${monthLabel(breakEven.reachedMonth)} tới nay`)
    : totals.cost > 0 && breakEven.monthsToGo
      ? t(
          `At the last ${breakEven.paceMonths} months' pace, break-even comes around ${monthAfter(breakEven.monthsToGo)}`,
          `Giữ nhịp lãi ${breakEven.paceMonths} tháng gần nhất thì hoà vốn khoảng ${monthAfter(breakEven.monthsToGo)}`
        )
      : totals.cost > 0
        ? t(
            `Revenue is ${money(shortfall)} short of capital, with no recent profit to close the gap`,
            `Doanh thu còn kém vốn ${money(shortfall)} — chưa có nhịp lãi nào để ước ngày hoà vốn`
          )
        : t("The road to break-even", "Đường hoà vốn");

  // --- Thu chi từng tháng --------------------------------------------------
  const activeMonths = monthly.filter((m) => m.cost !== 0 || m.revenue !== 0);
  const profitableMonths = activeMonths.filter((m) => m.profit > 0).length;
  const lastActive = lastRow && (lastRow.cost !== 0 || lastRow.revenue !== 0);
  const lastPart = !lastRow
    ? ""
    : lastActive
      ? t(
          ` — ${monthLabel(lastRow.name)}: ${lastRow.profit >= 0 ? "profit" : "loss"} ${money(Math.abs(lastRow.profit))}`,
          ` — tháng ${monthLabel(lastRow.name)} ${lastRow.profit >= 0 ? "lãi" : "lỗ"} ${money(Math.abs(lastRow.profit))}`
        )
      : t(` — nothing yet in ${monthLabel(lastRow.name)}`, ` — tháng ${monthLabel(lastRow.name)} chưa phát sinh`);
  const monthlyTitle =
    activeMonths.length === 0
      ? t("Month by month", "Thu chi từng tháng")
      : t(
          `${profitableMonths} of ${activeMonths.length} active ${activeMonths.length === 1 ? "month" : "months"} made a profit${lastPart}`,
          `Có lãi ${profitableMonths}/${activeMonths.length} tháng có thu chi${lastPart}`
        );

  // --- Doanh thu từ ai / Mua gì nhiều nhất ----------------------------------
  const maxSource = Math.max(1, ...revenueBySource.map((c) => c.amount));
  const topSource = revenueBySource.reduce<(typeof revenueBySource)[number] | null>(
    (best, s) => (!best || s.amount > best.amount ? s : best),
    null
  );
  const sourceSum = revenueBySource.reduce((sum, s) => sum + Math.max(0, s.amount), 0);
  const sourceTitle =
    !topSource || topSource.amount <= 0
      ? t("Where revenue came from", "Doanh thu từ ai")
      : revenueBySource.length === 1
        ? t(`All revenue so far came from ${topSource.name}`, `Toàn bộ doanh thu tới nay đến từ ${topSource.name}`)
        : t(
            `${topSource.name} brought in ${Math.round((topSource.amount / Math.max(1, sourceSum)) * 100)}% of revenue`,
            `${topSource.name} mang về ${Math.round((topSource.amount / Math.max(1, sourceSum)) * 100)}% doanh thu`
          );
  const maxItem = Math.max(1, ...topItems.map((c) => c.amount));
  const topItem = topItems.reduce<(typeof topItems)[number] | null>(
    (best, s) => (!best || s.amount > best.amount ? s : best),
    null
  );
  const itemTitle =
    topItem && topItem.amount > 0
      ? t(`${topItem.name} is the biggest purchase — ${money(topItem.amount)}`, `${topItem.name} tốn nhiều nhất — ${money(topItem.amount)}`)
      : t("Most bought", "Mua gì nhiều nhất");

  return (
    <div className="space-y-6">
      {/* --- Tên dự án và thao tác --- */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* globals.css kéo một đường taupe sau mọi h3.c-h3 — hợp với tiêu
                  đề mục, nhưng nằm giữa tên dự án và nhãn trạng thái thì chỉ
                  là một gạch lạc. Tắt riêng ở đây (quy tắc kia nằm ngoài
                  @layer nên phải có `!`). */}
              <h3 className="c-h3 text-[var(--color-text)] after:hidden!">{project.name}</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                {statusLabel}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-faint)] mt-1">
              {project.startDate
                ? t(`started ${dayLabel(project.startDate)}`, `bắt đầu ${dayLabel(project.startDate)}`)
                : totals.firstDate
                  ? t(`first entry ${dayLabel(totals.firstDate)}`, `khoản đầu tiên ${dayLabel(totals.firstDate)}`)
                  : t("no entries yet", "chưa có khoản nào")}
              {project.notes ? ` · ${project.notes}` : ""}
            </p>
          </div>
          <button
            onClick={onEditProject}
            aria-label={t("Edit project", "Sửa dự án")}
            title={t("Edit project", "Sửa dự án")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <Pencil size={17} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 mt-5">
          <button onClick={onAddCost} className="c-btn c-btn-primary c-btn-sm min-h-11 md:min-h-0">
            <TrendingDown size={15} /> {t("Record cost", "Ghi chi phí")}
          </button>
          <button
            onClick={onAddRevenue}
            className="c-btn c-btn-sm min-h-11 md:min-h-0 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"
          >
            <TrendingUp size={15} /> {t("Record revenue", "Ghi doanh thu")}
          </button>
          <button
            onClick={onAttach}
            className="col-span-2 c-btn c-btn-sm min-h-11 md:min-h-0 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
          >
            <Link2 size={15} /> {t("Add earlier transactions", "Gắn giao dịch đã ghi")}
          </button>
        </div>
      </div>

      {/* --- Thu hồi vốn: câu kết luận, thanh tiến độ, bốn con số ---
          Thanh thu hồi vốn và bốn ô cũ nằm ở hai thẻ rời; gộp lại để câu
          kết luận đứng trên cả hai. Ô lãi/lỗ là ô chính. */}
      <ChartCard
        title={recoveryTitle}
        subtitle={t(
          "Revenue earned back against capital put in, running totals",
          "Doanh thu thu về so với vốn đã bỏ ra, cộng dồn từ đầu"
        )}
      >
        {totals.cost > 0 && (
          <div className="flex flex-col gap-1.5">
            <Meter pct={recovery} />
            <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
              {t(
                `${money(totals.revenue)} earned back of ${money(totals.cost)} put in`,
                `doanh thu ${money(totals.revenue)} trên ${money(totals.cost)} vốn đã bỏ ra`
              )}
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatTile
            label={t("Invested", "Đã đầu tư")}
            value={formatVND(totals.cost)}
            note={
              totals.budget && totals.budgetUsedPct !== null
                ? t(
                    `${totals.budgetUsedPct}% of the ${money(totals.budget)} plan · ${totals.costCount} items`,
                    `${totals.budgetUsedPct}% của ${money(totals.budget)} dự định · ${totals.costCount} khoản chi`
                  )
                : t(`${totals.costCount} spending ${totals.costCount === 1 ? "entry" : "entries"}`, `${totals.costCount} khoản chi`)
            }
          />
          <StatTile
            label={t("Revenue", "Doanh thu")}
            value={formatVND(totals.revenue)}
            note={
              totals.revenueCount > 0
                ? t(`${totals.revenueCount} income ${totals.revenueCount === 1 ? "entry" : "entries"}`, `${totals.revenueCount} khoản thu`)
                : t("no income recorded yet", "chưa ghi khoản thu nào")
            }
          />
          <StatTile
            emphasis
            label={profitable ? t("Net profit", "Lãi ròng") : t("Net loss so far", "Đang lỗ")}
            value={<span className={profitClass}>{`${profitable ? "" : "−"}${formatVND(Math.abs(totals.profit))}`}</span>}
            // Chưa thu đồng nào thì ROI luôn là −100% — đúng nhưng vô nghĩa, chỉ
            // làm một dự án mới khởi động trông như thảm hoạ.
            note={
              totals.revenue <= 0
                ? t("ROI shows once revenue comes in", "ROI tính khi bắt đầu có doanh thu")
                : totals.roiPct !== null
                  ? t(
                      `ROI ${totals.roiPct}%${totals.marginPct !== null ? ` · margin ${totals.marginPct}%` : ""}`,
                      `ROI ${totals.roiPct}%${totals.marginPct !== null ? ` · biên lãi ${totals.marginPct}%` : ""}`
                    )
                  : "—"
            }
          />
          <StatTile label={t("Break-even", "Hoà vốn")} value={breakEvenTile.value} note={breakEvenTile.note} />
        </div>
      </ChartCard>

      {!hasMoney ? (
        <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm font-bold text-[var(--color-text)]">
            {t("Nothing tagged to this project yet", "Chưa có khoản nào thuộc dự án này")}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-lg mx-auto">
            {t(
              "Use the buttons above, or pick this project in the “Spent on project” box when you record or scan a receipt.",
              "Bấm các nút phía trên, hoặc chọn dự án này ở ô “Chi cho dự án” / “Doanh thu của dự án” khi ghi tay hay quét hoá đơn."
            )}
          </p>
        </div>
      ) : (
        <>
          {/* --- Đường hoà vốn ---
              Hai đường cộng dồn: vốn xám, doanh thu màu nhấn — chỗ doanh thu
              cắt qua vốn là lúc dự án tự trả được vốn. Nhãn ghi thẳng ở đầu
              mút mỗi đường thay cho chú giải. */}
          <ChartCard
            title={roadTitle}
            subtitle={t(
              "Capital put in and revenue earned, running totals by month",
              "Vốn đã bỏ vào và doanh thu thu về, cộng dồn theo tháng"
            )}
          >
            <div className="h-60 md:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  {/* Đệm hai đầu trục: điểm cuối sát mép thì nhãn tháng cuối bị cắt. */}
                  <XAxis dataKey="name" {...monthAxis(months)} padding={{ left: 16, right: 16 }} />
                  <YAxis {...yAxis(money, 52)} />
                  <Tooltip
                    {...TOOLTIP_LINE}
                    formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                    labelFormatter={(l) => monthLabel(String(l))}
                  />
                  {breakEven.reachedMonth && (
                    <ReferenceLine
                      x={breakEven.reachedMonth}
                      stroke={VIZ.muted}
                      strokeDasharray="4 3"
                      label={{ value: t("break-even", "hoà vốn"), position: "top", fontSize: 10, fill: "var(--color-text-faint)" }}
                    />
                  )}
                  <Line
                    {...LINE}
                    dot={singleDot(VIZ.muted)}
                    dataKey="cumCost"
                    name={t("Capital put in", "Vốn đã bỏ vào")}
                    stroke={VIZ.muted}
                    label={endLabel(lastIdx, (v) => `${t("Capital", "Vốn")} ${money(v)}`, !revenueOnTop || !endsClose)}
                  />
                  <Line
                    {...LINE}
                    dot={singleDot(VIZ.accent)}
                    dataKey="cumRevenue"
                    name={t("Revenue earned", "Doanh thu thu về")}
                    stroke={VIZ.accent}
                    label={endLabel(lastIdx, (v) => `${t("Revenue", "Doanh thu")} ${money(v)}`, revenueOnTop || !endsClose)}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* --- Thu chi từng tháng ---
              Hai cột cạnh nhau trên CÙNG một trục: doanh thu màu nhấn, chi phí
              xám. Lãi/lỗ của tháng nằm trong tooltip và trong tiêu đề, không
              vẽ thêm đường thứ ba đè lên cột. */}
          <ChartCard
            title={monthlyTitle}
            subtitle={t("Revenue and cost recorded each month", "Doanh thu và chi phí ghi nhận mỗi tháng")}
            keys={[
              { label: t("Revenue", "Doanh thu"), color: VIZ.accent, shape: "bar" },
              { label: t("Cost", "Chi phí"), color: VIZ.muted, shape: "bar" },
            ]}
          >
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" {...monthAxis(months)} />
                  <YAxis {...yAxis(money, 52)} />
                  <Tooltip
                    {...TOOLTIP}
                    formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                    labelFormatter={(l, p) => {
                      const row = p?.[0]?.payload as { profit?: number } | undefined;
                      const head = monthLabel(String(l));
                      if (row?.profit === undefined) return head;
                      return `${head} · ${row.profit >= 0 ? t("profit", "lãi") : t("loss", "lỗ")} ${money(Math.abs(row.profit))}`;
                    }}
                  />
                  <Bar dataKey="revenue" name={t("Revenue", "Doanh thu")} fill={VIZ.accent} {...BAR} />
                  <Bar dataKey="cost" name={t("Cost", "Chi phí")} fill={VIZ.muted} {...BAR} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* --- Giá thành & giá vốn: 5 nhóm chi phí, WIP/COGS, ngân sách --- */}
          <CostPanel cogs={cogs} money={money} onTransfer={onTransfer} onEditBudget={onEditProject} />

          {/* --- Doanh thu từ ai / Mua gì nhiều nhất ---
              Cột ngang xếp hạng, số căn phải; mục lớn nhất (mục tiêu đề nói tới)
              màu nhấn, còn lại xám. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title={sourceTitle}
              subtitle={t("Revenue by customer (the “from” field of income)", "Doanh thu theo khách hàng (ô “Nơi chi / nguồn” của khoản thu)")}
            >
              {revenueBySource.length === 0 ? (
                <p className="text-sm text-[var(--color-text-faint)]">
                  {t(
                    "No revenue yet. Record income with “Revenue of project” set to this project.",
                    "Chưa có doanh thu. Khi có đơn, ghi khoản thu và chọn dự án này ở ô “Doanh thu của dự án”."
                  )}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {revenueBySource.map((s) => {
                    const top = s.name === topSource?.name;
                    return (
                      <li key={s.name} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className={`min-w-0 truncate text-[var(--color-text)] ${top ? "font-bold" : ""}`}>
                            {s.name}
                            <span className="font-normal text-[var(--color-text-faint)]"> · {s.count} {t("orders", "lần")}</span>
                          </span>
                          <span className="shrink-0 tabular-nums font-bold text-[var(--color-text)]">{formatVND(s.amount)}</span>
                        </div>
                        <RankBar value={s.amount} max={maxSource} color={top ? VIZ.accent : VIZ.muted} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </ChartCard>

            {topItems.length > 0 && (
              <ChartCard title={itemTitle} subtitle={t("Most bought, from receipt line items", "Mua gì nhiều nhất, gộp từ chi tiết hoá đơn")}>
                <ul className="flex flex-col gap-3">
                  {topItems.map((it) => {
                    const top = it.name === topItem?.name;
                    return (
                      <li key={it.name} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className={`min-w-0 truncate text-[var(--color-text)] ${top ? "font-bold" : ""}`}>
                            {it.name}
                            <span className="font-normal text-[var(--color-text-faint)]"> · SL {it.quantity}</span>
                          </span>
                          <span className="shrink-0 tabular-nums font-bold text-[var(--color-text)]">{formatVND(it.amount)}</span>
                        </div>
                        <RankBar value={it.amount} max={maxItem} color={top ? VIZ.accent : VIZ.muted} />
                      </li>
                    );
                  })}
                </ul>
              </ChartCard>
            )}
          </div>
        </>
      )}
      {/* --- Sổ của dự án --- */}
      {transactions.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">{t("Project transactions", "Giao dịch của dự án")}</h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
            {t(
              `${transactions.length} ${transactions.length === 1 ? "entry" : "entries"} · tap one to edit · they also stay in Expense / Income`,
              `${transactions.length} khoản · chạm để sửa · các khoản này vẫn nằm trong Chi tiêu / Thu nhập chung`
            )}
          </p>
          <ul className="divide-y divide-[var(--color-border)] -mx-2">
            {transactions.map((tx) => {
              const income = tx.type === "Income";
              const refund = tx.type === "Refund";
              const items = tx.items.map((i) => i.productName).filter(Boolean).join(", ");
              return (
                <li key={tx.id} className="flex items-center gap-1">
                  <button
                    onClick={() => onEditTx(tx)}
                    className="flex-1 min-w-0 text-left px-2 py-3 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold text-[var(--color-text)] truncate">{tx.supplier}</span>
                      <span
                        className={`text-sm font-bold tabular-nums shrink-0 ${
                          income || refund ? "text-[var(--color-success)]" : "text-[var(--color-text)]"
                        }`}
                      >
                        {income || refund ? "+" : "−"}
                        {formatVND(tx.projectAmount)}
                      </span>
                    </span>
                    <span className="block text-xs text-[var(--color-text-faint)] mt-0.5 truncate">
                      {dayLabel(tx.date)} ·{" "}
                      {income
                        ? t("revenue", "doanh thu")
                        : tx.costCategories
                            .map((c) => {
                              const cat = costCategoryOf(c);
                              return cat ? t(cat.en, cat.vi) : c;
                            })
                            .join(", ")}
                      {refund ? ` (${t("refund", "hoàn tiền")})` : ""}
                      {/* Hoá đơn chia cho nhiều dự án: nói rõ dự án này gánh bao nhiêu. */}
                      {tx.projectPercentage < 100
                        ? ` · ${tx.projectPercentage}% ${t("of", "của")} ${formatVND(tx.totalAmount)}`
                        : ""}
                      {items ? ` · ${items}` : tx.notes ? ` · ${tx.notes}` : ""}
                    </span>
                  </button>
                  <button
                    onClick={() => onUnlink(tx.id)}
                    aria-label={t("Remove from project", "Gỡ khỏi dự án")}
                    title={t("Remove from project (keeps the transaction)", "Gỡ khỏi dự án (giao dịch vẫn còn trong sổ)")}
                    className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <Unlink size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* --- Sổ cái chỉ-ghi-thêm --- */}
      <LedgerPanel ledger={ledger} count={ledgerCount} />
    </div>
  );
}
