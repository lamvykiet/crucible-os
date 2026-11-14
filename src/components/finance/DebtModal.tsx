"use client";

import React, { useState } from "react";
import { X, ChevronDown, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { todayLocalIso } from "@/lib/localDate";
import AmountInput from "@/components/ui/AmountInput";
import CustomDatePicker from "@/components/ui/CustomDatePicker";

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Cùng khuôn ô nhập và nhãn với TransactionModal.
const inputClass =
  "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 min-h-11 text-base md:text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]";
const labelClass = "c-overline block";

export default function DebtModal({ isOpen, onClose, onSuccess }: DebtModalProps) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    type: "Personal Loan",
    startDate: todayLocalIso(),
    dueDate: "",
    principal: "",
    remaining: "",
    monthlyPayment: "",
    interestRate: "0",
    status: "active"
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setError("");
    if (!formData.name) {
      setError(t("Please enter debt name", "Vui lòng nhập tên khoản nợ"));
      return;
    }
    if (!formData.principal || isNaN(Number(formData.principal)) || Number(formData.principal) <= 0) {
      setError(t("Please enter valid principal amount", "Vui lòng nhập số tiền gốc hợp lệ"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/finance/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          principal: Number(formData.principal),
          remaining: formData.remaining ? Number(formData.remaining) : Number(formData.principal),
          monthlyPayment: formData.monthlyPayment ? Number(formData.monthlyPayment) : 0,
          interestRate: Number(formData.interestRate),
        })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setFormData({
          name: "",
          type: "Personal Loan",
          startDate: todayLocalIso(),
          dueDate: "",
          principal: "",
          remaining: "",
          monthlyPayment: "",
          interestRate: "0",
          status: "active"
        });
      } else {
        setError(data.error || t("Something went wrong", "Có lỗi xảy ra"));
      }
    } catch (err) {
      setError(t("Cannot reach the server", "Không thể kết nối đến máy chủ"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 p-5 md:p-6 border-b border-[var(--color-border)] flex justify-between items-center gap-3">
          <h2 className="c-h3 text-[var(--color-text)]">
            {t("Add Debt / Loan", "Thêm khoản nợ / vay")}
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
          {error && <div role="alert" className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Name */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className={labelClass}>{t("Debt Name", "Tên khoản nợ")}</label>
              <input name="name" value={formData.name} onChange={handleChange} type="text" placeholder={t("e.g. Car loan, credit card…", "VD: Vay mua ô tô, thẻ tín dụng…")} className={inputClass} />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className={labelClass}>{t("Type", "Loại hình")}</label>
              <div className="relative">
                <select name="type" value={formData.type} onChange={handleChange} className={`${inputClass} appearance-none pr-10`}>
                  <option value="Mortgage">{t("Mortgage", "Vay thế chấp")}</option>
                  <option value="Auto Loan">{t("Auto loan", "Vay mua xe")}</option>
                  <option value="Personal Loan">{t("Personal loan", "Vay tiêu dùng cá nhân")}</option>
                  <option value="Credit Card">{t("Credit card", "Thẻ tín dụng")}</option>
                  <option value="Student Loan">{t("Student loan", "Vay sinh viên")}</option>
                  <option value="Other">{t("Other", "Khác")}</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Principal */}
            <div className="space-y-2">
              <label className={labelClass}>{t("Principal (VND)", "Tiền gốc ban đầu (VND)")}</label>
              <AmountInput name="principal" value={formData.principal} onValueChange={(v) => setFormData({ ...formData, principal: v })} placeholder="50.000.000" className={inputClass} />
            </div>

            {/* Remaining */}
            <div className="space-y-2">
              <label className={labelClass}>{t("Remaining (VND)", "Dư nợ hiện tại (VND)")}</label>
              <AmountInput name="remaining" value={formData.remaining} onValueChange={(v) => setFormData({ ...formData, remaining: v })} placeholder={t("Leave blank if same as principal", "Bỏ trống nếu bằng gốc")} className={inputClass} />
            </div>

            {/* Monthly Payment */}
            <div className="space-y-2">
              <label className={labelClass}>{t("Monthly Payment (VND)", "Trả góp hàng tháng (VND)")}</label>
              <AmountInput name="monthlyPayment" value={formData.monthlyPayment} onValueChange={(v) => setFormData({ ...formData, monthlyPayment: v })} placeholder="5.000.000" className={inputClass} />
            </div>

            {/* Interest Rate */}
            <div className="space-y-2">
              <label className={labelClass}>{t("Interest Rate (%)", "Lãi suất (%/năm)")}</label>
              <input name="interestRate" value={formData.interestRate} onChange={handleChange} type="number" step="0.1" placeholder="8.5" className={inputClass} />
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <label className={labelClass}>{t("Start Date", "Ngày vay")}</label>
              <CustomDatePicker
                value={formData.startDate}
                onChange={(v) => setFormData({ ...formData, startDate: v })}
                aria-label={t("Start date", "Ngày vay")}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <label className={labelClass}>{t("Due Date", "Ngày đáo hạn / Kết thúc")}</label>
              <CustomDatePicker
                value={formData.dueDate}
                onChange={(v) => setFormData({ ...formData, dueDate: v })}
                allowClear
                aria-label={t("Due date", "Ngày đáo hạn")}
              />
            </div>

          </div>
        </div>

        <div className="shrink-0 p-5 md:p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="c-btn c-btn-tertiary"
          >
            {t("Cancel", "Huỷ")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="c-btn c-btn-primary"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {t("Save debt", "Lưu khoản nợ")}
          </button>
        </div>
      </div>
    </div>
  );
}
