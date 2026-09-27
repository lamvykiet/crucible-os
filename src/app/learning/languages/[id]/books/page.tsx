"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ArrowUpRight, Library } from "lucide-react";
import BookPath from "@/components/learning/BookPath";
import BookStepView from "@/components/learning/BookStepView";
import { useLanguage } from "@/lib/LanguageContext";

interface BookCard {
  id: string;
  title: string;
  level: string;
  note: string;
  stepCount: number;
  wordCount: number;
  doneCount: number;
}

/**
 * Tủ sách: chọn sách → đi trên đường học → mở một unit.
 *
 * Ba tầng nằm trong CÙNG một trang thay vì ba route, vì đi tới đi lui giữa
 * đường học và unit là việc làm liên tục; mỗi lần đổi route là một lần tải lại
 * và mất chỗ đang đứng trên đường.
 */
export default function BooksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();

  const [langCode, setLangCode] = useState<string | null>(null);
  const [books, setBooks] = useState<BookCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [openBook, setOpenBook] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/languages", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        const found = (json?.languages ?? []).find((l: { id: string }) => l.id === id);
        setLangCode(found?.code ?? "en");
      })
      .catch(() => setLangCode("en"));
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/books?languageId=${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        setBooks(json?.books ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-6">
      <Link href={`/learning/languages/${id}`} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Back to skills", "Về bảng kỹ năng")}
      </Link>

      {openBook && openStep !== null && langCode ? (
        <BookStepView
          bookId={openBook}
          step={openStep}
          languageId={id}
          langCode={langCode}
          onBack={() => setOpenStep(null)}
        />
      ) : openBook ? (
        <>
          <button onClick={() => setOpenBook(null)} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
            <ArrowLeft size={16} />
            {t("All books", "Mọi cuốn sách")}
          </button>
          <BookPath bookId={openBook} onOpenStep={(s) => setOpenStep(s)} />
        </>
      ) : (
        <>
          <h1 className="c-h1">{t("Books", "Tủ sách")}</h1>
          <p className="c-card-body">
            {t(
              "Each book becomes a path. One step per unit — tap a step to open its words.",
              "Mỗi cuốn sách trải thành một đường học. Mỗi bước là một unit — bấm vào để mở phần từ của nó."
            )}
          </p>

          {!loaded ? (
            <div className="flex items-center gap-2 c-help">
              <Loader2 size={16} className="animate-spin" />
              {t("Loading…", "Đang tải…")}
            </div>
          ) : books.length === 0 ? (
            <div className="c-card p-10 text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] grid place-content-center">
                <Library size={30} />
              </div>
              <p className="c-h3">{t("No books yet", "Chưa có cuốn nào")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {books.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setOpenBook(b.id)}
                  className="c-card c-elev-md p-5 text-left space-y-3 hover:border-[var(--color-primary)] transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{b.title}</p>
                    <ArrowUpRight
                      size={17}
                      className="flex-none text-[var(--color-text-faint)] group-hover:text-[var(--color-primary)] transition-colors"
                    />
                  </div>
                  <p className="c-help line-clamp-2">{b.note}</p>
                  <div className="c-progress">
                    <span style={{ width: `${Math.round((b.doneCount / b.stepCount) * 100)}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 c-stat-label tabular-nums">
                    <span className="c-chip c-chip-outline">{b.level}</span>
                    <span>{t(`${b.doneCount}/${b.stepCount} units`, `${b.doneCount}/${b.stepCount} unit`)}</span>
                    {b.wordCount > 0 && <span>{t(`${b.wordCount} words`, `${b.wordCount} từ`)}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
