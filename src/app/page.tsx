"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Wallet, Brain, Receipt, Lightbulb, Loader2, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

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
}

const EMPTY: Summary = {
  documents: 0, staleDocuments: 0, ideas: 0,
  netCashFlow: null, pendingInvoices: 0, dueCards: 0, totalCards: 0,
};

const formatVnd = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("vi-VN")} ₫`;

export default function Home() {
  const { t } = useLanguage();
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
    ])
      .then(([knowledge, finance, pending, cards]) => {
        if (controller.signal.aborted) return;
        setData({
          documents: knowledge?.data?.totalDocuments ?? 0,
          staleDocuments: knowledge?.data?.staleDocuments ?? 0,
          ideas: knowledge?.data?.totalIdeas ?? 0,
          netCashFlow: finance?.success ? (finance.data?.netCashFlow ?? 0) : null,
          pendingInvoices: pending?.count ?? 0,
          dueCards: cards?.dueCount ?? 0,
          totalCards: cards?.total ?? 0,
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
  ];

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <h1 className="c-h1">
        Crucible OS
      </h1>
      <p className="c-card-body mt-2">
        {t(
          "Your personal OS — Knowledge, Learning and Finance in one place.",
          "Hệ điều hành cá nhân — Kiến thức, Học tập và Tài chính trong một chỗ."
        )}
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {!loading && data.staleDocuments === 0 && data.pendingInvoices === 0 && data.dueCards === 0 && (
        <p className="mt-8 text-sm text-[var(--color-text-faint)]">
          {t("Nothing needs your attention right now.", "Hiện chưa có việc gì cần bạn xử lý.")}
        </p>
      )}
    </div>
  );
}
