"use client";

import React, { useState } from "react";
import { X, ChevronDown, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultType?: "Expense" | "Income" | "Transfer";
  initialData?: any;
}

const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Transport",
  "Bills & Utilities",
  "Entertainment",
  "Health & Fitness",
  "Other"
];

const INCOME_CATEGORIES = [
  "Salary",
  "Investment",
  "Business",
  "Gift",
  "Other Income"
];

const TRANSFER_CATEGORIES = [
  "Transfer Out",
  "Transfer In"
];

const SUB_CATEGORIES: Record<string, string[]> = {
  "Food & Dining": ["Breakfast", "Lunch", "Dinner", "Snacks"],
  "Shopping": ["Clothing", "Electronics", "Groceries"],
  "Transport": ["Fuel", "Taxi", "Public Transit"],
  "Bills & Utilities": ["Electricity", "Water", "Internet", "Phone", "Rent"],
  "Entertainment": ["Movies", "Games", "Subscription"],
  "Health & Fitness": ["Medical", "Pharmacy", "Gym"],
  "Salary": ["Base Salary", "Bonus", "Allowance"],
  "Investment": ["Dividends", "Interest", "Capital Gains"],
  "Business": ["Sales", "Services"],
};

export default function TransactionModal({ isOpen, onClose, onSuccess, defaultType = "Expense", initialData }: TransactionModalProps) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    date: initialData?.date || new Date().toISOString().slice(0, 10),
    supplier: initialData?.supplier || "",
    type: defaultType,
    categoryGroup: "Food & Dining",
    subGroup: "",
    amount: initialData?.totalAmount?.toString() || "",
    paymentMethod: "cash",
    notes: initialData?.items ? JSON.stringify(initialData.items) : ""
  });

  // Reset form when initialData changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        date: initialData?.date || new Date().toISOString().slice(0, 10),
        supplier: initialData?.supplier || "",
        type: initialData?.type || defaultType,
        categoryGroup: initialData?.categoryGroup || (initialData?.type === "Income" ? INCOME_CATEGORIES[0] : initialData?.type === "Transfer" ? TRANSFER_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
        subGroup: initialData?.subGroup || "",
        amount: initialData?.totalAmount?.toString() || initialData?.amount?.toString() || "",
        paymentMethod: initialData?.paymentMethod || "cash",
        notes: initialData?.notes || (initialData?.items ? JSON.stringify(initialData.items) : "")
      });
    }
  }, [isOpen, initialData, defaultType]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "type") {
      let defaultCat = EXPENSE_CATEGORIES[0];
      if (value === "Income") defaultCat = INCOME_CATEGORIES[0];
      else if (value === "Transfer") defaultCat = TRANSFER_CATEGORIES[0];
      
      setFormData({ 
        ...formData, 
        type: value as any, 
        categoryGroup: defaultCat, 
        subGroup: "" 
      });
    } else if (name === "categoryGroup") {
      setFormData({ ...formData, categoryGroup: value, subGroup: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      setError(t("Vui lòng nhập số tiền hợp lệ", "Please enter a valid amount"));
      return;
    }

    setIsSubmitting(true);
    try {
      const isEditing = !!initialData?.id;
      const res = await fetch("/api/finance/transaction", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          id: initialData?.id
        })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setFormData({
          date: new Date().toISOString().slice(0, 10),
          supplier: "",
          type: defaultType,
          categoryGroup: defaultType === "Income" ? INCOME_CATEGORIES[0] : defaultType === "Transfer" ? TRANSFER_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
          subGroup: "",
          amount: "",
          paymentMethod: "cash",
          notes: ""
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
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--color-text)]" style={{fontFamily: 'var(--font-display)'}}>
            {initialData?.id ? t("Chỉnh sửa giao dịch", "Edit transaction") : t("Thêm giao dịch thủ công", "Add manual transaction")}
          </h2>
          <button 
            onClick={onClose}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {error && <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Ngày", "Ngày")}</label>
              <div className="relative">
                <input name="date" value={formData.date} onChange={handleChange} type="date" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)]" />
              </div>
            </div>

            {/* Payee / Source */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Nơi chi / nguồn thu", "Nơi chi / nguồn thu")}</label>
              <input name="supplier" value={formData.supplier} onChange={handleChange} type="text" placeholder="VD: Coopmart, Lương tháng 7" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-info)] rounded-xl px-4 py-2.5 text-sm focus:outline-none text-[var(--color-text)]" />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Loại", "Loại")}</label>
              <div className="relative">
                <select name="type" value={formData.type} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] appearance-none">
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                  <option value="Transfer">Transfer</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Nhóm chi tiêu", "Nhóm chi tiêu")}</label>
              <div className="relative">
                <select name="categoryGroup" value={formData.categoryGroup} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] appearance-none">
                  {(formData.type === "Income" ? INCOME_CATEGORIES : formData.type === "Transfer" ? TRANSFER_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Subcategory */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Danh mục con", "Danh mục con")}</label>
              <div className="relative">
                <select name="subGroup" value={formData.subGroup} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] appearance-none">
                  <option value="">— Không chọn —</option>
                  {SUB_CATEGORIES[formData.categoryGroup]?.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Số tiền (VND)", "Số tiền (VND)")}</label>
              <input name="amount" value={formData.amount} onChange={handleChange} type="number" placeholder="125000" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)]" />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Thanh toán", "Thanh toán")}</label>
              <div className="relative">
                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] appearance-none">
                  <option value="cash">Tiền mặt</option>
                  <option value="card">Thẻ tín dụng</option>
                  <option value="transfer">Chuyển khoản</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>
            
            <div className="col-span-1 md:col-span-2 space-y-2">
               <label className="block text-xs font-bold text-[var(--color-info)] uppercase tracking-wider">{t("Ghi chú", "Ghi chú")}</label>
               <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)] min-h-[80px] resize-none"></textarea>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[var(--color-border)] flex items-center gap-4 bg-[var(--color-surface-2)]">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] disabled:opacity-50 text-white font-bold px-8 py-3 rounded-full text-sm shadow-sm transition-colors flex items-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {t("Lưu giao dịch", "Lưu giao dịch")}
          </button>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bold px-4 py-3 text-sm transition-colors disabled:opacity-50"
          >
            {t("Hủy", "Hủy")}
          </button>
        </div>
      </div>
    </div>
  );
}
