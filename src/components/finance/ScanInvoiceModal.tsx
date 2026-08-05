"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, Loader2, AlertCircle, Plus, Trash2, Check } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/invoice";

interface ScanInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface LineItem {
  productName: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
  suggestedCategoryGroup?: string | null;
  confidence?: number | null;
}

const EMPTY_FORM = {
  date: "",
  supplier: "",
  type: "Expense",
  categoryGroup: "",
  subGroup: "",
  subtotal: "",
  tax: "",
  serviceCharge: "",
  discount: "",
  totalAmount: "",
  paymentMethod: "unknown",
  language: "",
  notes: "",
};

const inputClass =
  "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm";
const labelClass = "block text-xs font-bold text-[var(--color-info)] mb-1 uppercase";

/** OCR trả null cho những gì không đọc được — ô nhập cần chuỗi rỗng, không phải "null". */
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function ScanInvoiceModal({ isOpen, onClose, onSuccess }: ScanInvoiceModalProps) {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "review">("upload");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [driveFileIds, setDriveFileIds] = useState<string[]>([]);
  const [driveFileName, setDriveFileName] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [items, setItems] = useState<LineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { groupNames, subGroupsOf } = useCategories(formData.type);

  const resetState = () => {
    setStep("upload");
    setPreviewUrls((urls) => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setDriveFileIds([]);
    setDriveFileName("");
    setDuplicateWarning(null);
    setFormData({ ...EMPTY_FORM });
    setItems([]);
    setError("");
  };

  useEffect(() => {
    if (!isOpen) resetState();
    // resetState đọc previewUrls qua dạng updater nên không cần nó trong deps;
    // bản cũ để previewUrls ngoài deps và revoke nhầm mảng của lần mở trước.
  }, [isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 3) {
      setError(t("Chỉ được tải lên tối đa 3 ảnh cùng lúc", "Max 3 images allowed"));
      return;
    }

    setPreviewUrls(files.map((f) => URL.createObjectURL(f)));
    setError("");
    setIsScanning(true);

    const upload = new FormData();
    files.forEach((f) => upload.append("file", f));

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: upload });
      const result = await res.json();

      if (!res.ok) {
        const err = new Error(result.error || "Có lỗi xảy ra khi quét hóa đơn");
        (err as any).movedToError = result.movedToError;
        throw err;
      }

      const { data, driveFileIds: newIds, driveFileName: name } = result;
      setDriveFileIds(newIds || []);
      setDriveFileName(name || "");

      // Gemini gợi ý nhóm chi tiêu cho từng dòng; chọn nhóm xuất hiện nhiều nhất
      // và chỉ dùng nếu nó khớp một danh mục có thật của người dùng.
      const suggested = pickSuggestedGroup(data.items || [], groupNames);

      setFormData({
        ...EMPTY_FORM,
        date: str(data.date) || new Date().toISOString().slice(0, 10),
        supplier: str(data.supplier),
        type: "Expense",
        categoryGroup: suggested || "",
        subtotal: str(data.subtotal),
        tax: str(data.tax),
        serviceCharge: str(data.serviceCharge),
        discount: str(data.discount),
        totalAmount: str(data.totalAmount),
        paymentMethod: str(data.paymentMethod) || "unknown",
        language: str(data.language),
        notes: str(data.notes),
      });

      setItems(data.items || []);
      setStep("review");

      if (data.date && data.totalAmount) {
        checkDuplicate(data.date, data.supplier, data.totalAmount);
      }
    } catch (err: any) {
      setError(
        err.movedToError
          ? `${err.message} — ${t(
              "Ảnh đã được chuyển vào thư mục Error_Invoices trên Drive, bạn có thể quét lại sau.",
              "The image was moved to Error_Invoices on Drive; you can rescan it later."
            )}`
          : err.message || t("Không thể quét hóa đơn. Vui lòng thử lại.", "Scan failed. Please try again.")
      );
      setPreviewUrls((urls) => {
        urls.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const checkDuplicate = async (date: string, supplier: string, totalAmount: number) => {
    try {
      const res = await fetch("/api/finance/transaction/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, supplier, totalAmount }),
      });
      const result = await res.json();
      if (result.success && result.isDuplicate) setDuplicateWarning(result.data);
    } catch {
      // Cảnh báo sớm chỉ là tiện ích; hỏng thì bỏ qua, bước duyệt vẫn kiểm tra lại.
    }
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    // Đổi loại giao dịch thì nhóm cũ không còn thuộc danh sách nào — xoá đi để
    // không lưu nhầm nhóm thu nhập vào một khoản chi.
    setFormData((prev) =>
      name === "type"
        ? { ...prev, type: value, categoryGroup: "", subGroup: "" }
        : name === "categoryGroup"
          ? { ...prev, categoryGroup: value, subGroup: "" }
          : { ...prev, [name]: value }
    );
  };

  const handleItemChange = (index: number, field: keyof LineItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value };
        // Sửa SL hoặc Đơn giá thì tính lại Thành tiền. Bản cũ để nguyên
        // totalPrice của OCR, nên sau khi sửa giá thì dòng chi tiết mâu thuẫn
        // với chính nó.
        if (field === "quantity" || field === "unitPrice") {
          const qty = Number(field === "quantity" ? value : item.quantity) || 0;
          const price = Number(field === "unitPrice" ? value : item.unitPrice) || 0;
          next.totalPrice = Math.round(qty * price);
        }
        return next;
      })
    );
  };

  const handleAddItem = () =>
    setItems((prev) => [...prev, { productName: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);

  const handleRemoveItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!formData.totalAmount || isNaN(Number(formData.totalAmount))) {
      setError(t("Vui lòng nhập tổng tiền hợp lệ", "Please enter a valid total"));
      return;
    }
    if (!formData.date) {
      setError(t("Vui lòng nhập ngày hóa đơn", "Please enter the receipt date"));
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/finance/transaction/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData, items, driveFileIds, driveFileName }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || t("Có lỗi xảy ra khi lưu nháp", "Failed to save draft"));
      }
    } catch {
      setError(t("Không thể kết nối đến máy chủ", "Cannot reach the server"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const itemsTotal = items.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0);
  const computedTotal =
    (Number(formData.subtotal) || 0) +
    (Number(formData.tax) || 0) +
    (Number(formData.serviceCharge) || 0) -
    (Number(formData.discount) || 0);
  const totalMismatch =
    formData.subtotal !== "" &&
    formData.totalAmount !== "" &&
    computedTotal !== Number(formData.totalAmount);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div
        className={`bg-[var(--color-surface)] rounded-3xl w-full ${
          step === "review" ? "max-w-6xl h-[90vh]" : "max-w-md"
        } shadow-xl overflow-hidden flex flex-col transition-all duration-300`}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2
            className="text-xl font-bold text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {step === "review" ? t("Duyệt kết quả OCR", "Review OCR Result") : t("Quét hóa đơn OCR", "Scan Invoice")}
          </h2>
          <button
            onClick={onClose}
            disabled={isScanning || isSubmitting}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {step === "upload" && (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            {error && (
              <div className="mb-6 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl w-full text-left">
                {error}
              </div>
            )}

            {isScanning ? (
              <div className="py-8 flex flex-col items-center">
                <Loader2 size={48} className="animate-spin text-[var(--color-info)] mb-4" />
                <p className="font-bold text-[var(--color-text)]">
                  {t("Đang phân tích hóa đơn...", "Analyzing receipt...")}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  {t("Vui lòng đợi trong giây lát.", "Please wait.")}
                </p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-[var(--color-info-tint)] text-[var(--color-info)] rounded-full flex items-center justify-center mb-6">
                  <FileText size={32} />
                </div>
                <h3 className="font-bold text-[var(--color-text)] text-lg mb-2">
                  {t("Tải lên hóa đơn", "Upload Receipt")}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-8">
                  {t(
                    "Hỗ trợ JPG, PNG. Có thể chọn tối đa 3 ảnh cho 1 hóa đơn dài.",
                    "Supports JPG, PNG. Max 3 images for a long receipt."
                  )}
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  multiple
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white font-bold px-8 py-3 rounded-full text-sm shadow-sm transition-colors flex items-center gap-2 w-full justify-center"
                >
                  <Upload size={18} />
                  {t("Chọn tệp (1-3 ảnh)", "Select Files (1-3)")}
                </button>
              </>
            )}
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
              {/* Cột trái: ảnh hóa đơn */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] overflow-y-auto p-4 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  {t("Ảnh hóa đơn", "Receipt Images")}
                </h3>
                {previewUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Receipt ${i + 1}`}
                    className="w-full rounded-lg shadow-sm border border-[var(--color-border)]"
                  />
                ))}
              </div>

              {/* Cột giữa: thông tin chung */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-y-auto p-6 flex flex-col">
                {error && (
                  <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
                    {error}
                  </div>
                )}

                {duplicateWarning && (
                  <div className="mb-4 text-sm bg-[var(--color-warning-tint)] text-[var(--color-warning)] p-3 rounded-xl flex gap-2">
                    <AlertCircle size={18} className="flex-none mt-0.5" />
                    <div>
                      <strong className="block">
                        {t("Có thể trùng với giao dịch đã có", "Possible duplicate")}
                      </strong>
                      {duplicateWarning.supplier} ·{" "}
                      {new Date(duplicateWarning.date).toLocaleDateString("vi-VN")} ·{" "}
                      {duplicateWarning.totalAmount.toLocaleString("vi-VN")} đ
                      <span className="block mt-1 opacity-80">
                        {t(
                          "Bạn vẫn lưu nháp được — hệ thống sẽ hỏi lại ở bước duyệt.",
                          "You can still save the draft; you will be asked again at approval."
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">
                  {t("Thông tin chung", "General Info")}
                </h3>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelClass}>{t("Ngày hóa đơn", "Date")}</label>
                    <input type="date" name="date" value={formData.date} onChange={handleFormChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("Nhà cung cấp", "Supplier")}</label>
                    <input type="text" name="supplier" value={formData.supplier} onChange={handleFormChange} className={inputClass} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>{t("Loại", "Type")}</label>
                      <select name="type" value={formData.type} onChange={handleFormChange} className={inputClass}>
                        <option value="Expense">Expense</option>
                        <option value="Income">Income</option>
                        <option value="Transfer">Transfer</option>
                        <option value="Refund">Refund</option>
                        <option value="Adjustment">Adjustment</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t("Nhóm", "Category")}</label>
                      <select name="categoryGroup" value={formData.categoryGroup} onChange={handleFormChange} className={inputClass}>
                        <option value="">{t("— Chọn nhóm —", "— Select —")}</option>
                        {groupNames.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>{t("Nhóm phụ", "Sub-group")}</label>
                      <input
                        type="text"
                        name="subGroup"
                        list="scan-subgroups"
                        value={formData.subGroup}
                        onChange={handleFormChange}
                        className={inputClass}
                      />
                      <datalist id="scan-subgroups">
                        {subGroupsOf(formData.categoryGroup).map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className={labelClass}>{t("Thanh toán", "Payment")}</label>
                      <select name="paymentMethod" value={formData.paymentMethod} onChange={handleFormChange} className={inputClass}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {t(PAYMENT_METHOD_LABELS[m], m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>{t("Tạm tính", "Subtotal")}</label>
                      <input type="number" name="subtotal" value={formData.subtotal} onChange={handleFormChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Thuế", "Tax")}</label>
                      <input type="number" name="tax" value={formData.tax} onChange={handleFormChange} className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>{t("Phí dịch vụ", "Service charge")}</label>
                      <input type="number" name="serviceCharge" value={formData.serviceCharge} onChange={handleFormChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Giảm giá", "Discount")}</label>
                      <input type="number" name="discount" value={formData.discount} onChange={handleFormChange} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>{t("Tổng tiền", "Total")}</label>
                    <input
                      type="number"
                      name="totalAmount"
                      value={formData.totalAmount}
                      onChange={handleFormChange}
                      className={`${inputClass} font-bold text-lg`}
                    />
                    {totalMismatch && (
                      <p className="mt-1 text-xs text-[var(--color-warning)]">
                        {t("Tạm tính + thuế + phí − giảm giá =", "Subtotal + tax + fee − discount =")}{" "}
                        {computedTotal.toLocaleString("vi-VN")} đ,{" "}
                        {t("lệch với tổng tiền", "differs from the total")}.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>{t("Ghi chú", "Notes")}</label>
                    <textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={2} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Cột phải: chi tiết món hàng */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface)] overflow-y-auto p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    {t("Chi tiết món hàng", "Line Items")}
                  </h3>
                  <button
                    onClick={handleAddItem}
                    className="text-xs flex items-center gap-1 bg-[var(--color-surface-2)] px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]"
                  >
                    <Plus size={14} /> {t("Thêm dòng", "Add row")}
                  </button>
                </div>

                <div className="border border-[var(--color-border)] rounded-xl overflow-hidden overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] uppercase border-b border-[var(--color-border)]">
                      <tr>
                        <th className="px-3 py-2">{t("Mặt hàng", "Item")}</th>
                        <th className="px-3 py-2 w-14">{t("SL", "Qty")}</th>
                        <th className="px-3 py-2 w-24">{t("Đơn giá", "Price")}</th>
                        <th className="px-3 py-2 w-24">{t("Thành tiền", "Amount")}</th>
                        <th className="px-3 py-2 w-10"></th>
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
                              className="w-full bg-transparent p-1 border border-[var(--color-border)] focus:border-[var(--color-info)] rounded"
                              placeholder={t("Tên SP", "Name")}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              className="w-full bg-transparent p-1 border border-[var(--color-border)] focus:border-[var(--color-info)] rounded text-center"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                              className="w-full bg-transparent p-1 border border-[var(--color-border)] focus:border-[var(--color-info)] rounded text-right"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.totalPrice}
                              onChange={(e) => handleItemChange(idx, "totalPrice", e.target.value)}
                              className="w-full bg-transparent p-1 border border-[var(--color-border)] focus:border-[var(--color-info)] rounded text-right"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-[var(--color-text-faint)]">
                            {t("Không có dữ liệu mặt hàng", "No line items")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {items.length > 0 && (
                  <p className="mt-3 text-xs text-[var(--color-text-muted)] text-right">
                    {t("Tổng các dòng:", "Lines total:")}{" "}
                    <strong className="text-[var(--color-text)]">
                      {itemsTotal.toLocaleString("vi-VN")} đ
                    </strong>
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-[#66c2c2] hover:bg-[var(--color-success)] text-white px-6 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {t("Xác nhận (Confirm)", "Confirm")}
              </button>
              <button
                onClick={onClose}
                className="text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                {t("Đóng", "Close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Nhóm được Gemini gợi ý nhiều nhất, nếu nó thật sự nằm trong danh mục của người dùng. */
function pickSuggestedGroup(items: LineItem[], validGroups: string[]): string {
  const tally = new Map<string, number>();
  for (const item of items) {
    const g = item.suggestedCategoryGroup;
    if (g && validGroups.includes(g)) tally.set(g, (tally.get(g) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [group, count] of tally) {
    if (count > bestCount) {
      best = group;
      bestCount = count;
    }
  }
  return best;
}
