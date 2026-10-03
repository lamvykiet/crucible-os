"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, BarChart,
} from "recharts";
import { ChevronDown, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { thisMonthLocalIso } from "@/lib/localDate";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";

// Không gian soi MỘT nhóm chi tiêu.
//
// Các màn còn lại nhìn từ trên xuống: tổng tháng rồi tỷ trọng các nhóm. Chúng
// trả lời "tháng này tiêu bao nhiêu" nhưng không trả lời "riêng nhóm Business
// năm nay thế nào so với năm ngoái".
//
// Mục này có tháng riêng, không dùng chung tháng với tab Chi tiêu: đang soi một
// nhóm thì thường muốn lùi lại vài tháng để xem, mà không muốn mọi biểu đồ khác
// trên trang nhảy theo.

const NONE_KEY = "__none";

interface Slice { name: string; amount: number; count: number; share: number }
interface DayRow { date: string; amount: number; supplier: string }
type MonthRow = Record<string, string | number>;

interface GroupData {
  group: string;
  month: string;
  year: number;
  current: { total: number; count: number; avg: number };
  prevMonth: { label: string; total: number; count: number };
  lastYearMonth: { label: string; total: number; count: number };
  ytd: { total: number; count: number };
  lastYtd: { total: number; count: number };
  lastYearFull: number;
  monthlySeries: MonthRow[];
  subNames: string[];
  details: Record<string, Record<string, { amount: number; days: DayRow[] }>>;
  cumulative: { name: string; thisYear: number | null; lastYear: number }[];
  seasonality: { name: string; avg: number }[];
  shareOfTotal: { name: string; pct: number }[];
  sizeBuckets: { name: string; count: number; amount: number }[];
  weekday: { name: string; amount: number; count: number }[];
  subGroupsYear: Slice[];
  merchants: Slice[];
  missingMonths: string[];
  hasAnyData: boolean;
}

/** Chênh lệch kèm chiều. Với chi tiêu thì TĂNG là tin xấu. */
function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const { t } = useLanguage();
  const diff = now - before;
  const pct = before > 0 ? Math.round((diff / before) * 100) : null;
  const color =
    diff === 0
      ? "text-[var(--color-text-faint)]"
      : diff > 0
        ? "text-[var(--color-error)]"
        : "text-[var(--color-success)]";
  return (
    <div className="text-xs mt-1">
      <span className={`font-bold ${color}`}>
        {diff > 0 ? "↗" : diff < 0 ? "↘" : "→"}{" "}
        {pct !== null
          ? `${pct > 0 ? "+" : ""}${pct}%`
          : before === 0 && now > 0
            ? t("new", "mới")
            : t("unchanged", "không đổi")}
      </span>{" "}
      <span className="text-[var(--color-text-faint)]">
        {label} {formatVND(before)}
      </span>
    </div>
  );
}

/**
 * Một sắc độ của cùng MỘT màu, đậm nhạt theo tỷ trọng trong tháng.
 *
 * Dùng `color-mix` pha với màu nền thẻ nên nó tự đúng ở cả bảng sáng lẫn bảng
 * tối, không cần hai bảng màu. Sàn 22% để khúc bé nhất vẫn nhìn ra, trần 96%
 * để khúc lớn nhất không đặc kịt.
 */
function shadeFor(share: number): string {
  const pct = Math.round(22 + Math.min(1, Math.max(0, share)) * 74);
  return `color-mix(in srgb, var(--chart-1) ${pct}%, var(--color-surface))`;
}

/**
 * Chú giải cột chồng: tên danh mục con, số tiền, và NGÀY phát sinh.
 *
 * Đặt ở cấp module chứ không lồng trong component cha: component khai báo lại ở
 * mỗi lần render thì React coi là một loại component mới và dựng lại cả cây con
 * (react-hooks/static-components).
 */
function StackTooltip({
  active,
  label: monthName,
  details,
  activeSub,
  noneLabel,
  moreLabel,
}: {
  active?: boolean;
  label?: string;
  details: Record<string, Record<string, { amount: number; days: DayRow[] }>>;
  activeSub: string | null;
  noneLabel: string;
  moreLabel: string;
}) {
  if (!active || !monthName) return null;
  const bucket = details[monthName];
  if (!bucket) return null;
  const rows = Object.entries(bucket).sort((a, b) => b[1].amount - a[1].amount);
  const total = rows.reduce((sum, [, v]) => sum + v.amount, 0);
  const focus = activeSub && bucket[activeSub] ? activeSub : null;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-sm text-xs max-w-[280px]">
      <p className="font-bold text-[var(--color-text)]">{monthName}</p>
      <p className="font-bold tabular-nums text-[var(--color-text)] mb-2">{formatVND(total)}</p>
      <ul className="space-y-1.5">
        {rows.map(([sub, v]) => {
          const isFocus = sub === focus;
          return (
            <li key={sub} className={isFocus ? "" : "opacity-70"}>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-none"
                  style={{ background: shadeFor(total > 0 ? v.amount / total : 0) }}
                  aria-hidden
                />
                <span
                  className={`flex-1 min-w-0 truncate ${
                    isFocus ? "font-bold text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {sub === NONE_KEY ? noneLabel : sub}
                </span>
                <span className="tabular-nums text-[var(--color-text)]">{formatVND(v.amount)}</span>
              </div>
              {/* Ngày phát sinh chỉ mở cho khúc đang trỏ vào — mở hết thì chú
                  giải dài hơn cả biểu đồ. */}
              {isFocus && (
                <ul className="mt-1 ml-[18px] space-y-0.5 text-[var(--color-text-faint)]">
                  {v.days.slice(0, 6).map((d, i) => (
                    <li key={`${d.date}-${i}`} className="flex justify-between gap-2">
                      <span className="tabular-nums">{d.date}</span>
                      <span className="truncate max-w-[110px]">{d.supplier}</span>
                      <span className="tabular-nums">{formatVND(d.amount)}</span>
                    </li>
                  ))}
                  {v.days.length > 6 && (
                    <li>
                      +{v.days.length - 6} {moreLabel}
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ExpenseGroupAnalysis({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t, language } = useLanguage();
  const { groupNames, label } = useCategories("Expense");

  const [group, setGroup] = useState("");
  const [month, setMonth] = useState(() => thisMonthLocalIso());
  const [data, setData] = useState<GroupData | null>(null);
  const [failed, setFailed] = useState(false);
  // Danh mục con đang rê chuột vào, để chú giải mở đúng khúc.
  const [activeSub, setActiveSub] = useState<string | null>(null);

  // Nhóm đầu tiên được chọn sẵn, để mục này không mở ra trống trơn. Đồng bộ
  // trong lúc render thay vì trong effect (react-hooks/set-state-in-effect).
  //
  // So bằng CHUỖI chứ không bằng tham chiếu: `useCategories` dựng mảng mới ở
  // mỗi lần render, nên so bằng tham chiếu thì lần nào cũng setState và thành
  // vòng lặp render vô hạn — đã làm trắng cả tab Chi tiêu một lần.
  const groupsKey = groupNames.join("|");
  const [lastGroupsKey, setLastGroupsKey] = useState("");
  if (groupNames.length > 0 && groupsKey !== lastGroupsKey) {
    setLastGroupsKey(groupsKey);
    if (!group || !groupNames.includes(group)) setGroup(groupNames[0]);
  }

  const isLoading =
    !failed && group !== "" && (!data || data.group !== group || data.month !== month);

  useEffect(() => {
    if (!group) return;
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/finance/expense/group?group=${encodeURIComponent(group)}&month=${month}`,
          { signal: controller.signal }
        );
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
  }, [group, month, refreshKey]);

  const selectClass =
    "w-full md:w-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl pl-4 pr-10 py-2.5 min-h-11 text-base md:text-sm font-bold text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] appearance-none";
  const subLabel = (s: string) =>
    s === NONE_KEY ? t("no sub-category", "chưa có danh mục con") : s;
  const axisTick = { fontSize: 11, fill: "var(--color-text-faint)" };
  const money = (v: number | string) => compactMoney(Number(v), language === "vi");

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("Group deep dive", "Soi riêng một nhóm")}
          </h3>
          <p className="text-xs text-[var(--color-text-faint)] mt-1">
            {t(
              "this section has its own month, the rest of the page stays put",
              "mục này có tháng riêng, phần còn lại của trang không đổi theo"
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-label={t("Expense group", "Nhóm chi tiêu")}
              className={selectClass}
            >
              {groupNames.map((g) => (
                <option key={g} value={g}>
                  {label(g)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
            />
          </div>
          <CustomMonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      {failed && (
        <p className="text-sm text-[var(--color-error)]">
          {t("Could not load this group.", "Không tải được dữ liệu nhóm này.")}
        </p>
      )}

      {!failed && isLoading && (
        <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
      )}

      {!failed && !isLoading && data && (
        <div className="space-y-8">
          {!data.hasAnyData ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t(
                `No spending recorded for ${label(group)} in the last two years.`,
                `Hai năm qua chưa ghi khoản chi nào cho nhóm ${label(group)}.`
              )}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("This month", "Tháng này")} · {data.month}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--color-text)] mt-1">
                    {formatVND(data.current.total)}
                  </div>
                  <div className="text-xs text-[var(--color-text-faint)] mt-1">
                    {data.current.count} {t("transactions", "giao dịch")}
                    {data.current.count > 0 &&
                      ` · ${t("avg", "BQ")} ${formatVND(data.current.avg)}`}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("vs last month", "So tháng trước")}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--color-text)] mt-1">
                    {formatVND(data.prevMonth.total)}
                  </div>
                  <Delta
                    now={data.current.total}
                    before={data.prevMonth.total}
                    label={data.prevMonth.label}
                  />
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("vs same month last year", "So cùng kỳ năm trước")}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--color-text)] mt-1">
                    {formatVND(data.lastYearMonth.total)}
                  </div>
                  <Delta
                    now={data.current.total}
                    before={data.lastYearMonth.total}
                    label={data.lastYearMonth.label}
                  />
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("Year to date", "Luỹ kế năm")} {data.year}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--color-text)] mt-1">
                    {formatVND(data.ytd.total)}
                  </div>
                  <Delta
                    now={data.ytd.total}
                    before={data.lastYtd.total}
                    label={`${data.year - 1} ${t("same period", "cùng kỳ")}`}
                  />
                </div>
              </div>

              {data.missingMonths.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning-tint)] p-4">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
                  <p className="text-sm text-[var(--color-text)]">
                    {t(
                      `${data.missingMonths.length} of the last 12 months have nothing in this group: `,
                      `${data.missingMonths.length} trong 12 tháng gần nhất không có khoản nào thuộc nhóm này: `
                    )}
                    <b>{data.missingMonths.join(", ")}</b>
                    {". "}
                    {t(
                      "If this is a recurring cost, those months are probably unrecorded.",
                      "Nếu đây là khoản chi đều hằng tháng thì nhiều khả năng mấy kỳ đó chưa nhập."
                    )}
                  </p>
                </div>
              )}

              {/* 1 — Cột chồng 24 tháng theo danh mục con */}
              <div>
                <h4 className="text-sm font-bold text-[var(--color-text)]">
                  {t("24 months, split by sub-category", "24 tháng, tách theo danh mục con")}
                </h4>
                <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
                  {t(
                    "one colour, darker the bigger its share of that month · hover a band for its dates",
                    "một màu, khúc chiếm tỷ trọng lớn hơn thì đậm hơn · rê vào một khúc để xem ngày phát sinh"
                  )}
                </p>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.monthlySeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fill: "var(--color-text-faint)" }}
                        angle={-45}
                        textAnchor="end"
                        height={56}
                        interval={1}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={axisTick}
                        tickFormatter={money}
                        width={48}
                      />
                      <Tooltip
                        content={
                          <StackTooltip
                            details={data.details}
                            activeSub={activeSub}
                            noneLabel={t("no sub-category", "chưa có danh mục con")}
                            moreLabel={t("more", "khoản nữa")}
                          />
                        }
                        cursor={{ fill: "var(--color-surface-2)" }}
                      />
                      {data.subNames.map((sub) => (
                        <Bar
                          key={sub}
                          dataKey={sub}
                          stackId="sub"
                          name={subLabel(sub)}
                          onMouseEnter={() => setActiveSub(sub)}
                          onMouseLeave={() => setActiveSub(null)}
                          stroke="var(--color-surface)"
                          strokeWidth={1}
                          maxBarSize={24}
                        >
                          {/* Màu đặt theo TỪNG Ô vì sắc độ phụ thuộc tỷ trọng
                              trong chính tháng đó. Dùng `style` chứ không phải
                              `fill`: globals.css tô đè mọi cột bằng --chart-1,
                              mà style nội tuyến thì thắng CSS. */}
                          {data.monthlySeries.map((row, i) => {
                            const total = Number(row.amount) || 0;
                            const v = Number(row[sub]) || 0;
                            return (
                              <Cell
                                key={`${sub}-${i}`}
                                style={{ fill: shadeFor(total > 0 ? v / total : 0) }}
                              />
                            );
                          })}
                        </Bar>
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 2 — Luỹ kế năm nay vs năm trước */}
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)]">
                    {t("Running total vs last year", "Luỹ kế năm nay so năm trước")}
                  </h4>
                  <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
                    {t(
                      "above the dashed line means spending faster than last year",
                      "nằm trên đường nét đứt là đang tiêu nhanh hơn năm ngoái"
                    )}
                  </p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.cumulative} className="c-chart-multi">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={axisTick}
                          tickFormatter={money}
                          width={48}
                        />
                        <Tooltip formatter={(v, n) => [formatVND(Number(v) || 0), n]} />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Line
                          type="monotone"
                          dataKey="lastYear"
                          name={String(data.year - 1)}
                          stroke="var(--color-text-faint)"
                          strokeWidth={2}
                          strokeDasharray="5 3"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="thisYear"
                          name={String(data.year)}
                          stroke="var(--chart-1)"
                          strokeWidth={3}
                          dot={{ r: 3, fill: "var(--chart-1)" }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3 — Mùa vụ */}
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)]">
                    {t("Which months run hot", "Tháng nào thường tốn")}
                  </h4>
                  <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
                    {t(
                      "average per calendar month across every year on record",
                      "trung bình mỗi tháng trong năm, gộp mọi năm đã có dữ liệu"
                    )}
                  </p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.seasonality}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={axisTick}
                          tickFormatter={money}
                          width={48}
                        />
                        <Tooltip formatter={(v) => formatVND(Number(v) || 0)} />
                        <Bar dataKey="avg" name={t("Average", "Trung bình")} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4 — Tỷ trọng trong tổng chi */}
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)]">
                    {t("Share of all spending", "Chiếm bao nhiêu phần tổng chi")}
                  </h4>
                  <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
                    {t(
                      "this group as a percent of everything spent that month",
                      "nhóm này chiếm bao nhiêu phần trăm tổng chi của tháng đó"
                    )}
                  </p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.shareOfTotal}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 9, fill: "var(--color-text-faint)" }}
                          angle={-45}
                          textAnchor="end"
                          height={50}
                          interval={2}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={axisTick}
                          tickFormatter={(v) => `${v}%`}
                          width={40}
                        />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Line
                          type="monotone"
                          dataKey="pct"
                          name={t("Share", "Tỷ trọng")}
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5 — Cỡ khoản chi */}
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)]">
                    {t("Few big ones or many small ones?", "Ít khoản to hay nhiều khoản nhỏ?")}
                  </h4>
                  <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
                    {t(
                      "number of transactions by size, last 12 months",
                      "số giao dịch theo cỡ khoản, 12 tháng gần nhất"
                    )}
                  </p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.sizeBuckets}>
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
                          tick={axisTick}
                          width={32}
                          allowDecimals={false}
                        />
                        <Tooltip
                          formatter={(v, n, item) => [
                            `${v} ${t("transactions", "giao dịch")} · ${formatVND(
                              Number((item?.payload as { amount?: number })?.amount) || 0
                            )}`,
                            t("Count", "Số giao dịch"),
                          ]}
                        />
                        <Bar dataKey="count" name={t("Count", "Số giao dịch")} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 6 — Thứ trong tuần */}
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)]">
                    {t("Which day of the week", "Rơi vào thứ mấy")}
                  </h4>
                  <p className="text-xs text-[var(--color-text-faint)] mt-1 mb-4">
                    {t("by amount, last 12 months", "theo số tiền, 12 tháng gần nhất")}
                  </p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.weekday}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={axisTick}
                          tickFormatter={money}
                          width={48}
                        />
                        <Tooltip
                          formatter={(v, n, item) => [
                            `${formatVND(Number(v) || 0)} · ${
                              (item?.payload as { count?: number })?.count || 0
                            } ${t("transactions", "giao dịch")}`,
                            t("Spending", "Số tiền"),
                          ]}
                        />
                        <Bar dataKey="amount" name={t("Spending", "Số tiền")} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 7 — Danh mục con trong năm */}
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)] mb-4">
                    {t("Sub-categories this year", "Danh mục con trong năm")} {data.year}
                  </h4>
                  {data.subGroupsYear.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("Nothing recorded this year.", "Năm nay chưa ghi khoản nào.")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.subGroupsYear.map((s) => (
                        <li key={s.name || NONE_KEY}>
                          <div className="flex items-baseline justify-between gap-3 mb-1">
                            <span className="min-w-0 truncate text-xs font-bold text-[var(--color-text-muted)]">
                              {s.name || t("no sub-category", "chưa có danh mục con")}
                            </span>
                            <span className="flex-none text-xs font-bold tabular-nums text-[var(--color-text)]">
                              {formatVND(s.amount)}
                              <span className="ml-1.5 font-normal text-[var(--color-text-faint)]">
                                {s.share}%
                              </span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.max(2, s.share)}%`,
                                background: shadeFor(s.share / 100),
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[var(--color-text)] mb-3">
                  {t("Where the money went", "Chi cho ai")} {data.year}
                </h4>
                {data.merchants.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {t("Nothing recorded this year.", "Năm nay chưa ghi khoản nào.")}
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {data.merchants.map((m) => (
                      <li
                        key={m.name || NONE_KEY}
                        className="py-2 first:pt-0 flex items-baseline justify-between gap-3"
                      >
                        <span className="min-w-0 truncate text-sm text-[var(--color-text)]">
                          {m.name || t("(no name)", "(chưa đặt tên)")}
                        </span>
                        <span className="flex-none text-sm tabular-nums text-[var(--color-text)]">
                          {formatVND(m.amount)}
                          <span className="ml-2 text-xs text-[var(--color-text-faint)]">
                            {m.count}×
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
