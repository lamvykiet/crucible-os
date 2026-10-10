"use client";

import { useState } from "react";
import { Archive, Loader2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { sendJson, type HealthProfile } from "@/components/health/types";

/** Thêm hoặc sửa một người được theo dõi. */
export default function ProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: HealthProfile | null;
  onClose: () => void;
  onSaved: (id: string | null) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(profile?.name ?? "");
  const [sex, setSex] = useState<"male" | "female">(profile?.sex ?? "male");
  const [birthYear, setBirthYear] = useState(profile?.birthYear ? String(profile.birthYear) : "");
  const [heightCm, setHeightCm] = useState(profile?.heightCm ? String(profile.heightCm) : "");
  const [target, setTarget] = useState(profile?.targetWeightKg ? String(profile.targetWeightKg) : "");
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError(t("Enter a name", "Chưa nhập tên"));
    setSaving(true);
    setError(null);
    try {
      const body = { id: profile?.id, name, sex, birthYear, heightCm, targetWeightKg: target };
      const json = await sendJson<{ profile: { id: string } }>("/api/health/profiles", profile ? "PUT" : "POST", body);
      onSaved(json.profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await sendJson(`/api/health/profiles?id=${profile.id}`, "DELETE");
      onSaved(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-[var(--color-surface)] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <h2 className="c-h4">{profile ? t("Edit person", "Sửa thông tin") : t("Add a person", "Thêm người theo dõi")}</h2>
          <button type="button" onClick={onClose} aria-label={t("Close", "Đóng")} className="c-btn c-btn-tertiary c-btn-icon">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="c-field">
            <label htmlFor="hp-name">{t("Name", "Tên")}</label>
            <input id="hp-name" className="c-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="c-field">
            <label>{t("Sex", "Giới tính")}</label>
            <div className="c-seg">
              {[
                { v: "male", en: "Male", vi: "Nam" },
                { v: "female", en: "Female", vi: "Nữ" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setSex(o.v as "male" | "female")}
                  className={`c-seg-opt flex-1 ${sex === o.v ? "active" : ""}`}
                >
                  {t(o.en, o.vi)}
                </button>
              ))}
            </div>
            <p className="c-help">
              {t(
                "Sets the reference ranges (body fat %, waist–hip) when the device doesn't print its own.",
                "Dùng để chọn ngưỡng tham chiếu (mỡ %, eo/hông) khi máy đo không in sẵn ngưỡng riêng."
              )}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="c-field">
              <label htmlFor="hp-year">{t("Born", "Năm sinh")}</label>
              <input id="hp-year" className="c-input" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
            </div>
            <div className="c-field">
              <label htmlFor="hp-height">{t("Height cm", "Cao (cm)")}</label>
              <input id="hp-height" className="c-input" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div className="c-field">
              <label htmlFor="hp-target">{t("Goal kg", "Mục tiêu kg")}</label>
              <input id="hp-target" className="c-input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>
          <p className="c-help -mt-2">
            {t(
              "Leave the goal empty to use the target weight printed on the latest report.",
              "Để trống mục tiêu thì dùng cân nặng mục tiêu in trên phiếu đo gần nhất."
            )}
          </p>

          {error && <p className="c-help error">{error}</p>}

          {profile && (
            <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => (confirmArchive ? archive() : setConfirmArchive(true))}
                className="c-btn c-btn-secondary c-btn-sm"
              >
                <Archive size={14} />
                {confirmArchive ? t("Archive for good?", "Lưu kho thật?") : t("Archive", "Lưu kho")}
              </button>
              {confirmArchive && (
                <p className="c-help w-full">
                  {t(
                    "Archived people disappear from the switcher; their measurements and workouts are kept.",
                    "Người đã lưu kho biến khỏi thanh chọn; số đo và buổi tập vẫn được giữ."
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-[var(--color-border)] flex gap-2">
          <button type="button" onClick={onClose} className="c-btn c-btn-secondary flex-1">
            {t("Cancel", "Huỷ")}
          </button>
          <button type="button" onClick={save} disabled={saving} className="c-btn c-btn-primary flex-1">
            {saving ? <Loader2 size={16} className="animate-spin" /> : t("Save", "Lưu")}
          </button>
        </div>
      </div>
    </div>
  );
}
