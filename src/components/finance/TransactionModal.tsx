"use client";

import React from "react";
import { X, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TransactionModal({ isOpen, onClose }: TransactionModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--color-text)]" style={{fontFamily: 'var(--font-display)'}}>
            {t("Thêm giao dịch thủ công", "Thêm giao dịch thủ công")}
          </h2>
          <button 
            onClick={onClose}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Ngày", "Ngày")}</label>
              <div className="relative">
                <input type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)]" />
              </div>
            </div>

            {/* Payee / Source */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Nơi chi / nguồn thu", "Nơi chi / nguồn thu")}</label>
              <input type="text" placeholder="VD: Coopmart, Lương tháng 7" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-info)] rounded-xl px-4 py-2.5 text-sm focus:outline-none text-[var(--color-text)]" />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Loại", "Loại")}</label>
              <div className="relative">
                <select className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] appearance-none">
                  <option>Expense</option>
                  <option>Income</option>
                  <option>Transfer</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Nhóm chi tiêu", "Nhóm chi tiêu")}</label>
              <div className="relative">
                <select className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] appearance-none">
                  <option>Food & Dining</option>
                  <option>Shopping</option>
                  <option>Transport</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Subcategory */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Danh mục con", "Danh mục con")}</label>
              <div className="relative">
                <select className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] appearance-none">
                  <option>— Không chọn —</option>
                  <option>Breakfast</option>
                  <option>Lunch</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Số tiền (VND)", "Số tiền (VND)")}</label>
              <input type="number" placeholder="125000" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)]" />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Thanh toán", "Thanh toán")}</label>
              <div className="relative">
                <select className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] appearance-none">
                  <option>Tiền mặt</option>
                  <option>Thẻ tín dụng</option>
                  <option>Chuyển khoản</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>
            
            <div className="col-span-1 md:col-span-2 space-y-2">
               <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Ghi chú", "Ghi chú")}</label>
               <textarea className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] min-h-[80px] resize-none"></textarea>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[var(--color-border)] flex items-center gap-4 bg-[var(--color-surface-2)]">
          <button 
            onClick={onClose}
            className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white font-bold px-8 py-3 rounded-full text-sm shadow-sm transition-colors"
          >
            {t("Lưu giao dịch", "Lưu giao dịch")}
          </button>
          <button 
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bold px-4 py-3 text-sm transition-colors"
          >
            {t("Hủy", "Hủy")}
          </button>
        </div>
      </div>
    </div>
  );
}
