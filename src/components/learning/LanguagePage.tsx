"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export interface LanguageInfo {
  id: string;
  code: string;
  name: string;
  script: string;
}

/**
 * Khung chung của các trang con trong một thứ tiếng: nút quay lại, tiêu đề, và
 * tải thông tin thứ tiếng trước khi dựng phần thân.
 */
export default function LanguagePage({
  id,
  title,
  backHref,
  backLabel,
  wide = false,
  children,
}: {
  id: string;
  /** Null = trang tự đặt tiêu đề trong phần thân (Lộ trình đặt trong thẻ đầu trang). */
  title: [string, string] | null;
  backHref?: string;
  backLabel?: [string, string];
  wide?: boolean;
  children: (lang: LanguageInfo) => ReactNode;
}) {
  const { t } = useLanguage();
  const [lang, setLang] = useState<LanguageInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/languages", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        setLang((json?.languages ?? []).find((l: LanguageInfo) => l.id === id) ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, [id]);

  const back = backLabel ?? ["Back to language", "Về trang ngôn ngữ"];

  return (
    <div className={`${wide ? "max-w-7xl" : "max-w-5xl"} mx-auto pb-24 space-y-6`}>
      <Link href={backHref ?? `/learning/languages/${id}`} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t(back[0], back[1])}
      </Link>
      {title && <h1 className="c-h1">{t(title[0], title[1])}</h1>}
      {!loaded ? (
        <div className="flex items-center gap-2 c-help">
          <Loader2 size={16} className="animate-spin" />
          {t("Loading…", "Đang tải…")}
        </div>
      ) : !lang ? (
        <p className="c-help">{t("Language not found.", "Không tìm thấy thứ tiếng này.")}</p>
      ) : (
        children(lang)
      )}
    </div>
  );
}
