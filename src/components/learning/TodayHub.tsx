"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Map as MapIcon, Type, BookMarked, Feather, BookOpenText, Clapperboard, Search } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Counts {
  path: { level: string | null; lessons: number | null };
  sentences: number;
  aiDecks: number;
  cards: number;
  grammar: number;
  readings: number;
  videos: number;
  dictionary: number;
}

/** Trang Đọc & dịch và Video dựng sau; bật lên khi trang đã có. */
const READY = { read: true, video: false };

/**
 * Hàng "Hôm nay học gì?" — bố cục theo trang chủ aioenglish.com: mỗi chức năng
 * học một thẻ, có con số thật và một câu nói rõ học cái gì. Phong cách vẫn là
 * Kính của dự án (một màu nhấn, không thẻ màu mè).
 */
export default function TodayHub({ languageId }: { languageId: string }) {
  const { t, language } = useLanguage();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [latin, setLatin] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/hub?languageId=${encodeURIComponent(languageId)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setCounts(json.counts);
        setLatin(json.latin);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [languageId]);

  const fmt = (n: number) => n.toLocaleString(language === "vi" ? "vi-VN" : "en-US");
  const base = `/learning/languages/${languageId}`;

  const cards = [
    {
      key: "path", icon: MapIcon, href: `${base}/path`,
      title: t("Path", "Lộ trình"),
      blurb: t("A1 to C1, chapter by chapter", "A1 đến C1, theo từng chương"),
      badge: counts?.path.level
        ? t(`${fmt(counts.path.lessons ?? 0)} lessons · ${counts.path.level}`, `${fmt(counts.path.lessons ?? 0)} bài · ${counts.path.level}`)
        : t("Set up", "Thiết lập"),
      show: true,
    },
    {
      key: "typing", icon: Type, href: `${base}/typing`,
      title: t("Sentence typing", "Gõ câu"),
      blurb: t("Type model sentences, fix what you miss", "Gõ lại câu mẫu, sai đâu sửa đó"),
      badge: counts ? t(`${fmt(counts.sentences)} sentences${counts.aiDecks ? ` · ${counts.aiDecks} AI sets` : ""}`, `${fmt(counts.sentences)} câu${counts.aiDecks ? ` · ${counts.aiDecks} bộ AI` : ""}`) : "…",
      show: latin,
    },
    {
      key: "vocab", icon: BookMarked, href: `${base}/vocabulary`,
      title: t("Vocabulary", "Từ vựng"),
      blurb: t("New words, reviewed just before you forget", "Học từ mới, ôn khi sắp quên"),
      badge: counts ? t(`${fmt(counts.cards)} cards`, `${fmt(counts.cards)} thẻ`) : "…",
      show: true,
    },
    {
      key: "grammar", icon: Feather, href: `${base}/grammar`,
      title: t("Grammar", "Ngữ pháp"),
      blurb: t("Step by step, every level", "Học từng bước, đủ mọi cấp"),
      badge: counts ? t(`${fmt(counts.grammar)} points`, `${fmt(counts.grammar)} điểm`) : "…",
      show: true,
    },
    {
      key: "read", icon: BookOpenText, href: `${base}/read-translate`,
      title: t("Read & translate", "Đọc & dịch"),
      blurb: t("Bilingual texts, translations graded", "Bài song ngữ, dịch có chấm điểm"),
      badge: counts ? t(`${fmt(counts.readings)} texts`, `${fmt(counts.readings)} bài`) : "…",
      show: latin && READY.read,
    },
    {
      key: "video", icon: Clapperboard, href: `${base}/video`,
      title: t("Video", "Video"),
      blurb: t("One video, three ways to learn", "Một video, ba cách học"),
      badge: counts ? t(`${fmt(counts.videos)} videos`, `${fmt(counts.videos)} video`) : "…",
      show: latin && READY.video,
    },
    {
      key: "dict", icon: Search, href: `/learning/dictionary`,
      title: t("Dictionary", "Từ điển"),
      blurb: t("Meaning, pronunciation, examples", "Nghĩa, cách đọc và ví dụ"),
      badge: t("Look anything up", "Tra mọi từ"),
      show: true,
    },
  ].filter((c) => c.show);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="c-h2">{t("What to study today?", "Hôm nay học gì?")}</h2>
        <p className="c-help">{t("A little every day is enough.", "Mỗi ngày một chút, đều đặn là được.")}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.key}
              href={c.href}
              className={`c-card p-4 flex flex-col gap-3 min-h-[180px] hover:border-[var(--color-primary)] transition-colors ${
                c.key === "path" ? "c-elev-md" : ""
              }`}
            >
              <span className="c-chip c-chip-outline w-fit text-[12px] tabular-nums">{c.badge}</span>
              <div className="space-y-1">
                <p className="c-h4">{c.title}</p>
                <p className="c-help leading-snug">{c.blurb}</p>
              </div>
              <span className="mt-auto ml-auto w-12 h-12 rounded-2xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] grid place-content-center">
                <Icon size={22} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
