"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Plus, Trash2, Loader2, StickyNote } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Note {
  id: string;
  body: string;
  color: string | null;
}

const FOCUS_MIN = 25;
const BREAK_MIN = 5;

/** Màu giấy nhớ, lấy từ token nên đổi chủ đề sáng/tối vẫn đọc được. */
const NOTE_COLORS = [
  "var(--color-warning-tint)",
  "var(--color-success-tint)",
  "var(--color-info-tint)",
  "var(--color-accent-tint)",
];

/**
 * Đồng hồ tập trung, kèm giấy nhớ.
 *
 * Ghi chú gắn với ngày chứ không thả trôi: mở lịch sử ngày 12/08 là thấy luôn
 * hôm đó đã ghi gì bên cạnh số thẻ đã ôn.
 *
 * Hết một phiên tập trung thì cộng tiến độ cho nhiệm vụ Pomodoro hôm nay —
 * Pomodoro không để lại dấu vết trong nhật ký ôn thẻ nên phải tự báo.
 */
export default function Pomodoro() {
  const { t } = useLanguage();

  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [done, setDone] = useState(0);

  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reportPomodoro = useCallback(async () => {
    try {
      const res = await fetch("/api/learning/tasks");
      const json = await res.json();
      const task = (json?.tasks ?? []).find((x: { kind: string }) => x.kind === "pomodoro");
      if (task) {
        await fetch("/api/learning/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, increment: 1 }),
        });
      }
    } catch {
      // Không cộng được tiến độ thì cũng không được phá phiên vừa xong.
    }
  }, []);

  // Đếm theo mốc kết thúc thay vì trừ dần mỗi giây: trình duyệt bóp nhịp hẹn
  // giờ ở tab nền, trừ dần sẽ chạy chậm lại và phiên 25 phút hoá ra dài hơn.
  const [endsAt, setEndsAt] = useState<number | null>(null);

  useEffect(() => {
    if (!running || endsAt === null) return;

    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left > 0) return;

      // Hết giờ: đổi chiều giữa tập trung và nghỉ.
      const wasFocus = !onBreak;
      setRunning(false);
      setEndsAt(null);
      setOnBreak(wasFocus);
      setSecondsLeft((wasFocus ? BREAK_MIN : FOCUS_MIN) * 60);
      if (wasFocus) {
        setDone((d) => d + 1);
        reportPomodoro();
      }
    };

    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [running, endsAt, onBreak, reportPomodoro]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/notes", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!controller.signal.aborted && json?.success) setNotes(json.notes);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [reloadKey]);

  const addNote = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await fetch("/api/learning/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft,
          color: NOTE_COLORS[notes.length % NOTE_COLORS.length],
        }),
      });
      setDraft("");
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const removeNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/learning/notes?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const total = (onBreak ? BREAK_MIN : FOCUS_MIN) * 60;
  const percent = ((total - secondsLeft) / total) * 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Đồng hồ */}
      <div className="c-card c-elev-md p-8 flex flex-col items-center gap-5">
        <p className="c-card-kicker">
          {onBreak ? t("Break", "Nghỉ ngơi") : t("Focus", "Tập trung")}
        </p>

        <p className="font-mono tabular-nums leading-none" style={{ font: "var(--text-display)" }}>
          {mm}:{ss}
        </p>

        <div className="c-progress w-full">
          <span style={{ width: `${percent}%` }} />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (running) {
                setRunning(false);
                setEndsAt(null);
              } else {
                setEndsAt(Date.now() + secondsLeft * 1000);
                setRunning(true);
              }
            }}
            className="c-btn c-btn-primary c-btn-lg min-w-[140px] justify-center"
          >
            {running ? <Pause size={18} /> : <Play size={18} />}
            {running ? t("Pause", "Tạm dừng") : t("Start", "Bắt đầu")}
          </button>
          <button
            onClick={() => {
              setRunning(false);
              setEndsAt(null);
              setOnBreak(false);
              setSecondsLeft(FOCUS_MIN * 60);
            }}
            className="c-btn c-btn-secondary c-btn-lg"
            title={t("Reset", "Đặt lại")}
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <p className="c-stat-label">
          {t(`${done} sessions today`, `Đã xong ${done} phiên hôm nay`)}
        </p>
      </div>

      {/* Giấy nhớ */}
      <div className="c-card p-6 flex flex-col gap-4">
        <h3 className="c-card-title flex items-center gap-2">
          <StickyNote size={17} />
          {t("Notes for today", "Ghi chú hôm nay")}
        </h3>

        <div className="flex gap-2">
          <input
            className="c-input flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            placeholder={t("Something to remember...", "Điều cần nhớ...")}
          />
          <button onClick={addNote} disabled={!draft.trim() || busy} className="c-btn c-btn-primary">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>

        {notes.length === 0 ? (
          <p className="c-card-body">
            {t("No notes yet today.", "Hôm nay chưa ghi gì.")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl p-3 flex items-start gap-3 text-sm"
                style={{ background: note.color ?? "var(--color-surface-2)" }}
              >
                <span className="flex-1 whitespace-pre-wrap break-words text-[var(--color-text)]">
                  {note.body}
                </span>
                <button
                  onClick={() => removeNote(note.id)}
                  className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors flex-none"
                  aria-label={t("Delete note", "Xoá ghi chú")}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
