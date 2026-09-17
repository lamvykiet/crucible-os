"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { WEEKDAY_LABELS, addDays, colorVar, dayKey, isScheduled, weekDays, weekdayOf } from "@/lib/habits";
import HabitsNav from "@/components/habits/HabitsNav";
import type { HabitRow, TodayResponse } from "@/components/habits/types";

const HOUR_PX = 56;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Lịch tuần.
 *
 * Chỉ vẽ những thói quen đã đặt giờ — phần còn lại nằm ở trang Hôm nay. Đặt giờ
 * cho một thói quen là biến nó từ "khi nào tiện" thành một chỗ cụ thể trong
 * ngày, và đó mới là thứ lịch này dùng để nói.
 *
 * Trên điện thoại lưới cuộn ngang (mỗi cột 76px) thay vì bóp bảy cột vào 375px:
 * bóp lại thì tên thói quen chỉ còn hai chữ cái, nhìn vào không đọc được gì.
 */
export default function HabitSchedule() {
  const { t } = useLanguage();

  const [anchor, setAnchor] = useState(() => dayKey());
  const [habits, setHabits] = useState<HabitRow[] | null>(null);

  const load = useCallback(() => {
    fetch(`/api/habits?date=${anchor}`)
      .then((r) => r.json())
      .then((json: TodayResponse) => setHabits(json?.success ? json.habits : []))
      .catch(() => {});
  }, [anchor]);

  useEffect(() => {
    load();
  }, [load]);

  const loading = habits === null;

  const days = weekDays(anchor);
  const scheduled = (habits ?? []).filter((h) => h.scheduleStart);
  const reminders = (habits ?? [])
    .filter((h) => h.reminderAt && !h.scheduleStart)
    .sort((a, b) => (a.reminderAt ?? "").localeCompare(b.reminderAt ?? ""));

  // Khung giờ vừa đủ chứa mọi khối, tối thiểu 6:00–22:00.
  const starts = scheduled.map((h) => toMinutes(h.scheduleStart!));
  const ends = scheduled.map((h) => toMinutes(h.scheduleStart!) + (h.scheduleMinutes ?? 30));
  const firstHour = Math.min(6, ...starts.map((m) => Math.floor(m / 60)));
  const lastHour = Math.max(22, ...ends.map((m) => Math.ceil(m / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-28">
      <header className="pt-2">
        <h1 className="c-h2">{t("Schedule", "Lịch tuần")}</h1>
        <p className="c-card-body">
          {t("Where each habit actually sits in the day.", "Mỗi thói quen nằm ở chỗ nào trong ngày.")}
        </p>
      </header>

      <HabitsNav />

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setAnchor(addDays(anchor, -7))}
          aria-label={t("Previous week", "Tuần trước")}
          className="w-11 h-11 grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold tabular-nums">
          {days[0].slice(5)} → {days[6].slice(5)}
        </span>
        <button
          onClick={() => setAnchor(addDays(anchor, 7))}
          aria-label={t("Next week", "Tuần sau")}
          className="w-11 h-11 grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div className="c-card h-40 grid place-content-center text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : scheduled.length === 0 ? (
        <section className="c-card text-center py-10 space-y-2">
          <p className="c-card-title">{t("No timed habits yet", "Chưa thói quen nào đặt giờ")}</p>
          <p className="c-card-body max-w-md mx-auto">
            {t(
              "Open a habit, set a start time and a length, and it will show up here.",
              "Mở một thói quen, đặt giờ bắt đầu và độ dài, nó sẽ hiện ở đây."
            )}
          </p>
        </section>
      ) : (
        <section className="c-card p-0 overflow-hidden">
          <div className="overflow-x-auto hide-scrollbar">
            <div className="min-w-[620px]">
              {/* Hàng thứ */}
              <div className="grid sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)]"
                   style={{ gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))" }}>
                <span />
                {days.map((iso) => (
                  <div key={iso} className="py-2 text-center">
                    <p className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                      {t(WEEKDAY_LABELS[weekdayOf(iso)].en, WEEKDAY_LABELS[weekdayOf(iso)].vi)}
                    </p>
                    <p className="text-sm font-bold tabular-nums">{Number(iso.slice(8))}</p>
                  </div>
                ))}
              </div>

              <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))" }}>
                {/* Cột giờ */}
                <div>
                  {hours.map((h) => (
                    <div key={h} className="relative" style={{ height: HOUR_PX }}>
                      <span className="absolute -top-2 right-1.5 text-[10px] text-[var(--color-text-faint)] tabular-nums">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {days.map((iso) => (
                  <div
                    key={iso}
                    className="relative border-l border-[var(--color-border)]"
                    style={{ height: hours.length * HOUR_PX }}
                  >
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="border-b border-[var(--color-border)] opacity-40"
                        style={{ height: HOUR_PX }}
                      />
                    ))}

                    {scheduled
                      .filter((habit) => isScheduled(habit, iso))
                      .map((habit) => {
                        const start = toMinutes(habit.scheduleStart!);
                        const length = habit.scheduleMinutes ?? 30;
                        return (
                          <div
                            key={habit.id}
                            title={`${habit.name} · ${habit.scheduleStart}`}
                            className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden"
                            style={{
                              top: ((start - firstHour * 60) / 60) * HOUR_PX,
                              height: Math.max(22, (length / 60) * HOUR_PX - 2),
                              background: colorVar(habit.color),
                              color: "var(--color-on-primary)",
                            }}
                          >
                            <p className="text-[10px] font-bold leading-tight line-clamp-2">{habit.name}</p>
                            <p className="text-[9px] opacity-80 tabular-nums">{habit.scheduleStart}</p>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {reminders.length > 0 && (
        <section className="c-card space-y-2">
          <p className="c-card-kicker flex items-center gap-1.5">
            <Bell size={12} /> {t("Reminders without a block", "Giờ nhắc chưa có khối lịch")}
          </p>
          {reminders.map((habit) => (
            <div key={habit.id} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: colorVar(habit.color) }} />
              <span className="text-sm flex-1 truncate">{habit.name}</span>
              <span className="c-stat-label tabular-nums">{habit.reminderAt}</span>
            </div>
          ))}
          <p className="c-help">
            {t(
              "Times are shown here, not pushed as notifications — the app does not run in the background.",
              "Giờ nhắc chỉ hiện ở đây, chưa bắn thông báo — ứng dụng không chạy nền."
            )}
          </p>
        </section>
      )}
    </div>
  );
}
