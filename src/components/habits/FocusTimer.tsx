"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { colorVar } from "@/lib/habits";
import HabitsNav from "@/components/habits/HabitsNav";
import type { HabitRow, SessionItem, TodayResponse } from "@/components/habits/types";

const PRESETS = [15, 25, 30, 45, 60];

const mmss = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

/**
 * Đồng hồ tập trung.
 *
 * Đếm bằng mốc thời gian thật (`Date.now()`) chứ không cộng dồn mỗi lần
 * `setInterval` chạy: tab chạy nền bị trình duyệt hãm nhịp, cộng dồn theo nhịp
 * sẽ ra một phiên ngắn hơn thực tế. Lúc dừng, số giây ghi xuống là số giây đã
 * chạy thật — bỏ ngang ở phút thứ tư thì lịch sử phải nói là bốn phút.
 *
 * Chọn "thói quen đang tập trung" thì phiên này cộng thẳng vào thói quen đó nếu
 * nó lấy tiến độ từ nguồn "số phút tập trung".
 */
export default function FocusTimer() {
  const { t } = useLanguage();

  const [mode, setMode] = useState<"countdown" | "stopwatch">("countdown");
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [habitId, setHabitId] = useState("");
  const [habits, setHabits] = useState<HabitRow[]>([]);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    fetch("/api/habits/sessions?days=7")
      .then((r) => r.json())
      .then((json) => {
        if (!json?.success) return;
        setSessions(json.sessions);
        setTodayMinutes(json.todayMinutes);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSessions();
    fetch("/api/habits")
      .then((r) => r.json())
      .then((json: TodayResponse) => setHabits(json?.success ? json.habits.filter((h) => h.kind === "build") : []))
      .catch(() => {});
  }, [loadSessions]);


  const save = useCallback(
    async (seconds: number, startedAt: Date | null) => {
      if (seconds < 60) {
        setMessage(t("Under a minute — not logged.", "Chưa tới một phút — không ghi lại."));
        return;
      }
      setSaving(true);
      const res = await fetch("/api/habits/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seconds,
          mode,
          targetMinutes: mode === "countdown" ? targetMinutes : 0,
          habitId: habitId || undefined,
          startedAt: startedAt?.toISOString(),
        }),
      })
        .then((r) => r.json())
        .catch(() => null);
      setSaving(false);
      setMessage(
        res?.success
          ? t(`Logged ${Math.round(seconds / 60)} minutes.`, `Đã ghi ${Math.round(seconds / 60)} phút.`)
          : (res?.error ?? t("Could not log the session", "Không ghi được phiên"))
      );
      loadSessions();
    },
    [habitId, loadSessions, mode, t, targetMinutes]
  );

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const base = accumulatedRef.current;
      const live = segmentStartRef.current ? (Date.now() - segmentStartRef.current) / 1000 : 0;
      const total = base + live;

      // Đếm ngược chạm 0 thì tự dừng và tự ghi lại ngay trong nhịp này, chứ
      // không đẩy sang một effect riêng: setState thẳng trong thân effect gây
      // render dây chuyền (và bị react-hooks chặn).
      if (mode === "countdown" && total >= targetMinutes * 60) {
        const started = sessionStartRef.current;
        segmentStartRef.current = null;
        accumulatedRef.current = 0;
        sessionStartRef.current = null;
        setRunning(false);
        setElapsed(0);
        void save(targetMinutes * 60, started);
        return;
      }

      setElapsed(Math.floor(total));
    }, 250);
    return () => clearInterval(id);
  }, [running, mode, targetMinutes, save]);


  const start = () => {
    if (!sessionStartRef.current) sessionStartRef.current = new Date();
    segmentStartRef.current = Date.now();
    setRunning(true);
    setMessage(null);
  };

  const pause = () => {
    if (segmentStartRef.current) {
      accumulatedRef.current += (Date.now() - segmentStartRef.current) / 1000;
      segmentStartRef.current = null;
    }
    setRunning(false);
  };

  const stop = async () => {
    const seconds = Math.floor(
      accumulatedRef.current + (segmentStartRef.current ? (Date.now() - segmentStartRef.current) / 1000 : 0)
    );
    segmentStartRef.current = null;
    accumulatedRef.current = 0;
    setRunning(false);
    setElapsed(0);
    const started = sessionStartRef.current;
    sessionStartRef.current = null;
    if (started) await save(seconds, started);
  };

  const remaining = mode === "countdown" ? Math.max(0, targetMinutes * 60 - elapsed) : elapsed;
  const fraction = mode === "countdown" ? Math.min(1, elapsed / (targetMinutes * 60)) : (elapsed % 3600) / 3600;
  const r = 78;
  const circumference = 2 * Math.PI * r;
  const activeHabit = habits.find((h) => h.id === habitId);

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-28">
      <header className="pt-2">
        <h1 className="c-h2">{t("Focus timer", "Bấm giờ tập trung")}</h1>
        <p className="c-card-body">
          {t("Minutes logged here feed the habits that count them.", "Số phút ở đây chảy thẳng vào thói quen đếm phút.")}
        </p>
      </header>

      <HabitsNav />

      <section className="c-card space-y-5">
        <div className="c-seg w-full">
          {[
            { value: "countdown", en: "Countdown", vi: "Đếm ngược" },
            { value: "stopwatch", en: "Stopwatch", vi: "Bấm giờ" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if (running) return;
                setMode(opt.value as typeof mode);
                setElapsed(0);
                accumulatedRef.current = 0;
              }}
              className={`c-seg-opt flex-1 ${mode === opt.value ? "active" : ""}`}
            >
              {t(opt.en, opt.vi)}
            </button>
          ))}
        </div>

        <div className="c-field">
          <label htmlFor="focus-habit">{t("Focus on", "Đang tập trung cho")}</label>
          <select
            id="focus-habit"
            className="c-select"
            value={habitId}
            onChange={(e) => setHabitId(e.target.value)}
          >
            <option value="">{t("Nothing in particular", "Không gắn thói quen")}</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          {activeHabit?.autoSource === "focus" && (
            <p className="c-help">
              {t(
                "This habit counts focus minutes, so the session lands on today's progress.",
                "Thói quen này đếm phút tập trung, nên phiên sẽ cộng thẳng vào tiến độ hôm nay."
              )}
            </p>
          )}
        </div>

        {mode === "countdown" && !running && elapsed === 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => setTargetMinutes(m)}
                className={`flex-1 min-w-[56px] h-11 rounded-lg text-sm font-semibold ${
                  targetMinutes === m
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        )}

        {/* Vòng đếm */}
        <div className="flex justify-center">
          <svg width="200" height="200" viewBox="0 0 200 200" role="timer" aria-label={mmss(remaining)}>
            <circle cx="100" cy="100" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="10" />
            <circle
              cx="100" cy="100" r={r} fill="none"
              stroke={activeHabit ? colorVar(activeHabit.color) : "var(--color-accent)"}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${circumference * fraction} ${circumference}`}
              transform="rotate(-90 100 100)"
            />
            <text
              x="100" y="104" textAnchor="middle"
              style={{ font: "700 34px var(--font-body)", fill: "var(--color-text)" }}
            >
              {mmss(remaining)}
            </text>
            <text
              x="100" y="130" textAnchor="middle"
              style={{ font: "600 12px var(--font-body)", fill: "var(--color-text-muted)" }}
            >
              {mode === "countdown" ? `${targetMinutes}m` : t("elapsed", "đã chạy")}
            </text>
          </svg>
        </div>

        <div className="flex gap-2">
          {running ? (
            <button onClick={pause} className="c-btn c-btn-secondary flex-1">
              <Pause size={16} />
              {t("Pause", "Tạm dừng")}
            </button>
          ) : (
            <button onClick={start} className="c-btn c-btn-primary flex-1">
              <Play size={16} />
              {elapsed > 0 ? t("Resume", "Chạy tiếp") : t("Start", "Bắt đầu")}
            </button>
          )}
          <button
            onClick={stop}
            disabled={elapsed === 0 && !running}
            className="c-btn c-btn-secondary flex-1"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
            {t("Stop & log", "Dừng & ghi")}
          </button>
        </div>

        {message && <p className="c-help">{message}</p>}
      </section>

      <section className="c-card space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="c-card-kicker">{t("Focused today", "Tập trung hôm nay")}</p>
          <p className="c-stat-value">
            {todayMinutes}
            <span className="c-stat-label"> {t("min", "phút")}</span>
          </p>
        </div>

        {sessions.length === 0 ? (
          <p className="c-card-body">{t("No sessions in the last week.", "Tuần qua chưa có phiên nào.")}</p>
        ) : (
          <ul className="space-y-1.5">
            {sessions.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ background: s.habit ? colorVar(s.habit.color) : "var(--color-border-strong)" }}
                />
                <span className="flex-1 truncate">
                  {s.habit?.name ?? t("Focus session", "Phiên tập trung")}
                </span>
                <span className="c-stat-label tabular-nums">
                  {new Date(s.endedAt).toLocaleString("vi-VN", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
                <span className="font-semibold tabular-nums w-14 text-right">{s.minutes}m</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
