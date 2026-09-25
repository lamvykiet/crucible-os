"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookMarked, Feather, Headphones, BookOpen, PenLine, Mic, AudioLines, PenTool,
  Keyboard, Link2,
  Loader2, AlertCircle, Lock,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { skillLevel, type SkillId } from "@/lib/languageSkills";

interface SkillRow {
  id: SkillId;
  en: string;
  vi: string;
  blurbEn: string;
  blurbVi: string;
  needsMic: boolean;
  available: boolean;
  href: string | null;
  progress: { xp: number; lessonsDone: number; minutes: number; lastPracticedAt: string | null };
}

const ICONS: Record<SkillId, typeof BookMarked> = {
  vocabulary: BookMarked,
  collocations: Link2,
  grammar: Feather,
  dictation: Keyboard,
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
  speaking: Mic,
  pronunciation: AudioLines,
  writingSystem: PenTool,
};

/**
 * Bảng kỹ năng của một thứ tiếng.
 *
 * Kỹ năng là chức năng của ứng dụng, không phải thư mục — "luyện nói" không thể
 * là một chỗ chứa tài liệu. Kỹ năng nào hiện ra phụ thuộc hệ chữ: tiếng Latin
 * không có phần luyện viết chữ, chữ Hán và Hangul thì có.
 *
 * Mỗi kỹ năng có cấp riêng, tính từ điểm tích luỹ. Chia nhỏ như vậy để thấy
 * ngay mình đang lệch: đọc tốt mà nói bỏ bê thì nhìn bảng là rõ, thay vì chỉ có
 * một con số tổng che mất điều đó.
 */
export default function SkillsBoard({ languageId }: { languageId: string }) {
  const { t } = useLanguage();

  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== languageId;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/learning/skills?languageId=${encodeURIComponent(languageId)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không đọc được kỹ năng");
        setSkills(json.skills);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(languageId);
      });

    return () => controller.abort();
  }, [languageId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="c-h2">{t("Skills", "Kỹ năng")}</h2>
        <p className="c-card-body mt-1">
          {t(
            "Each skill levels up on its own, so you can see which one you have been avoiding.",
            "Mỗi kỹ năng lên cấp riêng, nên nhìn là biết mình đang né kỹ năng nào."
          )}
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((s) => {
          const Icon = ICONS[s.id] ?? BookMarked;
          const { level, percent } = skillLevel(s.progress.xp);
          const started = s.progress.xp > 0;

          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`w-12 h-12 rounded-2xl grid place-content-center flex-none ${
                    s.available
                      ? "bg-[var(--color-accent-tint)] text-[var(--color-accent)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
                  }`}
                >
                  <Icon size={22} />
                </span>

                {s.available ? (
                  started && (
                    <span className="c-chip c-chip-outline">
                      {t(`Level ${level}`, `Cấp ${level}`)}
                    </span>
                  )
                ) : (
                  <span className="c-chip c-chip-outline inline-flex items-center gap-1">
                    <Lock size={11} />
                    {t("Soon", "Sắp có")}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="font-bold flex items-center gap-1.5">
                  {t(s.en, s.vi)}
                  {s.needsMic && (
                    <Mic size={12} className="text-[var(--color-text-faint)]" />
                  )}
                </p>
                <p className="c-stat-label leading-snug">{t(s.blurbEn, s.blurbVi)}</p>
              </div>

              {s.available && (
                <div className="mt-auto space-y-1.5">
                  <div className="c-progress">
                    <span style={{ width: `${started ? percent : 0}%` }} />
                  </div>
                  <p className="c-stat-label tabular-nums">
                    {started
                      ? t(
                          `${s.progress.xp} XP · ${s.progress.lessonsDone} sessions`,
                          `${s.progress.xp} điểm · ${s.progress.lessonsDone} lượt`
                        )
                      : t("Not started", "Chưa bắt đầu")}
                  </p>
                </div>
              )}
            </>
          );

          const base = "c-card p-5 flex flex-col gap-3 min-h-[190px]";

          return s.available && s.href ? (
            <Link
              key={s.id}
              href={s.href}
              className={`${base} hover:border-[var(--color-primary)] transition-colors`}
            >
              {inner}
            </Link>
          ) : (
            <div key={s.id} className={`${base} opacity-60`}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
