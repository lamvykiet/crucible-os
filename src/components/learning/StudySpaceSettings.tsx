"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { BACKDROPS, WEATHER_EFFECTS } from "@/lib/studySpace";

interface Pref {
  background: string | null;
  weatherEffect: string;
  contentAlign: string;
  newCardLimit: number;
  relearnLimit: number;
  skipExerciseOnNew: boolean;
  lowercaseAnswers: boolean;
}

/**
 * Không gian học và cách học.
 *
 * Bản tham chiếu có khoảng 25 ảnh nền minh hoạ mở khoá bằng kim cương. Đó là
 * tranh của họ — không chép về được. Thay vào đó là các nền chuyển sắc dựng
 * bằng CSS, không tốn dung lượng và tự hợp với chế độ sáng/tối. Muốn ảnh thật
 * thì dán đường dẫn ảnh của chính mình vào ô cuối.
 */
export default function StudySpaceSettings() {
  const { t } = useLanguage();

  const [pref, setPref] = useState<Pref | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/prefs", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không đọc được tuỳ chọn");
        setPref(json.pref);
        if (json.pref?.background?.startsWith("http")) setCustomUrl(json.pref.background);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, []);

  const save = async (patch: Partial<Pref>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không lưu được");
      setPref(json.pref);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!pref) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tiêu đề do trang bọc ngoài đặt — ở đây chỉ nói cách lưu, tránh lặp. */}
      <div className="flex items-center gap-3 -mt-2">
        <p className="c-card-body flex-1">
          {t("Saved as you change it.", "Đổi tới đâu lưu tới đó.")}
        </p>
        {saving && <Loader2 size={16} className="animate-spin text-[var(--color-text-faint)]" />}
        {saved && (
          <span className="c-chip c-chip-success inline-flex items-center gap-1">
            <Check size={12} />
            {t("Saved", "Đã lưu")}
          </span>
        )}
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Nền */}
      <section className="space-y-3">
        <h3 className="c-h3">{t("Backdrop", "Ảnh nền")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {BACKDROPS.map((b) => {
            const active = pref.background === b.id || (!pref.background && b.id === "none");
            return (
              <button
                key={b.id}
                onClick={() => save({ background: b.id === "none" ? null : b.id })}
                className={`rounded-xl h-20 border-2 transition-all relative overflow-hidden ${
                  active ? "border-[var(--color-focus)]" : "border-[var(--color-border)]"
                }`}
                style={{ background: b.css }}
                title={t(b.en, b.vi)}
              >
                <span className="absolute inset-x-0 bottom-0 bg-[var(--color-surface)]/85 text-[11px] font-semibold py-1 text-[var(--color-text)]">
                  {t(b.en, b.vi)}
                </span>
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] grid place-content-center">
                    <Check size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="c-field max-w-lg">
          <label htmlFor="bg-url">{t("Or your own image URL", "Hoặc dán đường dẫn ảnh của bạn")}</label>
          <div className="flex gap-2">
            <input
              id="bg-url"
              className="c-input flex-1"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://..."
            />
            <button
              onClick={() => save({ background: customUrl.trim() || null })}
              className="c-btn c-btn-secondary"
            >
              {t("Use", "Dùng")}
            </button>
          </div>
        </div>
      </section>

      {/* Hiệu ứng thời tiết */}
      <section className="space-y-3">
        <h3 className="c-h3">{t("Weather effect", "Hiệu ứng thời tiết")}</h3>
        <div className="flex flex-wrap gap-2">
          {WEATHER_EFFECTS.map((w) => (
            <button
              key={w.id}
              onClick={() => save({ weatherEffect: w.id })}
              className={`c-chip ${pref.weatherEffect === w.id ? "c-chip-solid" : "c-chip-outline"}`}
            >
              {t(w.en, w.vi)}
            </button>
          ))}
        </div>
      </section>

      {/* Căn khung */}
      <section className="space-y-3">
        <h3 className="c-h3">{t("Content alignment", "Căn khung nội dung")}</h3>
        <div className="c-seg self-start">
          {(["center", "left"] as const).map((a) => (
            <button
              key={a}
              className={`c-seg-opt ${pref.contentAlign === a ? "active" : ""}`}
              onClick={() => save({ contentAlign: a })}
            >
              {a === "center" ? t("Center", "Giữa") : t("Left", "Trái")}
            </button>
          ))}
        </div>
      </section>

      {/* Cách học */}
      <section className="space-y-4">
        <h3 className="c-h3">{t("How you study", "Cách học")}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="c-field">
            <label htmlFor="new-limit">{t("New cards per day", "Thẻ mới mỗi ngày")}</label>
            <input
              id="new-limit"
              type="number"
              min={0}
              max={200}
              className="c-input"
              value={pref.newCardLimit}
              onChange={(e) => setPref({ ...pref, newCardLimit: Number(e.target.value) })}
              onBlur={(e) => save({ newCardLimit: Number(e.target.value) })}
            />
          </div>
          <div className="c-field">
            <label htmlFor="relearn-limit">{t("Relearn cards per day", "Thẻ ôn lại mỗi ngày")}</label>
            <input
              id="relearn-limit"
              type="number"
              min={0}
              max={500}
              className="c-input"
              value={pref.relearnLimit}
              onChange={(e) => setPref({ ...pref, relearnLimit: Number(e.target.value) })}
              onBlur={(e) => save({ relearnLimit: Number(e.target.value) })}
            />
          </div>
        </div>

        <label className="c-check">
          <input
            type="checkbox"
            checked={pref.skipExerciseOnNew}
            onChange={(e) => save({ skipExerciseOnNew: e.target.checked })}
          />
          {t(
            "Skip exercises the first time I see a card",
            "Bỏ bài tập ở lần đầu gặp thẻ"
          )}
        </label>

        <label className="c-check">
          <input
            type="checkbox"
            checked={pref.lowercaseAnswers}
            onChange={(e) => save({ lowercaseAnswers: e.target.checked })}
          />
          {t("Let me answer in lowercase", "Cho gõ đáp án bằng chữ thường")}
        </label>
      </section>
    </div>
  );
}
