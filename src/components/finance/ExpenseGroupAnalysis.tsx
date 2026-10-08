"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart, Bar, Line, LineChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { ChevronDown, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { thisMonthLocalIso } from "@/lib/localDate";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import { VIZ, GRID, yAxis, xAxis, BAR, STACK_GAP, LINE, TOOLTIP, TOOLTIP_LINE, labelAt, pctChange, catColor, refLabel, barLabelAt, drawnIndex } from "@/lib/viz";
import { SeriesKey, Delta, StatTile, type SeriesKeyItem } from "@/components/charts/ChartCard";
import { monthAxis } from "./MonthAxisTick";

// Không gian soi MỘT nhóm chi tiêu.
//
// Các màn còn lại nhìn từ trên xuống: tổng tháng rồi tỷ trọng các nhóm. Chúng
// trả lời "tháng này tiêu bao nhiêu" nhưng không trả lời "riêng nhóm Business
// năm nay thế nào so với năm ngoái".
//
// Mục này có tháng riêng, không dùng chung tháng với tab Chi tiêu: đang soi một
// nhóm thì thường muốn lùi lại vài tháng để xem, mà không muốn mọi biểu đồ khác
// trên trang nhảy theo.
//
// Biểu đồ theo docs/bieu-do.md: mỗi khối có tiêu đề là câu kết luận tính từ dữ
// liệu; cột xám, chỉ điểm câu đó nói tới mang màu nhấn; ghi số ở một chỗ.

const NONE_KEY = "__none";
/** Danh mục con ngoài top 4 gộp vào khoá này trên cột chồng. */
const REST_KEY = "__rest";

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

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10" hoặc "10" → "T10" / "Oct" */
const monthShort = (k: string, vi: boolean) => {
  const m = Number(k.length >= 7 ? k.slice(5, 7) : k);
  if (!m) return k;
  return vi ? `T${m}` : MONTHS_EN[m - 1];
};
/** Thứ trong tuần: API trả nhãn tiếng Việt, CN trước. */
const WEEKDAY_EN: Record<string, string> = { CN: "Sun", T2: "Mon", T3: "Tue", T4: "Wed", T5: "Thu", T6: "Fri", T7: "Sat" };

/** Vị trí giá trị lớn nhất; -1 khi không có giá trị dương. */
function argmax(values: number[]) {
  let at = -1;
  let best = 0;
  values.forEach((v, i) => {
    if (v > best) {
      best = v;
      at = i;
    }
  });
  return at;
}

/** % thay đổi, nhưng hai bên cùng 0 thì là "không đổi" chứ không phải "mới". */
const change = (now: number, before: number) => (now === 0 && before === 0 ? 0 : pctChange(now, before));

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
  colorOf,
  noneLabel,
  moreLabel,
}: {
  active?: boolean;
  label?: string;
  details: Record<string, Record<string, { amount: number; days: DayRow[] }>>;
  activeSub: string | null;
  /** Cùng màu với khúc cột — màu đi theo danh mục con. */
  colorOf: (sub: string) => string;
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
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs max-w-[280px]">
      <p className="font-bold text-[var(--color-text)]">{monthName}</p>
      <p className="font-bold tabular-nums text-[var(--color-text)] mb-2">{formatVND(total)}</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map(([sub, v]) => {
          const isFocus = sub === focus;
          return (
            <li key={sub} className={focus && !isFocus ? "opacity-70" : ""}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-[3px] flex-none" style={{ background: colorOf(sub) }} aria-hidden />
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
                <ul className="mt-1 ml-[18px] flex flex-col gap-0.5 text-[var(--color-text-faint)]">
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

/** Một khối biểu đồ bên trong thẻ lớn: câu kết luận, dòng mô tả, chú giải. */
function Panel({
  title,
  subtitle,
  keys,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  keys?: SeriesKeyItem[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col gap-3 min-w-0 ${className}`}>
      <header>
        <h4 className="text-sm font-bold text-[var(--color-text)] text-balance">{title}</h4>
        {subtitle && <p className="text-xs text-[var(--color-text-faint)] mt-1">{subtitle}</p>}
      </header>
      {keys && keys.length > 0 && <SeriesKey items={keys} />}
      {children}
    </section>
  );
}

interface BarRow {
  key: string;
  name: string;
  value: number;
  display: string;
  color: string;
  strong?: boolean;
  note?: string;
}

/** Cột ngang (vẽ bằng div): tên + số ở dòng trên, thanh mảnh ở dòng dưới. */
function BarRows({ rows }: { rows: BarRow[] }) {
  const scale = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className={`min-w-0 truncate text-sm text-[var(--color-text)] ${r.strong ? "font-bold" : ""}`} title={r.name}>
              {r.name}
            </span>
            <span className="flex-none text-sm font-bold tabular-nums text-[var(--color-text)]">
              {r.display}
              {r.note && <span className="ml-1.5 text-xs font-normal text-[var(--color-text-faint)]">{r.note}</span>}
            </span>
          </div>
          <div className="h-3 w-full" aria-hidden>
            <div
              className="h-full rounded-r-[4px]"
              style={{
                width: `${(Math.max(0, r.value) / scale) * 100}%`,
                minWidth: r.value > 0 ? 3 : 0,
                background: r.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Nhãn tổng trên đỉnh cột chồng, chỉ ở MỘT cột (gắn vào khúc trên cùng có giá trị). */
function stackTotalAt(index: number, total: number, format: (v: number) => string) {
  const render = (props: { index?: number; x?: number | string; y?: number | string; width?: number | string }) => {
    if (props.index !== index) return null;
    const x = Number(props.x) + Number(props.width ?? 0) / 2;
    return (
      <text x={x} y={Number(props.y) - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--color-text)">
        {format(total)}
      </text>
    );
  };
  return render;
}

/** Chấm màu nhấn chỉ ở MỘT điểm của đường. */
function dotAt(index: number) {
  const render = (props: { index: number; cx?: number | string; cy?: number | string }) =>
    props.index === index && props.cx !== undefined && props.cy !== undefined ? (
      <circle key="dot-at" cx={Number(props.cx)} cy={Number(props.cy)} r={4} fill={VIZ.accent} stroke="var(--color-surface)" strokeWidth={2} />
    ) : null;
  return render;
}

export default function ExpenseGroupAnalysis({
  refreshKey = 0,
  preferredGroup,
}: {
  refreshKey?: number;
  /** Nhóm chi nhiều nhất của trang — mở sẵn nhóm này thay vì nhóm đầu bảng chữ cái. */
  preferredGroup?: string;
}) {
  const { t, language } = useLanguage();
  const vi = language === "vi";
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
  //
  // Mặc định là nhóm chi nhiều nhất (`preferredGroup`): nhóm đầu bảng chữ cái
  // thường là nhóm hai năm không tiêu đồng nào, mở ra chỉ thấy "chưa có dữ
  // liệu". Người dùng đã tự chọn thì không giành lại.
  const [picked, setPicked] = useState(false);
  const groupsKey = `${groupNames.join("|")}#${preferredGroup ?? ""}`;
  const [lastGroupsKey, setLastGroupsKey] = useState("");
  if (groupNames.length > 0 && groupsKey !== lastGroupsKey) {
    setLastGroupsKey(groupsKey);
    const fallback = preferredGroup && groupNames.includes(preferredGroup) ? preferredGroup : groupNames[0];
    if (!group || !groupNames.includes(group) || !picked) setGroup(fallback);
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
  const noneLabel = t("no sub-category", "chưa có danh mục con");
  const subLabel = (s: string) => (s === NONE_KEY ? noneLabel : s === REST_KEY ? t("Other", "Khác") : s);
  const money = (v: number) => compactMoney(v, vi);

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 md:p-6">
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
              onChange={(e) => {
                setPicked(true);
                setGroup(e.target.value);
              }}
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
        <div className="flex flex-col gap-8">
          {!data.hasAnyData ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t(
                `No spending recorded for ${label(group)} in the last two years.`,
                `Hai năm qua chưa ghi khoản chi nào cho nhóm ${label(group)}.`
              )}
            </p>
          ) : (
            <GroupCharts
              data={data}
              groupLabel={label(group)}
              vi={vi}
              money={money}
              subLabel={subLabel}
              noneLabel={noneLabel}
              activeSub={activeSub}
              setActiveSub={setActiveSub}
            />
          )}
        </div>
      )}
    </div>
  );
}

function GroupCharts({
  data,
  groupLabel: G,
  vi,
  money,
  subLabel,
  noneLabel,
  activeSub,
  setActiveSub,
}: {
  data: GroupData;
  groupLabel: string;
  vi: boolean;
  money: (v: number) => string;
  subLabel: (s: string) => string;
  noneLabel: string;
  activeSub: string | null;
  setActiveSub: (s: string | null) => void;
}) {
  const { t } = useLanguage();
  const mm = monthShort(data.month, vi);
  const prevYear = data.year - 1;

  // --- 1. 24 tháng theo danh mục con --------------------------------------------
  // API đã xếp danh mục con theo tổng CẢ cửa sổ 24 tháng — thứ tự cố định, nên
  // màu đi theo danh mục con chứ không đổi theo từng tháng. Bốn cái đầu mỗi cái
  // một màu, phần đuôi gộp "Khác".
  const topSubs = data.subNames.slice(0, 4);
  const restSubs = data.subNames.slice(4);
  const stackKeys = restSubs.length > 0 ? [...topSubs, REST_KEY] : topSubs;
  const colorOf = (sub: string) => {
    const i = topSubs.indexOf(sub);
    return i >= 0 ? catColor(i) : VIZ.other;
  };
  const series = data.monthlySeries.map((row) => {
    const out: MonthRow = { name: row.name, amount: row.amount, count: row.count };
    for (const s of topSubs) out[s] = Number(row[s]) || 0;
    if (restSubs.length > 0) out[REST_KEY] = restSubs.reduce((sum, s) => sum + (Number(row[s]) || 0), 0);
    return out;
  });
  const cur = series.length - 1;
  const curRow = series[cur];
  const avg24 = series.length > 0 ? series.reduce((s, r) => s + (Number(r.amount) || 0), 0) / series.length : 0;
  const vsAvg = pctChange(data.current.total, avg24);
  const stackHeadline =
    data.current.total <= 0
      ? t(
          `Nothing in ${G} in ${mm} — it usually runs ${money(avg24)} a month`,
          `${mm} chưa có khoản nào thuộc ${G} — bình thường khoảng ${money(avg24)} một tháng`
        )
      : vsAvg === null || vsAvg === 0
        ? t(`${G} in ${mm}: ${money(data.current.total)}, right on its 24-month average`, `${G} ${mm}: ${money(data.current.total)}, đúng mức trung bình 24 tháng`)
        : t(
            `${G} in ${mm}: ${money(data.current.total)}, ${Math.abs(vsAvg)}% ${vsAvg > 0 ? "above" : "below"} its 24-month average`,
            `${G} ${mm}: ${money(data.current.total)}, ${vsAvg > 0 ? "cao hơn" : "thấp hơn"} trung bình 24 tháng ${Math.abs(vsAvg)}%`
          );
  const single = stackKeys.length <= 1;
  const topKeyAtCur = curRow ? [...stackKeys].reverse().find((k) => (Number(curRow[k]) || 0) > 0) : undefined;
  const lastStackKey = stackKeys[stackKeys.length - 1];

  // --- 2. Luỹ kế năm nay vs năm trước -------------------------------------------
  const curIdx = Math.max(0, Number(data.month.slice(5, 7)) - 1);
  const cumNow = data.cumulative[curIdx]?.thisYear ?? 0;
  const cumThen = data.cumulative[curIdx]?.lastYear ?? 0;
  const cumPct = change(cumNow, cumThen);
  const cumHeadline =
    cumNow === 0 && cumThen === 0
      ? t(`Nothing in ${G} yet in ${data.year} or by this point in ${prevYear}`, `${G} chưa có khoản nào trong ${data.year}, cùng kỳ ${prevYear} cũng không`)
      : cumPct === null
        ? t(
            `${money(cumNow)} on ${G} in ${data.year} so far — nothing by this point in ${prevYear}`,
            `${data.year} tới ${mm} đã chi ${money(cumNow)} cho ${G} — cùng kỳ ${prevYear} chưa có gì`
          )
        : cumPct === 0
          ? t(`${data.year} is level with ${prevYear} on ${G} at this point`, `${G}: ${data.year} tới ${mm} ngang đúng cùng kỳ ${prevYear}`)
          : t(
              `${data.year} has spent ${Math.abs(cumPct)}% ${cumPct > 0 ? "more" : "less"} on ${G} than ${prevYear} had by ${mm}`,
              `${data.year} tới ${mm} chi cho ${G} ${cumPct > 0 ? "nhiều" : "ít"} hơn cùng kỳ ${prevYear} ${Math.abs(cumPct)}%`
            );
  const nearEnd = curIdx >= 9;

  // --- 3. Mùa vụ ----------------------------------------------------------------
  const hot = argmax(data.seasonality.map((s) => s.avg));
  const seasonHeadline =
    hot < 0
      ? t("No pattern yet — not enough history", "Chưa đủ dữ liệu để thấy mùa vụ")
      : t(
          `${monthShort(data.seasonality[hot].name, vi)} runs hottest — ${money(data.seasonality[hot].avg)} on average`,
          `${monthShort(data.seasonality[hot].name, vi)} thường tốn nhất — trung bình ${money(data.seasonality[hot].avg)}`
        );

  // --- 4. Tỷ trọng trong tổng chi --------------------------------------------
  const shareLast = data.shareOfTotal.length - 1;
  const shareNow = data.shareOfTotal[shareLast]?.pct ?? 0;
  const shareAvg =
    data.shareOfTotal.length > 0
      ? Math.round(data.shareOfTotal.reduce((s, p) => s + p.pct, 0) / data.shareOfTotal.length)
      : 0;
  const shareHeadline = t(
    `${G} was ${shareNow}% of all spending in ${mm}, against ${shareAvg}% on average`,
    `${G} chiếm ${shareNow}% tổng chi ${mm}, trung bình là ${shareAvg}%`
  );

  // --- 5. Cỡ khoản chi -----------------------------------------------------------
  const sizeTotal = data.sizeBuckets.reduce((s, b) => s + b.count, 0);
  const commonSize = argmax(data.sizeBuckets.map((b) => b.count));
  const sizeHeadline =
    commonSize < 0
      ? t("No transactions in the last 12 months", "12 tháng qua chưa có giao dịch nào")
      : t(
          `Most payments are ${data.sizeBuckets[commonSize].name} — ${data.sizeBuckets[commonSize].count} of ${sizeTotal}`,
          `Phần lớn là khoản ${data.sizeBuckets[commonSize].name} — ${data.sizeBuckets[commonSize].count}/${sizeTotal} giao dịch`
        );
  const sizeRows: BarRow[] = data.sizeBuckets.map((b, i) => ({
    key: b.name,
    name: b.name,
    value: b.count,
    display: `${b.count}`,
    color: i === commonSize ? VIZ.accent : VIZ.muted,
    strong: i === commonSize,
    note: b.amount > 0 ? money(b.amount) : undefined,
  }));

  // --- 6. Thứ trong tuần (thứ Hai trước) --------------------------------------
  const week = [...data.weekday.slice(1), ...data.weekday.slice(0, 1)].map((w) => ({
    ...w,
    label: vi ? w.name : WEEKDAY_EN[w.name] ?? w.name,
  }));
  const weekSum = week.reduce((s, w) => s + Math.max(0, w.amount), 0);
  const heavy = argmax(week.map((w) => w.amount));
  const weekHeadline =
    heavy < 0
      ? t("No spending in the last 12 months", "12 tháng qua chưa có khoản chi nào")
      : t(
          `${week[heavy].label} carries the most — ${Math.round((week[heavy].amount / Math.max(1, weekSum)) * 100)}% of the amount`,
          `${week[heavy].label} chi nhiều nhất — ${Math.round((week[heavy].amount / Math.max(1, weekSum)) * 100)}% số tiền`
        );

  // --- 7. Danh mục con trong năm & nơi chi -----------------------------------
  const topSubYear = data.subGroupsYear[0];
  const subYearHeadline = topSubYear
    ? t(
        `${topSubYear.name || noneLabel} is ${topSubYear.share}% of ${G} in ${data.year}`,
        `${topSubYear.name || noneLabel} chiếm ${topSubYear.share}% nhóm ${G} năm ${data.year}`
      )
    : t(`Sub-categories in ${data.year}`, `Danh mục con năm ${data.year}`);
  const subYearRows: BarRow[] = data.subGroupsYear.map((s, i) => ({
    key: s.name || NONE_KEY,
    name: s.name || noneLabel,
    value: s.amount,
    display: formatVND(s.amount),
    color: i === 0 ? VIZ.accent : VIZ.muted,
    strong: i === 0,
    note: `${s.share}%`,
  }));
  const topMerchant = data.merchants[0];
  const merchantHeadline = topMerchant
    ? t(
        `${topMerchant.name || t("(no name)", "(chưa đặt tên)")} took the most of ${G} in ${data.year} — ${topMerchant.share}%`,
        `${topMerchant.name || "(chưa đặt tên)"} nhận nhiều nhất nhóm ${G} năm ${data.year} — ${topMerchant.share}%`
      )
    : t(`Where the money went in ${data.year}`, `Chi cho ai năm ${data.year}`);
  const merchantRows: BarRow[] = data.merchants.map((m, i) => ({
    key: m.name || NONE_KEY,
    name: m.name || t("(no name)", "(chưa đặt tên)"),
    value: m.amount,
    display: formatVND(m.amount),
    color: i === 0 ? VIZ.accent : VIZ.muted,
    strong: i === 0,
    note: `${m.count}×`,
  }));

  return (
    <>
      {/* Bốn con số: tháng đang xem là ô chính; ba ô còn lại là mốc so sánh,
          mỗi ô kèm mũi tên "tháng này so với mốc đó". */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatTile
          emphasis
          label={`${t("This month", "Tháng này")} · ${data.month}`}
          value={formatVND(data.current.total)}
          note={`${data.current.count} ${t("transactions", "giao dịch")}${
            data.current.count > 0 ? ` · ${t("avg", "BQ")} ${formatVND(data.current.avg)}` : ""
          }`}
        />
        <StatTile
          label={`${t("Last month", "Tháng trước")} · ${data.prevMonth.label}`}
          value={formatVND(data.prevMonth.total)}
          delta={<Delta pct={change(data.current.total, data.prevMonth.total)} upIsGood={false} vs={t(`${mm} vs this`, `${mm} so với số này`)} />}
        />
        <StatTile
          label={`${t("Same month last year", "Cùng kỳ năm trước")} · ${data.lastYearMonth.label}`}
          value={formatVND(data.lastYearMonth.total)}
          delta={<Delta pct={change(data.current.total, data.lastYearMonth.total)} upIsGood={false} vs={t(`${mm} vs this`, `${mm} so với số này`)} />}
        />
        <StatTile
          label={`${t("Year to date", "Luỹ kế năm")} ${data.year}`}
          value={formatVND(data.ytd.total)}
          delta={<Delta pct={change(data.ytd.total, data.lastYtd.total)} upIsGood={false} vs={t(`vs same period ${prevYear}`, `so cùng kỳ ${prevYear}`)} />}
        />
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

      {/* 1 — 24 tháng. Nhiều danh mục con: cột chồng, màu theo danh mục con.
          Một danh mục con: cột xám, tháng đang xem màu nhấn. */}
      <Panel
        title={stackHeadline}
        subtitle={
          single
            ? t(`Spending per month, 24 months to ${data.month} · number = ${mm}`, `Chi mỗi tháng, 24 tháng tới ${data.month} · số trên cột = ${mm}`)
            : t(
                `Spending per month by sub-category, 24 months to ${data.month} · number = ${mm} total · hover a band for its dates`,
                `Chi mỗi tháng theo danh mục con, 24 tháng tới ${data.month} · số trên cột = tổng ${mm} · rê vào một khúc để xem ngày phát sinh`
              )
        }
        keys={single ? undefined : stackKeys.map((k) => ({ label: subLabel(k), color: colorOf(k), shape: "bar" as const }))}
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...monthAxis(series.map((d) => String(d.name)))} />
              <YAxis {...yAxis(money)} />
              <Tooltip
                {...TOOLTIP}
                content={
                  <StackTooltip
                    details={data.details}
                    activeSub={activeSub}
                    colorOf={colorOf}
                    noneLabel={noneLabel}
                    moreLabel={t("more", "khoản nữa")}
                  />
                }
              />
              {single ? (
                <Bar dataKey="amount" {...BAR} fill={VIZ.muted} label={barLabelAt(series, "amount", cur, money)}>
                  {series.map((r, i) => (
                    <Cell key={String(r.name)} fill={i === cur ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
              ) : (
                stackKeys.map((sub) => (
                  <Bar
                    key={sub}
                    dataKey={sub}
                    stackId="sub"
                    name={subLabel(sub)}
                    fill={colorOf(sub)}
                    {...STACK_GAP}
                    maxBarSize={BAR.maxBarSize}
                    radius={sub === lastStackKey ? BAR.radius : 0}
                    onMouseEnter={() => setActiveSub(sub === REST_KEY ? null : sub)}
                    onMouseLeave={() => setActiveSub(null)}
                    label={sub === topKeyAtCur ? stackTotalAt(drawnIndex(series, sub, cur), data.current.total, money) : undefined}
                  />
                ))
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 2 — Luỹ kế: năm nay màu nhấn, năm trước xám; tên năm ghi ngay đầu
            mút đường thay cho chú giải. */}
        <Panel
          title={cumHeadline}
          subtitle={t(`Running total of ${G}, ${data.year} against ${prevYear}`, `Luỹ kế ${G}, ${data.year} so với ${prevYear}`)}
          keys={[
            { label: String(data.year), color: VIZ.accent, shape: "line" },
            { label: String(prevYear), color: VIZ.muted, shape: "line" },
          ]}
        >
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.cumulative} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...xAxis} interval={0} tickFormatter={(v) => String(Number(v))} />
                <YAxis {...yAxis(money)} />
                <Tooltip
                  {...TOOLTIP_LINE}
                  formatter={(v, n) => [formatVND(Number(v) || 0), n]}
                  labelFormatter={(l) => monthShort(String(l), vi)}
                />
                <Line
                  {...LINE}
                  dataKey="lastYear"
                  name={String(prevYear)}
                  stroke={VIZ.muted}
                  label={labelAt(11, money, { anchor: "end" })}
                />
                <Line
                  {...LINE}
                  dataKey="thisYear"
                  name={String(data.year)}
                  stroke={VIZ.accent}
                  connectNulls={false}
                  label={labelAt(curIdx, money, { anchor: nearEnd ? "end" : "middle" })}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* 3 — Mùa vụ: tháng cao nhất màu nhấn + ghi số, không trục Y. */}
        <Panel
          title={seasonHeadline}
          subtitle={t(
            "Average per calendar month, across every year on record",
            "Trung bình mỗi tháng trong năm, gộp mọi năm đã có dữ liệu"
          )}
        >
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.seasonality} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="name" {...xAxis} interval={0} tickFormatter={(v) => String(Number(v))} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v) => [formatVND(Number(v) || 0), t("Average", "Trung bình")]}
                  labelFormatter={(l) => monthShort(String(l), vi)}
                />
                <Bar dataKey="avg" {...BAR} fill={VIZ.muted} label={barLabelAt(data.seasonality, "avg", hot, money)}>
                  {data.seasonality.map((s, i) => (
                    <Cell key={s.name} fill={i === hot ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* 4 — Tỷ trọng: một đường xám, tháng đang xem chấm màu nhấn + ghi số,
            đường trung bình nét đứt ghi nhãn tại chỗ. */}
        <Panel
          title={shareHeadline}
          subtitle={t(
            `${G} as a share of everything spent each month · dashed line = average`,
            `${G} chiếm bao nhiêu phần trăm tổng chi mỗi tháng · nét đứt = trung bình`
          )}
        >
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.shareOfTotal} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...monthAxis(data.shareOfTotal.map((d) => d.name))} />
                <YAxis {...yAxis((v) => `${v}%`, 36)} />
                <Tooltip {...TOOLTIP_LINE} formatter={(v) => [`${v}%`, t("Share", "Tỷ trọng")]} />
                {shareAvg > 0 && (
                  <ReferenceLine
                    y={shareAvg}
                    stroke={VIZ.muted}
                    strokeDasharray="4 3"
                    label={refLabel(`${t("avg", "TB")} ${shareAvg}%`)}
                  />
                )}
                <Line
                  {...LINE}
                  dataKey="pct"
                  name={t("Share", "Tỷ trọng")}
                  stroke={VIZ.muted}
                  dot={dotAt(shareLast)}
                  label={labelAt(shareLast, (v) => `${v}%`, { anchor: "end" })}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* 5 — Cỡ khoản chi: thang cỡ có thứ tự, nên giữ thứ tự chứ không xếp
            hạng; cột ngang để nhãn "100k – 500k" không bị chen ở khổ 375px. */}
        <Panel
          title={sizeHeadline}
          subtitle={t(
            "Number of transactions by size, last 12 months · grey figure = amount",
            "Số giao dịch theo cỡ khoản, 12 tháng gần nhất · số mờ = tổng tiền"
          )}
        >
          <BarRows rows={sizeRows} />
        </Panel>

        {/* 6 — Thứ trong tuần */}
        <Panel
          title={weekHeadline}
          subtitle={t("Spending by day of the week, last 12 months", "Chi theo thứ trong tuần, 12 tháng gần nhất")}
        >
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="label" {...xAxis} interval={0} />
                <Tooltip
                  {...TOOLTIP}
                  formatter={(v, n, item) => [
                    `${formatVND(Number(v) || 0)} · ${
                      (item?.payload as { count?: number })?.count || 0
                    } ${t("transactions", "giao dịch")}`,
                    t("Spending", "Số tiền"),
                  ]}
                />
                <Bar dataKey="amount" {...BAR} fill={VIZ.muted} label={barLabelAt(week, "amount", heavy, money)}>
                  {week.map((w, i) => (
                    <Cell key={w.name} fill={i === heavy ? VIZ.accent : VIZ.muted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* 7 — Danh mục con trong năm */}
        <Panel title={subYearHeadline} subtitle={t(`Sub-categories of ${G}, ${data.year}`, `Danh mục con của ${G}, năm ${data.year}`)}>
          {subYearRows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Nothing recorded this year.", "Năm nay chưa ghi khoản nào.")}
            </p>
          ) : (
            <BarRows rows={subYearRows} />
          )}
        </Panel>
      </div>

      <Panel title={merchantHeadline} subtitle={t(`Who got paid from ${G}, ${data.year}`, `Chi cho ai trong nhóm ${G}, năm ${data.year}`)}>
        {merchantRows.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("Nothing recorded this year.", "Năm nay chưa ghi khoản nào.")}
          </p>
        ) : (
          <BarRows rows={merchantRows} />
        )}
      </Panel>
    </>
  );
}
