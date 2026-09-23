"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Brain, BookMarked, ClipboardCheck, FolderOpen, Loader2, AlertCircle,
  ExternalLink, ArrowRight, CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import DeckManager from "@/components/learning/DeckManager";
import type { DomainStat } from "@/lib/learningStats";

interface Domain {
  id: string;
  name: string;
  webViewLink: string | null;
  documentCount: number;
}

/**
 * Bàn học của một môn.
 *
 * Trước đây địa chỉ này mở thẳng không gian ba khung tài liệu — nghĩa là "môn
 * học" đồng nghĩa với "đống tài liệu của môn đó", còn thẻ ghi nhớ, bộ thẻ và đề
 * thi thử thì nằm ở nơi khác, phải tự chọn lại bộ lọc mỗi lần.
 *
 * Giờ đây là bàn học thật: mọi công cụ đều đã gắn sẵn môn này. Bấm "Ôn thẻ" là
 * ôn thẻ CỦA MÔN NÀY, không phải mở màn ôn chung rồi tự lọc lại.
 *
 * Tài liệu vẫn còn, chuyển thành một công cụ trong bàn học thay vì là cả trang.
 */
export default function SubjectDesk({ subjectId }: { subjectId: string }) {
  const { t } = useLanguage();

  const [domain, setDomain] = useState<Domain | null>(null);
  const [stat, setStat] = useState<DomainStat | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/learning/domains", { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/learning/overview", { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([d, o]) => {
        if (controller.signal.aborted) return;

        const found = (d?.domains ?? []).find((x: Domain) => x.id === subjectId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setDomain(found);

        const match = (o?.domains ?? []).find(
          (s: DomainStat) => s.domain.trim().toLowerCase() === found.name.trim().toLowerCase()
        );
        setStat(match ?? null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, [subjectId]);

  if (notFound) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center space-y-4">
        <h1 className="c-h3 text-[var(--color-text-muted)]">
          {t("Subject not found", "Không tìm thấy môn này")}
        </h1>
        <Link href="/learning" className="c-btn c-btn-secondary c-btn-sm">
          {t("Back to Learning Hub", "Về Learning Hub")}
        </Link>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  const due = stat?.dueCount ?? 0;
  const q = encodeURIComponent(domain.name);

  /** Mọi công cụ đều mang sẵn tên môn, nên mở ra là đã đúng phạm vi. */
  const tools = [
    {
      href: `/learning/flashcards?domain=${q}`,
      icon: Brain,
      label: t("Review cards", "Ôn thẻ"),
      note: due > 0
        ? t(`${due} due now`, `${due} thẻ tới hạn`)
        : t("Nothing due", "Chưa tới hạn"),
      primary: due > 0,
    },
    {
      href: `/learning/inventory?domain=${q}`,
      icon: BookMarked,
      label: t("Term bank", "Kho thuật ngữ"),
      note: t(`${stat?.termCount ?? 0} terms`, `${stat?.termCount ?? 0} thuật ngữ`),
      primary: false,
    },
    {
      href: "/learning/exam",
      icon: ClipboardCheck,
      label: t("Mock exam", "Thi thử"),
      note: t("From this subject's documents", "Ra đề từ tài liệu môn này"),
      primary: false,
    },
    {
      href: `/learning/subject/${subjectId}/documents`,
      icon: FolderOpen,
      label: t("Documents", "Tài liệu"),
      note: t(`${domain.documentCount} files`, `${domain.documentCount} tài liệu`),
      primary: false,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-8">
      <Link href="/learning" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("All subjects", "Tất cả môn học")}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="c-card-kicker">{t("Study desk", "Bàn học")}</p>
          <h1 className="c-display mt-1">{domain.name}</h1>
        </div>
        {domain.webViewLink && (
          <a
            href={domain.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="c-btn c-btn-secondary c-btn-sm"
          >
            <ExternalLink size={14} />
            {t("Open in Drive", "Mở trong Drive")}
          </a>
        )}
      </header>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Tình hình môn này hôm nay */}
      <section className="c-card c-elev-md p-6 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[180px]">
          <p className="c-card-kicker">{t("Today", "Hôm nay")}</p>
          {due > 0 ? (
            <>
              <p className="c-stat-value">{due}</p>
              <p className="c-stat-label">{t("cards due", "thẻ tới hạn")}</p>
            </>
          ) : (
            <p className="c-h3 flex items-center gap-2 text-[var(--color-success)] mt-1">
              <CheckCircle2 size={20} />
              {t("All caught up", "Xong hết rồi")}
            </p>
          )}
        </div>

        <div className="flex gap-8">
          <div>
            <p className="c-stat-value">{stat?.termCount ?? 0}</p>
            <p className="c-stat-label">{t("terms", "thuật ngữ")}</p>
          </div>
          <div>
            <p className="c-stat-value">{domain.documentCount}</p>
            <p className="c-stat-label">{t("documents", "tài liệu")}</p>
          </div>
        </div>

        <Link
          href={`/learning/flashcards?domain=${q}`}
          className={`c-btn c-btn-lg ${due > 0 ? "c-btn-primary" : "c-btn-secondary"}`}
        >
          {due > 0 ? t("Start review", "Bắt đầu ôn") : t("Review anyway", "Ôn thêm")}
          <ArrowRight size={18} />
        </Link>
      </section>

      {/* Công cụ, đã gắn sẵn môn này */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map(({ href, icon: Icon, label, note, primary }) => (
          <Link
            key={href}
            href={href}
            className={`group c-card p-5 flex flex-col gap-2 transition-colors ${
              primary
                ? "border-[var(--color-primary)]"
                : "hover:border-[var(--color-border-strong)]"
            }`}
          >
            <Icon
              size={22}
              className={primary ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}
            />
            <p className="font-bold">{label}</p>
            <p className="c-stat-label">{note}</p>
          </Link>
        ))}
      </section>

      {/* Bộ thẻ của riêng môn này */}
      <DeckManager domain={domain.name} />
    </div>
  );
}
