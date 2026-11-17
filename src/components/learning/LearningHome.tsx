"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  FolderOpen, Loader2, AlertCircle, CheckCircle2, ArrowRight,
  CalendarDays, Timer, Palette, Boxes, BarChart3,
} from "lucide-react";
import PageIntro from "@/components/PageIntro";
import { GlassCard } from "@/components/charts/GlassCard";
import { en } from "@/lib/plural";
import { useLanguage } from "@/lib/LanguageContext";
import SubjectGrid from "@/components/learning/SubjectGrid";
import DailyTasks from "@/components/learning/DailyTasks";
import StudySpace from "@/components/learning/StudySpace";
import LearningOnboarding from "@/components/learning/LearningOnboarding";
import GuidedTour, { type TourStep } from "@/components/learning/GuidedTour";
import DailyChallenge from "@/components/learning/DailyChallenge";
import DailyQuoteCard from "@/components/learning/DailyQuoteCard";
import NotificationBell from "@/components/learning/NotificationBell";
import WordSearch from "@/components/learning/WordSearch";
import type { DomainStat } from "@/lib/learningStats";
import { VIZ } from "@/lib/viz";

/** Các chặng của tour, trỏ tới phần tử qua thuộc tính `data-tour`. */
const TOUR: TourStep[] = [
  {
    target: "today",
    titleEn: "Today", titleVi: "Hôm nay",
    bodyEn: "How many cards are due right now, your streak, and how big your term bank has grown.",
    bodyVi: "Còn bao nhiêu thẻ tới hạn ngay lúc này, chuỗi ngày học, và kho thuật ngữ đã dày tới đâu.",
  },
  {
    target: "subjects",
    titleEn: "Your subjects", titleVi: "Các môn bạn học",
    bodyEn: "Open a subject to get its own desk: its decks, its cards, its documents and its mock exams.",
    bodyVi: "Mở một môn là vào bàn học riêng của môn đó: bộ thẻ, thẻ ghi nhớ, tài liệu và đề thi thử của chính nó.",
  },
  {
    target: "challenge",
    titleEn: "Streak and daily challenge", titleVi: "Chuỗi ngày và thử thách",
    bodyEn: "One mission a day with a reward and a deadline at midnight. The streak survives a quiet day, but not two.",
    bodyVi: "Mỗi ngày một nhiệm vụ, có thưởng và có hạn chót lúc nửa đêm. Chuỗi chịu được một ngày nghỉ, nhưng không chịu được hai.",
  },
  {
    target: "bell",
    titleEn: "Notifications", titleVi: "Thông báo",
    bodyEn: "Warns you when the streak is about to break or the challenge is running out of time.",
    bodyVi: "Nhắc khi chuỗi sắp đứt hoặc thử thách sắp hết giờ.",
  },
  {
    target: "tasks",
    titleEn: "Today's tasks", titleVi: "Việc hôm nay",
    bodyEn: "Progress counts itself from what you actually reviewed. Hide any task you do not care about.",
    bodyVi: "Tiến độ tự đếm từ những gì bạn thật sự đã ôn. Việc nào không quan tâm thì ẩn đi.",
  },
  {
    target: "tools",
    titleEn: "Tools across subjects", titleVi: "Công cụ dùng chung",
    bodyEn: "These span every subject: the whole card library, your history, progress, focus timer and study space.",
    bodyVi: "Những thứ này trải ngang mọi môn: toàn bộ kho thẻ, lịch sử, tiến độ, đồng hồ tập trung và không gian học.",
  },
];

interface Overview {
  displayName: string | null;
  onboarded: boolean;
  translationLanguage: string;
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
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

  const greeting =
    hour === null
      ? ""
      : hour < 12
        ? t("Good morning", "Chào buổi sáng")
        : hour < 18
          ? t("Good afternoon", "Chào buổi chiều")
          : t("Good evening", "Chào buổi tối");

  // Chip buổi đứng cạnh lời chào. Cùng nguồn giờ với lời chào nên không bao
  // giờ lệch kiểu "Chào buổi sáng · Tối".
  const timeChip =
    hour === null
      ? null
      : hour < 12
        ? t("Morning", "Buổi sáng")
        : hour < 18
          ? t("Afternoon", "Buổi chiều")
          : t("Evening", "Buổi tối");

  const totals = data?.totals;
  const due = totals?.dueCount ?? 0;
  const attempts = data?.attempts ?? [];

  // Chỉ còn những công cụ trải ngang MỌI môn. Ôn thẻ, kho thuật ngữ, thi thử
  // và tài liệu đã dời vào bàn học của từng môn — chúng vốn luôn cần biết đang
  // học môn nào, để ở ngoài thì người dùng phải tự chọn lại bộ lọc mỗi lần.
  const tools = [
    { href: "/learning/inventory", icon: Boxes, label: t("Inventory", "Kho thẻ") },
    { href: "/learning/history", icon: CalendarDays, label: t("History", "Lịch sử") },
    { href: "/learning/progress", icon: BarChart3, label: t("Progress", "Tiến độ") },
    { href: "/learning/focus", icon: Timer, label: t("Focus", "Tập trung") },
    { href: "/learning/space", icon: Palette, label: t("Study space", "Không gian") },
    { href: "/knowledge", icon: FolderOpen, label: t("All documents", "Toàn bộ tài liệu") },
  ];

  // Tóm tắt trên phông cảnh: việc học cần làm hôm nay, tính từ /overview.
  const tot = data?.totals;
  // Câu kết luận đầu trang: việc học cần làm hôm nay, tính từ /overview.
  let lede: string | undefined;
  if (tot) {
    const streakTail = tot.streak > 1 ? t(` Streak: ${tot.streak} days.`, ` Chuỗi ${tot.streak} ngày liền.`) : "";
    if (tot.dueCount > 0) lede = t(`${en(tot.dueCount, "card")} due today${tot.newCount ? `, ${tot.newCount} new` : ""}.`, `${tot.dueCount} thẻ cần ôn hôm nay${tot.newCount ? `, ${tot.newCount} thẻ mới` : ""}.`) + streakTail;
    else if (tot.reviewedToday > 0) lede = t(`${en(tot.reviewedToday, "card")} reviewed today — nothing left due.`, `Đã ôn ${tot.reviewedToday} thẻ hôm nay — không còn thẻ tới hạn.`) + streakTail;
    else if (tot.cardCount === 0) lede = t("No flashcards yet — create some in a subject desk.", "Chưa có thẻ ôn nào — tạo thẻ trong bàn học của một môn.");
    else lede = t("Nothing due today.", "Hôm nay không có thẻ tới hạn.") + streakTail;
  }

  return (
    <StudySpace>
    <div className="max-w-7xl mx-auto space-y-10 pb-24">
      <PageIntro
        title={t("Learning", "Học tập")}
        kicker={<>{greeting}{timeChip ? ` · ${timeChip}` : ""}</>}
        lede={lede}
        aside={<div data-tour="bell"><NotificationBell /></div>}
      />

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Hôm nay */}
      <section data-tour="today" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
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
        </GlassCard>

        <div className="lg:col-span-1" data-tour="challenge">
          <DailyChallenge streak={totals?.streak ?? 0} />
        </div>
      </section>

      {/* Môn học — nội dung chính của trang */}
      <SubjectGrid stats={data?.domains ?? []} />

      {/* Việc hôm nay */}
      <div data-tour="tasks">
        <DailyTasks />
      </div>

      {/* Câu trích hôm nay */}
      <DailyQuoteCard />

      {/* Công cụ dùng chung cho mọi môn */}
      <nav data-tour="tools" className="space-y-3">
        <p className="c-card-kicker">{t("Across all subjects", "Dùng chung mọi môn")}</p>
        <div className="flex flex-wrap gap-3">
          {tools.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="c-btn c-btn-secondary c-btn-pill">
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Bài thi gần đây */}
      {attempts.length > 0 && (
        <section className="space-y-4">
          <h2 className="c-h2">{t("Recent mock exams", "Bài thi thử gần đây")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {attempts.map((a, i) => {
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
                  {/* Xám là mặc định; chỉ lần thi mới nhất (API trả mới trước) mang
                      màu nhấn — ba thanh đất nung cạnh nhau thì không thanh nào nổi. */}
                  <div className="c-progress">
                    <span style={{ width: `${pct}%`, background: i === 0 ? VIZ.accent : VIZ.muted }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>

      {/* Lần đầu mở Hub: chọn ngôn ngữ dịch nghĩa và các tiếng sẽ học. Chỉ dựng
          sau khi đã biết trạng thái thật, để không loé màn khởi đầu với người
          đã qua bước này. */}
      {!loading && data && !data.onboarded && (
        <LearningOnboarding
          initialCode={data.translationLanguage}
          onDone={() => setReloadKey((k) => k + 1)}
        />
      )}

      {/* Tour chỉ chạy sau khi đã qua màn khởi đầu — chồng hai lớp phủ lên nhau
          thì chẳng đọc được lớp nào. */}
      {!loading && data?.onboarded && <GuidedTour steps={TOUR} storageKey="learning-tour-v2" />}

      {/* Tra từ nhanh — nút nổi, mở được bằng Ctrl+K ở bất cứ đâu trong Hub */}
      <WordSearch />
    </StudySpace>
  );
}
