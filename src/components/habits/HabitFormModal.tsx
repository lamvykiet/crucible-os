"use client";

import { useState } from "react";
import { Archive, Loader2, Trash2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { AUTO_SOURCES, COLORS, GROUPS, PERIODS, UNITS, WEEKDAY_LABELS, colorVar } from "@/lib/habits";
import { HABIT_ICONS, ICON_NAMES, HabitGlyph } from "@/components/habits/icons";
import type { HabitRow } from "@/components/habits/types";

interface Props {
  habit: HabitRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyDraft = {
  name: "",
  cue: "",
  kind: "build",
  group: "daily",
  color: "accent",
  icon: "check",
  unit: "times",
  target: 1,
  period: "day",
  step: 1,
  weekdays: [] as number[],
  reminderAt: "",
  scheduleStart: "",
  scheduleMinutes: "" as number | "",
  autoSource: "manual",
};

/**
 * Tạo và sửa một thói quen.
 *
 * Khổ chuẩn là 375px: thân modal cuộn, còn hàng nút lưu dính đáy nên không bao
 * giờ phải cuộn xuống mới bấm được — đây là lỗi đã sửa nhiều lần ở các modal
 * bên Finance.
 *
 * "Xoá" nằm cạnh "Lưu kho" nhưng phải xác nhận hai bước: lưu kho giữ nguyên
 * lịch sử cho biểu đồ năm, xoá thì mất hẳn.
 */
export default function HabitFormModal({ habit, onClose, onSaved }: Props) {
  const { t } = useLanguage();

  const [draft, setDraft] = useState(() =>
    habit
      ? {
          name: habit.name,
          cue: habit.cue ?? "",
          kind: habit.kind,
          group: habit.group,
          color: habit.color,
          icon: habit.icon ?? "check",
          unit: habit.unit,
          target: habit.target,
          period: habit.period,
          step: habit.step,
          weekdays: habit.weekdays ?? [],
          reminderAt: habit.reminderAt ?? "",
          scheduleStart: habit.scheduleStart ?? "",
          scheduleMinutes: (habit.scheduleMinutes ?? "") as number | "",
          autoSource: habit.autoSource,
        }
      : emptyDraft
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const isQuit = draft.kind === "quit";

  const save = async () => {
    if (!draft.name.trim()) {
      setError(t("Give the habit a name first", "Đặt tên cho thói quen đã"));
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/habits", {
      method: habit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, id: habit?.id }),
    })
      .then((r) => r.json())
      .catch(() => null);

    setSaving(false);
    if (!res?.success) {
      setError(res?.error ?? t("Could not save", "Không lưu được"));
      return;
    }
    onSaved();
  };

  const archive = async () => {
    if (!habit) return;
    setSaving(true);
    await fetch("/api/habits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: habit.id, archived: habit.archivedAt === null }),
    }).catch(() => {});
    setSaving(false);
    onSaved();
  };

  const remove = async () => {
    if (!habit) return;
    setSaving(true);
    await fetch(`/api/habits?id=${habit.id}`, { method: "DELETE" }).catch(() => {});
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-[var(--color-surface)] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <h2 className="c-h4">
            {habit ? t("Edit habit", "Sửa thói quen") : t("New habit", "Thói quen mới")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="w-10 h-10 grid place-content-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Loại */}
          <div className="c-seg w-full">
            {[
              { value: "build", en: "Build", vi: "Tạo thói quen" },
              { value: "quit", en: "Quit", vi: "Bỏ thói quen" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("kind", opt.value)}
                className={`c-seg-opt flex-1 ${draft.kind === opt.value ? "active" : ""}`}
              >
                {t(opt.en, opt.vi)}
              </button>
            ))}
          </div>

          <div className="c-field">
            <label htmlFor="habit-name">{t("Name", "Tên")}</label>
            <input
              id="habit-name"
              className="c-input"
              value={draft.name}
              maxLength={80}
              placeholder={isQuit ? t("Quit smoking", "Bỏ thuốc lá") : t("Drink water", "Uống nước")}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="c-field">
            <label htmlFor="habit-cue">{t("Trigger — after what?", "Mốc bám — sau việc gì?")}</label>
            <input
              id="habit-cue"
              className="c-input"
              value={draft.cue}
              maxLength={200}
              placeholder={t("After my morning coffee, I will…", "Sau khi pha cà phê sáng, tôi sẽ…")}
              onChange={(e) => set("cue", e.target.value)}
            />
            <p className="c-help">
              {t(
                "A habit attached to something you already do survives much longer.",
                "Thói quen gắn vào một việc đã có sẵn trong ngày thì sống lâu hơn hẳn."
              )}
            </p>
          </div>

          {/* Chỉ tiêu — thói quen "bỏ" không có chỉ tiêu, chỉ có đồng hồ đếm. */}
          {!isQuit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="c-field">
                  <label htmlFor="habit-target">{t("Target", "Chỉ tiêu")}</label>
                  <input
                    id="habit-target"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="c-input"
                    value={draft.target}
                    onChange={(e) => set("target", Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <div className="c-field">
                  <label htmlFor="habit-unit">{t("Unit", "Đơn vị")}</label>
                  <select
                    id="habit-unit"
                    className="c-select"
                    value={draft.unit}
                    onChange={(e) => set("unit", e.target.value)}
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {t(u.en, u.vi)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="c-field">
                  <label htmlFor="habit-period">{t("Counted", "Tính theo")}</label>
                  <select
                    id="habit-period"
                    className="c-select"
                    value={draft.period}
                    onChange={(e) => set("period", e.target.value)}
                  >
                    {PERIODS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {t(p.en, p.vi)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="c-field">
                  <label htmlFor="habit-step">{t("Each tap adds", "Mỗi lần bấm")}</label>
                  <input
                    id="habit-step"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="c-input"
                    value={draft.step}
                    onChange={(e) => set("step", Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              </div>

              <div className="c-field">
                <label htmlFor="habit-source">{t("Progress comes from", "Tiến độ lấy từ")}</label>
                <select
                  id="habit-source"
                  className="c-select"
                  value={draft.autoSource}
                  onChange={(e) => set("autoSource", e.target.value)}
                >
                  {AUTO_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {t(s.en, s.vi)}
                    </option>
                  ))}
                </select>
                {draft.autoSource !== "manual" && (
                  <p className="c-help">
                    {t(
                      "Counted from your real records — nothing to tap, and the number never drifts.",
                      "Đếm thẳng từ dữ liệu thật của bạn — không phải bấm, và con số không bao giờ lệch."
                    )}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Lịch áp dụng */}
          <div className="c-field">
            <label>{t("Days", "Ngày áp dụng")}</label>
            <div className="flex gap-1.5">
              {WEEKDAY_LABELS.map((w, i) => {
                const on = draft.weekdays.length === 0 || draft.weekdays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const current = draft.weekdays.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : draft.weekdays;
                      const next = current.includes(i) ? current.filter((d) => d !== i) : [...current, i].sort();
                      set("weekdays", next.length === 7 ? [] : next);
                    }}
                    className={`flex-1 h-11 rounded-lg text-xs font-bold transition-colors ${
                      on
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
                    }`}
                  >
                    {t(w.en, w.vi)}
                  </button>
                );
              })}
            </div>
            <p className="c-help">
              {t(
                "Days you leave off never count against a streak.",
                "Ngày tắt ở đây không bao giờ bị tính là đứt chuỗi."
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="c-field">
              <label htmlFor="habit-remind">{t("Reminder", "Giờ nhắc")}</label>
              <input
                id="habit-remind"
                type="time"
                className="c-input"
                value={draft.reminderAt}
                onChange={(e) => set("reminderAt", e.target.value)}
              />
            </div>
            <div className="c-field">
              <label htmlFor="habit-group">{t("Section", "Nhóm")}</label>
              <select
                id="habit-group"
                className="c-select"
                value={draft.group}
                onChange={(e) => set("group", e.target.value)}
              >
                {GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {t(g.en, g.vi)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="c-field">
              <label htmlFor="habit-start">{t("On the week grid", "Trên lịch tuần")}</label>
              <input
                id="habit-start"
                type="time"
                className="c-input"
                value={draft.scheduleStart}
                onChange={(e) => set("scheduleStart", e.target.value)}
              />
            </div>
            <div className="c-field">
              <label htmlFor="habit-len">{t("Length (min)", "Dài (phút)")}</label>
              <input
                id="habit-len"
                type="number"
                inputMode="numeric"
                min={5}
                max={720}
                className="c-input"
                value={draft.scheduleMinutes}
                placeholder="30"
                onChange={(e) => set("scheduleMinutes", e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>

          {/* Màu và icon */}
          <div className="c-field">
            <label>{t("Colour", "Màu")}</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  aria-label={c}
                  aria-pressed={draft.color === c}
                  className={`w-11 h-11 rounded-full border-2 transition-transform ${
                    draft.color === c ? "scale-110 border-[var(--color-text)]" : "border-transparent"
                  }`}
                  style={{ background: colorVar(c) }}
                />
              ))}
            </div>
          </div>

          <div className="c-field">
            <label>{t("Icon", "Biểu tượng")}</label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICON_NAMES.map((name) => {
                const Ic = HABIT_ICONS[name];
                const on = draft.icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => set("icon", name)}
                    aria-label={name}
                    aria-pressed={on}
                    className={`aspect-square grid place-content-center rounded-lg ${
                      on
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    <Ic size={16} strokeWidth={2} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Xem trước */}
          <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: colorVar(draft.color), color: "var(--color-on-primary)" }}
          >
            <HabitGlyph icon={draft.icon} group={draft.group} size={18} />
            <span className="font-semibold text-sm">{draft.name || t("Preview", "Xem trước")}</span>
          </div>

          {error && <p className="c-help error">{error}</p>}

          {habit && (
            <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap gap-2">
              <button type="button" onClick={archive} className="c-btn c-btn-secondary c-btn-sm">
                <Archive size={14} />
                {habit.archivedAt ? t("Restore", "Khôi phục") : t("Archive", "Lưu kho")}
              </button>
              <button
                type="button"
                onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
                className="c-btn c-btn-danger c-btn-sm"
              >
                <Trash2 size={14} />
                {confirmDelete ? t("Delete for good?", "Xoá hẳn?") : t("Delete", "Xoá")}
              </button>
              {confirmDelete && (
                <p className="c-help error w-full">
                  {t(
                    "Deleting also removes every logged day. Archiving keeps the history.",
                    "Xoá là mất luôn toàn bộ ngày đã ghi. Lưu kho thì giữ lại lịch sử."
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-[var(--color-border)] flex gap-2">
          <button type="button" onClick={onClose} className="c-btn c-btn-secondary flex-1">
            {t("Cancel", "Huỷ")}
          </button>
          <button type="button" onClick={save} disabled={saving} className="c-btn c-btn-primary flex-1">
            {saving ? <Loader2 size={16} className="animate-spin" /> : t("Save", "Lưu")}
          </button>
        </div>
      </div>
    </div>
  );
}
