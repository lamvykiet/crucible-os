"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Flame, Loader2, Smile, TrendingUp } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { VIZ } from "@/lib/viz";
import ChartCard, { StatTile } from "@/components/charts/ChartCard";
import {
  PERIODS, UNITS, WEEKDAY_LABELS, addDays, colorVar, dayKey, monthDays, tintVar, weekStart,
} from "@/lib/habits";
import HabitsNav from "@/components/habits/HabitsNav";
import type { ReportHabit } from "@/components/habits/types";

interface Insights {
  percent: number;
  bestWeekday: number | null;
  worstWeekday: number | null;
  weekdayRates: (number | null)[];
  longestStreak: number;
  moodOnFullDays: number | null;
  moodOnOtherDays: number | null;
}

interface Report {
  success: boolean;
  range: string;
  anchor: string;
  today: string;
  days: string[];
  habits: ReportHabit[];
  insights: Insights;
  error?: string;
  /** `${range}|${anchor}` của lượt gọi — để biết kỳ trước đang giữ có khớp không. */
  reqKey?: string;
}

/** Kỳ ngay trước, chỉ để so trong câu tiêu đề. */
interface PrevPeriod {
  reqKey: string;
  percent: number;
  scheduled: number;
}

type Range = "week" | "month" | "year";

/** Tên đầy đủ của thứ cho câu tiêu đề; nhãn trục vẫn dùng WEEKDAY_LABELS. */
const WEEKDAY_FULL = [
  { en: "Sunday", vi: "Chủ nhật" },
  { en: "Monday", vi: "Thứ Hai" },
  { en: "Tuesday", vi: "Thứ Ba" },
  { en: "Wednesday", vi: "Thứ Tư" },
  { en: "Thursday", vi: "Thứ Năm" },
  { en: "Friday", vi: "Thứ Sáu" },
  { en: "Saturday", vi: "Thứ Bảy" },
];

/** Dời mốc một kỳ về trước (dir < 0) hoặc về sau. */
function shiftAnchor(range: Range, anchor: string, dir: number) {
  if (range === "week") return addDays(anchor, dir * 7);
  if (range === "month") {
    const days = monthDays(anchor);
    return dir < 0 ? addDays(days[0], -1) : addDays(days[days.length - 1], 1);
  }
  const year = Number(anchor.slice(0, 4)) + dir;
  return `${year}-${anchor.slice(5)}`;
}

/** Màu một ô lưới theo trạng thái máy chủ trả về. */
function cellStyle(state: number, color: string) {
  if (state === 2) return { background: colorVar(color) };
  if (state === 1) return { background: tintVar(color) };
  if (state === 3) return { background: "var(--color-surface-3)" };
  if (state === -1) return { background: "var(--color-surface-2)", opacity: 0.4 };
  return { background: "var(--color-surface-2)" };
}

/**
 * Báo cáo tuần / tháng / năm.
 *
 * Lưới ô vuông là cách duy nhất nhìn ra *hình dạng* của một thói quen: 83% nghe
 * như nhau, nhưng "đều đặn cả năm" và "chăm ba tháng rồi bỏ" là hai câu chuyện
 * khác hẳn, và chỉ lưới mới kể được.
 */
export default function HabitReports() {
  const { t } = useLanguage();

  const [range, setRange] = useState<Range>("week");
  const [anchor, setAnchor] = useState(() => dayKey());
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prev, setPrev] = useState<PrevPeriod | null>(null);

  const load = useCallback(() => {
    const reqKey = `${range}|${anchor}`;
    fetch(`/api/habits/reports?range=${range}&date=${anchor}`)
      .then((r) => r.json())
      .then((json: Report) => {
        if (!json?.success) throw new Error(json?.error || "Không tải được báo cáo");
        setData({ ...json, reqKey });
        setError(null);
      })
      .catch((e) => setError(e.message));
    // Kỳ trước chỉ để có câu so sánh ở tiêu đề. Con số do máy chủ tính (cùng
    // công thức), ở đây không tính lại; lỗi thì tiêu đề bỏ vế so sánh.
    fetch(`/api/habits/reports?range=${range}&date=${shiftAnchor(range, anchor, -1)}`)
      .then((r) => r.json())
      .then((json: Report) => {
        if (!json?.success) throw new Error(json?.error);
        setPrev({
          reqKey,
          percent: json.insights.percent,
          scheduled: json.habits.reduce((sum, h) => sum + h.scheduled, 0),
        });
      })
      .catch(() => setPrev(null));
  }, [range, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  // Báo cáo đang hiện thuộc dải khác = vẫn đang tải dải vừa chọn.
  const loading = data === null || data.range !== range;

  const shift = (dir: number) => setAnchor(shiftAnchor(range, anchor, dir));

  const today = data?.today ?? dayKey();
  const label =
    range === "week"
      ? `${weekStart(anchor).slice(5)} → ${addDays(weekStart(anchor), 6).slice(5)}`
      : range === "month"
        ? anchor.slice(0, 7)
        : anchor.slice(0, 4);

  const insights = data?.insights;
  const columns = range === "year" ? 31 : range === "month" ? 31 : 7;

  // --- Câu kết luận cho thẻ tóm tắt (docs/bieu-do.md §1) ---------------------
  const isCurrent =
    range === "week"
      ? weekStart(anchor) === weekStart(today)
      : range === "month"
        ? anchor.slice(0, 7) === today.slice(0, 7)
        : anchor.slice(0, 4) === today.slice(0, 4);
  const periodVi = isCurrent
    ? { week: "Tuần này", month: "Tháng này", year: "Năm nay" }[range]
    : { week: `Tuần ${label}`, month: `Tháng ${label}`, year: `Năm ${label}` }[range];
  const periodEn = isCurrent
    ? { week: "this week", month: "this month", year: "this year" }[range]
    : { week: `in week ${label}`, month: `in ${label}`, year: `in ${label}` }[range];
  const prevVi = { week: "tuần trước", month: "tháng trước", year: "năm trước" }[range];
  const prevEn = isCurrent
    ? { week: "last week", month: "last month", year: "last year" }[range]
    : { week: "the week before", month: "the month before", year: "the year before" }[range];

  const scheduledNow = (data?.habits ?? []).reduce((sum, h) => sum + h.scheduled, 0);
  const cmp = prev && data && prev.reqKey === data.reqKey && prev.scheduled > 0 ? prev.percent : null;
  const summaryTitle = !insights
    ? ""
    : scheduledNow === 0
      ? t(`Nothing was scheduled ${periodEn}`, `${periodVi} không có lần nào theo lịch`)
      : (() => {
          const p = insights.percent;
          const head = t(`${p}% of scheduled targets hit ${periodEn}`, `${periodVi} đạt ${p}% số lần có lịch`);
          if (cmp === null) return head;
          if (p === cmp) return t(`${head} — level with ${prevEn}`, `${head} — ngang ${prevVi}`);
          return p > cmp
            ? t(`${head} — up from ${cmp}% ${prevEn}`, `${head} — cao hơn ${prevVi} (${cmp}%)`)
            : t(`${head} — down from ${cmp}% ${prevEn}`, `${head} — thấp hơn ${prevVi} (${cmp}%)`);
        })();

  // --- Câu kết luận cho biểu đồ theo thứ -------------------------------------
  const rates = insights?.weekdayRates ?? [];
  const bestRate = insights?.bestWeekday != null ? rates[insights.bestWeekday] : null;
  const ratedCount = rates.filter((v) => v !== null).length;
  const tied = bestRate === null ? [] : rates.flatMap((v, i) => (v === bestRate ? [i] : []));
  // Mọi thứ bằng nhau thì không có gì nổi lên — để xám hết, không nhấn.
  const allEqual = tied.length === ratedCount && ratedCount > 1;
  const accentDays = bestRate && !allEqual ? tied : [];
  const weekdayTitle =
    bestRate === null || bestRate === undefined
      ? t("Completion by weekday", "Tỷ lệ đạt theo thứ trong tuần")
      : bestRate === 0
        ? t("No weekday has hit its target yet", "Chưa thứ nào đạt chỉ tiêu")
        : allEqual
          ? t(`Every scheduled weekday at ${bestRate}%`, `Mọi thứ có lịch đều đạt ${bestRate}%`)
          : tied.length > 1
            ? t(
                `${tied.map((i) => WEEKDAY_LABELS[i].en).join(", ")} tie for best — ${bestRate}%`,
                `${tied.map((i) => WEEKDAY_LABELS[i].vi).join(", ")} cùng cao nhất — ${bestRate}%`
              )
            : t(
                `${WEEKDAY_FULL[tied[0]].en} is your most reliable day — ${bestRate}%`,
                `${WEEKDAY_FULL[tied[0]].vi} là ngày đều nhất — đạt ${bestRate}%`
              );

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-28">
      <header className="pt-2">
        <h1 className="c-h2">{t("Habit reports", "Báo cáo thói quen")}</h1>
        <p className="c-card-body">
          {t("The shape of it, not just the number.", "Nhìn hình dạng, không chỉ nhìn con số.")}
        </p>
      </header>

      <HabitsNav />

      <div className="flex items-center gap-2">
        <div className="c-seg flex-1">
          {[
            { value: "week", en: "Week", vi: "Tuần" },
            { value: "month", en: "Month", vi: "Tháng" },
            { value: "year", en: "Year", vi: "Năm" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value as typeof range)}
              className={`c-seg-opt flex-1 ${range === opt.value ? "active" : ""}`}
            >
              {t(opt.en, opt.vi)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => shift(-1)}
          aria-label={t("Previous", "Trước")}
          className="w-11 h-11 grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold tabular-nums">{label}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor(today)} className="c-btn c-btn-secondary c-btn-sm">
            {t("Today", "Hôm nay")}
          </button>
          <button
            onClick={() => shift(1)}
            aria-label={t("Next", "Sau")}
            className="w-11 h-11 grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={16} className="icon" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="c-card h-40 grid place-content-center text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Ba con số tóm tắt — tỷ lệ chung là ô chính, hai ô còn lại là bối cảnh */}
          {insights && (
            <ChartCard
              title={summaryTitle}
              subtitle={t(
                `Targets hit out of scheduled check-ins, all habits, ${label}`,
                `Số lần đạt chỉ tiêu trên số lần có lịch, mọi thói quen, ${label}`
              )}
            >
              <div className="grid grid-cols-3 gap-2">
                <StatTile
                  emphasis
                  label={
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp size={11} aria-hidden /> {t("Overall", "Tổng thể")}
                    </span>
                  }
                  value={`${insights.percent}%`}
                  note={cmp === null ? undefined : t(`${prevEn}: ${cmp}%`, `${prevVi}: ${cmp}%`)}
                />
                <StatTile
                  label={
                    <span className="inline-flex items-center gap-1">
                      <Flame size={11} aria-hidden /> {t("Best streak", "Chuỗi dài nhất")}
                    </span>
                  }
                  value={insights.longestStreak}
                />
                <StatTile
                  label={t("Best day", "Ngày tốt nhất")}
                  value={
                    insights.bestWeekday === null
                      ? "—"
                      : t(WEEKDAY_LABELS[insights.bestWeekday].en, WEEKDAY_LABELS[insights.bestWeekday].vi)
                  }
                />
              </div>
            </ChartCard>
          )}

          {/* Tỷ lệ theo thứ: cột xám, ngày tiêu đề nói tới màu nhấn và là cột
              duy nhất ghi số. Không trục Y, không lưới — một đường gốc. */}
          {insights && insights.weekdayRates.some((v) => v !== null) && (
            <ChartCard
              title={weekdayTitle}
              subtitle={t(
                `Share of scheduled days that hit the target, by weekday, ${label}`,
                `Tỷ lệ ngày có lịch đạt chỉ tiêu, theo thứ trong tuần, ${label}`
              )}
              footnote={
                insights.worstWeekday !== null && insights.bestWeekday !== insights.worstWeekday
                  ? t(
                      `Hardest day so far: ${WEEKDAY_LABELS[insights.worstWeekday].en}. Consider a smaller target there instead of skipping it.`,
                      `Khó nhất đang là ${WEEKDAY_LABELS[insights.worstWeekday].vi}. Hạ chỉ tiêu ngày đó xuống còn hơn là bỏ hẳn.`
                    )
                  : undefined
              }
            >
              <div role="img" aria-label={weekdayTitle} className="pt-5">
                <div className="flex items-end gap-1.5 h-24 border-b border-[var(--viz-grid)]">
                  {insights.weekdayRates.map((v, i) => {
                    const lit = accentDays.includes(i);
                    return (
                      <div
                        key={i}
                        className="relative flex-1 h-full min-w-0 flex items-end justify-center"
                        title={v === null ? undefined : `${t(WEEKDAY_FULL[i].en, WEEKDAY_FULL[i].vi)}: ${v}%`}
                      >
                        {v !== null && v > 0 && (
                          <div
                            className="relative w-full max-w-6 rounded-t-[4px]"
                            style={{ height: `${v}%`, minHeight: 2, background: lit ? VIZ.accent : VIZ.muted }}
                          >
                            {i === insights.bestWeekday && (
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[11px] font-bold tabular-nums text-[var(--color-text)] whitespace-nowrap">
                                {v}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {insights.weekdayRates.map((v, i) => (
                    <span
                      key={i}
                      className={`flex-1 min-w-0 text-center text-[11px] ${
                        accentDays.includes(i)
                          ? "font-bold text-[var(--color-text)]"
                          : v === null
                            ? "text-[var(--color-text-faint)] opacity-50"
                            : "text-[var(--color-text-faint)]"
                      }`}
                    >
                      {t(WEEKDAY_LABELS[i].en, WEEKDAY_LABELS[i].vi)}
                    </span>
                  ))}
                </div>
              </div>
            </ChartCard>
          )}

          {/* Tâm trạng */}
          {insights?.moodOnFullDays != null && insights.moodOnOtherDays != null && (
            <section className="c-card flex items-center gap-3">
              <Smile size={20} className="text-[var(--color-accent)] flex-none" />
              <p className="text-sm">
                {t(
                  `Mood averages ${insights.moodOnFullDays}/5 on days you finish everything, ${insights.moodOnOtherDays}/5 otherwise.`,
                  `Ngày làm đủ mọi thứ, tâm trạng trung bình ${insights.moodOnFullDays}/5; ngày còn lại ${insights.moodOnOtherDays}/5.`
                )}
              </p>
            </section>
          )}

          {/* Lưới từng thói quen */}
          {(data?.habits ?? []).map((habit) => {
            const unit = UNITS.find((u) => u.value === habit.unit);
            const period = PERIODS.find((p) => p.value === habit.period);
            return (
              <section key={habit.id} className="c-card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{habit.name}</p>
                    <p className="c-stat-label">
                      {habit.target.toLocaleString("vi-VN")} {t(unit?.en ?? "", unit?.vi ?? "")}{" "}
                      {t(period?.en ?? "", period?.vi ?? "")}
                      {habit.streak > 0 && ` · ${t("streak", "chuỗi")} ${habit.streak}`}
                    </p>
                  </div>
                  <span className="c-stat-value text-right">{habit.percent}%</span>
                </div>

                <div
                  className="grid gap-[3px]"
                  style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                  {habit.cells.map((state, i) => (
                    <span
                      key={i}
                      title={`${data?.days[i]}`}
                      className="aspect-square rounded-[3px]"
                      style={cellStyle(state, habit.color)}
                    />
                  ))}
                </div>

                <p className="c-help">
                  {t(
                    `${habit.done} of ${habit.scheduled} scheduled · ${habit.total.toLocaleString("vi-VN")} ${unit?.en ?? ""} in total`,
                    `Đạt ${habit.done}/${habit.scheduled} lần có lịch · tổng ${habit.total.toLocaleString("vi-VN")} ${unit?.vi ?? ""}`
                  )}
                </p>
              </section>
            );
          })}

          {data?.habits.length === 0 && (
            <section className="c-card text-center py-10">
              <p className="c-card-body">
                {t(
                  "Nothing to report yet — create a habit and give it a few days.",
                  "Chưa có gì để báo cáo — tạo một thói quen và cho nó vài ngày."
                )}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
