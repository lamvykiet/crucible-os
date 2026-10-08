"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { BarShapeProps } from "recharts";
import { AlertCircle, CalendarDays } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { todayLocalIso } from "@/lib/localDate";
import { VIZ, GRID, BAR, TOOLTIP, xAxis, yAxis, labelAt, pctChange, refLabel, barLabelAt } from "@/lib/viz";
import ChartCard, { Delta } from "@/components/charts/ChartCard";

// Hôm nay, hôm qua, cả tuần.
//
// Sổ thường được ghi vào buổi tối, lúc không còn sức đọc một trang đầy biểu đồ
// cả tháng. Khối này trả lời đúng ba câu hỏi của lúc đó — hôm nay tiêu gì, hôm
// qua tiêu gì, tuần này đang đi về đâu — rồi mới tới phần dài hơn.
//
// Biểu đồ theo docs/bieu-do.md: tiêu đề là câu kết luận tính từ dữ liệu, cột
// xám, chỉ điểm mà tiêu đề nói tới (hôm nay, tuần này, thứ tốn nhất) mang màu
// nhấn, đường tham chiếu ghi nhãn tại chỗ thay cho chú giải.

interface Slice {
  date?: string;
  income: number;
  expense: number;
  debtPrincipal: number;
  cashOut: number;
  net: number;
  count: number;
  items?: { supplier: string; type: string; categoryGroup: string; subGroup: string; totalAmount: number }[];
}

interface DayPoint {
  date: string;
  weekday: number;
  expense: number;
  income: number;
  count: number;
  lastWeek: number;
  future: boolean;
  isToday: boolean;
}

interface WeekData {
  today: Slice;
  yesterday: Slice;
  week: Slice & {
    from: string;
    to: string;
    topGroups: { name: string; amount: number; count: number }[];
    elapsedDays: number;
  };
  prevWeek: Slice;
  days: DayPoint[];
  weeks: { name: string; from: string; expense: number; income: number; count: number; current: boolean }[];
  weekdayAverage: { weekday: number; avg: number }[];
  blankDays: string[];
  hasData: boolean;
}

const WEEKDAYS: [string, string][] = [
  ["Mon", "T2"], ["Tue", "T3"], ["Wed", "T4"], ["Thu", "T5"],
  ["Fri", "T6"], ["Sat", "T7"], ["Sun", "CN"],
];

/** "2026-10-05" → "05/10" */
function shortDate(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "10-05" (MM-DD, nhãn tuần của API) → "05/10" */
function weekLabel(mmdd: string) {
  return `${mmdd.slice(3, 5)}/${mmdd.slice(0, 2)}`;
}

/**
 * Vạch mốc "tuần trước" vẽ chồng lên cột tuần này (kiểu bullet graph).
 * Cột này nằm trên một trục X ẩn thứ hai (`xAxisId="prev"`) nên recharts đặt
 * nó TRÙNG chỗ với cột tuần này thay vì xếp cạnh — hai thanh song song là thứ
 * docs/bieu-do.md §2 dặn đừng làm.
 */
function LastWeekTick(props: BarShapeProps) {
  const { x, y, width, value } = props;
  const v = Array.isArray(value) ? value[1] - value[0] : value;
  if (!v) return null;
  return <rect x={x - 3} y={y - 1} width={width + 6} height={2.5} rx={1} fill={VIZ.ink} />;
}

/** Cột ngang xếp hạng (div): một thanh, thước chung `scale`. Cùng dáng với Bullet của MonthBreakdown. */
function RankBar({ value, scale, color }: { value: number; scale: number; color: string }) {
  return (
    <div className="relative h-3 w-full" aria-hidden>
      <div
        className="absolute inset-y-0 left-0 rounded-r-[4px]"
        style={{ width: `${(Math.max(0, value) / scale) * 100}%`, minWidth: value > 0 ? 3 : 0, background: color }}
      />
    </div>
  );
}

interface PanelProps {
  refreshKey: number;
  /** Bỏ hai danh sách hôm nay/hôm qua. Tab Chi tiêu đã có mục "Chi tiết theo
   *  ngày" làm đúng việc đó, bày lại là hai bản sao lệch nhau chờ xảy ra. */
  compact?: boolean;
}

export default function WeekPanel({ refreshKey, compact = false }: PanelProps) {
  const { t, language } = useLanguage();
  const expenseCats = useCategories("Expense");
  const [data, setData] = useState<WeekData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/finance/week?today=${todayLocalIso()}`, {
          signal: controller.signal,
        });
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
        {t("Could not load this week.", "Không tải được dữ liệu tuần này.")}
      </p>
    );
  }
  if (!data) {
    return <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>;
  }

  const { today, yesterday, week, days, weeks, weekdayAverage, blankDays } = data;

  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
  const label = (g: string) => expenseCats.label(g) || g;
  const dayName = (i: number) => t(WEEKDAYS[i][0], WEEKDAYS[i][1]);

  const dayChart = days.map((d) => ({
    ...d,
    name: dayName(d.weekday),
  }));
  const weekdayChart = weekdayAverage.map((w) => ({
    name: dayName(w.weekday),
    avg: w.avg,
  }));

  // So CÙNG KỲ: tuần này tới hôm nay với đúng những thứ đó của tuần trước.
  // Bản trước so nửa tuần đang chạy với CẢ tuần trước, nên thứ Ba nào cũng báo
  // "ít hơn tuần trước 70%" — đúng về số học, sai về ý nghĩa.
  const elapsed = days.filter((d) => !d.future);
  const soFar = elapsed.reduce((s, d) => s + d.expense, 0);
  const lastSoFar = elapsed.reduce((s, d) => s + d.lastWeek, 0);
  const likePct = pctChange(soFar, lastSoFar);
  const avgPerElapsedDay =
    week.elapsedDays > 0 ? Math.round(week.cashOut / week.elapsedDays) : 0;
  const todayIdx = dayChart.findIndex((d) => d.isToday);

  // --- Câu kết luận cho từng biểu đồ ------------------------------------------
  const sevenDayHeadline =
    soFar === 0 && lastSoFar === 0
      ? t("Nothing spent so far this week", "Tuần này chưa chi khoản nào")
      : likePct === null
        ? t(
            `${money(soFar)} out so far this week — last week had nothing by this day`,
            `Tuần này đã chi ${money(soFar)} — cùng kỳ tuần trước chưa chi gì`
          )
        : likePct === 0
          ? t(
              `${money(soFar)} out so far this week — level with last week`,
              `Tuần này đã chi ${money(soFar)} — ngang cùng kỳ tuần trước`
            )
          : t(
              `${money(soFar)} out so far this week — ${Math.abs(likePct)}% ${likePct < 0 ? "less" : "more"} than last week by this day`,
              `Tuần này đã chi ${money(soFar)} — ${likePct < 0 ? "ít" : "nhiều"} hơn cùng kỳ tuần trước ${Math.abs(likePct)}%`
            );

  const spendBase = week.expense > 0 ? week.expense : week.cashOut;
  const topGroup = week.topGroups[0];
  const maxGroup = Math.max(1, ...week.topGroups.map((g) => g.amount));
  const groupShare = (n: number) => (spendBase > 0 ? Math.round((n / spendBase) * 100) : 0);
  const groupsHeadline = topGroup
    ? t(
        `${label(topGroup.name)} took ${groupShare(topGroup.amount)}% of this week's spending`,
        `${label(topGroup.name)} chiếm ${groupShare(topGroup.amount)}% chi tiêu tuần này`
      )
    : t("Where this week went", "Tuần này tiêu vào đâu");

  const curWeekIdx = weeks.findIndex((w) => w.current);
  const curWeek = curWeekIdx >= 0 ? weeks[curWeekIdx] : null;
  const doneWeeks = weeks.filter((w) => !w.current);
  const weekAvg = doneWeeks.length
    ? Math.round(doneWeeks.reduce((s, w) => s + w.expense, 0) / doneWeeks.length)
    : 0;
  const weeksHeadline =
    weekAvg === 0 && (!curWeek || curWeek.expense === 0)
      ? t("No spending in the last twelve weeks", "Mười hai tuần qua chưa ghi khoản chi nào")
      : !curWeek || weekAvg === 0
        ? t("Twelve weeks back", "Mười hai tuần gần nhất")
        : curWeek.expense > weekAvg
          ? t(
              `This week has already passed a typical week (${money(weekAvg)})`,
              `Tuần này đã vượt mức một tuần thường (${money(weekAvg)})`
            )
          : t(
              `${money(curWeek.expense)} so far this week — under a typical week of ${money(weekAvg)}`,
              `Tuần này tới nay ${money(curWeek.expense)} — còn dưới mức một tuần thường ${money(weekAvg)}`
            );

  const maxWeekdayIdx = weekdayChart.reduce((best, w, i, arr) => (w.avg > arr[best].avg ? i : best), 0);
  const maxWeekday = weekdayChart[maxWeekdayIdx];
  const weekdayMean = weekdayChart.length
    ? Math.round(weekdayChart.reduce((s, w) => s + w.avg, 0) / weekdayChart.length)
    : 0;
  const weekdayHeadline =
    !maxWeekday || maxWeekday.avg === 0
      ? t("Not enough finished weeks to compare weekdays yet", "Chưa đủ tuần trọn vẹn để so các thứ")
      : t(
          `${maxWeekday.name} costs most — ${money(maxWeekday.avg)} on average`,
          `${maxWeekday.name} tốn nhất — trung bình ${money(maxWeekday.avg)}`
        );

  // Ba thẻ đầu. "Hôm qua" đặt cạnh "Hôm nay" vì ghi sổ buổi tối thì hôm qua mới
  // là ngày gần nhất đã trọn vẹn — so với một ngày mới đi được nửa chừng thì
  // không nói lên điều gì.
  const cards: {
    key: string;
    title: string;
    slice: Slice;
    note: string;
    accent?: boolean;
  }[] = [
    {
      key: "today",
      title: t("Today", "Hôm nay"),
      slice: today,
      note:
        today.count === 0
          ? t("nothing recorded yet", "chưa ghi khoản nào")
          : t(`${today.count} records`, `${today.count} khoản`),
      accent: true,
    },
    {
      key: "yesterday",
      title: t("Yesterday", "Hôm qua"),
      slice: yesterday,
      note:
        yesterday.count === 0
          ? t("nothing recorded", "không có khoản nào")
          : t(`${yesterday.count} records`, `${yesterday.count} khoản`),
    },
    {
      key: "week",
      title: t("This week", "Tuần này"),
      slice: week,
      note: `${shortDate(week.from)} – ${shortDate(week.to)} · ${t(
        `${week.count} records`,
        `${week.count} khoản`
      )}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* --- Ba thẻ --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.key}
            className={`bg-[var(--color-surface)] rounded-2xl p-5 border ${
              c.accent ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {c.title}
              </span>
              <span className="text-[11px] text-[var(--color-text-faint)]">{c.note}</span>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-text)]">
              {formatVND(c.slice.cashOut)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
              {c.slice.income > 0 && (
                <span className="text-[var(--color-success)]">
                  + {formatVND(c.slice.income)} {t("in", "vào")}
                </span>
              )}
              {c.slice.debtPrincipal > 0 && (
                <span>
                  {t("incl. principal", "gồm trả gốc")} {money(c.slice.debtPrincipal)}
                </span>
              )}
              {c.key === "week" && (
                <>
                  <span>
                    {t("avg/day", "BQ/ngày")} <b className="text-[var(--color-text)]">{money(avgPerElapsedDay)}</b>
                  </span>
                  {lastSoFar > 0 && (
                    <Delta
                      pct={likePct}
                      upIsGood={false}
                      vs={t("vs same days last week", "so cùng kỳ tuần trước")}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- Bảy ngày, đặt cạnh tuần trước --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title={sevenDayHeadline}
          subtitle={t(
            "Cash out per day, this week against the same weekday last week",
            "Tiền ra mỗi ngày, tuần này so với đúng thứ đó tuần trước"
          )}
          keys={[
            { label: t("This week", "Tuần này"), color: VIZ.muted, shape: "bar" },
            ...(todayIdx >= 0 ? [{ label: t("Today", "Hôm nay"), color: VIZ.accent, shape: "bar" as const }] : []),
            { label: t("Last week", "Tuần trước"), color: VIZ.ink, shape: "tick" },
          ]}
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayChart} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...xAxis} />
                <XAxis xAxisId="prev" dataKey="name" hide />
                <YAxis {...yAxis(money)} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                  labelFormatter={(l, p) => {
                    const row = p?.[0]?.payload as DayPoint | undefined;
                    return row ? `${l} · ${shortDate(row.date)}` : String(l);
                  }}
                />
                {/* Hôm nay mang màu nhấn: trong bảy cột giống hệt nhau thì không
                    có gì chỉ ra đang đứng ở đâu. Ngày chưa tới không có cột,
                    chỉ còn vạch tuần trước — thấy trước phía trước còn gì. */}
                <Bar
                  dataKey="expense"
                  name={t("This week", "Tuần này")}
                  {...BAR}
                  fill={VIZ.muted}
                  label={todayIdx >= 0 ? barLabelAt(dayChart, "expense", todayIdx, money) : undefined}
                >
                  {dayChart.map((d) => (
                    <Cell key={d.date} fill={d.isToday ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
                <Bar
                  xAxisId="prev"
                  dataKey="lastWeek"
                  name={t("Last week", "Tuần trước")}
                  maxBarSize={BAR.maxBarSize}
                  fill={VIZ.ink}
                  shape={LastWeekTick}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {blankDays.length > 0 && (
            <p className="text-xs flex items-start gap-2 text-[var(--color-text-muted)]">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
              <span>
                {t(
                  `${blankDays.length} day(s) this week with nothing recorded: `,
                  `${blankDays.length} ngày trong tuần chưa có khoản nào: `
                )}
                <b className="text-[var(--color-text)]">{blankDays.map(shortDate).join(", ")}</b>
              </span>
            </p>
          )}
        </ChartCard>

        {/* --- Tuần này tiêu vào nhóm nào --- */}
        <ChartCard
          title={groupsHeadline}
          subtitle={t("Spending by category, the six largest groups", "Chi theo nhóm, sáu nhóm lớn nhất")}
        >
          {week.topGroups.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Nothing recorded this week.", "Tuần này chưa ghi khoản chi nào.")}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {week.topGroups.map((g, i) => (
                <li key={g.name} className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={`min-w-0 truncate text-[var(--color-text)] ${i === 0 ? "font-bold" : ""}`}>
                      {label(g.name)}
                    </span>
                    <span className="flex-none tabular-nums">
                      <span className="font-bold text-[var(--color-text)]">{formatVND(g.amount)}</span>
                      <span className="ml-2 inline-block w-9 text-right text-xs text-[var(--color-text-faint)]">
                        {groupShare(g.amount)}%
                      </span>
                    </span>
                  </div>
                  <RankBar value={g.amount} scale={maxGroup} color={i === 0 ? VIZ.accent : VIZ.muted} />
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* --- Hai danh sách: hôm nay và hôm qua --- */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${compact ? "hidden" : ""}`}>
        {[today, yesterday].map((slice, i) => (
          <div
            key={slice.date}
            className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]"
          >
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <h4 className="c-h5 text-[var(--color-text)]">
                {i === 0 ? t("Today in detail", "Hôm nay có gì") : t("Yesterday in detail", "Hôm qua có gì")}
              </h4>
              <span className="text-xs tabular-nums text-[var(--color-text-faint)]">
                {slice.date ? shortDate(slice.date) : ""}
              </span>
            </div>
            {!slice.items || slice.items.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-2">
                <CalendarDays size={15} className="text-[var(--color-text-faint)]" />
                {t("Nothing recorded.", "Không có khoản nào.")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {slice.items.map((it, j) => (
                  <li key={`${it.supplier}-${j}`} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-bold text-sm text-[var(--color-text)]">
                        {it.supplier || t("(no name)", "(chưa đặt tên)")}
                      </span>
                      <span
                        className={`flex-none tabular-nums font-bold text-sm ${
                          it.type?.toLowerCase() === "income"
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-text)]"
                        }`}
                      >
                        {it.type?.toLowerCase() === "income" ? "+" : ""}
                        {formatVND(it.totalAmount)}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-faint)] mt-0.5 truncate">
                      {label(it.categoryGroup)}
                      {it.subGroup ? ` · ${it.subGroup}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>


      {/* --- Bối cảnh dài hơn: 12 tuần và trung bình theo thứ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title={weeksHeadline}
          subtitle={t(
            "Cash out per week, labelled by its Monday · dashed line = average of the finished weeks",
            "Tiền ra mỗi tuần, nhãn là thứ Hai của tuần · nét đứt = trung bình các tuần đã trọn"
          )}
        >
          {/* Không trục Y, không lưới: cột tuần này ghi số, đường trung bình
              ghi số — hai mốc đó đủ để đọc mọi cột còn lại. */}
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  {...xAxis}
                  tickFormatter={(v) => weekLabel(String(v))}
                  interval="preserveStartEnd"
                  minTickGap={6}
                />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v) => [formatVND(Number(v) || 0), t("Cash out", "Tiền ra")]}
                  labelFormatter={(l) => t(`Week of ${weekLabel(String(l))}`, `Tuần từ ${weekLabel(String(l))}`)}
                />
                {weekAvg > 0 && (
                  <ReferenceLine
                    y={weekAvg}
                    stroke={VIZ.muted}
                    strokeDasharray="4 3"
                    label={refLabel(`${t("avg", "TB")} ${money(weekAvg)}`)}
                  />
                )}
                <Bar
                  dataKey="expense"
                  name={t("Cash out", "Tiền ra")}
                  {...BAR}
                  fill={VIZ.muted}
                  label={curWeekIdx >= 0 ? barLabelAt(weeks, "expense", curWeekIdx, money) : undefined}
                >
                  {weeks.map((w) => (
                    <Cell key={w.from} fill={w.current ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={weekdayHeadline}
          subtitle={t(
            "Average cash out per weekday over the last 11 finished weeks — the running week is left out",
            "Tiền ra trung bình mỗi thứ, 11 tuần đã trọn vẹn — tuần đang chạy để ngoài"
          )}
        >
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayChart} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="name" {...xAxis} />
                <Tooltip {...TOOLTIP} formatter={(v) => [formatVND(Number(v) || 0), t("Average", "Trung bình")]} />
                {weekdayMean > 0 && (
                  <ReferenceLine
                    y={weekdayMean}
                    stroke={VIZ.muted}
                    strokeDasharray="4 3"
                    label={refLabel(`${t("avg/day", "TB/ngày")} ${money(weekdayMean)}`)}
                  />
                )}
                <Bar
                  dataKey="avg"
                  name={t("Average", "Trung bình")}
                  {...BAR}
                  fill={VIZ.muted}
                  label={maxWeekday && maxWeekday.avg > 0 ? barLabelAt(weekdayChart, "avg", maxWeekdayIdx, money) : undefined}
                >
                  {weekdayChart.map((w, i) => (
                    <Cell key={w.name} fill={i === maxWeekdayIdx && w.avg > 0 ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
