"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Briefcase, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { VIZ, GRID, yAxis, xAxis, BAR, LINE, STACK_GAP, TOOLTIP, catColor, soft, pctChange } from "@/lib/viz";
import ChartCard, { Delta, StatTile, type SeriesKeyItem } from "@/components/charts/ChartCard";
import StackedMonthTooltip from "./StackedMonthTooltip";
import { careerMonthAxis } from "./MonthAxisTick";

// Thu nhập nhìn theo cả sự nghiệp: từng nơi đã làm trả bao nhiêu, lương và
// thưởng chia thế nào, và giữa hai chặng hụt mất mấy tháng.
//
// Phần còn lại của tab Thu nhập chạy theo tháng báo cáo. Khối này KHÔNG: nó
// luôn đọc toàn bộ lịch sử, vì câu hỏi "chỗ nào trả khá hơn" không trả lời được
// bằng một cửa sổ 12 tháng.
//
// Biểu đồ theo docs/bieu-do.md. Ở đây các chuỗi CHÍNH LÀ đối tượng so sánh
// (nơi trả lương), nên mỗi nơi một màu `catColor(colourIndex)` — màu đi theo
// công ty (API gán theo tổng tiền, cố định), không theo thứ tự hiển thị; quá 4
// nơi thì phần đuôi là `VIZ.other`. Thưởng là bậc nhạt `soft()` của cùng màu.

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

/** Cùng quy tắc với API (`api/finance/income/employers`): "Lương" là khoản đều đặn. */
const isSalary = (sub: string) => {
  const s = sub.trim().toLowerCase();
  return s === "salary" || s === "lương";
};

/** Nhãn ở đầu mút đường trung bình, thay cho chú giải. */
function endLabel(index: number, text: (v: number) => string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (props: any) => {
    if (props.index !== index || props.value === undefined || props.value === null) return null;
    return (
      <text
        x={Number(props.x)}
        y={Number(props.y) - 10}
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

export default function IncomeCareer({ refreshKey }: { refreshKey: number }) {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
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
  const otherPayers = t("Other payers", "Nơi khác");
  const labelOf = (key: string, fallback: string) =>
    key === OTHER_KEY ? fallback : key;
  const nameOfEmployerKey = (key: string) => labelOf(key, otherPayers);

  // Lương/thưởng phải giữ NGUYÊN màu ở mọi chỗ (biểu đồ theo năm và từng thẻ
  // công ty): tô theo thứ tự trong từng thẻ thì nơi nào thưởng nhiều hơn lương
  // sẽ đảo màu. Lương là nền → xám; khoản ngoài lương lớn nhất là thứ câu
  // chuyện nói tới ("phần không chắc năm sau còn") → màu nhấn; các khoản ngoài
  // lương khác → bậc nhạt của nhấn; phần đuôi đã gộp → "Khác".
  const firstExtra = subKeys.find((k) => k !== OTHER_KEY && !isSalary(k));
  const subColour = (sub: string) => {
    if (isSalary(sub)) return VIZ.muted;
    if (sub === firstExtra) return VIZ.accent;
    if (sub !== OTHER_KEY && subKeys.includes(sub)) return soft(VIZ.accent);
    return VIZ.other;
  };

  // Nhãn năm chạy dọc dải thời gian. Chỉ lấy năm có mốc tháng 1 trong khoảng,
  // cộng năm đầu tiên.
  const yearTicks = months
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => i === 0 || m.endsWith("-01"));

  // Chú giải nơi trả tiền — cùng một bộ cho mọi thẻ, thứ tự như danh sách (mới nhất trước).
  const employerKeyItems: SeriesKeyItem[] = employerSeries.map((sr) => ({
    label: nameOfEmployerKey(sr.key),
    color: catColor(sr.colourIndex),
    shape: "bar",
  }));

  // ==========================================================================
  // Câu kết luận cho từng thẻ.
  // ==========================================================================

  // Dải thời gian: chặng dài nhất.
  const longest = [...employers].sort((a, b) => b.tenure - a.tenure)[0];
  const bandsHeadline =
    employers.length === 1
      ? t(`${longest.name}: ${longest.tenure} months so far`, `${longest.name}: ${longest.tenure} tháng`)
      : t(
          `${employers.length} employers in ${totals.careerMonths} months — longest at ${longest.name} (${longest.tenure} mo)`,
          `${employers.length} nơi trong ${totals.careerMonths} tháng — gắn bó lâu nhất ở ${longest.name} (${longest.tenure} tháng)`
        );

  // Từng tháng: bình quân 12 tháng gần nhất so với 12 tháng trước đó.
  const lastIdx = timeline.length - 1;
  const trailNow = Number(timeline[lastIdx]?.trailing12) || 0;
  const trailBefore = lastIdx >= 12 ? Number(timeline[lastIdx - 12]?.trailing12) || 0 : 0;
  const trailPct = pctChange(trailNow, trailBefore);
  const timelineHeadline =
    trailPct === null
      ? t(`Last 12 months average ${money(trailNow)} a month`, `12 tháng gần nhất bình quân ${money(trailNow)}/tháng`)
      : Math.abs(trailPct) < 3
        ? t(
            `Last 12 months average ${money(trailNow)} a month, level with the year before`,
            `12 tháng gần nhất bình quân ${money(trailNow)}/tháng, ngang 12 tháng trước đó`
          )
        : trailPct > 0
          ? t(
              `Last 12 months average ${money(trailNow)} a month — ${trailPct}% more than the year before`,
              `12 tháng gần nhất bình quân ${money(trailNow)}/tháng — hơn 12 tháng trước đó ${trailPct}%`
            )
          : t(
              `Last 12 months average ${money(trailNow)} a month — ${Math.abs(trailPct)}% less than the year before`,
              `12 tháng gần nhất bình quân ${money(trailNow)}/tháng — kém 12 tháng trước đó ${Math.abs(trailPct)}%`
            );
  // Khe nền giữa các khúc chỉ khi cột đủ rộng; 80 cột mảnh 3px mà thêm viền
  // 2px là cột biến mất.
  const timelineGap = months.length <= 36 ? STACK_GAP : {};
  const hasBonus = timelineSeries.some((sr) => sr.kind === "bonus" && timeline.some((r) => Number(r[sr.key]) > 0));

  // Theo năm, tách theo nơi: năm thu nhiều nhất, và ai trả phần lớn năm đó.
  const bestYearRow = [...yearByEmployer].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))[0];
  const bestYearTotal = Number(bestYearRow?.total) || 0;
  const bestYearPayer = bestYearRow
    ? employerSeries
        .filter((sr) => sr.key !== OTHER_KEY)
        .map((sr) => ({ key: sr.key, v: Number(bestYearRow[sr.key]) || 0 }))
        .sort((a, b) => b.v - a.v)[0]
    : undefined;
  const yearHeadline = !bestYearRow
    ? t("Each year, split by employer", "Mỗi năm, tách theo nơi làm")
    : bestYearPayer && bestYearTotal > 0 && bestYearPayer.v / bestYearTotal >= 0.5 && years.length > 1
      ? t(
          `${bestYearRow.name} was the best year — ${money(bestYearTotal)}, mostly from ${bestYearPayer.key}`,
          `${bestYearRow.name} là năm thu nhiều nhất — ${money(bestYearTotal)}, phần lớn từ ${bestYearPayer.key}`
        )
      : t(
          `${bestYearRow.name} was the best year — ${money(bestYearTotal)}`,
          `${bestYearRow.name} là năm thu nhiều nhất — ${money(bestYearTotal)}`
        );

  // Lương và thưởng: năm gần nhất có bao nhiêu phần nằm ngoài lương.
  const salaryKey = subKeys.find(isSalary);
  const latestSubRow = yearBySub[yearBySub.length - 1];
  const latestTotal = Number(latestSubRow?.total) || 0;
  const latestExtraShare =
    salaryKey && latestTotal > 0
      ? Math.round(((latestTotal - (Number(latestSubRow?.[salaryKey]) || 0)) / latestTotal) * 100)
      : null;
  const subHeadline =
    latestExtraShare === null || !latestSubRow
      ? t("Salary vs bonus, year by year", "Lương và thưởng, theo từng năm")
      : latestExtraShare === 0
        ? t(`${latestSubRow.name} income is all salary so far`, `Năm ${latestSubRow.name} toàn bộ thu nhập là lương`)
        : t(
            `${latestExtraShare}% of ${latestSubRow.name} income came on top of salary`,
            `Năm ${latestSubRow.name}, ${latestExtraShare}% thu nhập nằm ngoài lương`
          );
  // Lương nằm sát đáy: phần ổn định là gốc để so các năm với nhau.
  const subOrder = salaryKey ? [salaryKey, ...subKeys.filter((k) => k !== salaryKey)] : subKeys;

  // Bảng: nơi mang về nhiều tiền nhất tính cả chặng.
  const topTotal = [...employers].sort((a, b) => b.total - a.total)[0];
  const tableHeadline =
    topTotal && totals.allTime > 0
      ? t(
          `${topTotal.name} paid the most overall — ${money(topTotal.total)}, ${Math.round((topTotal.total / totals.allTime) * 100)}% of everything`,
          `${topTotal.name} trả nhiều nhất tính cả chặng — ${money(topTotal.total)}, ${Math.round((topTotal.total / totals.allTime) * 100)}% tổng thu`
        )
      : t("Every source, every year", "Mọi nguồn thu qua từng năm");

  // Từng nơi: lương bình quân/tháng cao nhất.
  const topSalary = [...employers]
    .filter((e) => e.avgSalaryPerMonth > 0)
    .sort((a, b) => b.avgSalaryPerMonth - a.avgSalaryPerMonth)[0];
  const placesHeadline =
    topSalary && employers.length > 1
      ? t(
          `${topSalary.name} pays the highest average salary — ${money(topSalary.avgSalaryPerMonth)} a month`,
          `${topSalary.name} trả lương trung bình cao nhất — ${money(topSalary.avgSalaryPerMonth)}/tháng`
        )
      : t("Place by place", "So sánh từng nơi");

  return (
    <div className="flex flex-col gap-6">
      {/* --- Bốn con số của cả chặng đường --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          emphasis
          label={t("Earned all time", "Tổng thu từ trước tới nay")}
          value={formatVND(totals.allTime)}
          note={t(
            `${totals.employerCount} places · ${totals.careerMonths} months`,
            `${totals.employerCount} nơi · ${totals.careerMonths} tháng`
          )}
        />
        <StatTile
          label={t("Avg per paid month", "BQ tháng CÓ lương")}
          value={formatVND(totals.avgPerPaidMonth)}
          note={t(`${totals.monthsPaid} months paid`, `${totals.monthsPaid} tháng có tiền về`)}
        />
        <StatTile
          label={t("Avg across the whole run", "BQ cả chặng đường")}
          value={formatVND(totals.avgPerCareerMonth)}
          note={t("gaps included", "tính cả tháng trống")}
        />
        <StatTile
          label={t("Months with nothing", "Tháng không có đồng nào")}
          value={String(totals.gapMonths)}
          note={
            totals.careerMonths > 0
              ? t(
                  `${Math.round((totals.gapMonths / totals.careerMonths) * 100)}% of the run`,
                  `${Math.round((totals.gapMonths / totals.careerMonths) * 100)}% quãng đường`
                )
              : undefined
          }
        />
      </div>

      {/* --- Dải thời gian: nằm ở đâu, bao lâu, và hở chỗ nào --- */}
      <ChartCard
        title={bandsHeadline}
        subtitle={t(
          "Each band is one employer, drawn over the months it actually paid",
          "Mỗi dải là một nơi, vẽ đúng quãng tháng có tiền về"
        )}
      >
        <div>
          <div className="relative flex justify-between text-[10px] tabular-nums text-[var(--color-text-faint)] mb-2">
            {yearTicks.map(({ m, i }) => (
              <span key={m} style={{ position: "absolute", left: `${(i / span) * 100}%` }}>
                {m.slice(0, 4)}
              </span>
            ))}
            <span className="invisible">0000</span>
          </div>

          <div className="flex flex-col gap-3">
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
                        className="w-2.5 h-2.5 rounded-[3px] flex-none"
                        style={{ background: catColor(e.colourIndex) }}
                        aria-hidden
                      />
                      <span className="text-xs font-bold text-[var(--color-text)] truncate">
                        {e.name}
                      </span>
                      {e.active && (
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] flex-none">
                          · {t("current", "đang nhận")}
                        </span>
                      )}
                    </span>
                    <span className="sm:flex-none text-[11px] tabular-nums text-[var(--color-text-faint)]">
                      <b className="text-[var(--color-text)]">{money(e.total)}</b>{" "}
                      · {viMonth(e.from)} – {viMonth(e.to)} · {e.tenure} {t("mo", "tháng")}
                    </span>
                  </div>
                  {/* Số tiền nằm NGOÀI dải: dải hai tháng không đủ chỗ cho chữ,
                      và chữ trên bốn màu khác nhau không đọc đều được. */}
                  <div className="relative h-3 rounded-[4px] bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="absolute inset-y-0 rounded-[4px]"
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 1.2)}%`,
                        background: catColor(e.colourIndex),
                      }}
                      title={`${e.name}: ${formatVND(e.total)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {gaps.length > 0 && (
          <p className="text-sm flex items-start gap-2">
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
      </ChartCard>

      {/* --- Từng tháng suốt sự nghiệp --- */}
      <ChartCard
        title={timelineHeadline}
        subtitle={t(
          "Income per month since the first payslip, by who paid · dashed line = average of the last 12 months, gaps included",
          "Thu nhập mỗi tháng kể từ khoản lương đầu tiên, theo nơi trả · nét đứt = bình quân 12 tháng gần nhất, tính cả tháng trống"
        )}
        keys={[
          ...employerKeyItems,
          ...(hasBonus
            ? [{ label: t("pale = bonus", "bậc nhạt = thưởng"), color: soft(VIZ.muted), shape: "bar" as const }]
            : []),
          { label: t("12-month average", "Bình quân 12 tháng"), color: VIZ.ink, shape: "dash" as const },
        ]}
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeline} margin={{ top: 22, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...careerMonthAxis(months)} />
              <YAxis {...yAxis(money)} />
              <Tooltip
                {...TOOLTIP}
                content={
                  <StackedMonthTooltip
                    otherKey={OTHER_KEY}
                    otherLabel={otherPayers}
                    skipKeys={["total", "trailing12"]}
                  />
                }
              />
              {timelineSeries.map((sr) => (
                <Bar
                  key={sr.key}
                  dataKey={sr.key}
                  stackId="emp"
                  name={
                    sr.key === OTHER_KEY
                      ? otherPayers
                      : `${sr.employer} · ${
                          sr.kind === "salary" ? t("Salary", "Lương") : t("Bonus", "Thưởng")
                        }`
                  }
                  fill={
                    sr.key === OTHER_KEY
                      ? VIZ.other
                      : sr.kind === "bonus"
                        ? soft(catColor(sr.colourIndex))
                        : catColor(sr.colourIndex)
                  }
                  {...timelineGap}
                  maxBarSize={BAR.maxBarSize}
                />
              ))}
              <Line
                {...LINE}
                dataKey="trailing12"
                name={t("12-month average", "Bình quân 12 tháng")}
                stroke={VIZ.ink}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                connectNulls={false}
                isAnimationActive={false}
                label={endLabel(lastIdx, (v) => `${t("avg", "BQ")} ${money(v)}`)}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* --- Hai biểu đồ theo năm --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title={yearHeadline}
          subtitle={t(
            "Income per year by employer · a year in two colours is a year you changed jobs",
            "Thu nhập mỗi năm theo nơi làm · năm nào có hai màu là năm đó chuyển việc"
          )}
          keys={employerKeyItems}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearByEmployer} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...xAxis} interval={0} />
                <YAxis {...yAxis(money)} />
                <Tooltip
                  {...TOOLTIP}
                  content={
                    <StackedMonthTooltip
                      otherKey={OTHER_KEY}
                      otherLabel={otherPayers}
                    />
                  }
                />
                {employerSeries.map((sr, i) => (
                  <Bar
                    key={sr.key}
                    dataKey={sr.key}
                    stackId="emp"
                    name={nameOfEmployerKey(sr.key)}
                    fill={catColor(sr.colourIndex)}
                    {...STACK_GAP}
                    maxBarSize={BAR.maxBarSize}
                    radius={i === employerSeries.length - 1 ? BAR.radius : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={subHeadline}
          subtitle={t(
            "Income per year, salary against everything on top · the part on top may not repeat next year",
            "Thu nhập mỗi năm, lương so với phần ngoài lương · phần ngoài lương không chắc năm sau còn"
          )}
          keys={subOrder.map((key) => ({
            label: labelOf(key, t("Other income", "Thu khác")),
            color: subColour(key),
            shape: "bar" as const,
          }))}
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearBySub} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...xAxis} interval={0} />
                <YAxis {...yAxis(money)} />
                <Tooltip
                  {...TOOLTIP}
                  content={
                    <StackedMonthTooltip
                      otherKey={OTHER_KEY}
                      otherLabel={t("Other income", "Thu khác")}
                    />
                  }
                />
                {subOrder.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="sub"
                    name={labelOf(key, t("Other income", "Thu khác"))}
                    fill={subColour(key)}
                    {...STACK_GAP}
                    maxBarSize={BAR.maxBarSize}
                    radius={i === subOrder.length - 1 ? BAR.radius : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* --- Mọi nguồn, mọi năm, trong một bảng --- */}
      {/*
        Khối "So sánh từng nguồn thu" ở dưới chỉ đặt năm đang chọn cạnh năm
        liền trước, nên nguồn đã dừng từ hai năm trước biến mất khỏi màn hình.
        Bảng này giữ đủ: mỗi dòng một nơi, mỗi cột một năm, ô trống nghĩa là
        năm đó không có đồng nào từ nơi đó — và chính những ô trống mới vẽ ra
        hình dáng của cả chặng đường.
      */}
      <ChartCard
        title={tableHeadline}
        subtitle={t(
          "Every source, every year · an empty cell means nothing came from there that year",
          "Mọi nguồn thu qua từng năm · ô trống nghĩa là năm đó không có đồng nào từ nơi đó"
        )}
      >
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[11px] text-[var(--color-text-muted)]">
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
                    <td className="py-2.5 pr-3 sticky left-0 bg-[var(--color-surface)] max-w-[10rem]">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-[3px] flex-none"
                          style={{ background: catColor(e.colourIndex) }}
                          aria-hidden
                        />
                        <span
                          className={`truncate text-[var(--color-text)] ${e.name === topTotal?.name ? "font-bold" : ""}`}
                          title={e.name}
                        >
                          {e.name}
                        </span>
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
                              <span className="text-[var(--color-text)]">{money(amount)}</span>
                              {/* Mũi tên chỉ có nghĩa khi năm trước CŨNG có số;
                                  năm đầu tiên nhận lương ở một nơi không phải
                                  là "tăng vô hạn". */}
                              {prev > 0 && (
                                <span className="ml-1">
                                  <Delta pct={pctChange(amount, prev)} upIsGood />
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 text-right tabular-nums font-bold text-[var(--color-text)] whitespace-nowrap">
                      {money(e.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--color-border-strong)]">
                <td className="py-2.5 pr-3 text-[11px] font-bold text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-surface)]">
                  {t("All sources", "Tất cả")}
                </td>
                {years.map((y) => {
                  const row = yearByEmployer.find((r) => r.name === String(y));
                  const total = Number(row?.total) || 0;
                  const prevRow = yearByEmployer.find((r) => r.name === String(y - 1));
                  const prev = Number(prevRow?.total) || 0;
                  return (
                    <td key={y} className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">
                      <span className="font-bold text-[var(--color-text)]">{money(total)}</span>
                      {prev > 0 && (
                        <span className="ml-1">
                          <Delta pct={pctChange(total, prev)} upIsGood />
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="py-2.5 pl-3 text-right tabular-nums font-bold text-[var(--color-text)] whitespace-nowrap">
                  {money(totals.allTime)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>

      {/* --- So sánh từng nơi --- */}
      <div className="flex flex-col gap-4">
        <header>
          <h4 className="c-h5 text-[var(--color-text)] text-balance">{placesHeadline}</h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1">
            {t(
              "The bar compares average monthly salary — the only number comparable across jobs of different lengths",
              "Thanh ngang so lương bình quân/tháng — con số duy nhất so được giữa những chặng dài ngắn khác nhau"
            )}
          </p>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {employers.map((e) => {
            const isTop = e.name === topSalary?.name && employers.length > 1;
            return (
              <div
                key={e.name}
                className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] flex flex-col gap-4 min-w-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-[3px] flex-none"
                        style={{ background: catColor(e.colourIndex) }}
                        aria-hidden
                      />
                      <span className="font-bold text-[var(--color-text)] truncate" title={e.name}>{e.name}</span>
                      {e.active && (
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] flex-none">
                          · {t("current", "đang nhận")}
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

                {/* Lương bình quân/tháng, cùng một thước cho mọi thẻ. Thanh xám;
                    nơi trả cao nhất (câu tiêu đề) mang màu của chính nó. */}
                <div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">
                      {t("Avg salary / month", "Lương BQ/tháng")}
                    </span>
                    <span className="font-bold tabular-nums text-[var(--color-text)]">
                      {formatVND(e.avgSalaryPerMonth)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-r-[4px] bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-r-[4px]"
                      style={{
                        width: `${e.avgSalaryPerMonth > 0 ? Math.max(2, (e.avgSalaryPerMonth / maxAvgSalary) * 100) : 0}%`,
                        background: isTop ? catColor(e.colourIndex) : VIZ.muted,
                      }}
                    />
                  </div>
                </div>

                {/* Lương / thưởng / khác — một thanh chồng, khúc tách bằng khe nền. */}
                <div>
                  <div className="flex h-3 gap-0.5 overflow-hidden rounded-[4px]">
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
                          className="w-2 h-2 rounded-[2px]"
                          style={{ background: subColour(s.sub) }}
                          aria-hidden
                        />
                        <span className="text-[var(--color-text-muted)]">{s.sub}</span>
                        <span className="font-bold tabular-nums text-[var(--color-text)]">
                          {s.share}%
                        </span>
                        <span className="tabular-nums text-[var(--color-text-faint)]">
                          {money(s.amount)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[var(--color-text-muted)]">
                      {t("First → last salary", "Lương đầu → lương cuối")}
                    </div>
                    <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5 flex flex-wrap items-baseline gap-x-2">
                      <span>
                        {e.firstSalary > 0 ? money(e.firstSalary) : "—"}
                        {" → "}
                        {e.lastSalary > 0 ? money(e.lastSalary) : "—"}
                      </span>
                      {e.salaryGrowthPct !== null && <Delta pct={e.salaryGrowthPct} upIsGood />}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-muted)]">
                      {t("Best month", "Tháng cao nhất")}
                    </div>
                    <div className="font-bold tabular-nums text-[var(--color-text)] mt-0.5">
                      {e.best ? money(e.best.amount) : "—"}
                      {e.best && (
                        <span className="ml-2 font-normal text-[var(--color-text-faint)]">
                          {viMonth(e.best.month)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {e.byYear.length > 1 && (
                  <div className="pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                    {e.byYear.map((y) => (
                      <span key={y.year} className="text-[var(--color-text-muted)]">
                        {y.year}{" "}
                        <b className="text-[var(--color-text)]">{money(y.amount)}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
