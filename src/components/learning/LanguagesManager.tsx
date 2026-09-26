"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus, Loader2, AlertCircle, Trash2, Languages as LanguagesIcon,
  ArrowUpRight, Music2, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { LanguagePreset } from "@/lib/languagePresets";
import type { PhoneticSystem, Script } from "@/lib/languagePresets";

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
  /** Điểm tích luỹ trên mọi kỹ năng của thứ tiếng này. */
  xp: number;
  /** Đã động tới bao nhiêu kỹ năng. */
  skillsTouched: number;
  lastPracticedAt: string | null;
}

/** Tổng số kỹ năng một thứ tiếng có, để tính phần trăm đã chạm tới. */
const SKILL_COUNT = 9;

/**
 * "hôm nay" / "3 ngày trước" — ngắn hơn và dễ đọc hơn một ngày tháng đầy đủ.
 *
 * Người học cần biết "lâu chưa" chứ không cần biết chính xác ngày nào. Quá hai
 * tuần thì mới hiện ngày, vì lúc đó con số ngày đã mất ý nghĩa.
 */
function lastSeen(iso: string | null, t: (en: string, vi: string) => string) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t("today", "hôm nay");
  if (days === 1) return t("yesterday", "hôm qua");
  if (days <= 14) return t(`${days} days ago`, `${days} ngày trước`);
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
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
              {languages.map((row) => (
                  <article
                    key={row.id}
                    className="c-card c-elev-md p-6 relative group transition-colors hover:border-[var(--color-primary)]"
                  >
                    {/* Cả thẻ là lối vào. Trước đây thẻ có thêm nút "Mở bộ thẻ"
                        ở dưới — thừa, vì thẻ chỉ có đúng một hành động chính, và
                        nhãn nút còn sai: bấm vào là ra bảng kỹ năng chứ không
                        phải bộ thẻ.

                        Dùng lối "link phủ kín": thẻ <Link> trải hết thẻ nằm dưới,
                        nội dung nổi lên trên nhưng cho chuột xuyên qua. Cách này
                        giữ HTML hợp lệ — nút Xoá không bị lồng trong thẻ <a>. */}
                    <Link
                      href={`/learning/languages/${row.id}`}
                      aria-label={t(`Open ${row.name}`, `Mở ${row.name}`)}
                      className="absolute inset-0 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                    />

                    <div className="relative pointer-events-none flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="c-card-title truncate">{row.name}</h3>
                          {row.nativeName && <p className="c-stat-label">{row.nativeName}</p>}
                        </div>
                        <ArrowUpRight
                          size={18}
                          className="flex-none text-[var(--color-text-faint)] group-hover:text-[var(--color-primary)] transition-colors"
                        />
                      </div>

                      {/* Chỉ giữ chip nào THẬT SỰ khác biệt giữa các thứ tiếng.
                          Bản cũ hiện bốn chip cho mọi thẻ (hệ phiên âm, thanh
                          điệu, luyện viết, thang cấp) — ba trong số đó là thứ
                          đọc một lần rồi thôi, nhưng chiếm chỗ ở mọi lần nhìn. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="c-chip c-chip-outline">{row.levelScale}</span>
                        {row.hasTones && (
                          <span className="c-chip c-chip-outline inline-flex items-center gap-1">
                            <Music2 size={11} />
                            {row.toneCount} {t("tones", "thanh")}
                          </span>
                        )}
                      </div>

                      {/* Tiến độ thật, thay cho "0 bộ thẻ, 0 từ" */}
                      {row.skillsTouched === 0 ? (
                        <div className="flex items-center gap-2 c-stat-label">
                          <Sparkles size={13} className="text-[var(--color-primary)]" />
                          {t("Not started — tap to begin", "Chưa bắt đầu — bấm vào để mở")}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="c-progress">
                            <span
                              style={{ width: `${Math.round((row.skillsTouched / SKILL_COUNT) * 100)}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 c-stat-label tabular-nums">
                            <span>
                              {t(
                                `${row.skillsTouched} of ${SKILL_COUNT} skills started`,
                                `đã chạm ${row.skillsTouched}/${SKILL_COUNT} kỹ năng`
                              )}
                            </span>
                            <span>{t(`${row.xp} XP`, `${row.xp} điểm`)}</span>
                            {lastSeen(row.lastPracticedAt, t) && (
                              <span>{t("last", "gần nhất")} {lastSeen(row.lastPracticedAt, t)}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Xoá là việc hiếm và không hoàn tác được, nên không cho nó
                        đứng ngang hàng với hành động chính: chỉ hiện khi rê chuột
                        hoặc khi bàn phím focus tới. Trên cảm ứng không có rê
                        chuột nên vẫn giữ hiện mờ, chứ không giấu hẳn. */}
                    <button
                      onClick={() => remove(row)}
                      disabled={busy === row.id}
                      title={t("Remove", "Bỏ khỏi danh sách")}
                      aria-label={t(`Remove ${row.name}`, `Bỏ ${row.name} khỏi danh sách`)}
                      // Vùng chạm tối thiểu 44px — dưới mức đó thì ngón tay bấm trượt. Đệm
                      // đơn thuần chỉ ra 31px, nên phải đặt kích thước tối thiểu.
                      className="absolute bottom-2 right-2 w-11 h-11 grid place-content-center rounded-full text-[var(--color-text-faint)] opacity-40 md:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--color-error-tint)] hover:text-[var(--color-error)] transition-all"
                    >
                      {busy === row.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </article>
              ))}
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
