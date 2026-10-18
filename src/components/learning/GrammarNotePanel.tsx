"use client";

import { Check, X, Lightbulb } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { GrammarNote } from "@/lib/grammar/types";

/**
 * Phần ghi chú soạn tay của một điểm ngữ pháp: ghi nhớ, bảng tra, lỗi hay gặp,
 * mẹo IELTS.
 *
 * Tách khỏi bài do AI viết và hiện ngay khi mở bài — không chờ mạng, nên vẫn
 * đọc được khi Gemini quá tải hay hết hạn mức trong ngày.
 *
 * Màu ngữ nghĩa chỉ nằm trên icon (✕ đỏ đất, ✓ rêu); chữ vẫn là mực. Câu sai
 * gạch ngang và nhạt đi để mắt bắt ngay câu đúng.
 */
export default function GrammarNotePanel({ note }: { note: GrammarNote }) {
  const { t } = useLanguage();
  const [head, ...rows] = note.table ?? [];

  return (
    <div className="space-y-6">
      {note.rules && note.rules.length > 0 && (
        <div className="rounded-xl p-5 bg-[var(--color-surface-2)] space-y-3">
          <p className="c-card-kicker">{t("Remember", "Ghi nhớ")}</p>
          <ul className="space-y-2">
            {note.rules.map((rule, i) => (
              <li key={i} className="flex gap-2.5 leading-relaxed">
                <span className="flex-none mt-[0.6em] w-1.5 h-1.5 rounded-full bg-[var(--color-text-faint)]" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {head && rows.length > 0 && (
        // Khổ 375px: bảng ba bốn cột chữ không vừa, nên cho cuộn ngang trong
        // khung riêng thay vì đẩy cả trang tràn ra.
        //
        // Không dùng `.c-table`: nó nằm ngoài mọi @layer nên thắng utility,
        // đệm 14px và chữ 16px của nó quá rộng cho bảng tra trong bài học.
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {head.map((cell, i) => (
                  <th
                    key={i}
                    className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-faint)] border-b border-[var(--color-border-strong)]"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-3 py-2.5 align-top border-b border-[var(--color-border)] ${j === 0 ? "font-semibold" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {note.mistakes && note.mistakes.length > 0 && (
        <div className="space-y-3">
          <p className="c-card-kicker">{t("Common mistakes", "Lỗi hay gặp")}</p>
          {note.mistakes.map((m, i) => (
            <div
              key={i}
              className="space-y-1.5 pb-3 border-b border-[var(--color-border)] last:border-0"
            >
              <p className="flex gap-2 items-start text-[var(--color-text-muted)]">
                <X size={16} className="flex-none mt-1 text-[var(--color-error)]" aria-label={t("wrong", "sai")} />
                <span className="line-through decoration-1">{m.wrong}</span>
              </p>
              <p className="flex gap-2 items-start font-medium">
                <Check size={16} className="flex-none mt-1 text-[var(--color-success)]" aria-label={t("right", "đúng")} />
                <span>{m.right}</span>
              </p>
              <p className="c-help pl-6">{m.why}</p>
            </div>
          ))}
        </div>
      )}

      {note.ielts && (
        <div className="c-alert c-alert-info">
          <Lightbulb size={18} className="icon" />
          <div className="flex-1">
            <strong>{t("IELTS tip", "Mẹo IELTS")}</strong>
            <p className="mt-0.5">{note.ielts}</p>
          </div>
        </div>
      )}
    </div>
  );
}
