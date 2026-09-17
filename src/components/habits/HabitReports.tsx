"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Flame, Loader2, Smile, TrendingUp } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
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

  const [range, setRange] = useState<"week" | "month" | "year">("week");
  const [anchor, setAnchor] = useState(() => dayKey());
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/habits/reports?range=${range}&date=${anchor}`)
      .then((r) => r.json())
      .then((json: Report) => {
        if (!json?.success) throw new Error(json?.error || "Không tải được báo cáo");
        setData(json);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [range, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  // Báo cáo đang hiện thuộc dải khác = vẫn đang tải dải vừa chọn.
  const loading = data === null || data.range !== range;

  const shift = (dir: number) => {
    if (range === "week") return setAnchor(addDays(anchor, dir * 7));
    if (range === "month") {
      const days = monthDays(anchor);
      return setAnchor(dir < 0 ? addDays(days[0], -1) : addDays(days[days.length - 1], 1));
    }
    const year = Number(anchor.slice(0, 4)) + dir;
    setAnchor(`${year}-${anchor.slice(5)}`);
  };

  const today = data?.today ?? dayKey();
  const label =
    range === "week"
      ? `${weekStart(anchor).slice(5)} → ${addDays(weekStart(anchor), 6).slice(5)}`
      : range === "month"
        ? anchor.slice(0, 7)
        : anchor.slice(0, 4);

  const insights = data?.insights;
  const columns = range === "year" ? 31 : range === "month" ? 31 : 7;

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
          {/* Ba con số tóm tắt */}
          {insights && (
            <section className="grid grid-cols-3 gap-2">
              <div className="c-card p-4">
                <p className="c-card-kicker flex items-center gap-1">
                  <TrendingUp size={12} /> {t("Overall", "Tổng thể")}
                </p>
                <p className="c-stat-value">{insights.percent}%</p>
              </div>
              <div className="c-card p-4">
                <p className="c-card-kicker flex items-center gap-1">
                  <Flame size={12} /> {t("Best streak", "Chuỗi dài nhất")}
                </p>
                <p className="c-stat-value">{insights.longestStreak}</p>
              </div>
              <div className="c-card p-4">
                <p className="c-card-kicker">{t("Best day", "Ngày tốt nhất")}</p>
                <p className="c-stat-value">
                  {insights.bestWeekday === null
                    ? "—"
                    : t(WEEKDAY_LABELS[insights.bestWeekday].en, WEEKDAY_LABELS[insights.bestWeekday].vi)}
                </p>
              </div>
            </section>
          )}

          {/* Tỷ lệ theo thứ trong tuần */}
          {insights && insights.weekdayRates.some((v) => v !== null) && (
            <section className="c-card space-y-3">
              <p className="c-card-kicker">{t("By weekday", "Theo thứ trong tuần")}</p>
              <div className="flex items-end gap-1.5 h-24">
                {insights.weekdayRates.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <span className="text-[10px] text-[var(--color-text-faint)] tabular-nums">
                      {v === null ? "" : `${v}%`}
                    </span>
                    <span
                      className="w-full rounded-t"
                      style={{
                        height: `${v ?? 0}%`,
                        minHeight: v ? 4 : 0,
                        background:
                          i === insights.bestWeekday ? "var(--color-success)" : "var(--color-accent-tint)",
                      }}
                    />
                    <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                      {t(WEEKDAY_LABELS[i].en, WEEKDAY_LABELS[i].vi)}
                    </span>
                  </div>
                ))}
              </div>
              {insights.worstWeekday !== null && insights.bestWeekday !== insights.worstWeekday && (
                <p className="c-help">
                  {t(
                    `Hardest day so far: ${WEEKDAY_LABELS[insights.worstWeekday].en}. Consider a smaller target there instead of skipping it.`,
                    `Khó nhất đang là ${WEEKDAY_LABELS[insights.worstWeekday].vi}. Hạ chỉ tiêu ngày đó xuống còn hơn là bỏ hẳn.`
                  )}
                </p>
              )}
            </section>
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
              <section key={habit.id} className="c-card space-y-3">
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
