"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { DEFAULT_LIFE_MONTHS } from "@/lib/assets";
import { todayLocalIso } from "@/lib/localDate";

// Thêm / sửa một tài sản.
//
// Chọn nhóm sẽ tự đặt đời hữu dụng mặc định, và riêng bất động sản thì chuyển
// luôn sang "không khấu hao" — nhà không mòn theo sổ sách, nó được định giá lại.

export interface AssetDraft {
  id?: string;
  name: string;
  category: string;
  acquisitionDate: string;
  acquisitionCost: number;
  depreciationMethod: string;
  usefulLifeMonths: number;
  salvageValue: number;
  currentValue: number | null;
  valuationDate: string | null;
  status: string;
  disposalDate: string | null;
  disposalAmount: number | null;
  debtId: string | null;
  notes: string;
}

const formatVND = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

const EMPTY = (): AssetDraft => ({
  name: "",
  category: "Electronics",
  acquisitionDate: todayLocalIso(),
  acquisitionCost: 0,
  depreciationMethod: "straight_line",
  usefulLifeMonths: DEFAULT_LIFE_MONTHS.Electronics,
  salvageValue: 0,
  currentValue: null,
  valuationDate: null,
  status: "owned",
  disposalDate: null,
  disposalAmount: null,
  debtId: null,
  notes: "",
});

interface Props {
  isOpen: boolean;
  initial?: AssetDraft | null;
  categories: string[];
  debts: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AssetModal({
  isOpen, initial, categories, debts, onClose, onSaved,
}: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<AssetDraft>(initial ?? EMPTY());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const set = <K extends keyof AssetDraft>(k: K, v: AssetDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const pickCategory = (c: string) => {
    const life = DEFAULT_LIFE_MONTHS[c] ?? 60;
    setDraft((d) => ({
      ...d,
      category: c,
      usefulLifeMonths: life,
      depreciationMethod: life === 0 ? "none" : "straight_line",
    }));
  };

  const noDepreciation = draft.depreciationMethod === "none" || draft.usefulLifeMonths <= 0;
  const perMonth = noDepreciation
    ? 0
    : Math.round(Math.max(0, draft.acquisitionCost - draft.salvageValue) / draft.usefulLifeMonths);

  const handleSave = async () => {
    if (!draft.name.trim() || draft.acquisitionCost <= 0) {
      setError(t("Name and a cost above 0 are required", "Cần tên và nguyên giá lớn hơn 0"));
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/finance/assets", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
        onClose();
      } else {
        setError(json.error || t("Save failed", "Lưu không thành công"));
      }
    } catch {
      setError(t("Save failed", "Lưu không thành công"));
    } finally {
      setIsSaving(false);
    }
  };

  const num = (label: string, key: keyof AssetDraft, hint?: string) => (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </label>
      <input
        type="number"
        inputMode="numeric"
        value={String(draft[key] ?? "")}
        onChange={(e) =>
          set(key, (e.target.value === "" ? null : Number(e.target.value)) as AssetDraft[typeof key])
        }
        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
      />
      {hint && <p className="text-[10px] leading-tight text-[var(--color-text-faint)]">{hint}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-4">
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 p-5 md:p-6 border-b border-[var(--color-border)] flex justify-between items-center gap-3">
          <h2 className="c-h3 text-[var(--color-text)]">
            {draft.id ? t("Edit asset", "Sửa tài sản") : t("Add asset", "Thêm tài sản")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
          {error && (
            <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Name", "Tên tài sản")}
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("e.g. Apartment, MacBook Pro", "VD: Căn hộ, MacBook Pro")}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Category", "Nhóm")}
              </label>
              <select
                value={draft.category}
                onChange={(e) => pickCategory(e.target.value)}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Acquisition date", "Ngày mua")}
              </label>
              <input
                type="date"
                value={draft.acquisitionDate}
                onChange={(e) => set("acquisitionDate", e.target.value)}
                className="w-full min-w-0 appearance-none bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
              />
            </div>

            {num(t("Acquisition cost (VND)", "Nguyên giá (VND)"), "acquisitionCost")}
            {num(
              t("Useful life (months)", "Đời hữu dụng (tháng)"),
              "usefulLifeMonths",
              t("0 means no depreciation", "0 nghĩa là không khấu hao")
            )}
            {num(
              t("Salvage value", "Giá trị thanh lý"),
              "salvageValue",
              t("depreciation never goes below this", "khấu hao không ăn xuống dưới mức này")
            )}
            {num(
              t("Current value (revaluation)", "Định giá hiện tại"),
              "currentValue",
              t(
                "leave blank to use book value; set it for property",
                "để trống thì dùng giá trị sổ sách; bất động sản thì đặt số này"
              )
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Linked loan", "Khoản vay gắn với tài sản")}
              </label>
              <select
                value={draft.debtId ?? ""}
                onChange={(e) => set("debtId", e.target.value || null)}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
              >
                <option value="">{t("— none —", "— không —")}</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <p className="text-[10px] leading-tight text-[var(--color-text-faint)]">
                {t(
                  "equity = value − outstanding loan",
                  "vốn chủ sở hữu = giá trị − dư nợ còn lại"
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Status", "Trạng thái")}
              </label>
              <select
                value={draft.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
              >
                <option value="owned">{t("owned", "đang giữ")}</option>
                <option value="sold">{t("sold", "đã bán")}</option>
                <option value="written_off">{t("written off", "đã thanh lý")}</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Notes", "Ghi chú")}
              </label>
              <input
                type="text"
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-text-muted)]">
            {noDepreciation ? (
              t(
                "No depreciation — worth is whatever you set as current value.",
                "Không khấu hao — giá trị lấy theo số bạn đặt ở ô định giá."
              )
            ) : (
              <>
                {t("Depreciation", "Khấu hao")}: <strong>{formatVND(perMonth)}</strong>/
                {t("month", "tháng")} · {draft.usefulLifeMonths} {t("months", "tháng")}
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 p-5 md:p-6 border-t border-[var(--color-border)] flex items-center gap-4 bg-[var(--color-surface-2)]">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="c-btn c-btn-primary c-btn-lg c-btn-pill shadow-sm"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {t("Save", "Lưu")}
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bold px-4 py-3 text-sm transition-colors disabled:opacity-50"
          >
            {t("Cancel", "Huỷ")}
          </button>
        </div>
      </div>
    </div>
  );
}
