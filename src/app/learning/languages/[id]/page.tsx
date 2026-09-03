"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Music2, PenLine } from "lucide-react";
import DeckManager from "@/components/learning/DeckManager";
import { useLanguage } from "@/lib/LanguageContext";
import {
  presetByCode, READING_LABEL, needsWritingPractice,
  type PhoneticSystem, type Script,
} from "@/lib/languagePresets";

interface LanguageRow {
  id: string;
  code: string;
  name: string;
  nativeName: string | null;
  script: Script;
  phoneticSystem: PhoneticSystem;
  hasTones: boolean;
  toneCount: number;
  levelScale: string;
}

/**
 * Một thứ tiếng: bộ thẻ và lộ trình của nó.
 *
 * Các mức cấp độ lấy từ mẫu theo mã ngôn ngữ (CEFR cho Anh/Pháp, HSK cho Quan
 * Thoại, TOPIK cho Hàn) — thang nào đúng với thứ tiếng đó, không dùng chung
 * một thang cho tất cả.
 */
export default function LanguagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();

  const [lang, setLang] = useState<LanguageRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/learning/languages", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        const found = (json?.languages ?? []).find((l: LanguageRow) => l.id === id);
        if (found) setLang(found);
        else setNotFound(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setNotFound(true);
      });

    return () => controller.abort();
  }, [id]);

  if (notFound) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center space-y-4">
        <h1 className="c-h3 text-[var(--color-text-muted)]">
          {t("Language not found", "Không tìm thấy thứ tiếng này")}
        </h1>
        <Link href="/learning/languages" className="c-btn c-btn-secondary c-btn-sm">
          {t("Back to languages", "Về danh sách ngôn ngữ")}
        </Link>
      </div>
    );
  }

  if (!lang) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  const levels = presetByCode(lang.code)?.levels ?? [];
  const reading = READING_LABEL[lang.phoneticSystem];

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-8">
      <Link href="/learning/languages" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Languages", "Ngôn ngữ")}
      </Link>

      <header className="space-y-3">
        <h1 className="c-h1">{lang.name}</h1>
        <div className="flex flex-wrap gap-2">
          {lang.nativeName && <span className="c-chip c-chip-outline">{lang.nativeName}</span>}
          <span className="c-chip c-chip-outline">{reading.vi}</span>
          {lang.hasTones && (
            <span className="c-chip c-chip-warning inline-flex items-center gap-1">
              <Music2 size={11} />
              {lang.toneCount} {t("tones", "thanh điệu")}
            </span>
          )}
          {needsWritingPractice(lang.script) && (
            <span className="c-chip c-chip-outline inline-flex items-center gap-1">
              <PenLine size={11} />
              {t("writing practice", "luyện viết chữ")}
            </span>
          )}
          <span className="c-chip c-chip-outline">{lang.levelScale}</span>
        </div>
      </header>

      <DeckManager languageId={lang.id} levels={levels} />
    </div>
  );
}
