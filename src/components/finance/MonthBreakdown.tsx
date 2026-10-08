"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { ChevronDown, Search, Store, Shapes } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { VIZ, BAR, TOOLTIP, labelAt, pctChange } from "@/lib/viz";
import { SeriesKey, Delta, StatTile } from "@/components/charts/ChartCard";
import { monthAxis } from "./MonthAxisTick";

// Chi vào đâu, thu từ đâu — theo nơi chi và theo nhóm danh mục.
//
// MẪU CHUẨN cho biểu đồ của Crucible (docs/bieu-do.md):
// - Tiêu đề là câu kết luận tính từ dữ liệu, không phải tên biểu đồ.
// - Mỗi mục: MỘT thanh cho tháng này + MỘT vạch mốc cho tháng trước (kiểu
//   bullet graph) trên cùng một thước. Bản trước vẽ hai thanh dài kéo hết bề
//   ngang — nhìn như thước kẻ, không thấy mục nào đáng để ý.
// - Thanh xám; chỉ mục mà tiêu đề nói tới mang màu nhấn.
// - Số căn một cột bên phải để dò dọc; mũi tên chênh lệch có chữ, không chỉ màu.

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
/** "2026-10" → "T10" / "Oct" */
const mShort = (k: string, vi: boolean) => {
  const m = Number(k.split("-")[1]);
  return vi ? `T${m}` : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
};

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/** Mục có gì để so trong tháng: tháng này hoặc tháng trước khác 0. */
const active = (r: Metrics) => r.month !== 0 || r.prev !== 0;

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
  const nameOf = (r: Metrics) => (view === "groups" ? label(r.name) : r.name);

  const rows = useMemo(() => {
    if (!sideData) return [];
    const list = (view === "vendors" ? sideData.vendors : sideData.groups).filter(active);
    const q = fold(query.trim());
    const filtered = q
      ? list.filter(
          (r) =>
            fold(r.name).includes(q) ||
            fold(label(r.name)).includes(q) ||
            (r.children ?? []).some((c) => fold(c.name).includes(q) || fold(label(c.name)).includes(q))
        )
      : list;
    return [...filtered].sort((a, b) => b.month - a.month || b.prev - a.prev);
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
  const thisM = mShort(data.month, vi);
  const prevM = mShort(data.prevMonth, vi);

  // --- Câu kết luận ---------------------------------------------------------
  const top = rows[0];
  const share = top && T.month > 0 ? Math.round((top.month / T.month) * 100) : 0;
  const riser = rows
    .filter((r) => r.prev > 0 && r.month > r.prev)
    .sort((a, b) => b.month - b.prev - (a.month - a.prev))[0];
  const kind = view === "vendors" ? (income ? t("source", "nguồn thu") : t("place", "nơi chi")) : t("category", "nhóm");
  const headline =
    top && top.month > 0
      ? t(
          `${nameOf(top)} is the biggest ${kind} in ${thisM} — ${share}% of ${income ? "income" : "spending"}`,
          `${nameOf(top)} là ${kind} lớn nhất ${thisM} — ${share}% tổng ${income ? "thu" : "chi"}`
        )
      : income
        ? t(`No income recorded in ${thisM}`, `${thisM} chưa ghi khoản thu nào`)
        : t(`No spending recorded in ${thisM}`, `${thisM} chưa ghi khoản chi nào`);

  const shown = showAll || query ? rows : rows.slice(0, SHOW);
  const scale = Math.max(1, ...shown.map((r) => Math.max(r.month, r.prev)));

  const seg = (on: boolean) =>
    `flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 min-h-10 rounded-full text-xs font-bold transition-colors ${
      on ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* --- Bộ lọc: một hàng phía trên, ngoài thẻ --- */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-1 p-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
          <button onClick={() => { setSide("expense"); setOpen(null); }} className={seg(!income)}>
            {t("Spending", "Chi tiêu")}
          </button>
          <button onClick={() => { setSide("income"); setOpen(null); }} className={seg(income)}>
            {t("Income", "Thu nhập")}
          </button>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
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
            placeholder={view === "vendors" ? t("Find… e.g. highlands", "Tìm… VD: highlands") : t("Find… e.g. coffee", "Tìm… VD: cafe")}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full pl-10 pr-4 py-2 min-h-10 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
          />
        </div>
      </div>

      <section className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] flex flex-col gap-5 min-w-0">
        <header>
          <h4 className="c-h5 text-[var(--color-text)] text-balance">{headline}</h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1">
            {t(
              `${income ? "Income" : "Spending"} by ${kind}, ${mLabel(data.month)} against ${mLabel(data.prevMonth)}`,
              `${income ? "Thu" : "Chi"} theo ${kind}, ${mLabel(data.month)} so với ${mLabel(data.prevMonth)}`
            )}
          </p>
        </header>

        {/* --- Bốn con số: tháng này là ô chính, ba ô còn lại là bối cảnh --- */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatTile
            emphasis
            label={t(`${thisM} ${data.year}`, `${thisM}/${data.year}`)}
            value={formatVND(T.month)}
            delta={<Delta pct={pctChange(T.month, T.prev)} upIsGood={income} vs={t(`vs ${prevM}`, `so ${prevM}`)} />}
          />
          <StatTile label={t(`Last month (${mLabel(data.prevMonth)})`, `Tháng trước (${mLabel(data.prevMonth)})`)} value={formatVND(T.prev)} />
          <StatTile label={t(`Same month last year (${mLabel(data.lastYearMonth)})`, `Cùng tháng năm trước (${mLabel(data.lastYearMonth)})`)} value={formatVND(T.lastYearMonth)} />
          <StatTile
            label={t(`${data.year} so far`, `Năm ${data.year} tới nay`)}
            value={formatVND(T.ytd)}
            delta={<Delta pct={pctChange(T.ytd, T.lastYtd)} upIsGood={income} vs={t(`vs same period ${data.year - 1}`, `so cùng kỳ ${data.year - 1}`)} />}
          />
        </div>

        {riser && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("Biggest rise vs last month:", "Tăng nhiều nhất so tháng trước:")}{" "}
            <strong className="text-[var(--color-text)]">{nameOf(riser)}</strong>{" "}
            <span className="tabular-nums">+{money(riser.month - riser.prev)}</span>
          </p>
        )}

        <SeriesKey
          items={[
            { label: thisM, color: VIZ.muted, shape: "bar" },
            { label: prevM, color: VIZ.ink, shape: "tick" },
          ]}
        />

        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)]">
            {query
              ? t("Nothing matches.", "Không có mục nào khớp.")
              : income
                ? t("No income in these two months.", "Hai tháng này chưa có khoản thu nào.")
                : t("No spending in these two months.", "Hai tháng này chưa có khoản chi nào.")}
          </p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {shown.map((r) => (
              <BreakdownRow
                key={r.key}
                row={r}
                name={nameOf(r)}
                scale={scale}
                income={income}
                highlight={r.key === top?.key}
                isOpen={open === r.key}
                onToggle={() => setOpen(open === r.key ? null : r.key)}
                data={data}
                money={money}
                prevM={prevM}
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
            {showAll ? t("Show top 10", "Thu gọn còn 10 mục") : t(`Show all ${rows.length}`, `Xem tất cả ${rows.length} mục`)}
          </button>
        )}
      </section>
    </div>
  );
}

// ==========================================================================

/** Một thanh kỳ này + vạch mốc kỳ trước, cùng thước `scale`. */
function Bullet({ now, before, scale, color }: { now: number; before: number; scale: number; color: string }) {
  const pos = (v: number) => `${(Math.max(0, v) / scale) * 100}%`;
  return (
    <div className="relative h-5 w-full" aria-hidden>
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded-r-[4px]"
        style={{ width: pos(now), minWidth: now > 0 ? 3 : 0, background: color }}
      />
      {before > 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 rounded-full"
          style={{ left: `calc(${pos(before)} - 1px)`, background: VIZ.ink }}
        />
      )}
    </div>
  );
}

function BreakdownRow({
  row,
  name,
  scale,
  income,
  highlight,
  isOpen,
  onToggle,
  data,
  money,
  prevM,
  childLabel,
}: {
  row: Metrics;
  name: string;
  scale: number;
  income: boolean;
  highlight: boolean;
  isOpen: boolean;
  onToggle: () => void;
  data: Breakdown;
  money: (n: number) => string;
  prevM: string;
  childLabel: (name: string) => string;
}) {
  const { t } = useLanguage();
  const trend = data.trendMonths.map((m, i) => ({ name: m, value: row.trend[i] ?? 0 }));
  const avg = Math.round(row.trend.reduce((a, b) => a + b, 0) / 12);
  const cur = trend.length - 1;
  const children = (row.children ?? []).filter(active);
  const childScale = Math.max(1, ...children.map((x) => Math.max(x.month, x.prev)));

  return (
    <li className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full text-left px-2 py-2.5 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_8.5rem] items-center gap-x-4 gap-y-1"
      >
        <span className="min-w-0 flex items-center gap-1.5">
          <ChevronDown
            size={14}
            className={`shrink-0 text-[var(--color-text-faint)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
          <span className={`text-sm truncate ${highlight ? "font-bold text-[var(--color-text)]" : "text-[var(--color-text)]"}`}>
            {name}
          </span>
        </span>
        <span className="order-3 col-span-2 md:order-none md:col-span-1">
          <Bullet now={row.month} before={row.prev} scale={scale} color={highlight ? VIZ.accent : VIZ.muted} />
        </span>
        <span className="text-right">
          <span className="block text-sm font-bold tabular-nums text-[var(--color-text)]">{formatVND(row.month)}</span>
          <span className="block">
            <Delta pct={pctChange(row.month, row.prev)} upIsGood={income} vs={t(`vs ${money(row.prev)}`, `từ ${money(row.prev)}`)} />
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="px-2 pb-5 pt-1 flex flex-col gap-4">
          {/* Năm nay so cùng kỳ — câu hỏi "năm trước bao nhiêu" */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StatTile
              emphasis
              label={t(`${data.year} so far`, `Năm ${data.year} tới nay`)}
              value={formatVND(row.ytd)}
              delta={<Delta pct={pctChange(row.ytd, row.lastYtd)} upIsGood={income} vs={t(`vs same period ${data.year - 1}`, `so cùng kỳ ${data.year - 1}`)} />}
            />
            <StatTile label={t(`Same period ${data.year - 1}`, `Cùng kỳ ${data.year - 1}`)} value={formatVND(row.lastYtd)} />
            <StatTile label={t(`All of ${data.year - 1}`, `Cả năm ${data.year - 1}`)} value={formatVND(row.lastYearTotal)} />
          </div>

          {/* 12 tháng: cột xám, tháng đang xem màu nhấn + ghi số; đường trung bình
              ghi nhãn tại chỗ thay cho chú giải. Không trục Y, không lưới. */}
          <div>
            <p className="text-xs text-[var(--color-text-faint)] mb-2">
              {t("Last 12 months · dashed line = 12-month average", "12 tháng gần nhất · nét đứt = trung bình 12 tháng")}
            </p>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="name" {...monthAxis(data.trendMonths)} />
                  <Tooltip
                    {...TOOLTIP}
                    formatter={(v) => [formatVND(Number(v) || 0), t("Amount", "Số tiền")]}
                    labelFormatter={(l) => mLabel(String(l))}
                  />
                  {avg > 0 && (
                    <ReferenceLine
                      y={avg}
                      stroke={VIZ.muted}
                      strokeDasharray="4 3"
                      label={{ value: `${t("avg", "TB")} ${money(avg)}`, position: "insideTopLeft", fontSize: 10, fill: "var(--color-text-faint)" }}
                    />
                  )}
                  <Bar dataKey="value" {...BAR} label={labelAt(cur, money)}>
                    {trend.map((p, i) => (
                      <Cell key={p.name} fill={i === cur ? VIZ.accent : VIZ.muted} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {children.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-[var(--color-text-faint)]">
                {t(`Sub-categories · tick = ${prevM}`, `Nhóm con · vạch = ${prevM}`)}
              </p>
              <ul className="flex flex-col">
                {children.map((c) => (
                  <li
                    key={c.key || "_"}
                    className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_8.5rem] items-center gap-x-4 gap-y-1 py-1.5"
                  >
                    <span className="text-xs text-[var(--color-text)] truncate">{childLabel(c.name)}</span>
                    <span className="order-3 col-span-2 md:order-none md:col-span-1">
                      <Bullet now={c.month} before={c.prev} scale={childScale} color={VIZ.muted} />
                    </span>
                    <span className="text-right text-xs">
                      <span className="font-bold tabular-nums text-[var(--color-text)]">{formatVND(c.month)}</span>{" "}
                      <Delta pct={pctChange(c.month, c.prev)} upIsGood={income} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
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
