"use client";

import { useState, useEffect } from "react";
import { Flame, Gem, Loader2, Timer, Check } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Challenge {
  id: string;
  label: string | null;
  target: number;
  progress: number;
  reward: number;
  done: boolean;
}

/** Giây → HH:MM:SS, giữ hai chữ số để chữ không nhảy ngang khi đếm. */
function clock(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Chuỗi ngày và thử thách hôm nay.
 *
 * Hai thứ đứng cạnh nhau vì cùng trả lời một câu: "hôm nay còn gì phải làm
 * trước nửa đêm".
 *
 * Đồng hồ đếm ngược lấy mốc từ máy chủ rồi trừ dần tại chỗ. Để trình duyệt tự
 * suy ra nửa đêm thì máy đặt sai múi giờ sẽ đếm lệch vài tiếng so với lúc
 * nhiệm vụ thật sự đổi.
 */
export default function DailyChallenge({ streak }: { streak: number }) {
  const { t } = useLanguage();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  // Giữ MỐC hạn chót chứ không giữ số giây còn lại: trình duyệt bóp nhịp hẹn
  // giờ ở tab nền, nên trừ dần từng giây sẽ chạy chậm lại và đồng hồ lệch dần
  // so với nửa đêm thật.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/challenge", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setChallenge(json.challenge);
        setDeadline(Date.now() + json.secondsLeft * 1000);
        setSecondsLeft(json.secondsLeft);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [reloadKey]);

  // Suy số giây còn lại từ mốc hạn chót, mỗi nửa giây một lần.
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline]);

  const claim = async () => {
    if (!challenge || claiming) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/learning/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: challenge.id }),
      });
      const json = await res.json();
      if (json?.success) {
        setClaimed(true);
        setReloadKey((k) => k + 1);
      }
    } finally {
      setClaiming(false);
    }
  };

  const percent = challenge
    ? Math.round((challenge.progress / Math.max(1, challenge.target)) * 100)
    : 0;

  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      {/* Chuỗi ngày */}
      <div className="c-card p-5 flex flex-col justify-between min-w-[116px]">
        <p className="c-card-kicker">{t("Streak", "Chuỗi")}</p>
        <div className="flex items-end gap-1.5">
          <span className="c-stat-value">{streak}</span>
          <Flame
            size={22}
            className={`mb-1.5 ${streak > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-text-faint)]"}`}
          />
        </div>
        <p className="c-stat-label">{t("days", "ngày")}</p>
      </div>

      {/* Thử thách */}
      <div className="c-card p-5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="c-card-kicker">{t("Daily challenge", "Thử thách hôm nay")}</p>
          {secondsLeft !== null && (
            <span className="c-stat-label inline-flex items-center gap-1 tabular-nums">
              <Timer size={12} />
              {clock(secondsLeft)}
            </span>
          )}
        </div>

        {!challenge ? (
          <div className="flex items-center h-[52px] text-[var(--color-text-muted)]">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : (
          <>
            <p className="font-bold leading-snug">{challenge.label}</p>

            <div className="c-progress">
              <span style={{ width: `${percent}%` }} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="c-stat-label tabular-nums">
                {challenge.progress}/{challenge.target}
              </span>

              {challenge.done && !claimed ? (
                <button onClick={claim} disabled={claiming} className="c-btn c-btn-primary c-btn-sm">
                  {claiming ? <Loader2 size={14} className="animate-spin" /> : <Gem size={14} />}
                  {t(`Claim ${challenge.reward}`, `Nhận ${challenge.reward}`)}
                </button>
              ) : claimed ? (
                <span className="c-chip c-chip-success inline-flex items-center gap-1">
                  <Check size={12} />
                  {t("Claimed", "Đã nhận")}
                </span>
              ) : (
                <span className="c-stat-label inline-flex items-center gap-1">
                  <Gem size={12} />
                  {challenge.reward}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
