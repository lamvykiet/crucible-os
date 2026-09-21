"use client";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Progress {
  thisWeek: number;
  lastWeek: number;
  best: number;
  totalXp: number;
  activeDays: number;
  recent: { week: string; xp: number }[];
}

/**
 * Bảng tiến độ.
 *
 * Bản tham chiếu có Leaderboard so điểm với những người học khác. Crucible chỉ
 * có một tài khoản, nên bảng xếp hạng kiểu đó sẽ vĩnh viễn một dòng và không
 * nói lên điều gì.
 *
 * Giữ lại cái lõi thật sự của leaderboard — "tôi đang tiến hay đang lùi" — rồi
 * đổi đối thủ: so với chính mình tuần trước, và với tuần tốt nhất từ trước tới
 * nay. Người học một mình dùng được ngay, không cần chờ có người thứ hai.
 */
export default function ProgressBoard() {
  const { t } = useLanguage();

  const [data, setData] = useState<Progress | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/progress", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json?.success) setData(json);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
    return () => controller.abort();
  }, []);

  if (failed) {
    return <p className="c-card-body">{t("Could not load progress.", "Không đọc được tiến độ.")}</p>;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const delta = data.thisWeek - data.lastWeek;
  const Trend = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor =
    delta > 0 ? "var(--color-success)" : delta < 0 ? "var(--color-error)" : "var(--color-text-faint)";

  // Cột cao nhất làm mốc; tối thiểu 1 để tuần trống không chia cho 0.
  const peak = Math.max(1, ...data.recent.map((r) => r.xp));

  return (
    <div className="space-y-6">
      <p className="c-card-body max-w-2xl">
        {t(
          "You are the only learner in this system, so there is no one else to rank against. This compares you with your own past weeks instead.",
          "Hệ này chỉ có một người học, nên không có ai khác để xếp hạng cùng. Thay vào đó, đây là bạn so với chính bạn ở những tuần trước."
        )}
      </p>

      {/* Số liệu chính */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="c-card p-5">
          <p className="c-card-kicker">{t("This week", "Tuần này")}</p>
          <p className="c-stat-value">{data.thisWeek}</p>
          <p className="c-stat-label inline-flex items-center gap-1" style={{ color: trendColor }}>
            <Trend size={13} />
            {delta > 0 ? "+" : ""}{delta} {t("vs last week", "so tuần trước")}
          </p>
        </div>

        <div className="c-card p-5">
          <p className="c-card-kicker inline-flex items-center gap-1.5">
            <Trophy size={13} />
            {t("Best week", "Tuần tốt nhất")}
          </p>
          <p className="c-stat-value">{data.best}</p>
          <p className="c-stat-label">
            {data.thisWeek >= data.best && data.best > 0
              ? t("that is this week", "chính là tuần này")
              : t("points", "điểm")}
          </p>
        </div>

        <div className="c-card p-5">
          <p className="c-card-kicker">{t("All time", "Tổng cộng")}</p>
          <p className="c-stat-value">{data.totalXp}</p>
          <p className="c-stat-label">{t("points", "điểm")}</p>
        </div>

        <div className="c-card p-5">
          <p className="c-card-kicker">{t("Active days", "Số ngày có học")}</p>
          <p className="c-stat-value">{data.activeDays}</p>
          <p className="c-stat-label">{t("last 26 weeks", "26 tuần gần nhất")}</p>
        </div>
      </div>

      {/* Mười hai tuần gần nhất */}
      <div className="c-card p-5 space-y-4">
        <p className="c-card-kicker">{t("Last 12 weeks", "12 tuần gần nhất")}</p>

        <div className="flex items-end gap-1.5 h-32">
          {data.recent.map((r, i) => {
            const isNow = i === data.recent.length - 1;
            return (
              <div key={r.week} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(2, (r.xp / peak) * 100)}%`,
                    background: isNow ? "var(--color-primary)" : "var(--color-surface-3, var(--color-surface-2))",
                  }}
                  title={`${r.week}: ${r.xp}`}
                />
                <span className="c-stat-label text-[10px] tabular-nums truncate w-full text-center">
                  {r.week.slice(5)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="c-help">
          {t(
            "One point per card reviewed, two when you answer an exercise correctly.",
            "Mỗi thẻ ôn được một điểm; trả lời đúng một câu bài tập được hai điểm."
          )}
        </p>
      </div>
    </div>
  );
}
