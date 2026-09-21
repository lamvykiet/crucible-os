"use client";

import { useState } from "react";
import { Check, Loader2, AlertCircle, ArrowRight, ArrowLeft, Plus } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import {
  TRANSLATION_LANGUAGES, translationLanguageByCode,
} from "@/lib/translationLanguages";
import { LANGUAGE_PRESETS, READING_LABEL } from "@/lib/languagePresets";

interface Props {
  /** Mã ngôn ngữ dịch đang lưu, để mở màn ra là thấy sẵn lựa chọn hiện tại. */
  initialCode: string;
  onDone: () => void;
}

/**
 * Thẻ xem trước.
 *
 * Đây là lý do màn này tồn tại chứ không phải một ô chọn trong Cài đặt: chọn
 * mù rồi phải vào tận màn học mới biết mình chọn sai, và lúc đó thẻ đã tạo
 * bằng ngôn ngữ không mong muốn rồi. Thấy trước thì chọn đúng ngay.
 */
function PreviewCard({ code }: { code: string }) {
  const { t } = useLanguage();
  const lang = translationLanguageByCode(code);

  return (
    <div className="c-card c-elev-lg p-6 flex flex-col gap-4 min-h-[320px]">
      <div className="flex items-center gap-2">
        <span className="c-chip c-chip-outline">{t("noun", "danh từ")}</span>
        <span className="c-chip c-chip-outline font-mono">/ˈæp.əl/</span>
      </div>

      <p className="c-h1 leading-none">apple</p>

      <div className="rounded-xl p-4 bg-[var(--color-surface-2)]">
        <p className="text-[var(--color-text)] leading-relaxed">{lang.sampleMeaning}</p>
      </div>

      <div className="border-t border-dashed border-[var(--color-border)] pt-4 space-y-1.5">
        <p className="c-card-kicker">{t("Example", "Ví dụ")}</p>
        <p className="text-[var(--color-text)]">
          I eat an <mark className="bg-[var(--color-accent-tint)] text-[var(--color-accent)] px-1 rounded">apple</mark> every morning.
        </p>
        <p className="text-[var(--color-text-muted)] text-sm">{lang.sampleExample}</p>
      </div>
    </div>
  );
}

/**
 * Màn khởi đầu Learning Hub.
 *
 * Hai bước, và chúng là hai thứ khác nhau mà rất dễ lẫn:
 *  1. Nghĩa của từ viết bằng tiếng gì — ảnh hưởng tới mọi thẻ sẽ tạo về sau.
 *  2. Mình định học những tiếng nào.
 *
 * Chọn "Tiếng Hàn" ở bước 1 nghĩa là nghĩa hiện bằng tiếng Hàn, KHÔNG phải học
 * tiếng Hàn. Nhãn ở đây phải nói rõ điều đó, vì chọn nhầm thì mọi thẻ tạo sau
 * đều sai ngôn ngữ và phải sửa tay từng cái.
 */
export default function LearningOnboarding({ initialCode, onDone }: Props) {
  const { t } = useLanguage();

  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState(initialCode);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLearn = (c: string) =>
    setPicked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const saveLanguage = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translationLanguage: code }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không lưu được");
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      // Thêm từng thứ tiếng người dùng đã chọn. Bỏ qua tiếng nào lỗi thay vì
      // huỷ cả bước — thêm được ba trên bốn vẫn tốt hơn là không được cái nào.
      for (const c of picked) {
        await fetch("/api/learning/languages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: c }),
        }).catch(() => {});
      }

      const res = await fetch("/api/learning/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finishOnboarding: true }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không lưu được");
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg)]">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-16 space-y-8">

        {/* Nhịp hai bước */}
        <div className="flex items-center gap-2">
          {[1, 2].map((n) => (
            <span
              key={n}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{
                background: step >= n ? "var(--color-primary)" : "var(--color-surface-2)",
              }}
            />
          ))}
        </div>

        {error && (
          <div className="c-alert c-alert-error">
            <AlertCircle size={18} className="icon" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {step === 1 ? (
          <>
            <header className="space-y-3 text-center">
              <h1 className="c-h1">
                {t("What language should meanings be in?", "Nghĩa của từ hiện bằng tiếng gì?")}
              </h1>
              <p className="c-card-body max-w-2xl mx-auto">
                {t(
                  "This is the language your card meanings and example translations are written in — not the language you are learning, and not the app's buttons and labels.",
                  "Đây là tiếng dùng để viết nghĩa của thẻ và bản dịch câu ví dụ — không phải thứ tiếng bạn đang học, cũng không phải chữ trên nút bấm của ứng dụng."
                )}
              </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-8 items-start">
              {/* Xem trước, dính lại khi cuộn danh sách dài */}
              <div className="lg:sticky lg:top-8">
                <p className="c-card-kicker mb-2">{t("Preview", "Xem trước")}</p>
                <PreviewCard code={code} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TRANSLATION_LANGUAGES.map((l) => {
                  const active = l.code === code;
                  return (
                    <button
                      key={l.code}
                      onClick={() => setCode(l.code)}
                      aria-pressed={active}
                      className={`c-card p-4 flex items-center gap-3 text-left transition-colors ${
                        active
                          ? "border-[var(--color-primary)] bg-[var(--color-accent-tint)]"
                          : "hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      <span
                        className="w-10 h-10 rounded-lg grid place-content-center flex-none font-bold text-sm"
                        style={{
                          background: active ? "var(--color-primary)" : "var(--color-surface-2)",
                          color: active ? "var(--color-on-primary)" : "var(--color-text-muted)",
                        }}
                      >
                        {l.tag}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold truncate">{l.name}</span>
                        <span className="block c-stat-label truncate">{l.nativeName}</span>
                      </span>
                      {active && <Check size={18} className="text-[var(--color-primary)] flex-none" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button onClick={saveLanguage} disabled={busy} className="c-btn c-btn-primary c-btn-lg">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {t("Use this language", "Dùng ngôn ngữ này")}
              </button>
            </div>
          </>
        ) : (
          <>
            <header className="space-y-3 text-center">
              <h1 className="c-h1">
                {t("Which languages will you learn?", "Bạn sẽ học những tiếng nào?")}
              </h1>
              <p className="c-card-body max-w-2xl mx-auto">
                {t(
                  "Each one brings its own writing system, reading notation and tones. Pick as many as you like — you can add more later.",
                  "Mỗi thứ tiếng có kiểu chữ, hệ phiên âm và thanh điệu riêng. Chọn bao nhiêu cũng được, sau này thêm tiếp vẫn kịp."
                )}
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {LANGUAGE_PRESETS.map((p) => {
                const active = picked.includes(p.code);
                const reading = READING_LABEL[p.phoneticSystem];
                return (
                  <button
                    key={p.code}
                    onClick={() => toggleLearn(p.code)}
                    aria-pressed={active}
                    className={`c-card p-5 text-left flex flex-col gap-3 transition-colors ${
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-accent-tint)]"
                        : "hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold truncate">{p.name}</p>
                        <p className="c-stat-label truncate">{p.nativeName}</p>
                      </div>
                      {active ? (
                        <Check size={18} className="text-[var(--color-primary)] flex-none" />
                      ) : (
                        <Plus size={18} className="text-[var(--color-text-faint)] flex-none" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="c-chip c-chip-outline">{reading.vi}</span>
                      {p.hasTones && (
                        <span className="c-chip c-chip-warning">
                          {p.toneCount} {t("tones", "thanh")}
                        </span>
                      )}
                      {p.script !== "latin" && (
                        <span className="c-chip c-chip-outline">{t("writing", "luyện viết")}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button onClick={() => setStep(1)} disabled={busy} className="c-btn c-btn-secondary c-btn-lg">
                <ArrowLeft size={18} />
                {t("Back", "Quay lại")}
              </button>
              <button onClick={finish} disabled={busy} className="c-btn c-btn-primary c-btn-lg">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {picked.length > 0
                  ? t(`Start with ${picked.length}`, `Bắt đầu với ${picked.length} thứ tiếng`)
                  : t("Skip for now", "Bỏ qua, chọn sau")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
