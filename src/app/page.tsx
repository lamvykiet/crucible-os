"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Wallet, Brain, Receipt, Lightbulb, Loader2, ArrowRight, Repeat, Flame } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import SceneSummary, { moneyBig } from "@/components/SceneSummary";

/**
 * Trang chủ — số liệu thật của cả ba module.
 *
 * Bản cũ hiển thị "0 Mục quá hạn" và "+1.250.000 ₫ — Số dư tháng này" viết cứng
 * ngay trong JSX, cùng hai nút không có `onClick`. Đây là màn hình đầu tiên
 * người dùng thấy mỗi lần mở ứng dụng, và con số trên đó là bịa.
 */

interface Summary {
  documents: number;
  staleDocuments: number;
  ideas: number;
  netCashFlow: number | null;
  pendingInvoices: number;
  dueCards: number;
  totalCards: number;
  habitsDone: number;
  habitsDue: number;
  habitPercent: number;
  bestStreak: number;
}

const EMPTY: Summary = {
  documents: 0, staleDocuments: 0, ideas: 0,
  netCashFlow: null, pendingInvoices: 0, dueCards: 0, totalCards: 0,
  habitsDone: 0, habitsDue: 0, habitPercent: 0, bestStreak: 0,
};

const formatVnd = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("vi-VN")} ₫`;

export default function Home() {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const [data, setData] = useState<Summary>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const month = new Date().toISOString().slice(0, 7);
    const get = (url: string) =>
      fetch(url, { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => null);

    // Mỗi nguồn hỏng độc lập: Drive lỗi thì ô tài chính vẫn hiện, và ngược lại.
    Promise.all([
      get("/api/knowledge/summary"),
      get(`/api/finance/dashboard?month=${month}`),
      get("/api/drive/pending-count"),
      get("/api/learning/flashcards?limit=1"),
      get("/api/habits"),
    ])
      .then(([knowledge, finance, pending, cards, habits]) => {
        if (controller.signal.aborted) return;
        setData({
          documents: knowledge?.data?.totalDocuments ?? 0,
          staleDocuments: knowledge?.data?.staleDocuments ?? 0,
          ideas: knowledge?.data?.totalIdeas ?? 0,
          netCashFlow: finance?.success ? (finance.data?.netCashFlow ?? 0) : null,
          pendingInvoices: pending?.count ?? 0,
          dueCards: cards?.dueCount ?? 0,
          totalCards: cards?.total ?? 0,
          habitsDone: habits?.doneCount ?? 0,
          habitsDue: habits?.dueCount ?? 0,
          habitPercent: habits?.percent ?? 0,
          bestStreak: (habits?.habits ?? []).reduce(
            (m: number, h: { streak: number }) => Math.max(m, h.streak),
            0
          ),
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const spinner = <Loader2 size={20} className="animate-spin inline" />;

  const cards = [
    {
      key: "knowledge",
      kicker: "Knowledge Hub",
      icon: BookOpen,
      href: "/knowledge",
      cta: t("Open documents", "Xem tài liệu"),
      title: loading ? spinner : `${data.documents} ${t("documents", "tài liệu")}`,
      body:
        data.staleDocuments > 0
          ? t(`${data.staleDocuments} untouched for 30+ days`, `${data.staleDocuments} tài liệu bỏ quên trên 30 ngày`)
          : t("Everything is up to date.", "Tất cả đều còn mới."),
      badge: data.ideas > 0 ? { icon: Lightbulb, text: `${data.ideas} ${t("ideas", "ý tưởng")}` } : null,
      alert: data.staleDocuments > 0,
    },
    {
      key: "finance",
      kicker: "Finance OS",
      icon: Wallet,
      href: "/finance",
      cta: t("Open ledger", "Sổ chi tiêu"),
      title: loading
        ? spinner
        : data.netCashFlow === null
          ? t("Unavailable", "Chưa đọc được")
          : formatVnd(data.netCashFlow),
      body: t("Net cash flow this month.", "Dòng tiền ròng tháng này."),
      badge:
        data.pendingInvoices > 0
          ? { icon: Receipt, text: t(`${data.pendingInvoices} to review`, `${data.pendingInvoices} hoá đơn chờ duyệt`) }
          : null,
      alert: data.pendingInvoices > 0,
    },
    {
      key: "learning",
      kicker: "Learning Hub",
      icon: Brain,
      href: "/learning/flashcards",
      cta: t("Start review", "Bắt đầu ôn"),
      title: loading ? spinner : `${data.dueCards} ${t("cards due", "thẻ tới hạn")}`,
      body:
        data.totalCards === 0
          ? t("No flashcards yet.", "Chưa có thẻ ghi nhớ nào.")
          : t(`${data.totalCards} cards in total.`, `Tổng cộng ${data.totalCards} thẻ.`),
      badge: null,
      alert: data.dueCards > 0,
    },
    {
      key: "habits",
      kicker: t("Habits", "Thói quen"),
      icon: Repeat,
      href: "/habits",
      cta: t("Open today", "Mở hôm nay"),
      title: loading ? spinner : `${data.habitPercent}%`,
      body:
        data.habitsDue === 0
          ? t("No habits scheduled for today.", "Hôm nay không có thói quen nào tới lịch.")
          : t(
              `${data.habitsDone} of ${data.habitsDue} done today.`,
              `Hôm nay xong ${data.habitsDone}/${data.habitsDue}.`
            ),
      badge:
        data.bestStreak > 0
          ? { icon: Flame, text: t(`${data.bestStreak}-day streak`, `chuỗi ${data.bestStreak} ngày`) }
          : null,
      alert: false,
    },
  ];

  // Tiêu đề trên phông cảnh: việc gấp nhất còn lại hôm nay, theo thứ tự thói
  // quen → hoá đơn chờ duyệt → thẻ ôn. Không còn gì thì nói thẳng là xong.
  const habitsLeft = data.habitsDue - data.habitsDone;
  let title = t("Overview", "Tổng quan");
  if (!loading) {
    if (habitsLeft > 0) title = t(`${habitsLeft} habits left today`, `Còn ${habitsLeft} thói quen hôm nay`);
    else if (data.pendingInvoices > 0) title = t(`${data.pendingInvoices} receipts to review`, `${data.pendingInvoices} hoá đơn chờ duyệt`);
    else if (data.dueCards > 0) title = t(`${data.dueCards} cards to review`, `${data.dueCards} thẻ cần ôn`);
    else title = t("Nothing left for today", "Hôm nay không còn việc gì");
  }
  const dash = (v: number) => (loading ? "—" : String(v));

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <SceneSummary
        title={title}
        main={{
          title: t("Today", "Hôm nay"),
          subtitle: loading
            ? undefined
            : data.habitsDue === 0
              ? t("No habits scheduled today", "Hôm nay không có thói quen tới lịch")
              : t(
                  `Habits ${data.habitsDone}/${data.habitsDue}` + (data.bestStreak > 0 ? ` · best streak ${data.bestStreak} days` : ""),
                  `Thói quen ${data.habitsDone}/${data.habitsDue}` + (data.bestStreak > 0 ? ` · chuỗi dài nhất ${data.bestStreak} ngày` : "")
                ),
          minis: [
            { label: t("Receipts to review", "Hoá đơn chờ duyệt"), value: dash(data.pendingInvoices), icon: Receipt },
            { label: t("Cards due", "Thẻ tới hạn"), value: dash(data.dueCards), icon: Brain },
            { label: t("Documents", "Tài liệu"), value: dash(data.documents), icon: BookOpen },
            { label: t("Ideas", "Ý tưởng"), value: dash(data.ideas), icon: Lightbulb },
          ],
          big: loading || data.habitsDue === 0 ? null : { value: String(data.habitPercent), unit: "%" },
        }}
        rows={[
          {
            title: t("Cash flow", "Dòng tiền"),
            subtitle: t("This month · income minus spending", "Tháng này · thu trừ chi"),
            big: loading ? null : moneyBig(data.netCashFlow, vi),
          },
          {
            title: t("Forgotten documents", "Tài liệu bỏ quên"),
            subtitle: t("Untouched for 30+ days", "Trên 30 ngày chưa mở"),
            big: loading ? null : { value: String(data.staleDocuments) },
          },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const Badge = card.badge?.icon;
          return (
            <div key={card.key} className="c-card flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="c-card-kicker">{card.kicker}</div>
                <Icon size={18} className="text-[var(--color-text-faint)]" />
              </div>

              <h2 className="c-card-title">
                {card.title}
              </h2>
              <p className="c-card-body mt-1 flex-1">{card.body}</p>

              {card.badge && Badge && (
                <span
                  className={`inline-flex items-center gap-1.5 mt-3 text-[11px] font-bold px-2.5 py-1 rounded-full w-fit ${
                    card.alert
                      ? "bg-[var(--color-warning-tint)] text-[var(--color-warning)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                  }`}
                >
                  <Badge size={12} />
                  {card.badge.text}
                </span>
              )}

              <Link
                href={card.href}
                className="c-btn c-btn-secondary c-btn-sm mt-4 w-fit flex items-center gap-1.5"
              >
                {card.cta} <ArrowRight size={14} />
              </Link>
            </div>
          );
        })}
      </div>

      {!loading && data.staleDocuments === 0 && data.pendingInvoices === 0 && data.dueCards === 0 &&
        data.habitsDone === data.habitsDue && (
        <p className="mt-8 text-sm text-[var(--color-text-faint)]">
          {t("Nothing needs your attention right now.", "Hiện chưa có việc gì cần bạn xử lý.")}
        </p>
      )}
    </div>
  );
}
