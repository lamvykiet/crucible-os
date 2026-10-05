"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, BarChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { AlertCircle, CalendarDays } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { todayLocalIso } from "@/lib/localDate";

// Hôm nay, hôm qua, cả tuần.
//
// Sổ thường được ghi vào buổi tối, lúc không còn sức đọc một trang đầy biểu đồ
// cả tháng. Khối này trả lời đúng ba câu hỏi của lúc đó — hôm nay tiêu gì, hôm
// qua tiêu gì, tuần này đang đi về đâu — rồi mới tới phần dài hơn.

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

  const { today, yesterday, week, prevWeek, days, weeks, weekdayAverage, blankDays } = data;

  const vi = language === "vi";
  const money = (n: number) => compactMoney(n, vi);
  const label = (g: string) => expenseCats.label(g) || g;

  const dayChart = days.map((d) => ({
    ...d,
    name: t(WEEKDAYS[d.weekday][0], WEEKDAYS[d.weekday][1]),
  }));
  const weekdayChart = weekdayAverage.map((w) => ({
    name: t(WEEKDAYS[w.weekday][0], WEEKDAYS[w.weekday][1]),
    avg: w.avg,
  }));

  const weekDelta = week.cashOut - prevWeek.cashOut;
  const weekPct = prevWeek.cashOut > 0 ? Math.round((weekDelta / prevWeek.cashOut) * 100) : null;
  const avgPerElapsedDay =
    week.elapsedDays > 0 ? Math.round(week.cashOut / week.elapsedDays) : 0;
  const maxGroup = week.topGroups[0]?.amount || 1;

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
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
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
                  {prevWeek.cashOut > 0 && (
                    <span
                      className={
                        weekDelta > 0
                          ? "text-[var(--color-error)]"
                          : weekDelta < 0
                            ? "text-[var(--color-success)]"
                            : ""
                      }
                    >
                      {weekDelta > 0 ? "↑" : weekDelta < 0 ? "↓" : "→"}{" "}
                      {weekPct !== null ? `${Math.abs(weekPct)}%` : ""}{" "}
                      {t("vs last week", "so tuần trước")}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* --- Bảy ngày, đặt cạnh tuần trước --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">
            {t("Seven days", "Bảy ngày trong tuần")}
          </h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t(
              "columns: this week · dashed line: the same weekday last week",
              "cột: tuần này · đường nét đứt: đúng thứ đó của tuần trước"
            )}
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dayChart} className="c-chart-multi">
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
                  tickFormatter={(v) => money(Number(v))}
                  width={46}
                />
                <Tooltip
                  formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                  labelFormatter={(l, p) => {
                    const row = p?.[0]?.payload as DayPoint | undefined;
                    return row ? `${l} · ${shortDate(row.date)}` : String(l);
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar
                  dataKey="expense"
                  name={t("This week", "Tuần này")}
                  className="c-series-1"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                >
                  {/* Hôm nay tô đậm hơn: trong bảy cột giống hệt nhau thì không
                      có gì chỉ ra đang đứng ở đâu. Ngày chưa tới để nhạt hẳn,
                      không thì cột 0 trông như một ngày không tiêu gì. */}
                  {dayChart.map((d) => (
                    <Cell
                      key={d.date}
                      style={{
                        fill: d.future
                          ? "var(--color-border)"
                          : d.isToday
                            ? "var(--chart-1)"
                            : "color-mix(in srgb, var(--chart-1) 55%, var(--color-surface))",
                      }}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="lastWeek"
                  name={t("Last week", "Tuần trước")}
                  stroke="var(--color-text-faint)"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 2.5 }}
                  className="c-series-muted"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {blankDays.length > 0 && (
            <p className="mt-4 text-xs flex items-start gap-2 text-[var(--color-text-muted)]">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
              {t(
                `${blankDays.length} day(s) this week with nothing recorded: `,
                `${blankDays.length} ngày trong tuần chưa có khoản nào: `
              )}
              <b className="text-[var(--color-text)]">
                {blankDays.map(shortDate).join(", ")}
              </b>
            </p>
          )}
        </div>

        {/* --- Tuần này tiêu vào nhóm nào --- */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">
            {t("Where this week went", "Tuần này tiêu vào đâu")}
          </h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t("the six largest groups", "sáu nhóm lớn nhất")}
          </p>
          {week.topGroups.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Nothing recorded this week.", "Tuần này chưa ghi khoản chi nào.")}
            </p>
          ) : (
            <ul className="space-y-3">
              {week.topGroups.map((g) => (
                <li key={g.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-[var(--color-text)]">{label(g.name)}</span>
                    <span className="flex-none tabular-nums font-bold text-[var(--color-text)]">
                      {formatVND(g.amount)}
                      <span className="ml-2 text-xs font-normal text-[var(--color-text-faint)]">
                        {week.cashOut > 0 ? Math.round((g.amount / week.cashOut) * 100) : 0}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--chart-1)]"
                      style={{ width: `${Math.max(2, (g.amount / maxGroup) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">
            {t("Twelve weeks back", "Mười hai tuần gần nhất")}
          </h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t(
              "one column per week, labelled by its Monday · the last one is still running",
              "mỗi cột một tuần, nhãn là thứ Hai của tuần đó · cột cuối là tuần đang chạy"
            )}
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--color-text-faint)" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                  tickFormatter={(v) => money(Number(v))}
                  width={46}
                />
                <Tooltip
                  formatter={(v) => formatVND(Number(v) || 0)}
                  labelFormatter={(l) => t(`Week of ${l}`, `Tuần từ ${l}`)}
                />
                <Bar dataKey="expense" name={t("Cash out", "Tiền ra")} radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {weeks.map((w) => (
                    <Cell
                      key={w.from}
                      style={{
                        fill: w.current
                          ? "var(--chart-1)"
                          : "color-mix(in srgb, var(--chart-1) 55%, var(--color-surface))",
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)]">
          <h4 className="c-h5 text-[var(--color-text)]">
            {t("Which weekday costs most", "Thứ nào trong tuần hay tốn")}
          </h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-6">
            {t(
              "average over the last 11 completed weeks — the running week is left out",
              "trung bình 11 tuần đã trọn vẹn — tuần đang chạy để ngoài"
            )}
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayChart}>
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
                  tickFormatter={(v) => money(Number(v))}
                  width={46}
                />
                <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                <Bar dataKey="avg" name={t("Average", "Trung bình")} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
