"use client";

import { useState, useEffect } from "react";
import {
  Loader2, BookOpen, ListOrdered, Table2, Quote, AlertTriangle, Clock, Info,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { GuideBlock, SkillGuide } from "@/lib/skillGuides";
import type { SkillId } from "@/lib/languageSkills";

/**
 * Hiện một bài hướng dẫn kỹ năng.
 *
 * Bài soạn tay, chia thành khối có kiểu rõ ràng thay vì một khối chữ dài: bảng
 * đối chiếu, các bước, mẫu câu, ví dụ đúng-sai, và cảnh báo. Người học quét mắt
 * tìm lại được chỗ cần, thay vì phải đọc lại từ đầu.
 */
function Block({ block }: { block: GuideBlock }) {
  if (block.kind === "text") {
    return (
      <div className="space-y-1.5">
        {block.title && <p className="c-card-kicker">{block.title}</p>}
        <p className="leading-relaxed">{block.body}</p>
      </div>
    );
  }

  if (block.kind === "steps") {
    return (
      <div className="space-y-2">
        {block.title && (
          <p className="c-card-kicker flex items-center gap-2">
            <ListOrdered size={14} />
            {block.title}
          </p>
        )}
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-relaxed">
              <span className="w-6 h-6 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-[12px] font-bold grid place-content-center flex-none mt-0.5 tabular-nums">
                {i + 1}
              </span>
              <span className="flex-1">{item}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (block.kind === "table") {
    return (
      <div className="space-y-2">
        {block.title && (
          <p className="c-card-kicker flex items-center gap-2">
            <Table2 size={14} />
            {block.title}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {block.head.map((h) => (
                  <th key={h} className="c-stat-label py-2 pr-4 align-bottom">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="py-2.5 pr-4 align-top leading-relaxed">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (block.kind === "phrases") {
    return (
      <div className="space-y-2">
        {block.title && (
          <p className="c-card-kicker flex items-center gap-2">
            <Quote size={14} />
            {block.title}
          </p>
        )}
        {block.note && <p className="c-help">{block.note}</p>}
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="leading-relaxed pl-3 border-l-2 border-[var(--color-border)]"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.kind === "examples") {
    return (
      <div className="space-y-2">
        {block.title && <p className="c-card-kicker">{block.title}</p>}
        {block.note && <p className="c-help">{block.note}</p>}
        <div className="space-y-3">
          {block.items.map((ex, i) => (
            <div key={i} className="c-card p-4 space-y-2">
              {ex.bad && (
                <p className="leading-relaxed text-[var(--color-text-muted)]">
                  <span className="c-stat-label mr-2">✗</span>
                  {ex.bad}
                </p>
              )}
              <p className="leading-relaxed">
                <span className="c-stat-label mr-2 text-[var(--color-success)]">✓</span>
                {ex.good}
              </p>
              {ex.note && <p className="c-help">{ex.note}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="c-alert c-alert-warning items-start">
      <AlertTriangle size={18} className="icon" />
      <div className="flex-1 space-y-1.5">
        {block.title && <p className="font-medium">{block.title}</p>}
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function SkillGuideView({
  langCode,
  skill,
}: {
  langCode: string;
  skill: SkillId;
}) {
  const { t } = useLanguage();
  const [guide, setGuide] = useState<SkillGuide | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = `${langCode}:${skill}`;
  const loading = loadedFor !== key;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/guide?lang=${encodeURIComponent(langCode)}&skill=${encodeURIComponent(skill)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        setGuide(json?.guide ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(key);
      });
    return () => controller.abort();
  }, [key, langCode, skill]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 c-help">
        <Loader2 size={16} className="animate-spin" />
        {t("Loading…", "Đang tải…")}
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="c-card p-8 text-center space-y-2">
        <p className="c-h3">{t("No guide yet", "Chưa có bài hướng dẫn")}</p>
        <p className="c-card-body">
          {t(
            "This skill does not have a written guide for this language yet. The practice tab still works.",
            "Kỹ năng này chưa có bài hướng dẫn cho thứ tiếng đang học. Phần luyện tập vẫn dùng được bình thường."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="c-h2">{guide.title}</h2>
        <p className="c-stat-label flex items-center gap-1.5">
          <Clock size={13} />
          {t(`about ${guide.minutes} minutes to read`, `đọc khoảng ${guide.minutes} phút`)}
        </p>
        <p className="leading-relaxed">{guide.intro}</p>
      </div>

      {guide.sections.map((section, i) => (
        <section key={section.id} className="space-y-4">
          <h3 className="c-h4 flex items-baseline gap-2">
            <span className="c-stat-label tabular-nums">{i + 1}.</span>
            {section.title}
          </h3>
          <div className="space-y-5">
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} />
            ))}
          </div>
        </section>
      ))}

      {guide.references && guide.references.length > 0 && (
        <details className="c-card p-4">
          <summary className="c-stat-label cursor-pointer flex items-center gap-2">
            <Info size={13} />
            {t("Where this comes from", "Bài này dựa trên nguồn nào")}
          </summary>
          <ul className="mt-3 space-y-1.5">
            {guide.references.map((ref) => (
              <li key={ref} className="c-help">
                {ref}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="c-help flex items-start gap-2">
        <BookOpen size={14} className="flex-none mt-0.5" />
        {t(
          "Read this once, then go and practise. Come back to it when the feedback keeps pointing at the same mistake.",
          "Đọc một lượt rồi đi luyện. Quay lại đây khi nhận xét cứ chỉ vào cùng một lỗi."
        )}
      </p>
    </div>
  );
}
