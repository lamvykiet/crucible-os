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
      setError(t("Vui lòng nhập tên khoản nợ", "Please enter debt name"));
      return;
    }
    if (!formData.principal || isNaN(Number(formData.principal)) || Number(formData.principal) <= 0) {
      setError(t("Vui lòng nhập số tiền gốc hợp lệ", "Please enter valid principal amount"));
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
        setError(data.error || "Có lỗi xảy ra");
      }
    } catch (err) {
      setError("Không thể kết nối đến máy chủ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 p-5 md:p-6 border-b border-[var(--color-border)] flex justify-between items-center gap-3">
          <h2 className="c-h3 text-[var(--color-text)]">
            {t("Thêm khoản nợ / vay", "Add Debt / Loan")}
          </h2>
          <button 
            onClick={onClose}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
          {error && <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Name */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Tên khoản nợ", "Debt Name")}</label>
              <input name="name" value={formData.name} onChange={handleChange} type="text" placeholder="VD: Vay mua ô tô, Thẻ tín dụng..." className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none text-[var(--color-text)]" />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Loại hình", "Type")}</label>
              <div className="relative">
                <select name="type" value={formData.type} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)] appearance-none">
                  <option value="Mortgage">Vay thế chấp (Mortgage)</option>
                  <option value="Auto Loan">Vay mua xe hơi</option>
                  <option value="Personal Loan">Vay tiêu dùng cá nhân</option>
                  <option value="Credit Card">Thẻ tín dụng</option>
                  <option value="Student Loan">Vay sinh viên</option>
                  <option value="Other">Khác</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Principal */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Tiền gốc ban đầu (VND)", "Principal (VND)")}</label>
              <AmountInput name="principal" value={formData.principal} onValueChange={(v) => setFormData({ ...formData, principal: v })} placeholder="50.000.000" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]" />
            </div>

            {/* Remaining */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Dư nợ hiện tại (VND)", "Remaining (VND)")}</label>
              <AmountInput name="remaining" value={formData.remaining} onValueChange={(v) => setFormData({ ...formData, remaining: v })} placeholder="(Bỏ trống nếu bằng gốc)" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]" />
            </div>

            {/* Monthly Payment */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Trả góp hàng tháng (VND)", "Monthly Payment (VND)")}</label>
              <AmountInput name="monthlyPayment" value={formData.monthlyPayment} onValueChange={(v) => setFormData({ ...formData, monthlyPayment: v })} placeholder="5.000.000" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]" />
            </div>

            {/* Interest Rate */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Lãi suất (%/năm)", "Interest Rate (%)")}</label>
              <input name="interestRate" value={formData.interestRate} onChange={handleChange} type="number" step="0.1" placeholder="8.5" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]" />
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Ngày vay", "Start Date")}</label>
              <CustomDatePicker
                value={formData.startDate}
                onChange={(v) => setFormData({ ...formData, startDate: v })}
                aria-label={t("Ngày vay", "Start date")}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Ngày đáo hạn / Kết thúc", "Due Date")}</label>
              <CustomDatePicker
                value={formData.dueDate}
                onChange={(v) => setFormData({ ...formData, dueDate: v })}
                allowClear
                aria-label={t("Ngày đáo hạn", "Due date")}
              />
            </div>

          </div>
        </div>

        <div className="shrink-0 p-5 md:p-6 border-t border-[var(--color-border)] flex items-center gap-4 bg-[var(--color-surface-2)]">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-on-primary)] font-bold px-8 py-3 rounded-full text-sm shadow-sm transition-opacity flex items-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {t("Lưu khoản nợ", "Save Debt")}
          </button>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bold px-4 py-3 text-sm transition-colors disabled:opacity-50"
          >
            {t("Hủy", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
