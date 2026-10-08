"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowUp, ArrowDown, ChevronDown, Search, Store, Shapes } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { monthAxis } from "./MonthAxisTick";

// Chi vào đâu, thu từ đâu — theo nơi chi và theo nhóm danh mục.
//
// Câu hỏi nó trả lời: "tháng này Highlands hết bao nhiêu, tháng trước bao
// nhiêu, năm ngoái bao nhiêu?", "ăn uống / cafe tháng này bao nhiêu?". Mỗi dòng
// là hai thanh nằm ngang (tháng này / tháng trước) cùng một thước đo, nên nhìn
// độ dài là thấy tăng hay giảm, khỏi đọc số.

interface Metrics {
  key: string;
  name: string;
  month: number;
  prev: number;
  lastYearMonth: number;
  ytd: number;
  lastYtd: number;
  lastYearTotal: number;
  count: number;
  trend: number[];
  variants?: number;
  children?: Metrics[];
}

interface SideData {
  totals: Omit<Metrics, "key" | "name">;
  vendors: Metrics[];
  groups: Metrics[];
}

interface Breakdown {
  month: string;
  prevMonth: string;
  lastYearMonth: string;
  year: number;
  trendMonths: string[];
  expense: SideData;
  income: SideData;
}

const SHOW = 10;

/** "2026-10" → "10/2026" */
const mLabel = (k: string) => {
  const [y, m] = k.split("-");
  return `${m}/${y}`;
};

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/** % thay đổi, null khi kỳ so sánh bằng 0 (không chia được). */
const change = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

export default function MonthBreakdown({ month, refreshKey }: { month: string; refreshKey: number }) {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
  const { label } = useCategories();

  const [data, setData] = useState<Breakdown | null>(null);
  const [failed, setFailed] = useState(false);
  const [side, setSide] = useState<"expense" | "income">("expense");
  const [view, setView] = useState<"vendors" | "groups">("vendors");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(`/api/finance/breakdown?month=${month}`, { signal: controller.signal });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setData(json.data);
        setFailed(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFailed(true);
      }
    };
    load();
    return () => controller.abort();
  }, [month, refreshKey]);

  const sideData = data?.[side];
  const rows = useMemo(() => {
    if (!sideData) return [];
    const list = view === "vendors" ? sideData.vendors : sideData.groups;
    const q = fold(query.trim());
    if (!q) return list;
    return list.filter(
      (r) =>
        fold(r.name).includes(q) ||
        fold(label(r.name)).includes(q) ||
        (r.children ?? []).some((c) => fold(c.name).includes(q) || fold(label(c.name)).includes(q))
    );
  }, [sideData, view, query, label]);

  if (failed && !data) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
        {t("Could not load the breakdown.", "Không tải được phân tích nơi chi / nhóm chi.")}
      </div>
    );
  }
  if (!data || !sideData) {
    return <div className="h-40 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse" />;
  }

  const income = side === "income";
  const T = sideData.totals;
  const yearDelta = change(T.ytd, T.lastYtd);
  const monthDelta = change(T.month, T.prev);
  const [, mm] = data.month.split("-");
  const shown = showAll || query ? rows : rows.slice(0, SHOW);
  const scale = Math.max(1, ...shown.map((r) => Math.max(r.month, r.prev)));
  const nameOf = (r: Metrics) => (view === "groups" ? label(r.name) : r.name);

  const stats = [
    {
      label: t(`This month (${mLabel(data.month)})`, `Tháng này (${mLabel(data.month)})`),
      value: formatVND(T.month),
      delta: monthDelta,
      note: t("vs last month", "so tháng trước"),
    },
    { label: t(`Last month (${mLabel(data.prevMonth)})`, `Tháng trước (${mLabel(data.prevMonth)})`), value: formatVND(T.prev) },
    { label: t(`Same month last year (${mLabel(data.lastYearMonth)})`, `Cùng tháng năm trước (${mLabel(data.lastYearMonth)})`), value: formatVND(T.lastYearMonth) },
    {
      label: t(`${data.year} to ${mm}`, `Năm ${data.year} (tới T${Number(mm)})`),
      value: formatVND(T.ytd),
      delta: yearDelta,
      note: t(
        `vs same period ${data.year - 1} (${money(T.lastYtd)}) · all of ${data.year - 1}: ${money(T.lastYearTotal)}`,
        `so cùng kỳ ${data.year - 1} (${money(T.lastYtd)}) · cả năm ${data.year - 1}: ${money(T.lastYearTotal)}`
      ),
    },
  ];

  const seg = (on: boolean) =>
    `flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 min-h-10 rounded-full text-xs font-bold transition-colors ${
      on ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
    }`;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] flex flex-col gap-6">
      {/* --- Điều khiển --- */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-1 p-1 rounded-full bg-[var(--color-surface-2)]">
          <button onClick={() => { setSide("expense"); setOpen(null); }} className={seg(!income)}>
            {t("Spending", "Chi tiêu")}
          </button>
          <button onClick={() => { setSide("income"); setOpen(null); }} className={seg(income)}>
            {t("Income", "Thu nhập")}
          </button>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-[var(--color-surface-2)]">
          <button onClick={() => { setView("vendors"); setOpen(null); }} className={seg(view === "vendors")}>
            <Store size={14} /> {income ? t("By source", "Theo nguồn thu") : t("By place", "Theo nơi chi")}
          </button>
          <button onClick={() => { setView("groups"); setOpen(null); }} className={seg(view === "groups")}>
            <Shapes size={14} /> {t("By category", "Theo nhóm")}
          </button>
        </div>
        <div className="relative md:ml-auto md:w-64">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "vendors" ? t("Find a place… e.g. highlands", "Tìm nơi chi… VD: highlands") : t("Find a category…", "Tìm nhóm… VD: cafe")}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full pl-10 pr-4 py-2 min-h-10 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
          />
        </div>
      </div>

      {/* --- Bốn con số tổng --- */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-[var(--color-surface-2)] p-4 min-w-0">
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{s.label}</div>
            <div className="text-base md:text-lg font-bold tabular-nums text-[var(--color-text)] mt-1">{s.value}</div>
            {"note" in s && (
              <div className="text-[11px] text-[var(--color-text-faint)] mt-0.5 flex flex-wrap items-center gap-x-1.5">
                {s.delta !== undefined && <Delta pct={s.delta ?? null} income={income} />}
                <span>{s.note}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* --- Chú giải hai thanh --- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-faint)] -mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full" style={{ background: "var(--chart-1)" }} /> {t("this month", "tháng này")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full" style={{ background: "var(--chart-4)" }} /> {t("last month", "tháng trước")}
        </span>
        <span>{t("tap a row for 12 months and last year", "chạm vào dòng để xem 12 tháng và năm trước")}</span>
      </div>

      {/* --- Danh sách --- */}
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-faint)]">
          {query
            ? t("Nothing matches.", "Không có dòng nào khớp.")
            : income
              ? t("No income in this period.", "Chưa có khoản thu nào trong khoảng này.")
              : t("No spending in this period.", "Chưa có khoản chi nào trong khoảng này.")}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] -mx-2">
          {shown.map((r) => (
            <BreakdownRow
              key={r.key}
              row={r}
              name={nameOf(r)}
              scale={scale}
              income={income}
              isOpen={open === r.key}
              onToggle={() => setOpen(open === r.key ? null : r.key)}
              data={data}
              money={money}
              childLabel={(n) => (n ? label(n) : t("(no sub-category)", "(chưa có nhóm con)"))}
            />
          ))}
        </ul>
      )}

      {!query && rows.length > SHOW && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="self-start text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-h-9"
        >
          {showAll ? t("Show top 10", "Thu gọn còn 10 dòng") : t(`Show all ${rows.length}`, `Xem tất cả ${rows.length} dòng`)}
        </button>
      )}
    </div>
  );
}

// ==========================================================================

/** Mũi tên tăng/giảm. Chi tăng là xấu, thu tăng là tốt — màu theo đó. */
function Delta({ pct, income }: { pct: number | null; income: boolean }) {
  const { t } = useLanguage();
  if (pct === null) return <span className="text-[var(--color-text-faint)]">{t("new", "mới")}</span>;
  if (pct === 0) return <span className="text-[var(--color-text-faint)]">±0%</span>;
  const up = pct > 0;
  const good = income ? up : !up;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${
        good ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
      }`}
    >
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(pct)}%
    </span>
  );
}

function Bars({ now, before, scale }: { now: number; before: number; scale: number }) {
  const w = (v: number) => `${Math.max(v > 0 ? 1.5 : 0, (Math.max(0, v) / scale) * 100)}%`;
  return (
    <div className="flex flex-col gap-1 mt-1.5" aria-hidden>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: w(now), background: "var(--chart-1)" }} />
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: w(before), background: "var(--chart-4)" }} />
      </div>
    </div>
  );
}

function BreakdownRow({
  row,
  name,
  scale,
  income,
  isOpen,
  onToggle,
  data,
  money,
  childLabel,
}: {
  row: Metrics;
  name: string;
  scale: number;
  income: boolean;
  isOpen: boolean;
  onToggle: () => void;
  data: Breakdown;
  money: (n: number) => string;
  childLabel: (name: string) => string;
}) {
  const { t } = useLanguage();
  const delta = change(row.month, row.prev);
  const trend = data.trendMonths.map((m, i) => ({ name: m, value: row.trend[i] ?? 0 }));
  const yearDelta = change(row.ytd, row.lastYtd);
  // Nhóm con chỉ so tháng này với tháng trước, nên dòng bằng 0 ở cả hai là nhiễu
  // (nó lọt vào đây vì luỹ kế năm có số).
  const children = (row.children ?? []).filter((c) => c.month !== 0 || c.prev !== 0);
  const childScale = Math.max(1, ...children.map((x) => Math.max(x.month, x.prev)));

  return (
    <li>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full text-left px-2 py-3 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 flex items-center gap-1.5">
            <ChevronDown
              size={14}
              className={`shrink-0 text-[var(--color-text-faint)] transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
            <span className="text-sm font-bold text-[var(--color-text)] truncate">{name}</span>
            {row.count > 0 && (
              <span className="shrink-0 text-[11px] text-[var(--color-text-faint)]">· {row.count} {t("tx", "lần")}</span>
            )}
          </span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--color-text)]">{formatVND(row.month)}</span>
        </span>
        <Bars now={row.month} before={row.prev} scale={scale} />
        <span className="flex flex-wrap items-center gap-x-1.5 mt-1.5 text-[11px] text-[var(--color-text-faint)] tabular-nums">
          <span>
            {t("last month", "tháng trước")} {money(row.prev)}
          </span>
          {(row.month !== 0 || row.prev !== 0) && <Delta pct={delta} income={income} />}
          <span>
            · {t("same month last year", "cùng tháng năm trước")} {money(row.lastYearMonth)}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="px-2 pb-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {[
              { l: t(`${data.year} to date`, `Năm ${data.year} tới nay`), v: row.ytd, d: yearDelta },
              { l: t(`Same period ${data.year - 1}`, `Cùng kỳ ${data.year - 1}`), v: row.lastYtd },
              { l: t(`All of ${data.year - 1}`, `Cả năm ${data.year - 1}`), v: row.lastYearTotal },
              { l: t("12-month average", "TB 12 tháng"), v: Math.round(row.trend.reduce((a, b) => a + b, 0) / 12) },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-[var(--color-surface-2)] p-3">
                <div className="text-[var(--color-text-muted)]">{x.l}</div>
                <div className="text-sm font-bold tabular-nums text-[var(--color-text)] mt-0.5">{formatVND(x.v)}</div>
                {"d" in x && (row.ytd !== 0 || row.lastYtd !== 0) && (
                  <div className="mt-0.5">
                    <Delta pct={x.d ?? null} income={income} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} className="c-chart-multi" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" {...monthAxis(data.trendMonths)} />
                <Tooltip
                  formatter={(v) => [formatVND(Number(v) || 0), t("Amount", "Số tiền")]}
                  labelFormatter={(l) => mLabel(String(l))}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={22}>
                  {/* Tháng báo cáo đậm, các tháng khác nhạt — biết ngay cột nào là "tháng này". */}
                  {trend.map((p) => (
                    <Cell
                      key={p.name}
                      style={{ fill: p.name === data.month ? "var(--chart-1)" : "var(--chart-4)" }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {children.length > 0 && (
            <ul className="flex flex-col gap-3">
              {children.map((c) => (
                <li key={c.key || "_"}>
                  <span className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-[var(--color-text)]">{childLabel(c.name)}</span>
                    <span className="shrink-0 tabular-nums font-bold text-[var(--color-text)]">
                      {formatVND(c.month)}
                      <span className="ml-1.5 font-normal text-[var(--color-text-faint)]">
                        {t("prev", "trước")} {money(c.prev)}
                      </span>
                    </span>
                  </span>
                  <Bars now={c.month} before={c.prev} scale={childScale} />
                </li>
              ))}
            </ul>
          )}

          {row.variants && row.variants > 1 ? (
            <p className="text-[11px] text-[var(--color-text-faint)]">
              {t(
                `Merged ${row.variants} spellings of this name (case and accents ignored).`,
                `Đã gộp ${row.variants} cách viết của tên này (không phân biệt hoa thường, có dấu hay không).`
              )}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}
