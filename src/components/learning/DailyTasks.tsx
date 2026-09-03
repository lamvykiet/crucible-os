"use client";

import { useState, useEffect } from "react";
import { Check, Eye, EyeOff, Loader2, Target, Gem } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Task {
  id: string;
  kind: string;
  label: string | null;
  target: number;
  progress: number;
  reward: number;
  visible: boolean;
  color: string | null;
}

/** Nhãn mặc định theo loại việc, dùng khi người dùng chưa tự đặt tên. */
const KIND_LABEL: Record<string, { en: string; vi: string }> = {
  review: { en: "Clear the due queue", vi: "Ôn hết thẻ tới hạn" },
  newCards: { en: "Learn new cards", vi: "Học thẻ mới" },
  pomodoro: { en: "One focus session", vi: "Một phiên tập trung" },
  listen: { en: "Listening practice", vi: "Luyện nghe" },
  pronounce: { en: "Pronunciation practice", vi: "Luyện phát âm" },
  read: { en: "Reading practice", vi: "Luyện đọc" },
};

/**
 * Việc cần làm hôm nay.
 *
 * Tiến độ do máy chủ tính lại từ nhật ký ôn thật mỗi lần đọc, nên ôn ở màn nào
 * thì ở đây cũng nhích theo — không có con số nào tự bịa ra.
 *
 * Nút con mắt để ẩn việc không quan tâm; ẩn rồi thì nó không tính vào phần trăm
 * hoàn thành nữa, chứ không phải chỉ khuất mắt.
 */
export default function DailyTasks() {
  const { t } = useLanguage();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [percent, setPercent] = useState(0);
  const [reward, setReward] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/tasks", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setTasks(json.tasks);
        setPercent(json.percent);
        setReward(json.reward);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const toggle = async (task: Task) => {
    setBusy(task.id);
    await fetch("/api/learning/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, visible: !task.visible }),
    }).catch(() => {});
    setBusy(null);
    setReloadKey((k) => k + 1);
  };

  if (!loaded) {
    return (
      <div className="c-card p-6 flex items-center justify-center h-40 text-[var(--color-text-muted)]">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="c-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="c-card-kicker flex items-center gap-1.5">
            <Target size={13} />
            {t("Today's tasks", "Việc hôm nay")}
          </p>
          <p className="c-stat-value">{percent}%</p>
        </div>
        {reward > 0 && (
          <span className="c-chip c-chip-warning inline-flex items-center gap-1">
            <Gem size={12} />
            +{reward}
          </span>
        )}
      </div>

      <div className="c-progress">
        <span style={{ width: `${percent}%` }} />
      </div>

      <ul className="flex flex-col gap-2.5">
        {tasks.map((task) => {
          const label = task.label ?? t(
            KIND_LABEL[task.kind]?.en ?? task.kind,
            KIND_LABEL[task.kind]?.vi ?? task.kind
          );
          const complete = task.progress >= task.target;
          return (
            <li
              key={task.id}
              className={`flex items-center gap-3 ${task.visible ? "" : "opacity-40"}`}
            >
              <span
                className={`w-5 h-5 rounded-md flex-none grid place-content-center ${
                  complete
                    ? "bg-[var(--color-success)] text-[var(--color-on-primary)]"
                    : "bg-[var(--color-surface-2)]"
                }`}
              >
                {complete && <Check size={13} />}
              </span>

              <span className="flex-1 text-sm">{label}</span>

              <span className="c-stat-label tabular-nums">
                {task.progress}/{task.target}
              </span>

              <button
                onClick={() => toggle(task)}
                disabled={busy === task.id}
                className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
                aria-label={task.visible ? t("Hide", "Ẩn việc này") : t("Show", "Hiện lại")}
              >
                {busy === task.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : task.visible ? (
                  <Eye size={14} />
                ) : (
                  <EyeOff size={14} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
