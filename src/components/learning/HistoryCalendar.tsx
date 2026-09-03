"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Day {
  date: string; // YYYY-MM-DD
  reviews: number;
  correct: number;
  wrong: number;
  notes: { id: string; body: string; color: string | null }[];
}

interface Stats {
  mastered: number;
  learning: number;
  due: number;
  paused: number;
}

/** Bốn nhóm tình trạng thẻ, cùng thứ tự với vòng tròn thống kê. */
const SLICES = [
  { key: "mastered", color: "var(--color-success)", en: "Mastered", vi: "Đã thuộc" },
  { key: "learning", color: "var(--color-info)", en: "Learning", vi: "Đang học" },
  { key: "due", color: "var(--color-warning)", en: "Due", vi: "Cần ôn" },
  { key: "paused", color: "var(--color-text-faint)", en: "Paused", vi: "Tạm dừng" },
] as const;

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Lịch sử học và thống kê.
 *
 * Ô càng đậm là hôm đó ôn càng nhiều. Bấm một ngày để xem hôm đó ôn bao nhiêu
 * thẻ, đúng bao nhiêu, và đã ghi chú gì.
 *
 * Số liệu đến từ `ReviewLog`. Nếu chỉ nhìn bảng thẻ thì không thể dựng được màn
 * này: thẻ chỉ mang trạng thái hiện tại, không mang lịch sử.
 */
export default function HistoryCalendar({ languageId }: { languageId?: string }) {
  const { t } = useLanguage();

  const [cursor, setCursor] = useState(() => new Date());
  const [days, setDays] = useState<Day[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const month = monthKey(cursor);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = `${month}:${languageId ?? ""}`;
  const loading = loadedFor !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ month });
    if (languageId) params.set("languageId", languageId);

    fetch(`/api/learning/history?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được lịch sử");
        setDays(json.days);
        setStats(json.stats);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(requestKey);
      });

    return () => controller.abort();
  }, [requestKey, month, languageId]);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const busiest = useMemo(() => Math.max(1, ...days.map((d) => d.reviews)), [days]);

  /** Các ô của tháng, đệm đầu tuần cho thẳng cột. Tuần bắt đầu từ thứ Hai. */
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(year, m, 1);
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;

    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }),
    ];
  }, [cursor]);

  const shift = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const total = stats ? stats.mastered + stats.learning + stats.due + stats.paused : 0;
  const detail = selected ? byDate.get(selected) : null;

  // Vòng tròn thống kê vẽ bằng conic-gradient — không cần thư viện biểu đồ.
  const gradient = useMemo(() => {
    if (!stats || total === 0) return "var(--color-surface-2)";
    let at = 0;
    const stops = SLICES.map((s) => {
      const from = (at / total) * 100;
      at += stats[s.key];
      const to = (at / total) * 100;
      return `${s.color} ${from}% ${to}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [stats, total]);

  const weekdays = [
    t("Mo", "T2"), t("Tu", "T3"), t("We", "T4"),
    t("Th", "T5"), t("Fr", "T6"), t("Sa", "T7"), t("Su", "CN"),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lịch */}
      <div className="c-card p-6 lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="c-card-title mb-0">
            {cursor.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
          </h3>
          <div className="flex gap-1">
            <button onClick={() => shift(-1)} className="c-btn c-btn-secondary c-btn-icon" aria-label={t("Previous month", "Tháng trước")}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => shift(1)} className="c-btn c-btn-secondary c-btn-icon" aria-label={t("Next month", "Tháng sau")}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="c-alert c-alert-error">
            <AlertCircle size={18} className="icon" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5">
              {weekdays.map((w) => (
                <div key={w} className="c-stat-label text-center py-1">{w}</div>
              ))}
              {cells.map((date, i) => {
                if (!date) return <div key={`pad-${i}`} />;
                const day = byDate.get(date);
                const intensity = day ? day.reviews / busiest : 0;
                const isSelected = selected === date;
                return (
                  <button
                    key={date}
                    onClick={() => setSelected(isSelected ? null : date)}
                    className={`aspect-square rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                      isSelected ? "ring-2 ring-[var(--color-focus)]" : ""
                    }`}
                    style={{
                      background:
                        intensity > 0
                          ? `color-mix(in srgb, var(--color-accent) ${Math.round(18 + intensity * 72)}%, var(--color-surface-2))`
                          : "var(--color-surface-2)",
                      color: intensity > 0.55 ? "var(--color-on-primary)" : "var(--color-text-muted)",
                    }}
                    title={
                      day
                        ? t(`${day.reviews} reviews`, `${day.reviews} lượt ôn`)
                        : t("Nothing", "Không có gì")
                    }
                  >
                    {Number(date.slice(-2))}
                    {day && day.notes.length > 0 && (
                      <span className="absolute mt-5 w-1 h-1 rounded-full bg-current opacity-70" />
                    )}
                  </button>
                );
              })}
            </div>

            {detail && (
              <div className="border-t border-[var(--color-border)] pt-4 space-y-2">
                <p className="font-bold">{selected}</p>
                <p className="c-stat-label">
                  {t(
                    `${detail.reviews} reviews · ${detail.correct} right · ${detail.wrong} missed`,
                    `${detail.reviews} lượt ôn · ${detail.correct} đúng · ${detail.wrong} chưa thuộc`
                  )}
                </p>
                {detail.notes.map((n) => (
                  <p key={n.id} className="text-sm rounded-lg p-2.5" style={{ background: n.color ?? "var(--color-surface-2)" }}>
                    {n.body}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Thống kê */}
      <div className="c-card p-6 space-y-5">
        <h3 className="c-card-title mb-0">{t("Card status", "Tình trạng thẻ")}</h3>

        {total === 0 ? (
          <p className="c-card-body">{t("No cards yet.", "Chưa có thẻ nào.")}</p>
        ) : (
          <>
            <div className="flex justify-center">
              <div
                className="w-40 h-40 rounded-full grid place-content-center"
                style={{ background: gradient }}
                role="img"
                aria-label={t("Card status breakdown", "Phân bổ tình trạng thẻ")}
              >
                <div className="w-24 h-24 rounded-full bg-[var(--color-surface)] grid place-content-center text-center">
                  <span className="c-stat-value text-[26px]">{total}</span>
                  <span className="c-stat-label">{t("cards", "thẻ")}</span>
                </div>
              </div>
            </div>

            <ul className="flex flex-col gap-2">
              {SLICES.map((s) => (
                <li key={s.key} className="flex items-center gap-2.5 text-sm">
                  <span className="w-3 h-3 rounded-sm flex-none" style={{ background: s.color }} />
                  <span className="flex-1 text-[var(--color-text-muted)]">{t(s.en, s.vi)}</span>
                  <span className="font-bold tabular-nums">{stats?.[s.key] ?? 0}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
