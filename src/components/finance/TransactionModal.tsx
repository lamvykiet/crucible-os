"use client";

import React, { useState } from "react";
import { X, ChevronDown, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/invoice";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultType?: "Expense" | "Income" | "Transfer";
  initialData?: any;
}

export default function TransactionModal({ isOpen, onClose, onSuccess, defaultType = "Expense", initialData }: TransactionModalProps) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Danh mục lấy từ bảng Category, thay cho ba mảng viết cứng trước đây.
  const [typeForCategories, setTypeForCategories] = useState<string>(initialData?.type || defaultType);
  const { groupNames, subGroupsOf, label } = useCategories(typeForCategories);

  const [formData, setFormData] = useState({
    date: initialData?.date || new Date().toISOString().slice(0, 10),
    supplier: initialData?.supplier || "",
    type: defaultType,
    categoryGroup: initialData?.categoryGroup || "",
    subGroup: "",
    amount: initialData?.totalAmount?.toString() || "",
    paymentMethod: initialData?.paymentMethod || "unknown",
    notes: initialData?.notes || ""
  });

  const [items, setItems] = useState<any[]>(initialData?.items || []);

  // Reset form when initialData changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        date: initialData?.date || new Date().toISOString().slice(0, 10),
        supplier: initialData?.supplier || "",
        type: initialData?.type || defaultType,
        categoryGroup: initialData?.categoryGroup || "",
        subGroup: initialData?.subGroup || "",
        amount: initialData?.totalAmount?.toString() || initialData?.amount?.toString() || "",
        paymentMethod: initialData?.paymentMethod || "unknown",
        notes: initialData?.notes || ""
      });
      setItems(initialData?.items || []);
      setTypeForCategories(initialData?.type || defaultType);
    }
  }, [isOpen, initialData, defaultType]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "type") {
      // Đổi loại giao dịch thì nhóm cũ không còn thuộc danh sách nào — xoá đi
      // để không lưu nhầm nhóm thu nhập vào một khoản chi.
      setTypeForCategories(value);
      setFormData({
        ...formData,
        type: value as any,
        categoryGroup: "",
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
          items: items,
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
          categoryGroup: "",
          subGroup: "",
          amount: "",
          paymentMethod: "unknown",
          notes: ""
        });
        setItems([]);
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
          <h2 className="c-modal-title text-[var(--color-text)]">
            {initialData?.id ? t("Chỉnh sửa giao dịch", "Edit transaction") : t("Thêm giao dịch thủ công", "Add manual transaction")}
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
            {/* Date */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Ngày", "Ngày")}</label>
              <div className="relative">
                <input name="date" value={formData.date} onChange={handleChange} type="date" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]" />
              </div>
            </div>

            {/* Payee / Source */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Nơi chi / nguồn thu", "Nơi chi / nguồn thu")}</label>
              <input name="supplier" value={formData.supplier} onChange={handleChange} type="text" placeholder="VD: Coopmart, Lương tháng 7" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none text-[var(--color-text)]" />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Loại", "Loại")}</label>
              <div className="relative">
                <select name="type" value={formData.type} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)] appearance-none">
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                  <option value="Transfer">Transfer</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Nhóm chi tiêu", "Nhóm chi tiêu")}</label>
              <div className="relative">
                <select name="categoryGroup" value={formData.categoryGroup} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)] appearance-none">
                  <option value="">{t("— Chọn nhóm —", "— Select —")}</option>
                  {groupNames.map(cat => (
                    <option key={cat} value={cat}>{label(cat)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Subcategory */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Danh mục con", "Danh mục con")}</label>
              <div className="relative">
                <select name="subGroup" value={formData.subGroup} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)] appearance-none">
                  <option value="">— Không chọn —</option>
                  {subGroupsOf(formData.categoryGroup).map(sub => (
                    <option key={sub} value={sub}>{label(sub)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Số tiền (VND)", "Số tiền (VND)")}</label>
              <input name="amount" value={formData.amount} onChange={handleChange} type="number" placeholder="125000" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]" />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Thanh toán", "Thanh toán")}</label>
              <div className="relative">
                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)] appearance-none">
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{t(PAYMENT_METHOD_LABELS[m], m)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
              </div>
            </div>
            
            <div className="col-span-1 md:col-span-2 space-y-2">
               <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("Ghi chú", "Ghi chú")}</label>
               <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)] min-h-[80px] resize-none"></textarea>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mt-6 border-t border-[var(--color-border)] pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-[var(--color-text)]">Chi tiết món hàng</h3>
              <button 
                onClick={() => setItems([...items, { productName: "", quantity: 1, unitPrice: 0, totalPrice: 0 }])}
                className="text-xs flex items-center gap-1 bg-[var(--color-surface-2)] px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text)]"
              >
                Thêm dòng
              </button>
            </div>
            
            <div className="border border-[var(--color-border)] rounded-xl overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] uppercase border-b border-[var(--color-border)]">
                  <tr>
                    <th className="px-3 py-3">Tên sản phẩm</th>
                    <th className="px-3 py-3 w-16">SL</th>
                    <th className="px-3 py-3 w-28">Đơn giá</th>
                    <th className="px-3 py-3 w-32">Thành tiền</th>
                    <th className="px-3 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]/50">
                      <td className="px-2 py-2">
                        <input type="text" value={item.productName} onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].productName = e.target.value;
                          setItems(newItems);
                        }} className="w-full bg-transparent p-1.5 border border-transparent focus:border-[var(--color-accent)] rounded outline-none text-[var(--color-text)]" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={item.quantity} onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].quantity = e.target.value;
                          setItems(newItems);
                        }} className="w-full bg-transparent p-1.5 border border-transparent focus:border-[var(--color-accent)] rounded outline-none text-[var(--color-text)]" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={item.unitPrice} onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].unitPrice = e.target.value;
                          setItems(newItems);
                        }} className="w-full bg-transparent p-1.5 border border-transparent focus:border-[var(--color-accent)] rounded outline-none text-[var(--color-text)]" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={item.totalPrice} onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].totalPrice = e.target.value;
                          setItems(newItems);
                        }} className="w-full bg-transparent p-1.5 border border-transparent focus:border-[var(--color-accent)] rounded outline-none text-[var(--color-text)]" />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => {
                          const newItems = [...items];
                          newItems.splice(idx, 1);
                          setItems(newItems);
                        }} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] p-1.5 rounded-lg hover:bg-[var(--color-error-tint)] transition-colors">
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-[var(--color-text-faint)]">Không có dữ liệu mặt hàng</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-5 md:p-6 border-t border-[var(--color-border)] flex items-center gap-4 bg-[var(--color-surface-2)]">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="c-btn c-btn-primary c-btn-lg c-btn-pill shadow-sm"
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
