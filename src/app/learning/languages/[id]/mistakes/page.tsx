"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import MistakeBook from "@/components/learning/MistakeBook";
import { useLanguage } from "@/lib/LanguageContext";

interface LanguageRow {
  id: string;
  code: string;
  name: string;
}

export default function MistakesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();

  const [lang, setLang] = useState<LanguageRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/languages", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        setLang((json?.languages ?? []).find((l: LanguageRow) => l.id === id) ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-6">
      <Link href={`/learning/languages/${id}`} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Back to language", "Về trang ngôn ngữ")}
      </Link>
      <h1 className="c-h1">{t("Mistake book", "Sổ lỗi sai")}</h1>

      {!loaded ? (
        <div className="flex items-center gap-2 c-help">
          <Loader2 size={16} className="animate-spin" />
          {t("Loading…", "Đang tải…")}
        </div>
      ) : !lang ? (
        <p className="c-help">{t("Language not found.", "Không tìm thấy thứ tiếng này.")}</p>
      ) : (
        <MistakeBook languageId={lang.id} langCode={lang.code} />
      )}
    </div>
  );
}
