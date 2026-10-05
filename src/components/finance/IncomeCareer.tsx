"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Briefcase, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import StackedMonthTooltip from "./StackedMonthTooltip";
import { careerMonthAxis } from "./MonthAxisTick";

// Thu nhập nhìn theo cả sự nghiệp: từng nơi đã làm trả bao nhiêu, lương và
// thưởng chia thế nào, và giữa hai chặng hụt mất mấy tháng.
//
// Phần còn lại của tab Thu nhập chạy theo tháng báo cáo. Khối này KHÔNG: nó
// luôn đọc toàn bộ lịch sử, vì câu hỏi "chỗ nào trả khá hơn" không trả lời được
// bằng một cửa sổ 12 tháng.

interface SubSlice { sub: string; amount: number; share: number }

interface Employer {
  name: string;
  /** Bậc màu, gán theo tổng tiền chứ không theo vị trí trong danh sách. */
  colourIndex: number;
  from: string;
  to: string;
  tenure: number;
  paid: number;
  total: number;
  subs: SubSlice[];
  salaryTotal: number;
  bonusTotal: number;
  avgPerMonth: number;
  avgSalaryPerMonth: number;
  firstSalary: number;
  lastSalary: number;
  salaryGrowthPct: number | null;
  best: { month: string; amount: number } | null;
  byYear: { year: number; amount: number }[];
  active: boolean;
}

interface Gap { from: string; to: string; months: number }

interface CareerData {
  hasData: boolean;
  firstMonth: string;
  lastMonth: string;
  nowMonth: string;
  months: string[];
  employers: Employer[];
  employerKeys: string[];
  employerSeries: { key: string; colourIndex: number }[];
  /** Mỗi nơi hai chuỗi: lương và thưởng. Khoá đánh theo số thứ tự, không ghép tên. */
  timelineSeries: {
    key: string;
    employer: string;
    kind: "salary" | "bonus";
    colourIndex: number;
  }[];
  subKeys: string[];
  years: number[];
  yearByEmployer: Record<string, string | number>[];
  yearBySub: Record<string, string | number>[];
  timeline: Record<string, string | number | null>[];
  gaps: Gap[];
  otherKey: string;
  totals: {
    allTime: number;
    monthsPaid: number;
    careerMonths: number;
    gapMonths: number;
    avgPerPaidMonth: number;
    avgPerCareerMonth: number;
    employerCount: number;
  };
}

const OTHER_KEY = "__other";

/** "2024-03" → "03/2024". Ngày tháng kiểu Việt đọc nhanh hơn ở nhãn ngắn. */
function viMonth(key: string) {
  return `${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

function monthIndex(key: string, first: string) {
  const y = Number(key.slice(0, 4)) - Number(first.slice(0, 4));
  return y * 12 + (Number(key.slice(5, 7)) - Number(first.slice(5, 7)));
}

export default function IncomeCareer({ refreshKey }: { refreshKey: number }) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<CareerData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/finance/income/employers", { signal: controller.signal });
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
        {t("Could not load career data.", "Không tải được dữ liệu sự nghiệp.")}
      </p>
    );
  }
  if (!data) {
    return (
      <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
    );
  }
  if (!data.hasData || data.employers.length === 0) return null;

  const {
    employers, employerSeries, subKeys, yearByEmployer, yearBySub,
    timeline, timelineSeries, gaps, totals, months, firstMonth, years,
  } = data;

  const span = months.length;
  const maxAvgSalary = Math.max(...employers.map((e) => e.avgSalaryPerMonth), 1);
  const colourOf = (i: number) =>
    i < 4 ? `var(--chart-${i + 1})` : "var(--color-border-strong)";
  // Bậc nhạt cùng họ, cho khúc thưởng. Phải khớp đúng công thức trong
  // globals.css (.c-series-N-soft) vì chỗ này chỉ tô ô chú giải, còn khúc cột
  // thật do CSS tô — hai công thức lệch nhau là chú giải nói dối.
  const softOf = (i: number) =>
    i < 4
      ? `color-mix(in srgb, var(--chart-${i + 1}) 42%, var(--color-surface))`
      : "var(--color-border-strong)";
  const labelOf = (key: string, fallback: string) =>
    key === OTHER_KEY ? fallback : key;
  // Lương/thưởng phải giữ NGUYÊN màu ở mọi chỗ: nếu tô theo thứ tự trong từng
  // thẻ thì nơi nào thưởng nhiều hơn lương sẽ đảo màu, và người đọc đang so hai
  // thẻ cạnh nhau lại thấy cùng một màu mang hai nghĩa.
  const subColour = (sub: string) => {
    const i = subKeys.indexOf(sub);
    return colourOf(i >= 0 ? i : subKeys.length);
  };

  // Nhãn năm chạy dọc dải thời gian. Chỉ lấy năm có mốc tháng 1 trong khoảng,
  // cộng năm đầu tiên.
  const yearTicks = months
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => i === 0 || m.endsWith("-01"));

  return (
    <div className="space-y-6">
      {/* --- Bốn con số của cả chặng đường --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t("Earned all time", "Tổng thu từ trước tới nay"),
            value: formatVND(totals.allTime),
            note: t(
              `${totals.employerCount} places · ${totals.careerMonths} months`,
              `${totals.employerCount} nơi · ${totals.careerMonths} tháng`
            ),
            strong: true,
          },
          {
            label: t("Avg per paid month", "BQ tháng CÓ lương"),
            value: formatVND(totals.avgPerPaidMonth),
            note: t(`${totals.monthsPaid} months paid`, `${totals.monthsPaid} tháng có tiền về`),
          },
          {
            label: t("Avg across the whole run", "BQ cả chặng đường"),
            value: formatVND(totals.avgPerCareerMonth),
            note: t("gaps included", "tính cả tháng trống"),
          },
          {
            label: t("Months with nothing", "Tháng không có đồng nào"),
            value: String(totals.gapMonths),
            note:
              totals.careerMonths > 0
                ? t(
                    `${Math.round((totals.gapMonths / totals.careerMonths) * 100)}% of the run`,
                    `${Math.round((totals.gapMonths / totals.careerMonths) * 100)}% quãng đường`
                  )
                : "",
            warn: totals.gapMonths > 0,
          },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)]"
          >
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {c.label}
            </div>
            <div
              className={`text-xl font-bold tabular-nums mt-2 ${
                c.warn
                  ? "text-[var(--color-warning)]"
                  : c.strong
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-text)]"
              }`}
            >
              {c.value}
            </div>
            <div className="text-xs text-[var(--color-text-faint)] mt-1">{c.note}</div>
          </div>
        ))}
      </div>

      {/* --- Dải thời gian: nằm ở đâu, bao lâu, và hở chỗ nào --- */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
        <h4 className="c-h5 text-[var(--color-text)]">
          {t("Where the money came from, and when", "Đã làm ở đâu, trong bao lâu")}
        </h4>
        <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
          {t(
            "each band is one employer, drawn over the months it actually paid",
            "mỗi dải là một nơi, vẽ đúng quãng tháng có tiền về"
          )}
        </p>

        <div className="relative flex justify-between text-[10px] tabular-nums text-[var(--color-text-faint)] mb-2">
          {yearTicks.map(({ m, i }) => (
            <span key={m} style={{ position: "absolute", left: `${(i / span) * 100}%` }}>
              {m.slice(0, 4)}
            </span>
          ))}
          <span className="invisible">0000</span>
        </div>

        <div className="space-y-2.5">
          {employers.map((e) => {
            const left = (monthIndex(e.from, firstMonth) / span) * 100;
            const width = (e.tenure / span) * 100;
            return (
              <div key={e.name}>
                {/* Ở 375px tên công ty và dòng mô tả không đứng cùng hàng được:
                    "80,5tr · 06/2026 – 09/2026 · 4 tháng" ăn gần hết bề ngang và
                    "SHINHAN FINANCE" bị cắt còn "S...". Xuống dòng từ dưới 640px. */}
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3 mb-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-none"
                      style={{ background: colourOf(e.colourIndex) }}
                      aria-hidden
                    />
                    <span className="text-xs font-bold text-[var(--color-text)] truncate">
                      {e.name}
                    </span>
                    {e.active && (
                      <span className="text-[10px] font-bold text-[var(--color-accent)] flex-none">
                        {t("current", "đang nhận")}
                      </span>
                    )}
                  </span>
                  <span className="sm:flex-none text-[11px] tabular-nums text-[var(--color-text-faint)]">
                    <b className="text-[var(--color-text)]">
                      {compactMoney(e.total, language === "vi")}
                    </b>{" "}
                    · {viMonth(e.from)} – {viMonth(e.to)} · {e.tenure} {t("mo", "tháng")}
                  </span>
                </div>
                {/* Số tiền nằm NGOÀI dải. Viết vào trong thì bốn bậc màu
                    --chart-* có bậc sáng bậc tối, chữ đọc được trên bậc này lại
                    mất hút trên bậc kia; dải hai tháng thì không đủ chỗ cho chữ
                    và co thành một chấm tròn. */}
                <div className="relative h-5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 1.2)}%`,
                      background: colourOf(e.colourIndex),
                    }}
                    title={`${e.name}: ${formatVND(e.total)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {gaps.length > 0 && (
          <p className="mt-5 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
            <span className="text-[var(--color-text)]">
              {t(
                `${gaps.length} stretches with no income at all: `,
                `${gaps.length} quãng không có đồng nào: `
              )}
              <b className="tabular-nums">
                {gaps
                  .map((g) =>
                    g.months === 1
                      ? viMonth(g.from)
                      : `${viMonth(g.from)}–${viMonth(g.to)} (${g.months} ${t("mo", "tháng")})`
                  )
                  .join(", ")}
              </b>
            </span>
          </p>
        )}
      </div>

      {/* --- Từng tháng suốt sự nghiệp --- */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
        <h4 className="c-h5 text-[var(--color-text)]">
          {t("Every month since the first payslip", "Từng tháng kể từ khoản lương đầu tiên")}
        </h4>
        <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
          {t(
            "columns: who paid — solid shade is salary, pale is bonus · dashed line: average per month over the last 12, gaps included",
            "cột: nơi trả tiền — bậc đậm là lương, bậc nhạt là thưởng · đường nét đứt: trung bình mỗi tháng của 12 tháng gần nhất, tính cả tháng trống"
          )}
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeline} className="c-chart-multi">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" {...careerMonthAxis(months)} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                tickFormatter={(v) => compactMoney(Number(v), language === "vi")}
                width={50}
              />
              <Tooltip
                content={
                  <StackedMonthTooltip
                    otherKey={OTHER_KEY}
                    otherLabel={t("Other payers", "Nơi khác")}
                    skipKeys={["total", "trailing12"]}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              {/* Chỉ khúc lương vào chú giải; khúc thưởng dùng chung tên công
                  ty nên thêm vào là chú giải dài gấp đôi mà không nói thêm gì —
                  phần đậm/nhạt đã giải thích ở dòng mô tả trên. */}
              {timelineSeries.map((sr) => (
                <Bar
                  key={sr.key}
                  dataKey={sr.key}
                  stackId="emp"
                  name={
                    sr.key === OTHER_KEY
                      ? t("Other payers", "Nơi khác")
                      : `${sr.employer} · ${
                          sr.kind === "salary" ? t("Salary", "Lương") : t("Bonus", "Thưởng")
                        }`
                  }
                  legendType={sr.kind === "bonus" ? "none" : "rect"}
                  className={
                    sr.key === OTHER_KEY
                      ? "c-series-other"
                      : sr.kind === "bonus"
                        ? `c-series-${sr.colourIndex + 1}-soft`
                        : `c-series-${sr.colourIndex + 1}`
                  }
                  fill={sr.kind === "bonus" ? softOf(sr.colourIndex) : colourOf(sr.colourIndex)}
                  maxBarSize={18}
                />
              ))}
              <Line
                type="monotone"
                dataKey="trailing12"
                name={t("12-month average", "Trung bình 12 tháng")}
                stroke="var(--color-text)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- Hai biểu đồ theo năm --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">
            {t("Each year, split by employer", "Mỗi năm, tách theo nơi làm")}
          </h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t(
              "a year split in two means you changed jobs mid-year",
              "năm nào có hai màu là năm đó chuyển việc"
            )}
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearByEmployer} className="c-chart-multi">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                  tickFormatter={(v) => compactMoney(Number(v), language === "vi")}
                  width={50}
                />
                <Tooltip
                  content={
                    <StackedMonthTooltip
                      otherKey={OTHER_KEY}
                      otherLabel={t("Other payers", "Nơi khác")}
                    />
                  }
                />
                {employerSeries.map((sr) => (
                  <Bar
                    key={sr.key}
                    dataKey={sr.key}
                    stackId="emp"
                    name={labelOf(sr.key, t("Other payers", "Nơi khác"))}
                    className={
                      sr.key === OTHER_KEY ? "c-series-other" : `c-series-${sr.colourIndex + 1}`
                    }
                    fill={colourOf(sr.colourIndex)}
                    maxBarSize={48}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">
            {t("Salary vs bonus, year by year", "Lương và thưởng, theo từng năm")}
          </h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t(
              "bonus is the part that does not repeat next year",
              "thưởng là phần không chắc năm sau còn"
            )}
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearBySub} className="c-chart-multi">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                  tickFormatter={(v) => compactMoney(Number(v), language === "vi")}
                  width={50}
                />
                <Tooltip
                  content={
                    <StackedMonthTooltip
                      otherKey={OTHER_KEY}
                      otherLabel={t("Other income", "Thu khác")}
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                {subKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="sub"
                    name={labelOf(key, t("Other income", "Thu khác"))}
                    className={key === OTHER_KEY ? "c-series-other" : `c-series-${i + 1}`}
                    fill={colourOf(i)}
                    maxBarSize={48}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- Mọi nguồn, mọi năm, trong một bảng --- */}
      {/*
        Khối "So sánh từng nguồn thu" ở dưới chỉ đặt năm đang chọn cạnh năm
        liền trước, nên nguồn đã dừng từ hai năm trước biến mất khỏi màn hình.
        Bảng này giữ đủ: mỗi dòng một nơi, mỗi cột một năm, ô trống nghĩa là
        năm đó không có đồng nào từ nơi đó — và chính những ô trống mới vẽ ra
        hình dáng của cả chặng đường.
      */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
        <h4 className="c-h5 text-[var(--color-text)]">
          {t("Every source, every year", "Mọi nguồn thu qua từng năm")}
        </h4>
        <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-5">
          {t(
            "an empty cell means nothing came from there that year",
            "ô trống nghĩa là năm đó không có đồng nào từ nơi đó"
          )}
        </p>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="text-left py-2 pr-3 font-bold sticky left-0 bg-[var(--color-surface)]">
                  {t("Source", "Nguồn")}
                </th>
                {years.map((y) => (
                  <th key={y} className="text-right py-2 px-2 tabular-nums font-bold whitespace-nowrap">
                    {y}
                  </th>
                ))}
                <th className="text-right py-2 pl-3 font-bold whitespace-nowrap">
                  {t("Total", "Tổng")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {employers.map((e) => {
                const byYear = new Map(e.byYear.map((y) => [y.year, y.amount]));
                return (
                  <tr key={e.name}>
                    <td className="py-2.5 pr-3 sticky left-0 bg-[var(--color-surface)]">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-none"
                          style={{ background: colourOf(e.colourIndex) }}
                          aria-hidden
                        />
                        <span className="font-bold text-[var(--color-text)] truncate">{e.name}</span>
                      </span>
                    </td>
                    {years.map((y) => {
                      const amount = byYear.get(y) || 0;
                      const prev = byYear.get(y - 1) || 0;
                      return (
                        <td
                          key={y}
                          className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap"
                        >
                          {amount === 0 ? (
                            <span className="text-[var(--color-border-strong)]">—</span>
                          ) : (
                            <>
                              <span className="text-[var(--color-text)]">
                                {compactMoney(amount, language === "vi")}
                              </span>
                              {/* Mũi tên chỉ có nghĩa khi năm trước CŨNG có số;
                                  năm đầu tiên nhận lương ở một nơi không phải
                                  là "tăng vô hạn". */}
                              {prev > 0 && (
                                <span
                                  className={`ml-1 text-[10px] font-bold ${
                                    amount > prev
                                      ? "text-[var(--color-success)]"
                                      : amount < prev
                                        ? "text-[var(--color-error)]"
                                        : "text-[var(--color-text-faint)]"
                                  }`}
                                >
                                  {amount > prev ? "↑" : amount < prev ? "↓" : "→"}
                                  {Math.abs(Math.round(((amount - prev) / prev) * 100))}%
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 text-right tabular-nums font-bold text-[var(--color-text)] whitespace-nowrap">
                      {compactMoney(e.total, language === "vi")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--color-border-strong)]">
                <td className="py-2.5 pr-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-surface)]">
                  {t("All sources", "Tất cả")}
                </td>
                {years.map((y) => {
                  const row = yearByEmployer.find((r) => r.name === String(y));
                  const total = Number(row?.total) || 0;
                  const prevRow = yearByEmployer.find((r) => r.name === String(y - 1));
                  const prev = Number(prevRow?.total) || 0;
                  return (
                    <td key={y} className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">
                      <span className="font-bold text-[var(--color-text)]">
                        {compactMoney(total, language === "vi")}
                      </span>
                      {prev > 0 && (
                        <span
                          className={`ml-1 text-[10px] font-bold ${
                            total > prev
                              ? "text-[var(--color-success)]"
                              : "text-[var(--color-error)]"
                          }`}
                        >
                          {total > prev ? "↑" : "↓"}
                          {Math.abs(Math.round(((total - prev) / prev) * 100))}%
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2.5 pl-3 text-right tabular-nums font-bold text-[var(--color-success)] whitespace-nowrap">
                  {compactMoney(totals.allTime, language === "vi")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* --- So sánh từng nơi --- */}
      <div>
        <h4 className="c-h5 text-[var(--color-text)] mb-1">
          {t("Place by place", "So sánh từng nơi")}
        </h4>
        <p className="text-xs text-[var(--color-text-faint)] mb-4">
          {t(
            "the bar compares average monthly salary — the only number comparable across jobs of different lengths",
            "thanh ngang so lương bình quân/tháng — con số duy nhất so được giữa những chặng dài ngắn khác nhau"
          )}
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {employers.map((e) => (
            <div
              key={e.name}
              className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm flex-none"
                      style={{ background: colourOf(e.colourIndex) }}
                      aria-hidden
                    />
                    <span className="font-bold text-[var(--color-text)] truncate">{e.name}</span>
                    {e.active && (
                      <span className="text-[10px] font-bold text-[var(--color-accent)] flex-none">
                        {t("current", "đang nhận")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-faint)] mt-1 tabular-nums">
                    {viMonth(e.from)} – {viMonth(e.to)} · {e.tenure} {t("months", "tháng")}
                    {e.paid !== e.tenure &&
                      ` · ${t(`${e.paid} paid`, `${e.paid} tháng có tiền`)}`}
                  </div>
                </div>
                <div className="text-right flex-none">
                  <div className="font-bold tabular-nums text-[var(--color-text)]">
                    {formatVND(e.total)}
                  </div>
                  <div className="text-xs text-[var(--color-text-faint)]">
                    {t("total", "tổng")}
                  </div>
                </div>
              </div>

              {/* Lương bình quân/tháng, so trực tiếp giữa các nơi */}
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">
                    {t("Avg salary / month", "Lương BQ/tháng")}
                  </span>
                  <span className="font-bold tabular-nums text-[var(--color-text)]">
                    {formatVND(e.avgSalaryPerMonth)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (e.avgSalaryPerMonth / maxAvgSalary) * 100)}%`,
                      background: colourOf(e.colourIndex),
                    }}
                  />
                </div>
              </div>

              {/* Lương / thưởng / khác */}
              <div className="mt-4">
                <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--color-surface-2)]">
                  {e.subs.map((s) => (
                    <div
                      key={s.sub}
                      style={{ width: `${s.share}%`, background: subColour(s.sub) }}
                      title={`${s.sub}: ${formatVND(s.amount)}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                  {e.subs.map((s) => (
                    <span key={s.sub} className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-sm"
                        style={{ background: subColour(s.sub) }}
                        aria-hidden
                      />
                      <span className="text-[var(--color-text-muted)]">{s.sub}</span>
                      <span className="font-bold tabular-nums text-[var(--color-text)]">
                        {s.share}%
                      </span>
                      <span className="tabular-nums text-[var(--color-text-faint)]">
                        {compactMoney(s.amount, language === "vi")}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[var(--color-text-muted)]">
                    {t("First → last salary", "Lương đầu → lương cuối")}
                  </div>
                  <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5">
                    {e.firstSalary > 0 ? compactMoney(e.firstSalary, language === "vi") : "—"}
                    {" → "}
                    {e.lastSalary > 0 ? compactMoney(e.lastSalary, language === "vi") : "—"}
                    {e.salaryGrowthPct !== null && (
                      <span
                        className={`ml-2 font-bold ${
                          e.salaryGrowthPct > 0
                            ? "text-[var(--color-success)]"
                            : e.salaryGrowthPct < 0
                              ? "text-[var(--color-error)]"
                              : "text-[var(--color-text-faint)]"
                        }`}
                      >
                        {e.salaryGrowthPct > 0 ? "+" : ""}
                        {e.salaryGrowthPct}%
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--color-text-muted)]">
                    {t("Best month", "Tháng cao nhất")}
                  </div>
                  <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5">
                    {e.best ? `${compactMoney(e.best.amount, language === "vi")}` : "—"}
                    {e.best && (
                      <span className="ml-2 font-normal text-[var(--color-text-faint)]">
                        {viMonth(e.best.month)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {e.byYear.length > 1 && (
                <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                  {e.byYear.map((y) => (
                    <span key={y.year} className="text-[var(--color-text-muted)]">
                      {y.year}{" "}
                      <b className="text-[var(--color-text)]">
                        {compactMoney(y.amount, language === "vi")}
                      </b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-faint)] flex items-start gap-2">
        <Briefcase size={14} className="shrink-0 mt-0.5" />
        {t(
          "Employer comes from the payer on each income record; salary and bonus from its sub-category.",
          "Nơi làm lấy từ bên trả tiền trên mỗi khoản thu; lương/thưởng lấy từ danh mục con."
        )}
      </p>
    </div>
  );
}
