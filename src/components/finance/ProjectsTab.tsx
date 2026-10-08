"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Plus, Pencil, Link2, Unlink, Hammer, TrendingDown, TrendingUp, Loader2,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { todayLocalIso } from "@/lib/localDate";
import { monthAxis } from "./MonthAxisTick";
import TransactionModal from "./TransactionModal";
import ProjectModal, { emptyProject, type ProjectDraft } from "./ProjectModal";
import AttachTransactionsModal from "./AttachTransactionsModal";

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

export default function ProjectsTab() {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
  const { label } = useCategories();

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
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
        setProjects(list);
        // Giữ dự án đang xem nếu nó còn; không thì lấy dự án đầu (đang chạy
        // được xếp lên trước).
        setSelectedId((cur) => (cur && list.some((p) => p.id === cur) ? cur : list[0]?.id ?? null));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setProjects([]);
          setError((err as Error).message || t("Could not load projects", "Không tải được danh sách dự án"));
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

  // ------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
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
          className="c-btn c-btn-primary shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5! self-end md:self-auto"
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

      {projects === null || (loading && !current) ? (
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
          label={label}
          money={money}
          onEditProject={() =>
            setProjectDraft({
              id: project.id,
              name: project.name,
              status: project.status,
              budget: project.budget,
              startDate: project.startDate ?? "",
              notes: project.notes ?? "",
            })
          }
          onAddCost={() => setTxModal({ type: "Expense", initialData: { type: "Expense", projectId: project.id } })}
          onAddRevenue={() => setTxModal({ type: "Income", initialData: { type: "Income", projectId: project.id } })}
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
  label: (name: string) => string;
  money: (n: number) => string;
  onEditProject: () => void;
  onAddCost: () => void;
  onAddRevenue: () => void;
  onAttach: () => void;
  onEditTx: (tx: ProjectTxRow) => void;
  onUnlink: (txId: string) => void;
}

function ProjectBody({
  data,
  statusLabel,
  label,
  money,
  onEditProject,
  onAddCost,
  onAddRevenue,
  onAttach,
  onEditTx,
  onUnlink,
}: BodyProps) {
  const { t } = useLanguage();
  const { project, totals, breakEven, monthly, costByCategory, revenueBySource, topItems, transactions } = data;
  const hasMoney = totals.cost !== 0 || totals.revenue !== 0;
  const profitable = totals.profit >= 0;
  const recovery = Math.max(0, Math.min(100, totals.recoveryPct ?? 0));

  // --- Bốn câu trả lời --------------------------------------------------
  const breakEvenCard = breakEven.reachedMonth
    ? {
        value: t("Broke even", "Đã hoà vốn"),
        note: t(`since ${monthLabel(breakEven.reachedMonth)}`, `từ tháng ${monthLabel(breakEven.reachedMonth)}`),
        tone: "success",
      }
    : totals.cost <= 0
      ? { value: "—", note: t("nothing invested yet", "chưa bỏ vốn"), tone: "text" }
      : breakEven.monthsToGo
        ? {
            value: t(`~${breakEven.monthsToGo} months`, `~${breakEven.monthsToGo} tháng nữa`),
            note: t(
              `around ${monthAfter(breakEven.monthsToGo)}, at the last ${breakEven.paceMonths} months' pace (${money(breakEven.avgMonthlyProfit)}/mo)`,
              `khoảng ${monthAfter(breakEven.monthsToGo)}, nếu giữ nhịp lãi ${breakEven.paceMonths} tháng gần nhất (${money(breakEven.avgMonthlyProfit)}/tháng)`
            ),
            tone: "text",
          }
        : {
            value: t(`${money(breakEven.shortfall)} to go`, `còn thiếu ${money(breakEven.shortfall)}`),
            note: t(
              "no profitable month yet to estimate from",
              "chưa có tháng nào lãi để ước ngày hoà vốn"
            ),
            tone: "warning",
          };

  const headline = [
    {
      label: t("Invested", "Đã đầu tư"),
      value: formatVND(totals.cost),
      note:
        totals.budget && totals.budgetUsedPct !== null
          ? t(
              `${totals.budgetUsedPct}% of the ${money(totals.budget)} plan · ${totals.costCount} items`,
              `${totals.budgetUsedPct}% của ${money(totals.budget)} dự định · ${totals.costCount} khoản chi`
            )
          : t(`${totals.costCount} spending ${totals.costCount === 1 ? "entry" : "entries"}`, `${totals.costCount} khoản chi`),
      tone: "text",
    },
    {
      label: t("Revenue", "Doanh thu"),
      value: formatVND(totals.revenue),
      note:
        totals.revenueCount > 0
          ? t(`${totals.revenueCount} income ${totals.revenueCount === 1 ? "entry" : "entries"}`, `${totals.revenueCount} khoản thu`)
          : t("no income recorded yet", "chưa ghi khoản thu nào"),
      tone: totals.revenue > 0 ? "success" : "text",
    },
    {
      label: profitable ? t("Net profit", "Lãi ròng") : t("Net loss so far", "Đang lỗ"),
      value: `${profitable ? "" : "−"}${formatVND(Math.abs(totals.profit))}`,
      // Chưa thu đồng nào thì ROI luôn là −100% — đúng nhưng vô nghĩa, chỉ làm
      // một dự án mới khởi động trông như thảm hoạ.
      note:
        totals.revenue <= 0
          ? t("ROI shows once revenue comes in", "ROI tính khi bắt đầu có doanh thu")
          : totals.roiPct !== null
          ? t(
              `ROI ${totals.roiPct}%${totals.marginPct !== null ? ` · margin ${totals.marginPct}%` : ""}`,
              `ROI ${totals.roiPct}%${totals.marginPct !== null ? ` · biên lãi ${totals.marginPct}%` : ""}`
            )
          : "—",
      tone: profitable ? (totals.profit > 0 ? "success" : "text") : "error",
    },
    { label: t("Break-even", "Hoà vốn"), ...breakEvenCard },
  ];

  const toneClass = (tone: string) =>
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "warning"
        ? "text-[var(--color-warning)]"
        : tone === "error"
          ? "text-[var(--color-error)]"
          : "text-[var(--color-text)]";

  const maxCost = Math.max(1, ...costByCategory.map((c) => c.amount));
  const maxSource = Math.max(1, ...revenueBySource.map((c) => c.amount));
  const months = monthly.map((m) => m.name);

  return (
    <div className="space-y-6">
      {/* --- Tên dự án và thao tác --- */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="c-h3 text-[var(--color-text)]">{project.name}</h3>
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

      {/* --- Bốn câu trả lời --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {headline.map((c) => (
          <div key={c.label} className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)]">
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{c.label}</div>
            <div className={`text-xl font-bold tabular-nums mt-2 ${toneClass(c.tone)}`}>{c.value}</div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{c.note}</div>
          </div>
        ))}
      </div>

      {/* --- Thanh thu hồi vốn --- */}
      {totals.cost > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-bold text-[var(--color-text)]">{t("Capital recovered", "Đã thu hồi vốn")}</span>
              <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">{totals.recoveryPct ?? 0}%</span>
            </div>
            <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2 mt-2 overflow-hidden">
              <div className="bg-[var(--color-success)] h-2 rounded-full" style={{ width: `${recovery}%` }} />
            </div>
            <p className="text-xs text-[var(--color-text-faint)] mt-1.5">
              {t(
                `${money(totals.revenue)} earned back of ${money(totals.cost)} put in`,
                `doanh thu ${money(totals.revenue)} trên ${money(totals.cost)} vốn đã bỏ ra`
              )}
            </p>
          </div>
          {totals.budget && totals.budgetUsedPct !== null ? (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-[var(--color-text)]">{t("Planned capital used", "Đã dùng vốn dự định")}</span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    totals.budgetUsedPct > 100 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"
                  }`}
                >
                  {totals.budgetUsedPct}%
                </span>
              </div>
              <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${totals.budgetUsedPct > 100 ? "bg-[var(--color-error)]" : "bg-[var(--color-warning)]"}`}
                  style={{ width: `${Math.min(100, totals.budgetUsedPct)}%` }}
                />
              </div>
              <p className="text-xs text-[var(--color-text-faint)] mt-1.5">
                {totals.budgetUsedPct > 100
                  ? t(
                      `${money(totals.cost - totals.budget)} over the plan`,
                      `vượt dự định ${money(totals.cost - totals.budget)}`
                    )
                  : t(
                      `${money(totals.budget - totals.cost)} left in the plan`,
                      `còn ${money(totals.budget - totals.cost)} trong dự định`
                    )}
              </p>
            </div>
          ) : null}
        </div>
      )}

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
          {/* --- Đường hoà vốn --- */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
            <h4 className="c-h5 text-[var(--color-text)]">{t("The road to break-even", "Đường hoà vốn")}</h4>
            <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
              {t(
                "running totals · where the revenue line crosses the cost line, the project has paid for itself",
                "cộng dồn từ đầu · chỗ đường doanh thu cắt qua đường vốn là lúc dự án tự trả được vốn"
              )}
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} className="c-chart-multi">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  {/* Biểu đồ chỉ có đường: điểm đầu/cuối nằm sát mép, nhãn tháng cuối
                      bị cắt ("oc"). Đệm hai đầu trục cho nhãn có chỗ. */}
                  <XAxis dataKey="name" {...monthAxis(months)} padding={{ left: 24, right: 24 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                    tickFormatter={(v) => money(Number(v))}
                    width={52}
                  />
                  <Tooltip
                    formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                    labelFormatter={(l) => monthLabel(String(l))}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Line
                    type="monotone"
                    dataKey="cumCost"
                    name={t("Capital put in", "Vốn đã bỏ vào")}
                    // Phải đặt màu tường minh: CSS `.c-chart-multi` chỉ tô lại
                    // đường kẻ, còn ô màu trong chú giải lấy từ prop này —
                    // thiếu nó là chú giải hiện xanh dương mặc định của recharts.
                    stroke="var(--color-text)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumRevenue"
                    name={t("Revenue earned", "Doanh thu thu về")}
                    className="c-series-1"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- Thu chi từng tháng --- */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
            <h4 className="c-h5 text-[var(--color-text)]">{t("Month by month", "Thu chi từng tháng")}</h4>
            <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
              {t("columns: revenue and cost · line: that month's profit", "cột: doanh thu và chi phí · đường: lãi/lỗ của riêng tháng đó")}
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} className="c-chart-multi">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" {...monthAxis(months)} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                    tickFormatter={(v) => money(Number(v))}
                    width={52}
                  />
                  <Tooltip
                    formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                    labelFormatter={(l) => monthLabel(String(l))}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar
                    dataKey="revenue"
                    name={t("Revenue", "Doanh thu")}
                    className="c-series-1"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="cost"
                    name={t("Cost", "Chi phí")}
                    className="c-series-3"
                    fill="var(--chart-3)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name={t("Profit", "Lãi/lỗ")}
                    stroke="var(--color-text)"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- Vốn đi đâu / Doanh thu từ ai --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
              <h4 className="c-h5 text-[var(--color-text)]">{t("Where the capital went", "Vốn đi đâu")}</h4>
              <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-5">{t("by category", "theo danh mục")}</p>
              {costByCategory.length === 0 ? (
                <p className="text-sm text-[var(--color-text-faint)]">{t("No costs yet", "Chưa có khoản chi nào")}</p>
              ) : (
                <ul className="space-y-3">
                  {costByCategory.map((c) => (
                    <li key={`${c.group}::${c.subGroup ?? ""}`}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-[var(--color-text)]">
                          {label(c.subGroup || c.group)}
                          {c.subGroup && (
                            <span className="text-[var(--color-text-faint)]"> · {label(c.group)}</span>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums font-bold text-[var(--color-text)]">
                          {formatVND(c.amount)}
                          <span className="ml-1.5 font-normal text-[var(--color-text-faint)]">
                            {totals.cost > 0 ? Math.round((c.amount / totals.cost) * 100) : 0}%
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-[var(--color-surface-2)] rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${Math.max(2, (c.amount / maxCost) * 100)}%`, background: "var(--chart-3)" }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
              <h4 className="c-h5 text-[var(--color-text)]">{t("Where revenue came from", "Doanh thu từ ai")}</h4>
              <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-5">
                {t("by customer (the “from” field of income)", "theo khách hàng (ô “Nơi chi / nguồn” của khoản thu)")}
              </p>
              {revenueBySource.length === 0 ? (
                <p className="text-sm text-[var(--color-text-faint)]">
                  {t(
                    "No revenue yet. Record income with “Revenue of project” set to this project.",
                    "Chưa có doanh thu. Khi có đơn, ghi khoản thu và chọn dự án này ở ô “Doanh thu của dự án”."
                  )}
                </p>
              ) : (
                <ul className="space-y-3">
                  {revenueBySource.map((s) => (
                    <li key={s.name}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-[var(--color-text)]">
                          {s.name}
                          <span className="text-[var(--color-text-faint)]"> · {s.count} {t("orders", "lần")}</span>
                        </span>
                        <span className="shrink-0 tabular-nums font-bold text-[var(--color-success)]">{formatVND(s.amount)}</span>
                      </div>
                      <div className="w-full bg-[var(--color-surface-2)] rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${Math.max(2, (s.amount / maxSource) * 100)}%`, background: "var(--chart-1)" }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* --- Mua gì nhiều nhất --- */}
          {topItems.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
              <h4 className="c-h5 text-[var(--color-text)]">{t("Most bought", "Mua gì nhiều nhất")}</h4>
              <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
                {t("from receipt line items", "gộp từ chi tiết hoá đơn")}
              </p>
              <ul className="divide-y divide-[var(--color-border)]">
                {topItems.map((it) => (
                  <li key={it.name} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                    <span className="min-w-0 text-[var(--color-text)]">
                      {it.name}
                      <span className="text-[var(--color-text-faint)]"> · SL {it.quantity}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-bold text-[var(--color-text)]">{formatVND(it.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* --- Sổ của dự án --- */}
      {transactions.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">{t("Project ledger", "Sổ của dự án")}</h4>
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
                        {formatVND(tx.totalAmount)}
                      </span>
                    </span>
                    <span className="block text-xs text-[var(--color-text-faint)] mt-0.5 truncate">
                      {dayLabel(tx.date)} · {income ? t("revenue", "doanh thu") : refund ? t("refund", "hoàn tiền") : label(tx.subGroup || tx.categoryGroup)}
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
    </div>
  );
}
