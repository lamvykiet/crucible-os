"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, Cell, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
  type ScatterShapeProps,
} from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { VIZ, GRID, yAxis, xAxis, BAR, STACK_GAP, LINE, TOOLTIP, TOOLTIP_LINE, catColor, soft } from "@/lib/viz";
import ChartCard, { StatTile, type SeriesKeyItem } from "@/components/charts/ChartCard";
import { monthAxis, careerMonthAxis } from "./MonthAxisTick";

// Bức tranh nợ, đọc từ lịch trả nợ — xem docs/bieu-do.md.
//
// Thứ tự theo câu người ta thực sự hỏi: bao giờ hết nợ → đã trả được bao
// nhiêu → mỗi năm tiền đi vào lãi bao nhiêu → mười hai tháng tới cần bao
// nhiêu → có trả đúng lịch không. Mỗi thẻ có tiêu đề là câu trả lời tính từ dữ
// liệu; tên biểu đồ nằm ở dòng phụ.
//
// Màu: các khoản vay LÀ đối tượng so sánh nên dư nợ và mười hai tháng tới tô
// theo `catColor(colourIndex)` (API gán sẵn, khoản thứ năm trở đi là "Khác").
// Biểu đồ gốc/lãi và trả thật/lịch thì xám mặc định, nhấn đúng chỗ câu chuyện
// nói tới (phần lãi, tháng trả thiếu).

const OTHER_KEY = "__other";

interface DebtRow {
  id: string;
  name: string;
  type: string;
  status: string;
  principal: number;
  remaining: number;
  monthlyPayment: number;
  interestRate: number;
  colourIndex: number;
  paidPeriods: number;
  totalPeriods: number;
  periodsLeft: number;
  interestPaid: number;
  interestLeft: number;
  totalLeft: number;
  payoffDate: string | null;
  nextDue: {
    period: number;
    dueDate: string;
    payment: number;
    principal: number;
    interest: number;
  } | null;
  paidPct: number;
  hasSchedule: boolean;
}

interface Analysis {
  hasData: boolean;
  nowMonth: string;
  months: string[];
  balanceSeries: Record<string, string | number>[];
  balanceKeys: string[];
  principalVsInterest: { name: string; principal: number; interest: number; total: number; share: number }[];
  next12: Record<string, string | number>[];
  actualVsPlan: { name: string; planned: number; actual: number }[];
  debts: DebtRow[];
  totals: {
    outstanding: number;
    principalTotal: number;
    principalPaid: number;
    interestPaid: number;
    interestLeft: number;
    totalLeft: number;
    monthlyPayment: number;
    payoffDate: string | null;
    monthsLeft: number;
    weightedRate: number;
    activeCount: number;
    settledCount: number;
  };
}

/** "2040-04-10" → "04/2040" */
function viMonthOf(iso: string) {
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** "2026-10" → "10/2026" */
const mLabel = (k: string) => {
  const [y, m] = k.split("-");
  return `${m}/${y}`;
};

/** Trả thiếu so với lịch: lệch quá 1% (bỏ qua chênh lệch làm tròn của ngân hàng). */
const isShort = (r: { planned: number; actual: number }) => r.planned > 0 && r.actual < r.planned * 0.99;

/** Thanh tiến độ: rãnh `VIZ.ghost`, phần đã đi màu `color`. Luôn đi kèm chữ ghi số. */
function Meter({ pct, color = VIZ.accent }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: VIZ.ghost }} aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${w}%`, minWidth: w > 0 ? 4 : 0, background: color }} />
    </div>
  );
}

export default function DebtOverview({ refreshKey }: { refreshKey: number }) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<Analysis | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/finance/debts/analysis", { signal: controller.signal });
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setData(json.data);
          setFailed(false);
        } else {
          setFailed(true);
        }
      } catch (e) {
        if (!ignore && (e as Error).name !== "AbortError") setFailed(true);
      }
    })();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [refreshKey]);

  if (failed) {
    return (
      <p className="text-sm text-[var(--color-error)]">
        {t("Could not load the debt analysis.", "Không tải được phân tích nợ.")}
      </p>
    );
  }
  if (!data) {
    return <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>;
  }
  if (!data.hasData) return null;

  const {
    totals, debts, balanceSeries, balanceKeys, principalVsInterest, next12,
    actualVsPlan, months, nowMonth,
  } = data;

  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
  const nameOf = (id: string) =>
    id === OTHER_KEY ? t("Other loans", "Khoản khác") : debts.find((d) => d.id === id)?.name || id;
  const colourOfId = (id: string) => catColor(debts.find((d) => d.id === id)?.colourIndex ?? 4);
  const loanKeys: SeriesKeyItem[] | undefined =
    balanceKeys.length > 1 ? balanceKeys.map((k) => ({ label: nameOf(k), color: colourOfId(k), shape: "bar" })) : undefined;
  const lastKey = balanceKeys[balanceKeys.length - 1];

  const payoff = totals.payoffDate ? viMonthOf(totals.payoffDate) : null;
  const yearsLeft = totals.monthsLeft > 0 ? (totals.monthsLeft / 12).toFixed(1) : "0";
  // Tiền lãi tính theo phần trăm của gốc đã vay — câu "vay 2,1 tỷ trả 3,4 tỷ"
  // nói rõ hơn mọi con số lãi suất.
  const interestTotal = totals.interestPaid + totals.interestLeft;
  const interestOverPrincipal =
    totals.principalTotal > 0 ? Math.round((interestTotal / totals.principalTotal) * 100) : 0;
  const principalPaidPct =
    totals.principalTotal > 0 ? Math.round((totals.principalPaid / totals.principalTotal) * 100) : 0;

  // --- 1. Tổng quan ---------------------------------------------------------
  const overviewTitle = payoff
    ? t(`Debt-free in ${payoff} — about ${yearsLeft} years to go`, `Hết nợ vào ${payoff} — còn khoảng ${yearsLeft} năm`)
    : t("Your debts at a glance", "Tổng quan các khoản nợ");

  // --- 2. Dư nợ về 0 --------------------------------------------------------
  const nowRow = balanceSeries.find((r) => r.name === nowMonth);
  const nowTotal = nowRow ? Number(nowRow.total) || 0 : null;
  const balanceTitle =
    totals.principalTotal > 0
      ? t(
          `${principalPaidPct}% of the ${money(totals.principalTotal)} borrowed is repaid — ${money(totals.outstanding)} still owed`,
          `Đã trả ${principalPaidPct}% trong ${money(totals.principalTotal)} gốc đã vay — còn nợ ${money(totals.outstanding)}`
        )
      : t("The road to zero", "Đường dư nợ về 0");

  // --- 3. Gốc và lãi theo năm ----------------------------------------------
  const thisYear = nowMonth.slice(0, 4);
  const yearRow = principalVsInterest.find((r) => r.name === thisYear);
  const underHalf = principalVsInterest.find((r) => r.name >= thisYear && r.total > 0 && r.share < 50);
  const piTitle = yearRow && yearRow.total > 0
    ? yearRow.share >= 50 && underHalf
      ? t(
          `${yearRow.share}% of what you pay in ${thisYear} is interest — it drops below half only in ${underHalf.name}`,
          `${yearRow.share}% số tiền trả năm ${thisYear} là lãi — tới ${underHalf.name} mới xuống dưới một nửa`
        )
      : t(`${yearRow.share}% of what you pay in ${thisYear} is interest`, `${yearRow.share}% số tiền trả năm ${thisYear} là lãi`)
    : t("Principal vs interest, year by year", "Gốc và lãi, theo từng năm");

  // --- 4. Mười hai tháng tới ------------------------------------------------
  const next12Total = next12.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const next12Avg = next12.length > 0 ? next12Total / next12.length : 0;
  const next12Peak = next12.reduce<Record<string, string | number> | null>(
    (best, r) => (!best || (Number(r.total) || 0) > (Number(best.total) || 0) ? r : best),
    null
  );
  const peakStandsOut = next12Peak && (Number(next12Peak.total) || 0) > next12Avg * 1.15;
  const next12Title =
    next12Total > 0
      ? peakStandsOut && next12Peak
        ? t(
            `The next ${next12.length} months need ${money(next12Total)} — peaking at ${money(Number(next12Peak.total))} in ${mLabel(String(next12Peak.name))}`,
            `${next12.length} tháng tới cần ${money(next12Total)} — cao nhất ${money(Number(next12Peak.total))} vào ${mLabel(String(next12Peak.name))}`
          )
        : t(
            `The next ${next12.length} months need ${money(next12Total)}, about ${money(next12Avg)} a month`,
            `${next12.length} tháng tới cần ${money(next12Total)}, khoảng ${money(next12Avg)} mỗi tháng`
          )
      : t("Nothing scheduled in the next twelve months", "Mười hai tháng tới không có kỳ nào phải trả");

  // --- 5. Trả thật so với lịch ---------------------------------------------
  const duePeriods = actualVsPlan.filter((r) => r.planned > 0);
  const shortRows = duePeriods.filter(isShort);
  const shortGap = shortRows.reduce((s, r) => s + (r.planned - r.actual), 0);
  const actualTotal = actualVsPlan.reduce((s, r) => s + r.actual, 0);
  const paidTitle =
    duePeriods.length === 0
      ? t("No payments were due in the last twelve months", "Mười hai tháng qua chưa có kỳ nào đến hạn")
      : actualTotal === 0
        ? t(
            `No debt payment recorded for the ${duePeriods.length} months that were due`,
            `Chưa ghi khoản trả nợ nào cho ${duePeriods.length} tháng đã đến hạn`
          )
        : shortRows.length === 0
          ? t(
              `Paid in full in all ${duePeriods.length} months that were due`,
              `Trả đủ cả ${duePeriods.length} tháng đến hạn`
            )
          : t(
              `Paid short in ${shortRows.length} of ${duePeriods.length} months — ${money(shortGap)} behind schedule`,
              `Trả thiếu ${shortRows.length}/${duePeriods.length} tháng — hụt ${money(shortGap)} so với lịch`
            );

  return (
    <div className="space-y-6">
      {/* --- 1. Bốn con số --- */}
      <ChartCard
        title={overviewTitle}
        subtitle={t(
          `${totals.activeCount} active ${totals.activeCount === 1 ? "loan" : "loans"} · average rate ${totals.weightedRate.toFixed(2)}%/yr · from the repayment schedule`,
          `${totals.activeCount} khoản đang trả · lãi suất bình quân ${totals.weightedRate.toFixed(2)}%/năm · theo lịch trả nợ`
        )}
      >
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatTile
            emphasis
            label={t("Still to pay", "Còn phải trả")}
            value={formatVND(totals.totalLeft)}
            note={t(
              `${money(totals.outstanding)} principal + ${money(totals.interestLeft)} interest`,
              `${money(totals.outstanding)} gốc + ${money(totals.interestLeft)} lãi`
            )}
          />
          <StatTile
            label={t("Every month", "Mỗi tháng")}
            value={formatVND(totals.monthlyPayment)}
            note={t(`${totals.activeCount} active loans`, `${totals.activeCount} khoản đang trả`)}
          />
          <StatTile
            label={t("Interest, all in", "Tiền lãi, cả đời vay")}
            value={formatVND(interestTotal)}
            note={t(
              `${interestOverPrincipal}% of the ${money(totals.principalTotal)} borrowed`,
              `bằng ${interestOverPrincipal}% của ${money(totals.principalTotal)} đã vay`
            )}
          />
          <StatTile
            label={t("Debt-free on", "Hết nợ vào")}
            value={payoff ?? "—"}
            note={t(`${yearsLeft} years to go`, `còn khoảng ${yearsLeft} năm`)}
          />
        </div>
      </ChartCard>

      {/* --- 2. Dư nợ đi xuống tới ngày hết nợ ---
          Vùng chồng theo khoản vay: mỗi khoản một màu nhạt (`soft`) + nét viền
          đậm cùng màu, nên hai vùng không pha màu vào nhau. "Hôm nay" là một
          vạch mảnh và một chấm ghi số — chỗ duy nhất có nhãn. */}
      <ChartCard
        title={balanceTitle}
        subtitle={t(
          "Balance left after each period, by loan, on the current schedule",
          "Dư nợ còn lại sau mỗi kỳ, theo từng khoản, theo lịch trả nợ hiện tại"
        )}
        keys={loanKeys}
      >
        <div className="h-64 md:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceSeries} margin={{ top: 22, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...careerMonthAxis(months)} />
              <YAxis {...yAxis(money, 52)} />
              <Tooltip
                {...TOOLTIP_LINE}
                formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                labelFormatter={(l) => mLabel(String(l))}
              />
              {balanceKeys.map((key) => (
                <Area
                  key={key}
                  {...LINE}
                  strokeWidth={1.5}
                  dataKey={key}
                  stackId="bal"
                  name={nameOf(key)}
                  stroke={colourOfId(key)}
                  fill={soft(colourOfId(key), 30)}
                  fillOpacity={1}
                />
              ))}
              {nowTotal !== null && (
                <ReferenceLine
                  x={nowMonth}
                  stroke={VIZ.muted}
                  strokeWidth={1}
                  label={{ value: t("today", "hôm nay"), position: "top", fontSize: 10, fill: "var(--color-text-faint)" }}
                />
              )}
              {nowTotal !== null && nowTotal > 0 && (
                <ReferenceDot
                  x={nowMonth}
                  y={nowTotal}
                  r={4}
                  fill={VIZ.ink}
                  stroke={VIZ.surface}
                  strokeWidth={2}
                  label={{ value: money(nowTotal), position: "right", fontSize: 11, fontWeight: 700, fill: "var(--color-text)" }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- 3. Gốc và lãi theo năm ---
            Lãi nằm SÁT ĐÁY và mang màu nhấn: cùng một đường gốc thì mắt so
            được chiều cao phần lãi qua từng năm — đó là thứ đáng thấy. */}
        <ChartCard
          title={piTitle}
          subtitle={t("Principal and interest due each year, on the schedule", "Gốc và lãi phải trả mỗi năm, theo lịch trả nợ")}
          keys={[
            { label: t("Interest", "Lãi"), color: VIZ.accent, shape: "bar" },
            { label: t("Principal", "Gốc"), color: VIZ.muted, shape: "bar" },
          ]}
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={principalVsInterest} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis
                  dataKey="name"
                  {...xAxis}
                  // Không ép `interval`: 21 năm trên khổ 375px thì cách một
                  // nhãn vẫn chồng lên nhau. Để recharts tự đo rồi bỏ bớt.
                  minTickGap={12}
                />
                <YAxis {...yAxis(money, 50)} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                  labelFormatter={(l, p) => {
                    const row = p?.[0]?.payload as { share?: number } | undefined;
                    return row?.share !== undefined
                      ? `${l} · ${t(`${row.share}% is interest`, `lãi chiếm ${row.share}%`)}`
                      : String(l);
                  }}
                />
                <Bar dataKey="interest" stackId="pi" name={t("Interest", "Lãi")} fill={VIZ.accent} maxBarSize={BAR.maxBarSize} {...STACK_GAP} />
                <Bar dataKey="principal" stackId="pi" name={t("Principal", "Gốc")} fill={VIZ.muted} {...BAR} {...STACK_GAP} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* --- 4. Mười hai kỳ tới --- */}
        <ChartCard
          title={next12Title}
          subtitle={t("What each loan asks for, month by month", "Mỗi khoản đòi bao nhiêu, theo từng tháng")}
          keys={next12Total > 0 ? loanKeys : undefined}
        >
          {next12Total > 0 && (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={next12} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" {...monthAxis(next12.map((r) => String(r.name)))} />
                  <YAxis {...yAxis(money, 50)} />
                  <Tooltip
                    {...TOOLTIP}
                    formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                    labelFormatter={(l) => mLabel(String(l))}
                  />
                  {balanceKeys.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="due"
                      name={nameOf(key)}
                      fill={colourOfId(key)}
                      maxBarSize={BAR.maxBarSize}
                      radius={key === lastKey ? BAR.radius : undefined}
                      {...STACK_GAP}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* --- 5. Trả thật so với lịch ---
          Kiểu bullet: cột = tiền thật sự đã rời tài khoản, vạch ngang = lịch
          yêu cầu. Cột xám; tháng trả thiếu mới mang màu nhấn. */}
      {actualVsPlan.length > 0 && (
        <ChartCard
          title={paidTitle}
          subtitle={t(
            "Debt payments recorded each month against the schedule, last 12 months",
            "Khoản trả nợ đã ghi mỗi tháng so với lịch, 12 tháng gần nhất"
          )}
          keys={[
            { label: t("Paid", "Đã trả"), color: VIZ.muted, shape: "bar" },
            ...(shortRows.length > 0 && actualTotal > 0
              ? [{ label: t("Paid short", "Trả thiếu"), color: VIZ.accent, shape: "bar" as const }]
              : []),
            { label: t("Scheduled", "Theo lịch"), color: VIZ.ink, shape: "line" },
          ]}
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={actualVsPlan} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...monthAxis(actualVsPlan.map((r) => r.name))} />
                <YAxis {...yAxis(money, 50)} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                  // Lịch của tháng ghi ngay ở dòng đầu: tooltip chung không
                  // phải lúc nào cũng liệt kê điểm của <Scatter>.
                  labelFormatter={(l, p) => {
                    const row = p?.[0]?.payload as { planned?: number } | undefined;
                    const head = mLabel(String(l));
                    return row?.planned ? `${head} · ${t("scheduled", "theo lịch")} ${formatVND(row.planned)}` : head;
                  }}
                />
                <Bar dataKey="actual" name={t("Paid", "Đã trả")} fill={VIZ.muted} {...BAR}>
                  {actualVsPlan.map((r) => (
                    <Cell key={r.name} fill={actualTotal > 0 && isShort(r) ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
                <Scatter
                  dataKey="planned"
                  name={t("Scheduled", "Theo lịch")}
                  fill={VIZ.ink}
                  isAnimationActive={false}
                  shape={(p: ScatterShapeProps) => {
                    const v = Number((p.payload as { planned?: number } | undefined)?.planned) || 0;
                    if (p.cx === undefined || p.cy === undefined || v <= 0) return <g />;
                    return (
                      <line
                        x1={p.cx - 12}
                        x2={p.cx + 12}
                        y1={p.cy}
                        y2={p.cy}
                        stroke={VIZ.ink}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* --- 6. Tiến độ từng khoản --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {debts.map((d) => (
          <div
            key={d.id}
            className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] flex flex-col gap-3 min-w-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-[3px] flex-none"
                    style={{ background: catColor(d.colourIndex) }}
                    aria-hidden
                  />
                  <span className="font-bold text-[var(--color-text)] truncate">{d.name}</span>
                </div>
                <div className="text-xs text-[var(--color-text-faint)] mt-1">
                  {d.type} · {d.interestRate}%/{t("yr", "năm")}
                </div>
              </div>
              <div className="text-right flex-none">
                <div className="font-bold tabular-nums text-[var(--color-text)]">{formatVND(d.remaining)}</div>
                <div className="text-xs text-[var(--color-text-faint)]">
                  {t("left of", "còn lại /")} {money(d.principal)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Meter pct={d.paidPct} />
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-bold tabular-nums text-[var(--color-text)]">
                  {t(`${d.paidPct}% of principal repaid`, `Đã trả ${d.paidPct}% gốc`)}
                </span>
                <span className="tabular-nums text-[var(--color-text-faint)]">
                  {t(`${d.paidPeriods} of ${d.totalPeriods} periods`, `${d.paidPeriods}/${d.totalPeriods} kỳ`)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <div className="text-[var(--color-text-muted)]">{t("Interest still to pay", "Lãi còn phải trả")}</div>
                <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5">{money(d.interestLeft)}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)]">{t("Debt-free on", "Hết nợ vào")}</div>
                <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5">
                  {d.payoffDate ? viMonthOf(d.payoffDate) : "—"}
                </div>
              </div>
              {d.nextDue && (
                <div className="col-span-2 pt-2 border-t border-[var(--color-border)]">
                  <div className="text-[var(--color-text-muted)]">
                    {t("Next payment", "Kỳ tới")} · {t("period", "kỳ")} {d.nextDue.period} · {d.nextDue.dueDate}
                  </div>
                  <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5">
                    {formatVND(d.nextDue.payment)}
                    {/* Tách gốc/lãi ngay ở đây: biết 6,7 triệu trong 12,5 triệu
                        là tiền lãi thì mới thấy vì sao dư nợ xuống chậm. */}
                    <span className="ml-2 font-normal text-[var(--color-text-faint)]">
                      {t("principal", "gốc")} {money(d.nextDue.principal)} · {t("interest", "lãi")} {money(d.nextDue.interest)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
