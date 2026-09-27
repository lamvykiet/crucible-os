"use client";

import { useState } from "react";
import { Loader2, Sparkles, AlertTriangle, Lightbulb, RefreshCw, StickyNote } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export interface LessonSection {
  heading: string;
  intro?: string;
  form?: { headers: string[]; rows: string[][] };
  uses?: { use: string; example: string }[];
  hints?: string[];
  watchOut?: string[];
}

export interface LessonData {
  summary: string;
  sections: LessonSection[];
  notes?: string[];
}

/**
 * Phần lý thuyết của một unit.
 *
 * Khuôn bám theo cách sách bày một unit ngữ pháp: bảng cấu tạo, bảng "dùng khi
 * nào + ví dụ", hộp mẹo, hộp cảnh báo. Khuôn sư phạm thì không ai sở hữu; câu
 * chữ trong từng ô mới là thứ có bản quyền, và chỗ đó do ứng dụng tự soạn.
 *
 * Không tự sinh lúc mở unit — phải bấm. Sinh sẵn cho mọi unit người ta chỉ lướt
 * qua là đốt hạn mức AI vào việc không ai đọc.
 */
export default function BookUnitLesson({
  bookId,
  step,
  lesson,
  onLoaded,
}: {
  bookId: string;
  step: number;
  lesson: LessonData | null;
  onLoaded: (v: LessonData) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/books/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, step, part: "lesson" }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không soạn được bài");
      onLoaded(json.lesson);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!lesson) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="c-alert c-alert-error">
            <AlertTriangle size={18} className="icon" />
            <p className="flex-1">{error}</p>
          </div>
        )}
        <div className="c-card p-8 text-center space-y-3">
          <p className="c-h4">{t("No lesson written yet", "Chưa soạn bài học")}</p>
          <p className="c-card-body max-w-md mx-auto">
            {t(
              "The concepts, forms and notes for this unit are written once and then kept, so you can come back to the same page.",
              "Khái niệm, cấu trúc và ghi chú của unit này soạn một lần rồi giữ lại, để lần sau quay lại vẫn đúng trang đó."
            )}
          </p>
          <button onClick={generate} disabled={busy} className="c-btn c-btn-primary c-btn-lg">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {busy ? t("Writing…", "Đang soạn…") : t("Write the lesson", "Soạn bài học")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <p className="leading-relaxed text-[17px]">{lesson.summary}</p>

      {lesson.sections.map((sec, i) => (
        <section key={i} className="space-y-3">
          <h3 className="c-h4">{sec.heading}</h3>
          {sec.intro && <p className="leading-relaxed">{sec.intro}</p>}

          {/* Bảng cấu tạo */}
          {sec.form && sec.form.rows?.length > 0 && (
            <div className="c-card p-4 overflow-x-auto">
              <p className="c-stat-label mb-2">{t("Form", "Cấu tạo")}</p>
              <table className="w-full text-left border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    {sec.form.headers.map((h) => (
                      <th key={h} className="c-stat-label py-1.5 pr-4 align-bottom">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sec.form.rows.map((row, r) => (
                    <tr key={r} className="border-b border-[var(--color-border)] last:border-0">
                      {row.map((cell, c) => (
                        <td key={c} className="py-2 pr-4 align-top leading-snug">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dùng khi nào + ví dụ */}
          {sec.uses && sec.uses.length > 0 && (
            <div className="c-card p-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="c-stat-label py-1.5 pr-4 w-2/5">{t("Use", "Dùng khi")}</th>
                    <th className="c-stat-label py-1.5">{t("Example", "Ví dụ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.uses.map((u, k) => (
                    <tr key={k} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2 pr-4 align-top leading-snug">{u.use}</td>
                      <td className="py-2 align-top leading-snug">{u.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sec.hints && sec.hints.length > 0 && (
            <div className="c-alert c-alert-info items-start">
              <Lightbulb size={18} className="icon" />
              <ul className="flex-1 space-y-1.5">
                {sec.hints.map((h, k) => (
                  <li key={k} className="leading-relaxed">{h}</li>
                ))}
              </ul>
            </div>
          )}

          {sec.watchOut && sec.watchOut.length > 0 && (
            <div className="c-alert c-alert-warning items-start">
              <AlertTriangle size={18} className="icon" />
              <ul className="flex-1 space-y-1.5">
                {sec.watchOut.map((w, k) => (
                  <li key={k} className="leading-relaxed">{w}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}

      {lesson.notes && lesson.notes.length > 0 && (
        <div className="c-card p-5 space-y-2">
          <p className="c-card-kicker flex items-center gap-2">
            <StickyNote size={14} />
            {t("Quick notes", "Ghi nhớ nhanh")}
          </p>
          <ul className="space-y-1.5">
            {lesson.notes.map((n, i) => (
              <li key={i} className="leading-relaxed pl-3 border-l-2 border-[var(--color-border)]">{n}</li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={generate} disabled={busy} className="c-btn c-btn-tertiary c-btn-sm">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {t("Rewrite this lesson", "Soạn lại bài này")}
      </button>
    </div>
  );
}
