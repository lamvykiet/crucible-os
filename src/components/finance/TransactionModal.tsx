"use client";

import React, { useState } from "react";
import { X, ChevronDown, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/invoice";
import { invalidateSuppliers, type SupplierSuggestion } from "@/lib/useSuppliers";
import SupplierInput from "./SupplierInput";
import { todayLocalIso } from "@/lib/localDate";

interface LineItem {
  productName: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
}

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
    date: initialData?.date || todayLocalIso(),
    supplier: initialData?.supplier || "",
    type: defaultType,
    categoryGroup: initialData?.categoryGroup || "",
    subGroup: "",
    amount: initialData?.totalAmount?.toString() || "",
    paymentMethod: initialData?.paymentMethod || "unknown",
    notes: initialData?.notes || ""
  });

  const [items, setItems] = useState<LineItem[]>(initialData?.items || []);

  // Reset form when initialData changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        date: initialData?.date || todayLocalIso(),
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

  /**
   * Chọn một gợi ý thì điền luôn nhóm chi tiêu quen thuộc của nơi đó.
   *
   * Chỉ điền khi ô nhóm đang trống: người dùng đã tự chọn nhóm rồi thì cái họ
   * chọn mới là đúng, gợi ý không được đè lên. Cũng chỉ dùng gợi ý đúng loại
   * giao dịch đang chọn — nhóm thu nhập không được rơi vào một khoản chi.
   */
  const applySupplierDefaults = (supplier: SupplierSuggestion) => {
    setFormData((prev) => {
      if (prev.categoryGroup) return prev;
      const preset = supplier.defaultsByType[prev.type];
      if (!preset) return prev;
      return { ...prev, categoryGroup: preset.categoryGroup, subGroup: preset.subGroup || "" };
    });
  };

  /**
   * Mọi thay đổi ở bảng chi tiết đều đi qua đây, để Số tiền luôn bằng tổng các
   * dòng. Trước đây nhập xong bảng chi tiết vẫn phải tự cộng rồi gõ lại tổng
   * vào ô Số tiền — vừa mất công vừa dễ lệch.
   *
   * Ô Số tiền vẫn gõ tay được (hoá đơn có thuế/phí không nằm trong dòng nào);
   * khi số đã gõ khác tổng các dòng thì form hiện chú thích tổng để đối chiếu,
   * chứ không tự sửa số của người dùng.
   */
  const updateItems = (next: LineItem[]) => {
    setItems(next);
    const total = next.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
    if (next.length > 0 && total > 0) {
      setFormData((prev) => ({ ...prev, amount: String(total) }));
    }
  };

  const handleItemChange = (index: number, field: keyof LineItem, value: string) => {
    updateItems(
      items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value };
        // Sửa SL hoặc Đơn giá thì tính lại Thành tiền — đúng như hai modal hoá
        // đơn quét vẫn làm. Ô Thành tiền vẫn sửa được cho những dòng giá lẻ
        // (khuyến mãi, làm tròn, cân ký), chỉ là không phải nhân tay nữa.
        if (field === "quantity" || field === "unitPrice") {
          const quantity = Number(field === "quantity" ? value : item.quantity) || 0;
          const unitPrice = Number(field === "unitPrice" ? value : item.unitPrice) || 0;
          next.totalPrice = Math.round(quantity * unitPrice);
        }
        return next;
      })
    );
  };

  const handleRemoveItem = (index: number) => updateItems(items.filter((_, i) => i !== index));

  // Ô nhập trong thẻ món hàng trên mobile. Cỡ chữ để mặc định (globals.css đặt
  // sàn 16px dưới 768px) — hạ xuống dưới 16px là iOS Safari phóng to cả trang.
  const mobileItemInput =
    "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 " +
    "focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]";

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
        // Nơi chi vừa gõ giờ đã là dữ liệu thật — bỏ cache để lần mở sau gợi ý nó.
        invalidateSuppliers();
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setFormData({
          date: todayLocalIso(),
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

  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
  // Chỉ nhắc khi hai con số thật sự lệch nhau — lệch là dấu hiệu hoặc còn
  // thuế/phí chưa vào dòng nào, hoặc gõ nhầm.
  const totalMismatch = itemsTotal > 0 && Number(formData.amount) !== itemsTotal;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 p-5 md:p-6 border-b border-[var(--color-border)] flex justify-between items-center gap-3">
          <h2 className="c-h3 text-[var(--color-text)]">
            {initialData?.id ? t("Chỉnh sửa giao dịch", "Edit transaction") : t("Thêm giao dịch thủ công", "Add manual transaction")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("Đóng", "Close")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
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
              <SupplierInput
                value={formData.supplier}
                onChange={(supplier) => setFormData((prev) => ({ ...prev, supplier }))}
                onSelect={applySupplierDefaults}
                placeholder="VD: Coopmart, Lương tháng 7"
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none text-[var(--color-text)]"
              />
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
              <input name="amount" value={formData.amount} onChange={handleChange} type="number" inputMode="numeric" placeholder="125000" className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]" />
              {totalMismatch && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, amount: String(itemsTotal) }))}
                  className="text-xs text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
                >
                  {t("Tổng các dòng:", "Line items total:")} {itemsTotal.toLocaleString("vi-VN")} ₫
                </button>
              )}
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
              <h3 className="c-h5 text-[var(--color-text)]">Chi tiết món hàng</h3>
              <button 
                onClick={() => updateItems([...items, { productName: "", quantity: 1, unitPrice: 0, totalPrice: 0 }])}
                className="text-xs flex items-center gap-1 bg-[var(--color-surface-2)] px-4 min-h-11 md:min-h-0 md:px-3 md:py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text)]"
              >
                Thêm dòng
              </button>
            </div>
            
            {/* Bảng 5 cột chỉ dùng được từ tablet trở lên. Ở 375px nó bóp cột
                "Tên sản phẩm" còn 60px và cắt mất chữ ngay cả với "22000" —
                nên mobile dùng bố cục thẻ bên dưới. */}
            <div className="hidden md:block border border-[var(--color-border)] rounded-xl overflow-x-auto">
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
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                          className="w-full bg-transparent p-1.5 border border-transparent focus:border-[var(--color-accent)] rounded outline-none text-[var(--color-text)]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="w-full bg-transparent p-1.5 border border-transparent focus:border-[var(--color-accent)] rounded outline-none text-center text-[var(--color-text)]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                          className="w-full bg-transparent p-1.5 border border-transparent focus:border-[var(--color-accent)] rounded outline-none text-right text-[var(--color-text)]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={item.totalPrice}
                          onChange={(e) => handleItemChange(idx, "totalPrice", e.target.value)}
                          className="w-full bg-transparent p-1.5 border border-transparent focus:border-[var(--color-accent)] rounded outline-none text-right text-[var(--color-text)]"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] p-1.5 rounded-lg hover:bg-[var(--color-error-tint)] transition-colors"
                        >
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

            {/* Mobile: mỗi món hàng một thẻ. Cùng handler với bảng ở trên nên
                không có đường nào lệch nhau. */}
            <div className="md:hidden space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        {t("Tên sản phẩm", "Product")}
                      </label>
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                        className={mobileItemInput}
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      aria-label={t("Xoá dòng", "Remove line")}
                      className="mt-6 shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-tint)] transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        {t("SL", "Qty")}
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        className={mobileItemInput}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                        {t("Đơn giá", "Unit price")}
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                        className={mobileItemInput}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {t("Thành tiền", "Line total")}
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={item.totalPrice}
                      onChange={(e) => handleItemChange(idx, "totalPrice", e.target.value)}
                      className={mobileItemInput}
                    />
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] py-6 text-center text-[var(--color-text-faint)]">
                  {t("Không có dữ liệu mặt hàng", "No line items")}
                </div>
              )}
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
