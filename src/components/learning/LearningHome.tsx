"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Brain, BookMarked, ClipboardCheck, FolderOpen, Flame, Loader2, AlertCircle,
  CheckCircle2, ArrowRight, Languages as LanguagesIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import SubjectsTab from "@/components/learning/SubjectsTab";
import type { DomainStat } from "@/lib/learningStats";

interface Overview {
  totals: {
    cardCount: number;
    termCount: number;
    dueCount: number;
    newCount: number;
    reviewedToday: number;
    streak: number;
  };
  domains: DomainStat[];
  attempts: {
    id: string;
    sourceName: string;
    questionCount: number;
    correctCount: number;
    completedAt: string;
  }[];
}

/** Giờ trên máy không đổi trong lúc trang mở, nên không có gì để theo dõi. */
const noSubscribe = () => () => {};

/**
 * Giờ hiện tại theo đồng hồ của máy người dùng, hoặc `null` khi dựng trên máy chủ.
 *
 * Máy chủ chạy UTC còn trình duyệt ở giờ Việt Nam, nên render thẳng giờ ra HTML
 * là lệch hydration. `useSyncExternalStore` cho phép trả về hai ảnh chụp khác
 * nhau cho hai phía một cách hợp lệ — sạch hơn cách đọc trong `useEffect`, vốn
 * gây thêm một lượt render và bị react-hooks chặn.
 */
function useGreetingHour() {
  return useSyncExternalStore(
    noSubscribe,
    () => new Date().getHours(),
    () => null
  );
}

/**
 * Trang chủ Learning Hub.
 *
 * Bản cũ mở ra là một dải ba tab (Lĩnh vực / Từ điển / Thi thử) — một kho công
 * cụ, vào rồi phải tự nghĩ xem hôm nay làm gì. Bản này trả lời sẵn câu đó: còn
 * bao nhiêu thẻ tới hạn, ở lĩnh vực nào, và một nút để bắt đầu.
 *
 * Quan trọng: Hub không phục vụ riêng một môn. Mọi con số ở đây đều tách theo
 * lĩnh vực — lĩnh vực là thư mục Drive do người dùng tự tạo, nên thêm một mảng
 * học mới không cần sửa code.
 */
export default function LearningHome() {
  const { t } = useLanguage();
  const hour = useGreetingHour();

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/learning/overview", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được số liệu");
        setData(json);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const greeting =
    hour === null
      ? ""
      : hour < 12
        ? t("Good morning", "Chào buổi sáng")
        : hour < 18
          ? t("Good afternoon", "Chào buổi chiều")
          : t("Good evening", "Chào buổi tối");

  const totals = data?.totals;
  const due = totals?.dueCount ?? 0;
  const attempts = data?.attempts ?? [];

  const actions = [
    { href: "/learning/languages", icon: LanguagesIcon, label: t("Languages", "Ngôn ngữ") },
    { href: "/learning/flashcards", icon: Brain, label: t("Review cards", "Ôn thẻ") },
    { href: "/learning/dictionary", icon: BookMarked, label: t("Term bank", "Kho thuật ngữ") },
    { href: "/learning/exam", icon: ClipboardCheck, label: t("Mock exam", "Thi thử") },
    { href: "/knowledge", icon: FolderOpen, label: t("Documents", "Tài liệu") },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24">
      {/* Lời chào */}
      <header className="pt-2">
        <p className="c-overline min-h-[16px]">{greeting}</p>
        <h1 className="c-display mt-1">Learning Hub</h1>
        <p className="c-card-body mt-2 max-w-xl">
          {t(
            "Every subject in one place — terms, cards and mock exams, tracked per field.",
            "Mọi lĩnh vực trong một chỗ — thuật ngữ, thẻ ghi nhớ và đề thi thử, theo dõi riêng từng mảng."
          )}
        </p>
      </header>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Hôm nay */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="c-card c-elev-md lg:col-span-2 p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <p className="c-card-kicker">{t("Today", "Hôm nay")}</p>
            {loading ? (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] h-[52px]">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm font-bold">{t("Loading...", "Đang tải...")}</span>
              </div>
            ) : due > 0 ? (
              <>
                <p className="c-stat-value">{due}</p>
                <p className="c-stat-label">
                  {t("cards due", "thẻ tới hạn")}
                  {totals?.newCount ? ` · ${totals.newCount} ${t("new", "thẻ mới")}` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="c-h3 flex items-center gap-2 text-[var(--color-success)]">
                  <CheckCircle2 size={22} />
                  {t("All caught up", "Xong hết rồi")}
                </p>
                <p className="c-stat-label mt-1">
                  {totals?.reviewedToday
                    ? t(
                        `${totals.reviewedToday} cards reviewed today`,
                        `Đã ôn ${totals.reviewedToday} thẻ hôm nay`
                      )
                    : t("Nothing due right now.", "Chưa có thẻ nào tới hạn.")}
                </p>
              </>
            )}
          </div>

          <Link
            href="/learning/flashcards"
            className={`c-btn c-btn-lg justify-center whitespace-nowrap ${
              due > 0 ? "c-btn-primary" : "c-btn-secondary"
            }`}
          >
            {due > 0 ? t("Start review", "Bắt đầu ôn") : t("Review anyway", "Ôn thêm")}
            <ArrowRight size={18} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="c-card p-5 flex flex-col justify-between">
            <p className="c-card-kicker flex items-center gap-1.5">
              <Flame size={13} />
              {t("Streak", "Chuỗi")}
            </p>
            <div>
              <p className="c-stat-value">{totals?.streak ?? 0}</p>
              <p className="c-stat-label">{t("days", "ngày")}</p>
            </div>
          </div>
          <div className="c-card p-5 flex flex-col justify-between">
            <p className="c-card-kicker">{t("Term bank", "Kho từ")}</p>
            <div>
              <p className="c-stat-value">{totals?.termCount ?? 0}</p>
              <p className="c-stat-label">{t("terms", "thuật ngữ")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lối tắt */}
      <nav className="flex flex-wrap gap-3">
        {actions.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className="c-btn c-btn-secondary c-btn-pill">
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Lĩnh vực — mỗi thư mục Drive là một mảng học riêng */}
      <SubjectsTab stats={data?.domains ?? []} />

      {/* Bài thi gần đây */}
      {attempts.length > 0 && (
        <section className="space-y-4">
          <h2 className="c-h2">{t("Recent mock exams", "Bài thi thử gần đây")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {attempts.map((a) => {
              const pct = a.questionCount
                ? Math.round((a.correctCount / a.questionCount) * 100)
                : 0;
              return (
                <div key={a.id} className="c-card p-5">
                  <p className="c-card-title truncate" title={a.sourceName}>
                    {a.sourceName}
                  </p>
                  <p className="c-stat-label mb-3">
                    {a.correctCount}/{a.questionCount} {t("correct", "câu đúng")}
                  </p>
                  <div className="c-progress">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
