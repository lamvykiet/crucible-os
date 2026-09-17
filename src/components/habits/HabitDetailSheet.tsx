"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { UNITS, addDays, colorVar, isScheduled, tintVar } from "@/lib/habits";
import { HabitGlyph } from "@/components/habits/icons";
import type { HabitRow } from "@/components/habits/types";

interface Props {
  habit: HabitRow;
  date: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
}

interface DayEntry {
  day: string;
  amount: number;
  skipped: boolean;
  note: string | null;
}

/**
 * Bảng chi tiết một thói quen trong một ngày.
 *
 * Nút "+" ngoài danh sách chỉ cộng từng bước; ở đây mới nhập được con số chính
 * xác, ghi chú, và đánh dấu **ngày nghỉ** — ngày nghỉ không tính là hoàn thành
 * nhưng cũng không phá chuỗi, nên một hôm ốm không xoá sổ ba tháng đã làm.
 */
export default function HabitDetailSheet({ habit, date, onClose, onChanged, onEdit }: Props) {
  const { t } = useLanguage();

  const [amount, setAmount] = useState(String(habit.amount));
  const [note, setNote] = useState(habit.note ?? "");
  const [skipped, setSkipped] = useState(habit.skipped);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<DayEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const auto = habit.autoSource !== "manual";
  const unit = UNITS.find((u) => u.value === habit.unit);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/habits/entries?habitId=${habit.id}&to=${date}&days=29`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setHistory(json.entries);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [habit.id, date]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/habits/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        habitId: habit.id,
        date,
        ...(auto ? {} : { amount: Number(amount) || 0 }),
        note,
        skipped,
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.success) {
      setError(res?.error ?? t("Could not save", "Không lưu được"));
      return;
    }
    onChanged();
    onClose();
  };

  const relapse = async () => {
    setSaving(true);
    await fetch("/api/habits/quit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: habit.id, note }),
    }).catch(() => {});
    setSaving(false);
    onChanged();
    onClose();
  };

  // Dải 30 ngày gần nhất — đủ để thấy hình dạng gần đây mà không phải mở báo cáo.
  const byDay = new Map((history ?? []).map((e) => [e.day, e]));
  const strip = Array.from({ length: 30 }, (_, i) => addDays(date, i - 29));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-[var(--color-surface)] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-xl grid place-content-center flex-none"
            style={{ background: colorVar(habit.color), color: "var(--color-on-primary)" }}
          >
            <HabitGlyph icon={habit.icon} group={habit.group} size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="c-h5 truncate">{habit.name}</h2>
            <p className="c-stat-label">{date}</p>
          </div>
          <button
            onClick={onEdit}
            aria-label={t("Edit habit", "Sửa thói quen")}
            className="w-10 h-10 grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="w-10 h-10 grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {habit.cue && (
            <p className="c-alert c-alert-info text-sm">
              <span>{habit.cue}</span>
            </p>
          )}

          {habit.kind === "quit" ? (
            <div className="space-y-3">
              <p className="c-card-body">
                {t(
                  "Slipped up? Resetting logs the relapse and starts the clock again — the history stays.",
                  "Lỡ tái phạm? Đặt lại sẽ ghi nhận lần trượt và bắt đầu đếm lại — lịch sử vẫn còn."
                )}
              </p>
              <button onClick={relapse} disabled={saving} className="c-btn c-btn-danger w-full">
                <RotateCcw size={16} />
                {t("I slipped — reset the clock", "Tôi đã trượt — đếm lại")}
              </button>
            </div>
          ) : (
            <div className="c-field">
              <label htmlFor="habit-amount">
                {t("Done today", "Hôm nay đã làm")} · {t(unit?.en ?? "", unit?.vi ?? "")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="habit-amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="c-input flex-1"
                  value={auto ? habit.amount : amount}
                  disabled={auto}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="c-stat-label whitespace-nowrap">
                  / {habit.target.toLocaleString("vi-VN")}
                </span>
              </div>
              {auto && (
                <p className="c-help">
                  {t(
                    "This one counts itself from your real records, so it is read-only here.",
                    "Thói quen này tự đếm từ dữ liệu thật, nên ở đây chỉ để xem."
                  )}
                </p>
              )}
            </div>
          )}

          <div className="c-field">
            <label htmlFor="habit-note">{t("Note", "Ghi chú")}</label>
            <textarea
              id="habit-note"
              className="c-textarea"
              rows={2}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("What made it easy or hard?", "Hôm nay dễ hay khó vì điều gì?")}
            />
          </div>

          {habit.kind === "build" && (
            <label className="c-check">
              <input type="checkbox" checked={skipped} onChange={(e) => setSkipped(e.target.checked)} />
              <span>
                {t("Rest day — don't break the streak", "Ngày nghỉ — đừng tính đứt chuỗi")}
              </span>
            </label>
          )}

          {/* 30 ngày gần nhất */}
          <div className="space-y-2">
            <p className="c-card-kicker">{t("Last 30 days", "30 ngày gần nhất")}</p>
            {history === null ? (
              <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" />
            ) : (
              <div className="grid grid-cols-10 gap-1.5">
                {strip.map((iso) => {
                  const e = byDay.get(iso);
                  const off = !isScheduled(habit, iso);
                  const done = (e?.amount ?? 0) >= habit.target;
                  return (
                    <span
                      key={iso}
                      title={iso}
                      className="aspect-square rounded-[5px]"
                      style={{
                        background: e?.skipped
                          ? "var(--color-surface-3)"
                          : done
                            ? colorVar(habit.color)
                            : (e?.amount ?? 0) > 0
                              ? tintVar(habit.color)
                              : "var(--color-surface-2)",
                        opacity: off ? 0.35 : 1,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="c-help error">{error}</p>}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-[var(--color-border)] flex gap-2">
          <button onClick={onClose} className="c-btn c-btn-secondary flex-1">
            {t("Close", "Đóng")}
          </button>
          <button onClick={save} disabled={saving} className="c-btn c-btn-primary flex-1">
            {saving ? <Loader2 size={16} className="animate-spin" /> : t("Save", "Lưu")}
          </button>
        </div>
      </div>
    </div>
  );
}
