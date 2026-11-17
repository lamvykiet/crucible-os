"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookX } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

/** Thẻ dẫn vào Sổ lỗi sai, kèm số câu đang chờ ôn. */
export default function MistakeBookLink({ languageId }: { languageId: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/mistakes?countOnly=1&languageId=${encodeURIComponent(languageId)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (!controller.signal.aborted && json?.success) setOpen(json.open);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [languageId]);

  return (
    <Link
      href={`/learning/languages/${languageId}/mistakes`}
      className="c-card c-elev-md p-6 flex items-center gap-4 hover:border-[var(--color-primary)] transition-colors"
    >
      <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] grid place-content-center flex-none">
        <BookX size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="c-h4">{t("Mistake book", "Sổ lỗi sai")}</p>
        <p className="c-help">
          {open === null
            ? t("Everything you got wrong, in one place to review.", "Mọi câu đã làm sai, gom một chỗ để ôn.")
            : open === 0
              ? t("Empty — nothing to review right now.", "Đang trống — chưa có câu nào cần ôn.")
              : t(`${open} to review.`, `${open} câu đang chờ ôn.`)}
        </p>
      </div>
      <ArrowRight size={18} className="flex-none text-[var(--color-text-faint)]" />
    </Link>
  );
}
