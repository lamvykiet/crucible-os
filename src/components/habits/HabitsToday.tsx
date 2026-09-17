"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, ChevronLeft, ChevronRight, Flame, Loader2, Plus, RotateCcw, Check, Zap,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  GROUPS, UNITS, WEEKDAY_LABELS, addDays, colorVar, dayKey, elapsedParts, tintVar, weekDays,
} from "@/lib/habits";
import { HabitGlyph } from "@/components/habits/icons";
import HabitsNav from "@/components/habits/HabitsNav";
import HabitFormModal from "@/components/habits/HabitFormModal";
import HabitDetailSheet from "@/components/habits/HabitDetailSheet";
import TodoSection from "@/components/habits/TodoSection";
import type { HabitRow, TodayResponse } from "@/components/habits/types";

/** Vòng tròn phần trăm của ngày. */
function Ring({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={r} fill="none"
        stroke="var(--color-success)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(c * percent) / 100} ${c}`}
        transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dasharray .35s" }}
      />
      <text
        x="32" y="36" textAnchor="middle"
        style={{ font: "700 15px var(--font-body)", fill: "var(--color-text)" }}
      >
        {percent}%
      </text>
    </svg>
  );
}

/** Đồng hồ đã nhịn được của thói quen "bỏ", chạy từng giây. */
function QuitClock({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const { days, hours, minutes, seconds } = elapsedParts(since, new Date(now));
  return (
    <span className="tabular-nums text-sm font-semibold">
      {days > 0 && `${days}d `}
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

interface RowProps {
  habit: HabitRow;
  editable: boolean;
  onLog: (habit: HabitRow, body: Record<string, unknown>) => void;
  onOpen: (habit: HabitRow) => void;
  busy: boolean;
}

/** Một dòng thói quen: tên, chuỗi ngày, tiến độ, và đúng một nút hành động. */
function Row({ habit, editable, onLog, onOpen, busy }: RowProps) {
  const { t } = useLanguage();
  const unit = UNITS.find((u) => u.value === habit.unit);
  const auto = habit.autoSource !== "manual";

  const pct = habit.kind === "quit" ? 100 : Math.min(100, Math.round((habit.periodAmount / habit.target) * 100));
  const isCheckbox = habit.target === 1 && habit.step === 1;

  const action = () => {
    if (!editable || busy) return;
    if (auto) return onOpen(habit);
    if (habit.done) return onLog(habit, { amount: 0 });
    onLog(habit, isCheckbox ? { toggle: true } : { increment: habit.step });
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${habit.skipped || !habit.scheduled ? "opacity-55" : ""}`}
      style={{ background: "var(--color-surface-2)" }}
    >
      {/* Dải nền chạy theo tiến độ — đọc được tiến độ mà không cần nhìn con số. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{ width: `${pct}%`, background: tintVar(habit.color) }}
      />

      <div className="relative flex items-center gap-2 p-2">
        <button
          onClick={() => onOpen(habit)}
          className="flex items-center gap-2 px-2.5 h-10 rounded-lg max-w-[45%] text-left"
          style={{ background: colorVar(habit.color), color: "var(--color-on-primary)" }}
        >
          <HabitGlyph icon={habit.icon} group={habit.group} size={15} className="flex-none" />
          <span className="text-sm font-semibold truncate">{habit.name}</span>
        </button>

        {habit.streak > 0 && (
          <span className="c-chip px-2 py-1 gap-1 text-[11px] flex-none bg-[var(--color-surface)]">
            <Flame size={11} className="text-[var(--color-warning)]" />
            {habit.streak}
          </span>
        )}

        <span className="flex-1" />

        <span className="text-xs sm:text-sm text-[var(--color-text-muted)] tabular-nums text-right">
          {habit.kind === "quit" && habit.quitSince ? (
            <QuitClock since={habit.quitSince} />
          ) : habit.skipped ? (
            t("Rest day", "Ngày nghỉ")
          ) : (
            <>
              {habit.periodAmount.toLocaleString("vi-VN")} / {habit.target.toLocaleString("vi-VN")}{" "}
              <span className="hidden sm:inline">{t(unit?.en ?? "", unit?.vi ?? "")}</span>
            </>
          )}
        </span>

        <button
          onClick={action}
          disabled={!editable || busy}
          aria-label={
            habit.kind === "quit"
              ? t("Reset the clock", "Đặt lại đồng hồ")
              : habit.done
                ? t("Clear today", "Xoá kết quả hôm nay")
                : t("Add progress", "Cộng tiến độ")
          }
          className="w-11 h-11 flex-none grid place-content-center rounded-lg disabled:opacity-40"
          style={{
            background: habit.done ? colorVar(habit.color) : "var(--color-surface)",
            color: habit.done ? "var(--color-on-primary)" : "var(--color-text-muted)",
          }}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : habit.kind === "quit" ? (
            <RotateCcw size={16} />
          ) : auto ? (
            <Zap size={16} />
          ) : habit.done ? (
            <Check size={18} strokeWidth={3} />
          ) : isCheckbox ? (
            <Check size={18} />
          ) : (
            <Plus size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Trang Hôm nay của module Thói quen.
 *
 * Một màn hình trả lời đúng một câu: *hôm nay còn gì chưa làm*. Dải bảy ngày ở
 * trên để xem lại và ghi bù ngày đã qua; ngày trong tương lai xem được nhưng
 * không ghi được — ghi trước một việc chưa xảy ra là tự làm hỏng số liệu của
 * chính mình.
 */
export default function HabitsToday() {
  const { t } = useLanguage();

  const [date, setDate] = useState(() => dayKey());
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<HabitRow | null | undefined>(undefined);
  const [sheetFor, setSheetFor] = useState<HabitRow | null>(null);

  const load = useCallback(() => {
    fetch(`/api/habits?date=${date}`)
      .then((r) => r.json())
      .then((json: TodayResponse) => {
        if (!json?.success) throw new Error(json?.error || "Không tải được");
        setData(json);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const today = data?.today ?? dayKey();
  const editable = date <= today;
  // Dữ liệu của ngày khác đang hiện = vẫn đang tải ngày này. Suy ra khi render
  // thay vì giữ thêm một cờ `loading` phải đặt trong effect.
  const loading = data === null || data.date !== date;

  const log = async (habit: HabitRow, body: Record<string, unknown>) => {
    setBusyId(habit.id);
    // Cập nhật lạc quan để nút phản hồi tức thì; con số thật vẫn do máy chủ chốt.
    setData((d) =>
      d
        ? {
            ...d,
            habits: d.habits.map((h) =>
              h.id === habit.id
                ? {
                    ...h,
                    amount: typeof body.increment === "number" ? h.amount + body.increment : h.amount,
                  }
                : h
            ),
          }
        : d
    );
    await fetch("/api/habits/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: habit.id, date, ...body }),
    }).catch(() => {});
    setBusyId(null);
    load();
  };

  const habits = data?.habits ?? [];
  const build = habits.filter((h) => h.kind === "build");
  const quit = habits.filter((h) => h.kind === "quit");
  const atRisk = build.filter((h) => h.streak >= 3 && !h.done && h.scheduled && !h.skipped && date === today);

  const strip = weekDays(date);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-28">
      <header className="pt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="c-h2">{t("Habits", "Thói quen")}</h1>
          <p className="c-card-body">
            {t("What today still needs from you.", "Hôm nay còn gì chưa làm.")}
          </p>
        </div>
        <button onClick={() => setFormFor(null)} className="c-btn c-btn-primary c-btn-sm flex-none">
          <Plus size={16} />
          <span className="hidden sm:inline">{t("New habit", "Thói quen mới")}</span>
        </button>
      </header>

      <HabitsNav />

      {/* Dải bảy ngày */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setDate(addDays(date, -7))}
          aria-label={t("Previous week", "Tuần trước")}
          className="w-9 h-11 flex-none grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex-1 grid grid-cols-7 gap-1">
          {strip.map((iso) => {
            const active = iso === date;
            const wd = WEEKDAY_LABELS[new Date(`${iso}T00:00:00.000Z`).getUTCDay()];
            return (
              <button
                key={iso}
                onClick={() => setDate(iso)}
                aria-current={active ? "date" : undefined}
                className={`h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-colors ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-surface)]"
                    : "border-transparent bg-[var(--color-surface-2)]"
                } ${iso > today ? "opacity-45" : ""}`}
              >
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                  {t(wd.en, wd.vi)}
                </span>
                <span className={`text-sm font-bold tabular-nums ${iso === today ? "text-[var(--color-accent)]" : ""}`}>
                  {Number(iso.slice(8))}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setDate(addDays(date, 7))}
          aria-label={t("Next week", "Tuần sau")}
          className="w-9 h-11 flex-none grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
        >
          <ChevronRight size={18} />
        </button>
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
          {/* Tổng quan ngày */}
          <section className="c-card flex items-center gap-4">
            <Ring percent={data?.percent ?? 0} />
            <div className="min-w-0">
              <p className="c-card-kicker">
                {date === today ? t("Today", "Hôm nay") : date}
              </p>
              <p className="text-sm">
                {t(
                  `${data?.doneCount ?? 0} of ${data?.dueCount ?? 0} habits done`,
                  `Xong ${data?.doneCount ?? 0}/${data?.dueCount ?? 0} thói quen`
                )}
              </p>
              {atRisk.length > 0 && (
                <p className="text-xs text-[var(--color-warning)] mt-1">
                  {t(
                    `${atRisk.length} streak${atRisk.length > 1 ? "s" : ""} at risk today`,
                    `${atRisk.length} chuỗi sắp đứt hôm nay`
                  )}
                  : {atRisk.map((h) => h.name).join(", ")}
                </p>
              )}
            </div>
          </section>

          <TodoSection date={date} />

          {/* Thói quen theo nhóm */}
          {GROUPS.map((group) => {
            const rows = build.filter((h) => h.group === group.value);
            if (rows.length === 0) return null;
            const done = rows.filter((h) => h.done).length;
            return (
              <section key={group.value} className="space-y-2">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="c-h5">{t(group.en, group.vi)}</h2>
                  <span className="c-stat-label tabular-nums">
                    {done}/{rows.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {rows.map((habit) => (
                    <Row
                      key={habit.id}
                      habit={habit}
                      editable={editable}
                      busy={busyId === habit.id}
                      onLog={log}
                      onOpen={setSheetFor}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {quit.length > 0 && (
            <section className="space-y-2">
              <h2 className="c-h5 px-1">{t("Quitting", "Đang cai")}</h2>
              <div className="space-y-1.5">
                {quit.map((habit) => (
                  <Row
                    key={habit.id}
                    habit={habit}
                    editable={editable}
                    busy={busyId === habit.id}
                    onLog={() => setSheetFor(habit)}
                    onOpen={setSheetFor}
                  />
                ))}
              </div>
            </section>
          )}

          {habits.length === 0 && (
            <section className="c-card text-center py-10 space-y-3">
              <p className="c-card-title">{t("No habits yet", "Chưa có thói quen nào")}</p>
              <p className="c-card-body max-w-sm mx-auto">
                {t(
                  "Start with one, small enough that a bad day cannot break it.",
                  "Bắt đầu bằng đúng một thói quen, nhỏ tới mức một ngày tệ cũng không phá được."
                )}
              </p>
              <button onClick={() => setFormFor(null)} className="c-btn c-btn-primary">
                <Plus size={16} />
                {t("Create the first one", "Tạo thói quen đầu tiên")}
              </button>
            </section>
          )}
        </>
      )}

      {formFor !== undefined && (
        <HabitFormModal
          habit={formFor}
          onClose={() => setFormFor(undefined)}
          onSaved={() => {
            setFormFor(undefined);
            load();
          }}
        />
      )}

      {sheetFor && (
        <HabitDetailSheet
          habit={sheetFor}
          date={date}
          onClose={() => setSheetFor(null)}
          onChanged={load}
          onEdit={() => {
            setFormFor(sheetFor);
            setSheetFor(null);
          }}
        />
      )}
    </div>
  );
}
