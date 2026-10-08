"use client";

import { useState, useEffect } from "react";
import { Loader2, Trophy } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { VIZ, pctChange } from "@/lib/viz";
import ChartCard, { Delta, StatTile } from "@/components/charts/ChartCard";

interface Progress {
  thisWeek: number;
  lastWeek: number;
  best: number;
  totalXp: number;
  activeDays: number;
  recent: { week: string; xp: number }[];
}

/** "2026-10-05" → "05/10" */
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

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
 *
 * Biểu đồ theo docs/bieu-do.md: tiêu đề là câu kết luận tính từ số liệu, cột
 * xám, chỉ tuần này mang màu nhấn và ghi số.
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

  const recent = data.recent;
  const cur = recent.length - 1;
  // Cột cao nhất làm mốc; tối thiểu 1 để tuần trống không chia cho 0.
  const peak = Math.max(1, ...recent.map((r) => r.xp));
  const isBest = data.thisWeek > 0 && data.thisWeek >= data.best;
  const change = pctChange(data.thisWeek, data.lastWeek);

  // --- Câu kết luận, tính từ dữ liệu (docs/bieu-do.md §1) -------------------
  // Tuần này chưa hết, nên câu nói "tới nay" — so một tuần dở với một tuần trọn.
  const empty = data.totalXp === 0 || recent.every((r) => r.xp === 0);
  const headline =
    empty
      ? t("No points in the last 12 weeks yet", "12 tuần gần nhất chưa có điểm nào")
      : isBest
        ? t(
            `This week is your best week yet — ${data.thisWeek} points`,
            `Tuần này là tuần tốt nhất từ trước tới nay — ${data.thisWeek} điểm`
          )
        : data.thisWeek === 0
          ? t(
              `No points this week yet — last week had ${data.lastWeek}`,
              `Tuần này chưa có điểm — tuần trước được ${data.lastWeek}`
            )
          : change === null
            ? t(
                `${data.thisWeek} points this week so far — none last week`,
                `Tuần này tới nay ${data.thisWeek} điểm — tuần trước không học`
              )
            : change === 0
              ? t(
                  `${data.thisWeek} points this week so far — level with last week`,
                  `Tuần này tới nay ${data.thisWeek} điểm — ngang tuần trước`
                )
              : t(
                  `${data.thisWeek} points this week so far — ${Math.abs(change)}% ${change > 0 ? "more" : "fewer"} than last week`,
                  `Tuần này tới nay ${data.thisWeek} điểm — ${change > 0 ? "nhiều" : "ít"} hơn tuần trước ${Math.abs(change)}%`
                );

  return (
    <div className="space-y-6">
      <p className="c-card-body max-w-2xl">
        {t(
          "You are the only learner in this system, so there is no one else to rank against. This compares you with your own past weeks instead.",
          "Hệ này chỉ có một người học, nên không có ai khác để xếp hạng cùng. Thay vào đó, đây là bạn so với chính bạn ở những tuần trước."
        )}
      </p>

      <ChartCard
        title={headline}
        subtitle={t(
          `Points per week, last 12 weeks (${dm(recent[0].week)} – ${dm(recent[cur].week)})`,
          `Điểm mỗi tuần, 12 tuần gần nhất (${dm(recent[0].week)} – ${dm(recent[cur].week)})`
        )}
        footnote={t(
          "One point per card reviewed, two when you answer an exercise correctly.",
          "Mỗi thẻ ôn được một điểm; trả lời đúng một câu bài tập được hai điểm."
        )}
      >
        {/* Bốn con số: tuần này là ô chính, ba ô còn lại là bối cảnh */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            emphasis
            label={t("This week", "Tuần này")}
            value={data.thisWeek}
            delta={
              change === null ? undefined : (
                <Delta pct={change} upIsGood vs={t(`vs ${data.lastWeek} last week`, `so ${data.lastWeek} tuần trước`)} />
              )
            }
            note={change === null ? t("nothing last week", "tuần trước không học") : undefined}
          />
          <StatTile
            label={
              <span className="inline-flex items-center gap-1">
                <Trophy size={11} aria-hidden />
                {t("Best week", "Tuần tốt nhất")}
              </span>
            }
            value={data.best}
            note={isBest ? t("that is this week", "chính là tuần này") : t("points", "điểm")}
          />
          <StatTile label={t("All time", "Tổng cộng")} value={data.totalXp} note={t("points", "điểm")} />
          <StatTile
            label={t("Active days", "Số ngày có học")}
            value={data.activeDays}
            note={t("last 26 weeks", "26 tuần gần nhất")}
          />
        </div>

        {/* 12 cột: xám, tuần này màu nhấn và là cột DUY NHẤT ghi số. Không trục Y,
            không lưới — một đường gốc là đủ. Mười hai tuần trống thì không vẽ:
            một khung rỗng với chữ "0" chỉ là rác — tiêu đề đã nói đủ. */}
        {!empty && (
        <div role="img" aria-label={headline} className="pt-5">
          <div className="flex items-end gap-1.5 h-28 border-b border-[var(--viz-grid)]">
            {recent.map((r, i) => {
              const isNow = i === cur;
              return (
                <div
                  key={r.week}
                  className="relative flex-1 h-full min-w-0 flex items-end justify-center"
                  title={`${dm(r.week)}: ${r.xp}`}
                >
                  {r.xp > 0 && (
                    <div
                      className="relative w-full max-w-6 rounded-t-[4px] transition-[height] duration-300"
                      style={{
                        height: `${(r.xp / peak) * 100}%`,
                        minHeight: 2,
                        background: isNow ? VIZ.accent : VIZ.muted,
                      }}
                    >
                      {isNow && (
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[11px] font-bold tabular-nums text-[var(--color-text)] whitespace-nowrap">
                          {r.xp}
                        </span>
                      )}
                    </div>
                  )}
                  {isNow && r.xp === 0 && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-1 text-[11px] font-bold tabular-nums text-[var(--color-text)]">
                      0
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Hai mốc ở hai đầu thay cho 12 nhãn chen nhau ở khổ 375px */}
          <div className="mt-1.5 flex justify-between text-[11px] text-[var(--color-text-faint)] tabular-nums">
            <span>{dm(recent[0].week)}</span>
            <span className="font-bold text-[var(--color-text)]">{t("This week", "Tuần này")}</span>
          </div>
        </div>
        )}
      </ChartCard>
    </div>
  );
}
