"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Flag, ListTodo, Loader2, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { TodoItem } from "@/components/habits/types";

/**
 * Việc cần làm của ngày đang xem.
 *
 * Việc quá hạn từ hôm trước vẫn nằm trong danh sách và được đánh dấu đỏ thay vì
 * biến mất — danh sách nào tự giấu việc chưa xong thì người dùng thôi tin nó
 * sau đúng một lần.
 */
export default function TodoSection({ date }: { date: string }) {
  const { t } = useLanguage();

  // `null` = chưa tải xong lần đầu. Phân biệt với `[]` (đã tải, không có việc)
  // để lần đầu hiện vòng xoay còn lúc rỗng thật thì hiện đúng danh sách rỗng.
  const [items, setItems] = useState<TodoItem[] | null>(null);
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/habits/todos?date=${date}`)
      .then((r) => r.json())
      .then((json) => setItems(json?.success ? json.items : []))
      .catch(() => {});
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const text = title.trim();
    if (!text) return;
    setTitle("");
    setDueTime("");
    await fetch("/api/habits/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: text, due: date, dueTime: dueTime || undefined }),
    }).catch(() => {});
    load();
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    await fetch("/api/habits/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    }).catch(() => {});
    setBusy(null);
    load();
  };

  const remove = async (id: string) => {
    setBusy(id);
    await fetch(`/api/habits/todos?id=${id}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    load();
  };

  const rows = items ?? [];
  const remaining = rows.filter((i) => !i.done).length;

  return (
    <section className="c-card p-0 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 h-12 text-left"
      >
        <ListTodo size={16} className="text-[var(--color-text-muted)]" />
        <span className="font-semibold text-sm flex-1">{t("To-do list", "Việc cần làm")}</span>
        <span className="c-stat-label tabular-nums">{remaining}</span>
        <ChevronDown
          size={16}
          className={`text-[var(--color-text-muted)] transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {items === null ? (
            <div className="h-16 grid place-content-center text-[var(--color-text-muted)]">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : (
            rows.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-[var(--color-surface-2)]"
              >
                <button
                  onClick={() => patch(item.id, { done: !item.done })}
                  disabled={busy === item.id}
                  aria-label={item.done ? t("Mark as not done", "Bỏ đánh dấu xong") : t("Mark as done", "Đánh dấu xong")}
                  className={`w-9 h-9 flex-none rounded-lg grid place-content-center border ${
                    item.done
                      ? "bg-[var(--color-success)] border-transparent text-[var(--color-on-primary)]"
                      : "border-[var(--color-border-strong)] text-transparent"
                  }`}
                >
                  <Check size={16} strokeWidth={3} />
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${item.done ? "line-through text-[var(--color-text-faint)]" : ""}`}>
                    {item.title}
                  </p>
                  {(item.dueTime || item.overdue) && (
                    <p className={`text-xs ${item.overdue ? "text-[var(--color-error)]" : "text-[var(--color-text-faint)]"}`}>
                      {item.overdue ? t("Overdue", "Quá hạn") : ""} {item.dueTime ?? ""}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => patch(item.id, { flagged: !item.flagged })}
                  aria-label={t("Flag", "Đánh dấu quan trọng")}
                  className={`w-9 h-9 grid place-content-center rounded-lg ${
                    item.flagged ? "text-[var(--color-error)]" : "text-[var(--color-text-faint)]"
                  }`}
                >
                  <Flag size={15} />
                </button>
                <button
                  onClick={() => remove(item.id)}
                  aria-label={t("Delete", "Xoá")}
                  className="w-9 h-9 grid place-content-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}

          <div className="flex gap-1.5 pt-1">
            <input
              className="c-input flex-1 min-w-0"
              value={title}
              placeholder={t("Add a task", "Thêm việc")}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <input
              type="time"
              aria-label={t("Time", "Giờ")}
              className="c-input w-[104px] flex-none"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
            <button onClick={add} className="c-btn c-btn-primary c-btn-icon flex-none" aria-label={t("Add", "Thêm")}>
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
