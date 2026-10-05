"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { monthAxis, careerMonthAxis } from "./MonthAxisTick";

// Bức tranh nợ, đọc từ lịch trả nợ.
//
// Màn hình cũ mở lên là bốn ô số rồi một bảng rồi một danh sách — đúng dữ liệu
// nhưng không trả lời câu nào. Khối này xếp theo thứ tự người ta thực sự hỏi:
// bao giờ hết nợ → còn phải trả bao nhiêu → mỗi tháng tiền đi đâu → có trả
// đúng hạn không.

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
    actualVsPlan, months,
  } = data;

  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
  const nameOf = (id: string) =>
    id === OTHER_KEY ? t("Other loans", "Khoản khác") : debts.find((d) => d.id === id)?.name || id;
  const colourOf = (i: number) =>
    i < 4 ? `var(--chart-${i + 1})` : "var(--color-border-strong)";
  const colourOfId = (id: string) =>
    colourOf(debts.find((d) => d.id === id)?.colourIndex ?? 4);

  const yearsLeft = totals.monthsLeft > 0 ? (totals.monthsLeft / 12).toFixed(1) : "0";
  // Tiền lãi tính theo phần trăm của gốc đã vay — câu "vay 2,1 tỷ trả 3,4 tỷ"
  // nói rõ hơn mọi con số lãi suất.
  const interestTotal = totals.interestPaid + totals.interestLeft;
  const interestOverPrincipal =
    totals.principalTotal > 0 ? Math.round((interestTotal / totals.principalTotal) * 100) : 0;

  const headline = [
    {
      label: t("Debt-free on", "Hết nợ vào"),
      value: totals.payoffDate ? viMonthOf(totals.payoffDate) : "—",
      note: t(`${yearsLeft} years to go`, `còn khoảng ${yearsLeft} năm`),
      tone: "text",
    },
    {
      label: t("Still to pay", "Còn phải trả"),
      value: formatVND(totals.totalLeft),
      note: t(
        `${money(totals.outstanding)} principal + ${money(totals.interestLeft)} interest`,
        `${money(totals.outstanding)} gốc + ${money(totals.interestLeft)} lãi`
      ),
      tone: "warning",
    },
    {
      label: t("Every month", "Mỗi tháng"),
      value: formatVND(totals.monthlyPayment),
      note: t(
        `${totals.activeCount} active loans · ${totals.weightedRate.toFixed(2)}%/yr`,
        `${totals.activeCount} khoản đang trả · ${totals.weightedRate.toFixed(2)}%/năm`
      ),
      tone: "text",
    },
    {
      label: t("Interest, all in", "Tiền lãi, tính cả đời vay"),
      value: formatVND(interestTotal),
      note: t(
        `${interestOverPrincipal}% of the ${money(totals.principalTotal)} borrowed`,
        `bằng ${interestOverPrincipal}% của ${money(totals.principalTotal)} đã vay`
      ),
      tone: "error",
    },
  ];

  return (
    <div className="space-y-6">
      {/* --- Bốn câu trả lời --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {headline.map((c) => (
          <div
            key={c.label}
            className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)]"
          >
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {c.label}
            </div>
            <div
              className={`text-xl font-bold tabular-nums mt-2 ${
                c.tone === "warning"
                  ? "text-[var(--color-warning)]"
                  : c.tone === "error"
                    ? "text-[var(--color-error)]"
                    : "text-[var(--color-text)]"
              }`}
            >
              {c.value}
            </div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{c.note}</div>
          </div>
        ))}
      </div>

      {/* --- Dư nợ đi xuống tới ngày hết nợ --- */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
        <h4 className="c-h5 text-[var(--color-text)]">
          {t("The road to zero", "Đường dư nợ về 0")}
        </h4>
        <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
          {t(
            "dư nợ còn lại sau mỗi kỳ, theo lịch trả nợ hiện tại",
            "dư nợ còn lại sau mỗi kỳ, theo lịch trả nợ hiện tại"
          )}
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceSeries} className="c-chart-multi">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" {...careerMonthAxis(months)} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                tickFormatter={(v) => money(Number(v))}
                width={52}
              />
              <Tooltip
                formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                labelFormatter={(l) => String(l)}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              {balanceKeys.map((key, i) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="bal"
                  name={nameOf(key)}
                  className={key === OTHER_KEY ? "c-series-other" : `c-series-${i + 1}`}
                  stroke={colourOfId(key)}
                  fill={colourOfId(key)}
                  // globals.css đặt `.recharts-area-area { opacity: .14 }` cho
                  // biểu đồ vùng một chuỗi, nơi nền mờ là đúng. Ở đây hai vùng
                  // chồng nhau và chính mảng màu mới là dữ liệu, nên phải gỡ —
                  // `opacity` là thuộc tính khác `fill-opacity`, hai cái nhân
                  // với nhau ra 0,07 và cả biểu đồ gần như vô hình. Style nội
                  // tuyến là lối duy nhất thắng được quy tắc chung.
                  style={{ opacity: 1, fillOpacity: 0.55 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Gốc và lãi theo năm --- */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">
            {t("Principal vs interest, year by year", "Gốc và lãi, theo từng năm")}
          </h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t(
              "the interest share falls very slowly — that is what a long loan means",
              "phần lãi giảm rất chậm — đó chính là cái giá của khoản vay dài"
            )}
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={principalVsInterest} className="c-chart-multi">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--color-text-faint)" }}
                  // Không ép `interval`: 21 năm trên khổ 375px thì cách một
                  // nhãn vẫn chồng lên nhau thành "20202022024". Để recharts tự
                  // đo bề rộng chữ rồi bỏ bớt theo khổ màn hình.
                  minTickGap={12}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                  tickFormatter={(v) => money(Number(v))}
                  width={50}
                />
                <Tooltip
                  formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                  labelFormatter={(l, p) => {
                    const row = p?.[0]?.payload as { share?: number } | undefined;
                    return row?.share !== undefined
                      ? `${l} · ${t(`${row.share}% is interest`, `lãi chiếm ${row.share}%`)}`
                      : String(l);
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar
                  dataKey="principal"
                  stackId="pi"
                  name={t("Principal", "Gốc")}
                  className="c-series-1"
                  fill="var(--chart-1)"
                  maxBarSize={26}
                />
                <Bar
                  dataKey="interest"
                  stackId="pi"
                  name={t("Interest", "Lãi")}
                  className="c-series-2"
                  fill="var(--chart-2)"
                  maxBarSize={26}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --- Mười hai kỳ tới --- */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">
            {t("The next twelve months", "Mười hai tháng tới cần bao nhiêu")}
          </h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t("what each loan asks for, month by month", "mỗi khoản đòi bao nhiêu, theo từng tháng")}
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={next12} className="c-chart-multi">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  {...monthAxis(next12.map((r) => String(r.name)))}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                  tickFormatter={(v) => money(Number(v))}
                  width={50}
                />
                <Tooltip formatter={(v, n) => [formatVND(Number(v) || 0), n]} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                {balanceKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="due"
                    name={nameOf(key)}
                    className={key === OTHER_KEY ? "c-series-other" : `c-series-${i + 1}`}
                    fill={colourOfId(key)}
                    maxBarSize={32}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- Trả thật so với kế hoạch --- */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
        <h4 className="c-h5 text-[var(--color-text)]">
          {t("Paid versus scheduled", "Đã trả so với lịch")}
        </h4>
        <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
          {t(
            "columns: what actually left the account · line: what the schedule asked for",
            "cột: tiền thật sự đã rời tài khoản · đường: lịch trả nợ yêu cầu bao nhiêu"
          )}
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={actualVsPlan} className="c-chart-multi">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" {...monthAxis(actualVsPlan.map((r) => r.name))} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                tickFormatter={(v) => money(Number(v))}
                width={50}
              />
              <Tooltip formatter={(v, n) => [formatVND(Number(v) || 0), n]} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Bar
                dataKey="actual"
                name={t("Actually paid", "Đã trả thật")}
                className="c-series-1"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
              <Line
                type="monotone"
                dataKey="planned"
                name={t("Scheduled", "Theo lịch")}
                stroke="var(--color-text)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 2.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- Tiến độ từng khoản --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {debts.map((d) => (
          <div
            key={d.id}
            className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-none"
                    style={{ background: colourOf(d.colourIndex) }}
                    aria-hidden
                  />
                  <span className="font-bold text-[var(--color-text)] truncate">{d.name}</span>
                </div>
                <div className="text-xs text-[var(--color-text-faint)] mt-1">
                  {d.type} · {d.interestRate}%/{t("yr", "năm")} ·{" "}
                  {t(
                    `${d.paidPeriods} of ${d.totalPeriods} periods paid`,
                    `đã trả ${d.paidPeriods}/${d.totalPeriods} kỳ`
                  )}
                </div>
              </div>
              <div className="text-right flex-none">
                <div className="font-bold tabular-nums text-[var(--color-warning)]">
                  {formatVND(d.remaining)}
                </div>
                <div className="text-xs text-[var(--color-text-faint)]">
                  / {money(d.principal)}
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-success)]"
                style={{ width: `${Math.max(1, d.paidPct)}%` }}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <div className="text-[var(--color-text-muted)]">
                  {t("Interest still to pay", "Lãi còn phải trả")}
                </div>
                <div className="font-bold tabular-nums text-[var(--color-error)] mt-0.5">
                  {money(d.interestLeft)}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)]">
                  {t("Debt-free on", "Hết nợ vào")}
                </div>
                <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5">
                  {d.payoffDate ? viMonthOf(d.payoffDate) : "—"}
                </div>
              </div>
              {d.nextDue && (
                <div className="col-span-2 pt-2 border-t border-[var(--color-border)]">
                  <div className="text-[var(--color-text-muted)]">
                    {t("Next payment", "Kỳ tới")} · {t("period", "kỳ")} {d.nextDue.period} ·{" "}
                    {d.nextDue.dueDate}
                  </div>
                  <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5">
                    {formatVND(d.nextDue.payment)}
                    {/* Tách gốc/lãi ngay ở đây: biết 6,7 triệu trong 12,5 triệu
                        là tiền lãi thì mới thấy vì sao dư nợ xuống chậm. */}
                    <span className="ml-2 font-normal text-[var(--color-text-faint)]">
                      {t("principal", "gốc")} {money(d.nextDue.principal)} ·{" "}
                      {t("interest", "lãi")} {money(d.nextDue.interest)}
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
