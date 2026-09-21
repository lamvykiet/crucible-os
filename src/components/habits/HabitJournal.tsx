"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Send, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { colorVar, dayKey } from "@/lib/habits";
import HabitsNav from "@/components/habits/HabitsNav";
import type { HabitRow, JournalItem, TodayResponse } from "@/components/habits/types";

/** Năm mức tâm trạng. Số lưu xuống DB là 1..5, chữ chỉ để hiển thị. */
const MOODS = [
  { value: 1, en: "Rough", vi: "Tệ" },
  { value: 2, en: "Low", vi: "Hơi xuống" },
  { value: 3, en: "Okay", vi: "Bình thường" },
  { value: 4, en: "Good", vi: "Tốt" },
  { value: 5, en: "Great", vi: "Rất tốt" },
];

/**
 * Nhật ký thói quen.
 *
 * Mỗi dòng gắn với một ngày và (tuỳ chọn) một thói quen, kèm điểm tâm trạng và
 * mức năng lượng. Hai điểm số này không để trang trí: trang Báo cáo đối chiếu
 * chúng với những ngày làm đủ, nên sau vài tuần có thể thấy hôm nào làm đủ thì
 * tâm trạng khác hôm nào không.
 */
export default function HabitJournalView() {
  const { t } = useLanguage();

  const [items, setItems] = useState<JournalItem[] | null>(null);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [habitId, setHabitId] = useState("");
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter) params.set("habitId", filter);
    if (query.trim()) params.set("q", query.trim());
    fetch(`/api/habits/journal?${params}`)
      .then((r) => r.json())
      .then((json) => setItems(json?.success ? json.items : []))
      .catch(() => {});
  }, [filter, query]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = items ?? [];

  useEffect(() => {
    fetch("/api/habits")
      .then((r) => r.json())
      .then((json: TodayResponse) => setHabits(json?.success ? json.habits : []))
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!body.trim()) return;
    setSaving(true);
    await fetch("/api/habits/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, mood, energy, habitId: habitId || undefined, date: dayKey() }),
    }).catch(() => {});
    setSaving(false);
    setBody("");
    setMood(null);
    setEnergy(null);
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/habits/journal?id=${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-28">
      <header className="pt-2">
        <h1 className="c-h2">{t("Journal", "Nhật ký")}</h1>
        <p className="c-card-body">
          {t("A line a day is enough to spot a pattern.", "Mỗi ngày một dòng là đủ để nhận ra quy luật.")}
        </p>
      </header>

      <HabitsNav />

      {/* Ô viết */}
      <section className="c-card space-y-3">
        <textarea
          className="c-textarea"
          rows={3}
          value={body}
          maxLength={4000}
          placeholder={t("How did today go?", "Hôm nay thế nào?")}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="space-y-2">
          <p className="c-card-kicker">{t("Mood", "Tâm trạng")}</p>
          <div className="flex gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMood(mood === m.value ? null : m.value)}
                aria-pressed={mood === m.value}
                className={`flex-1 h-11 rounded-lg text-xs font-semibold transition-colors ${
                  mood === m.value
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                }`}
              >
                {t(m.en, m.vi)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="c-card-kicker">{t("Energy", "Năng lượng")}</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setEnergy(energy === v ? null : v)}
                aria-pressed={energy === v}
                aria-label={`${v}/5`}
                className={`flex-1 h-11 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                  energy === v
                    ? "bg-[var(--color-accent)] text-[var(--color-on-primary)]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <select className="c-select flex-1" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
            <option value="">{t("No habit", "Không gắn thói quen")}</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button onClick={submit} disabled={saving || !body.trim()} className="c-btn c-btn-primary flex-none">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {t("Save", "Lưu")}
          </button>
        </div>
      </section>

      {/* Lọc */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <input
            className="c-input pl-9! w-full"
            value={query}
            placeholder={t("Search entries", "Tìm trong nhật ký")}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="c-select w-40" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{t("All habits", "Mọi thói quen")}</option>
          {habits.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      {items === null ? (
        <div className="c-card h-32 grid place-content-center text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="c-card text-center py-10">
          <p className="c-card-body">{t("Nothing written yet.", "Chưa viết gì.")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((item) => (
            <article key={item.id} className="c-card space-y-2">
              <p className="text-sm whitespace-pre-wrap">{item.body}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="c-stat-label tabular-nums">{item.day}</span>
                {item.habit && (
                  <span
                    className="c-chip px-2 py-1 text-[11px]"
                    style={{ background: colorVar(item.habit.color), color: "var(--color-on-primary)" }}
                  >
                    {item.habit.name}
                  </span>
                )}
                {item.mood != null && (
                  <span className="c-chip px-2 py-1 text-[11px]">
                    {t(MOODS[item.mood - 1].en, MOODS[item.mood - 1].vi)}
                  </span>
                )}
                {item.energy != null && (
                  <span className="c-chip px-2 py-1 text-[11px]">
                    {t("Energy", "Năng lượng")} {item.energy}/5
                  </span>
                )}
                <span className="flex-1" />
                <button
                  onClick={() => remove(item.id)}
                  aria-label={t("Delete", "Xoá")}
                  className="w-9 h-9 grid place-content-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
