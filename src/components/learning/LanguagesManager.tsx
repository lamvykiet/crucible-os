"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus, Loader2, AlertCircle, Trash2, Languages as LanguagesIcon,
  Layers, BookMarked, ChevronRight, Music2, PenLine,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { LanguagePreset } from "@/lib/languagePresets";
import { READING_LABEL, needsWritingPractice, type PhoneticSystem, type Script } from "@/lib/languagePresets";

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
  active: boolean;
  deckCount: number;
  itemCount: number;
}

/**
 * Chọn và quản lý các thứ tiếng đang học.
 *
 * Không tự chèn sẵn thứ tiếng nào — chỉ gợi ý những mẫu chưa thêm, người dùng
 * bấm mới tạo. Mỗi thứ tiếng mang theo quy ước riêng (hệ phiên âm, thanh điệu,
 * kiểu chữ), và những quy ước đó quyết định các màn sau hiện ô gì, bật phần
 * luyện nào — chứ không phải viết cứng theo tiếng Anh.
 */
export default function LanguagesManager() {
  const { t } = useLanguage();

  const [languages, setLanguages] = useState<LanguageRow[]>([]);
  const [presets, setPresets] = useState<LanguagePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/learning/languages", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được danh sách");
        setLanguages(json.languages);
        setPresets(json.presets);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const add = async (preset: LanguagePreset) => {
    setBusy(preset.code);
    setError(null);
    try {
      const res = await fetch("/api/learning/languages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: preset.code }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không thêm được");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: LanguageRow) => {
    const warning = row.deckCount
      ? t(
          `Remove ${row.name}? Its ${row.deckCount} decks go too — the words themselves stay in your term bank.`,
          `Bỏ ${row.name}? ${row.deckCount} bộ thẻ của nó sẽ mất theo — các từ vẫn còn trong kho thuật ngữ.`
        )
      : t(`Remove ${row.name}?`, `Bỏ ${row.name}?`);
    if (!window.confirm(warning)) return;

    setBusy(row.id);
    await fetch(`/api/learning/languages?id=${row.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="c-h2">{t("Languages", "Ngôn ngữ")}</h2>
        <p className="c-card-body mt-1 max-w-2xl">
          {t(
            "Each language brings its own writing system, reading notation and tones. Those settings drive every study screen that follows.",
            "Mỗi thứ tiếng có kiểu chữ, hệ phiên âm và thanh điệu riêng. Chính những thiết lập đó quyết định các màn học phía sau hiện gì."
          )}
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading...", "Đang tải...")}</span>
        </div>
      ) : (
        <>
          {/* Đang học */}
          {languages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
                <LanguagesIcon size={32} />
              </div>
              <p className="c-h3">{t("No languages yet", "Chưa chọn thứ tiếng nào")}</p>
              <p className="c-card-body max-w-sm">
                {t("Pick one below to start.", "Chọn một thứ tiếng bên dưới để bắt đầu.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {languages.map((row) => {
                const reading = READING_LABEL[row.phoneticSystem];
                return (
                  <article key={row.id} className="c-card c-elev-md p-6 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="c-card-title truncate">{row.name}</h3>
                        {row.nativeName && (
                          <p className="c-stat-label">{row.nativeName}</p>
                        )}
                      </div>
                      <button
                        onClick={() => remove(row)}
                        disabled={busy === row.id}
                        title={t("Remove", "Bỏ khỏi danh sách")}
                        className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors p-1"
                      >
                        {busy === row.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>

                    {/* Quy ước của thứ tiếng này */}
                    <div className="flex flex-wrap gap-2">
                      <span className="c-chip c-chip-outline">{reading.vi}</span>
                      {row.hasTones && (
                        <span className="c-chip c-chip-warning inline-flex items-center gap-1">
                          <Music2 size={11} />
                          {row.toneCount} {t("tones", "thanh điệu")}
                        </span>
                      )}
                      {needsWritingPractice(row.script) && (
                        <span className="c-chip c-chip-outline inline-flex items-center gap-1">
                          <PenLine size={11} />
                          {t("writing", "luyện viết")}
                        </span>
                      )}
                      <span className="c-chip c-chip-outline">{row.levelScale}</span>
                    </div>

                    <div className="flex items-center gap-4 c-stat-label">
                      <span className="flex items-center gap-1.5">
                        <Layers size={12} />
                        {row.deckCount} {t("decks", "bộ thẻ")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BookMarked size={12} />
                        {row.itemCount} {t("words", "từ")}
                      </span>
                    </div>

                    <Link
                      href={`/learning/languages/${row.id}`}
                      className="c-btn c-btn-secondary c-btn-sm justify-center mt-auto"
                    >
                      {t("Open decks", "Mở bộ thẻ")}
                      <ChevronRight size={14} />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          {/* Thêm thứ tiếng */}
          {presets.length > 0 && (
            <section className="space-y-4 pt-2">
              <h3 className="c-h3">{t("Add a language", "Thêm thứ tiếng")}</h3>
              <div className="flex flex-wrap gap-3">
                {presets.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => add(p)}
                    disabled={busy === p.code}
                    className="c-btn c-btn-secondary c-btn-pill"
                  >
                    {busy === p.code ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Plus size={15} />
                    )}
                    {p.name}
                    <span className="text-[var(--color-text-faint)]">{p.nativeName}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
