"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND } from "@/lib/formatMoney";
import AmountInput from "@/components/ui/AmountInput";
import CustomDatePicker from "@/components/ui/CustomDatePicker";

// Thêm / sửa một tài khoản thanh toán.
//
// Số dư đầu kỳ là thứ quan trọng nhất ở form này: app không nối với ngân hàng
// nên không tự biết tài khoản đang có bao nhiêu. Người dùng nhập số dư tại một
// mốc ngày, từ đó về sau số dư được cộng dồn theo giao dịch đã ghi.

export interface AccountDraft {
  id?: string;
  name: string;
  kind: string;
  bank: string;
  last4: string;
  openingBalance: number;
  openingDate: string;
  creditLimit: number | null;
  statementDay: number | null;
  dueDay: number | null;
  notes: string;
}

export const ACCOUNT_KINDS = ["bank", "credit_card", "ewallet", "cash"] as const;

export const emptyAccount = (): AccountDraft => ({
  name: "",
  kind: "bank",
  bank: "",
  last4: "",
  openingBalance: 0,
  openingDate: "",
  creditLimit: null,
  statementDay: null,
  dueDay: null,
  notes: "",
});

interface Props {
  isOpen: boolean;
  draft: AccountDraft;
  onClose: () => void;
  onSaved: () => void;
}

export default function AccountModal({ isOpen, draft: initial, onClose, onSaved }: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<AccountDraft>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Mở modal với một tài khoản khác thì nạp lại form. Đồng bộ trong lúc render
  // thay vì trong effect — setState đồng bộ trong effect vi phạm lint rule.
  const [lastId, setLastId] = useState(initial.id);
  if (initial.id !== lastId) {
    setLastId(initial.id);
    setDraft(initial);
  }

  if (!isOpen) return null;

  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const isCard = draft.kind === "credit_card";

  const KIND_LABELS: Record<string, string> = {
    bank: t("Bank account", "Tài khoản ngân hàng"),
    credit_card: t("Credit card", "Thẻ tín dụng"),
    ewallet: t("E-wallet", "Ví điện tử"),
    cash: t("Cash", "Tiền mặt"),
  };

  const handleSave = async () => {
    setError("");
    if (!draft.name.trim()) {
      setError(t("Please enter a name", "Vui lòng nhập tên tài khoản"));
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/finance/accounts", {
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

  const labelClass =
    "block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider";
  const inputClass =
    "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 min-h-11 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-[var(--color-surface)] rounded-t-3xl md:rounded-3xl w-full max-w-xl max-h-[90dvh] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="shrink-0 p-5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <h2 className="c-h4 text-[var(--color-text)]">
            {draft.id ? t("Edit account", "Sửa tài khoản") : t("Add account", "Thêm tài khoản")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {error && (
            <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] rounded-xl p-3">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>{t("Name", "Tên tài khoản")}</label>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("e.g. VPBank S Rewards", "VD: VPBank S Rewards")}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>{t("Kind", "Loại")}</label>
              <select
                value={draft.kind}
                onChange={(e) => set("kind", e.target.value)}
                className={inputClass}
              >
                {ACCOUNT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>{t("Bank", "Ngân hàng")}</label>
              <input
                value={draft.bank}
                onChange={(e) => set("bank", e.target.value)}
                placeholder={t("e.g. VPBank", "VD: VPBank")}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>{t("Last 4 digits", "4 số cuối")}</label>
              <input
                value={draft.last4}
                onChange={(e) => set("last4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="5901"
                className={inputClass}
              />
              <p className="text-[10px] text-[var(--color-text-faint)]">
                {t("only to tell cards apart", "chỉ để phân biệt thẻ, không lưu số đầy đủ")}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>
                {isCard
                  ? t("Outstanding at that date", "Dư nợ tại ngày chốt")
                  : t("Balance at that date", "Số dư tại ngày chốt")}
              </label>
              <AmountInput
                value={draft.openingBalance}
                onValueChange={(v) => set("openingBalance", Number(v) || 0)}
                aria-label={t("Opening balance", "Số dư đầu kỳ")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>{t("As of date", "Ngày chốt số dư")}</label>
            <CustomDatePicker
              value={draft.openingDate}
              onChange={(v) => set("openingDate", v)}
              allowClear
              aria-label={t("As of date", "Ngày chốt số dư")}
            />
            {/* Nói rõ số dư được tính thế nào, nếu không người dùng tưởng app
                tự nối với ngân hàng. */}
            <p className="text-[10px] text-[var(--color-text-faint)]">
              {t(
                "balance today = this number + every transaction recorded on this account after that date",
                "số dư hôm nay = số này cộng dồn các giao dịch đã ghi cho tài khoản, tính từ ngày đó"
              )}
            </p>
          </div>

          {isCard && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>{t("Credit limit", "Hạn mức tín dụng")}</label>
                <AmountInput
                  value={draft.creditLimit ?? ""}
                  onValueChange={(v) => set("creditLimit", v === "" ? null : Number(v) || 0)}
                  aria-label={t("Credit limit", "Hạn mức tín dụng")}
                  className="w-full flex items-center justify-between gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 min-h-11 text-left text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                {draft.creditLimit ? (
                  <p className="text-[10px] text-[var(--color-text-faint)]">
                    {t("available", "còn dùng được")}{" "}
                    {formatVND(Math.max(0, draft.creditLimit - draft.openingBalance))}{" "}
                    {t("at that date", "tại ngày chốt")}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>{t("Statement day", "Ngày chốt sao kê")}</label>
                  <input
                    value={draft.statementDay ?? ""}
                    onChange={(e) =>
                      set("statementDay", e.target.value === "" ? null : Number(e.target.value))
                    }
                    type="number"
                    min={1}
                    max={31}
                    placeholder="2"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>{t("Payment due day", "Ngày đến hạn trả")}</label>
                  <input
                    value={draft.dueDay ?? ""}
                    onChange={(e) =>
                      set("dueDay", e.target.value === "" ? null : Number(e.target.value))
                    }
                    type="number"
                    min={1}
                    max={31}
                    placeholder="20"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>{t("Notes", "Ghi chú")}</label>
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              className={`${inputClass} min-h-[72px] resize-none`}
            />
          </div>
        </div>

        <div className="shrink-0 p-5 border-t border-[var(--color-border)] flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="c-btn c-btn-primary c-btn-pill flex-1 md:flex-none"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {t("Save", "Lưu")}
          </button>
          <button onClick={onClose} className="c-btn c-btn-tertiary">
            {t("Cancel", "Hủy")}
          </button>
        </div>
      </div>
    </div>
  );
}
