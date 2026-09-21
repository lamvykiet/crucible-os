"use client";

import { useState, useEffect } from "react";
import { Quote as QuoteIcon, Loader2, Volume2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak } from "@/lib/speech";

interface Quote {
  text: string;
  translation: string | null;
  author: string | null;
}

/**
 * Câu trích hôm nay.
 *
 * Một câu ngắn, kèm bản dịch sang ngôn ngữ người dùng đã chọn — câu tiếng Anh
 * mà không hiểu thì chỉ là hình trang trí, không phải thứ để học.
 *
 * Câu do máy chủ giữ lại theo ngày nên nó đứng yên suốt cả ngày; tải lại trang
 * không đổi câu khác.
 */
export default function DailyQuoteCard() {
  const { t } = useLanguage();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/quote", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json?.success) setQuote(json.quote);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
    return () => controller.abort();
  }, []);

  // Không lấy được câu thì ẩn hẳn khối này. Một ô trống kèm lời xin lỗi còn
  // chiếm chỗ hơn là không có gì.
  if (failed) return null;

  return (
    <div className="c-card p-5 flex gap-4">
      <QuoteIcon size={20} className="text-[var(--color-accent)] flex-none mt-0.5" />

      {!quote ? (
        <div className="flex items-center h-10 text-[var(--color-text-muted)]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : (
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="c-italic text-[var(--color-text)] leading-relaxed">{quote.text}</p>
          {quote.translation && (
            <p className="text-sm text-[var(--color-text-muted)]">{quote.translation}</p>
          )}
          <div className="flex items-center gap-3 pt-0.5">
            {quote.author && <span className="c-stat-label">— {quote.author}</span>}
            <button
              onClick={() => speak(quote.text, "en")}
              className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
              aria-label={t("Listen", "Nghe")}
            >
              <Volume2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
