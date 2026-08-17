"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, FileText, Check, AlertCircle, Trash2, Plus, ArrowLeft, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/invoice";

interface ReviewQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LineItem {
  productName: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
}

const inputClass =
  "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm";
const labelClass = "block text-xs font-bold text-[var(--color-info)] mb-1 uppercase";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const toDateInput = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export default function ReviewQueueModal({ isOpen, onClose }: ReviewQueueModalProps) {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [items, setItems] = useState<LineItem[]>([]);
  const [previewIds, setPreviewIds] = useState<string[]>([]);

  // Hoá đơn Gemini đọc hỏng, đang nằm ở Error_Invoices chờ quét lại.
  const [errorFiles, setErrorFiles] = useState<any[]>([]);
  const [rescanning, setRescanning] = useState<string | null>(null);

  // "Học" nhóm vừa chọn thành quy tắc cho nhà cung cấp này.
  const [saveRule, setSaveRule] = useState(false);

  // Hộp thoại trùng lặp: giữ nguyên trên màn hình cho tới khi người dùng chọn
  // một trong ba hướng xử lý. Không có hành động nào chạy trước khi họ bấm.
  const [duplicate, setDuplicate] = useState<any>(null);
  const [resolving, setResolving] = useState<"delete" | "trash" | "force" | null>(null);

  const { groupNames, subGroupsOf, label } = useCategories(formData.type);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/finance/transaction/drafts");
      const data = await res.json();
      if (data.success) setQueue(data.drafts || []);
      else setError(data.error || t("Không đọc được hàng đợi", "Failed to load the queue"));
    } catch {
      setError(t("Lỗi kết nối", "Connection error"));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchErrorFiles = async () => {
    try {
      const res = await fetch("/api/ocr/from-drive");
      const data = await res.json();
      if (data.success) setErrorFiles(data.files || []);
    } catch {
      // Danh sách phụ; hỏng thì ẩn đi.
    }
  };

  /** Quét lại một ảnh hỏng: OCR lại rồi đưa trở vào hàng đợi chờ duyệt. */
  const rescan = async (fileId: string) => {
    setRescanning(fileId);
    setError("");
    try {
      const res = await fetch("/api/ocr/from-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json();
      if (data.success) {
        setErrorFiles((prev) => prev.filter((f) => f.id !== fileId));
        fetchQueue();
      } else {
        setError(data.error || t("Quét lại thất bại", "Rescan failed"));
      }
    } catch {
      setError(t("Lỗi kết nối", "Connection error"));
    } finally {
      setRescanning(null);
    }
  };

  // Đặt SAU fetchQueue/fetchErrorFiles: bản cũ gọi hai hàm này ở phía trên chỗ
  // khai báo chúng, chạy được nhờ effect luôn chạy sau render nhưng vẫn là đọc
  // biến trong vùng chết (TDZ) — đổi thứ tự khai báo một lần là hỏng.
  useEffect(() => {
    if (isOpen) {
      fetchQueue();
      fetchErrorFiles();
    } else {
      setQueue([]);
      setActiveDraft(null);
      setDuplicate(null);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /** Mở một bản nháp: ảnh chuyển Incoming → Review rồi mới hiện form duyệt. */
  const openDraft = async (draft: any) => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/finance/transaction/draft/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || t("Không mở được hóa đơn", "Could not open the receipt"));
        return;
      }

      const d = data.draft;
      setActiveDraft(d);
      setFormData({
        date: toDateInput(d.date),
        supplier: str(d.supplier),
        type: d.type || "Expense",
        categoryGroup: str(d.categoryGroup),
        subGroup: str(d.subGroup),
        subtotal: str(d.subtotal),
        tax: str(d.tax),
        serviceCharge: str(d.serviceCharge),
        discount: str(d.discount),
        totalAmount: str(d.totalAmount),
        paymentMethod: d.paymentMethod || "unknown",
        notes: str(d.notes),
      });
      setItems(d.items || []);
      setPreviewIds((d.driveFileIds || "").split(",").filter(Boolean));
      setSaveRule(false);
    } catch {
      setError(t("Lỗi kết nối", "Connection error"));
    } finally {
      setIsLoading(false);
    }
  };

  const backToList = () => {
    setActiveDraft(null);
    setDuplicate(null);
    setError("");
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev: any) =>
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

  const handleRemoveItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  /** Duyệt: ghi Transaction + TransactionLine. `force` bỏ qua kiểm tra trùng. */
  const approve = async (force = false) => {
    if (!formData.totalAmount || isNaN(Number(formData.totalAmount))) {
      setError(t("Vui lòng nhập tổng tiền hợp lệ", "Please enter a valid total"));
      return;
    }
    if (!formData.date) {
      setError(t("Vui lòng nhập ngày hóa đơn", "Please enter the receipt date"));
      return;
    }

    if (force) setResolving("force");
    else setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/finance/transaction/process-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: activeDraft.id, formData, items, force, saveRule }),
      });
      const data = await res.json();

      if (data.success) {
        finishDraft(activeDraft.id);
      } else if (data.isDuplicate) {
        setDuplicate(data.duplicate);
      } else {
        setError(data.error || t("Có lỗi xảy ra", "Something went wrong"));
      }
    } catch {
      setError(t("Lỗi kết nối", "Connection error"));
    } finally {
      setIsSubmitting(false);
      setResolving(null);
    }
  };

  /** Hai hướng huỷ khi trùng: xoá hẳn ảnh, hoặc cất ảnh vào thùng rác. */
  const resolveDuplicate = async (action: "delete" | "trash") => {
    setResolving(action);
    setError("");
    try {
      const res = await fetch("/api/finance/transaction/resolve-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: activeDraft.id, action }),
      });
      const data = await res.json();
      if (data.success) finishDraft(activeDraft.id);
      else setError(data.error || t("Không xử lý được", "Could not complete the action"));
    } catch {
      setError(t("Lỗi kết nối", "Connection error"));
    } finally {
      setResolving(null);
    }
  };

  const finishDraft = (draftId: string) => {
    const remaining = queue.filter((q) => q.id !== draftId);
    setQueue(remaining);
    setDuplicate(null);
    setActiveDraft(null);
    if (remaining.length === 0) onClose();
  };

  if (!isOpen) return null;

  const busy = isSubmitting || resolving !== null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div
        className={`bg-[var(--color-surface)] rounded-3xl w-full ${
          activeDraft ? "max-w-6xl h-[90vh]" : "max-w-xl"
        } shadow-xl overflow-hidden flex flex-col transition-all duration-300`}
      >
        <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2
            className="text-xl font-bold text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("Duyệt hóa đơn", "Review Invoices")}
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {!activeDraft ? (
          /* --- Danh sách chờ duyệt --------------------------------------- */
          <div className="p-6 overflow-y-auto">
            {error && (
              <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
                {error}
              </div>
            )}

            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              {t("Có", "There are")} <strong>{queue.length}</strong>{" "}
              {t("hóa đơn đang chờ duyệt.", "receipts waiting for review.")}
            </p>

            {isLoading && (
              <div className="flex justify-center py-6 text-[var(--color-info)]">
                <Loader2 size={24} className="animate-spin" />
              </div>
            )}

            <div className="space-y-3">
              {queue.map((draft) => (
                <button
                  key={draft.id}
                  onClick={() => openDraft(draft)}
                  disabled={isLoading}
                  className="w-full text-left flex items-center gap-4 bg-[var(--color-surface-2)] p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-info)] transition-colors disabled:opacity-50"
                >
                  <div className="w-10 h-10 bg-[var(--color-info-tint)] text-[var(--color-info)] rounded-lg flex items-center justify-center flex-none">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 truncate">
                    <p className="font-bold text-sm text-[var(--color-text)] truncate">
                      {draft.supplier || t("Hóa đơn mới", "New receipt")}
                    </p>
                    <p className="text-xs text-[var(--color-text-faint)]">
                      {draft.date ? new Date(draft.date).toLocaleDateString("vi-VN") : "—"} ·{" "}
                      {draft.items?.length || 0} {t("dòng", "lines")}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-[var(--color-text)] flex-none">
                    {draft.totalAmount ? `${draft.totalAmount.toLocaleString("vi-VN")} đ` : "—"}
                  </div>
                </button>
              ))}

              {!isLoading && queue.length === 0 && (
                <div className="text-center text-[var(--color-text-faint)] py-10">
                  {t("Không còn hóa đơn nào trong hàng đợi.", "The queue is empty.")}
                </div>
              )}
            </div>

            {errorFiles.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
                <h3 className="text-sm font-bold text-[var(--color-error)] mb-1">
                  {t("Hóa đơn quét lỗi", "Failed scans")} ({errorFiles.length})
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                  {t(
                    "Những ảnh này Gemini đọc không thành công. Bấm quét lại để đưa về hàng đợi.",
                    "Gemini could not read these images. Rescan to put them back in the queue."
                  )}
                </p>
                <div className="space-y-2">
                  {errorFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-border)]"
                    >
                      <FileText size={16} className="text-[var(--color-error)] flex-none" />
                      <span className="flex-1 truncate text-sm text-[var(--color-text)]">{f.name}</span>
                      <button
                        onClick={() => rescan(f.id)}
                        disabled={rescanning !== null}
                        className="text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border)] disabled:opacity-50"
                      >
                        {rescanning === f.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        {t("Quét lại", "Rescan")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* --- Màn hình duyệt chi tiết ----------------------------------- */
          <div className="flex flex-col flex-1 overflow-hidden relative">
            {duplicate && (
              <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-[var(--color-surface)] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                  <div className="flex items-center gap-3 text-[var(--color-warning)] mb-4">
                    <AlertCircle size={24} />
                    <h3 className="font-bold text-lg">
                      {t("Phát hiện trùng lặp", "Duplicate detected")}
                    </h3>
                  </div>
                  <p className="text-sm text-[var(--color-text)] mb-2">
                    {t(
                      "Đã có một giao dịch cùng ngày, cùng nhà cung cấp và cùng số tiền:",
                      "A transaction with the same date, supplier and amount already exists:"
                    )}
                  </p>
                  <div className="bg-[var(--color-surface-2)] p-3 rounded-xl mb-6 text-sm">
                    <div>
                      <strong>{t("Nhà cung cấp:", "Supplier:")}</strong> {duplicate.supplier}
                    </div>
                    <div>
                      <strong>{t("Ngày:", "Date:")}</strong>{" "}
                      {new Date(duplicate.date).toLocaleDateString("vi-VN")}
                    </div>
                    <div>
                      <strong>{t("Tổng tiền:", "Total:")}</strong>{" "}
                      {duplicate.totalAmount.toLocaleString("vi-VN")} đ
                    </div>
                    <div className="text-[var(--color-text-muted)] text-xs mt-1">
                      {duplicate.categoryGroup} · {duplicate.itemCount} {t("dòng", "lines")} ·{" "}
                      {duplicate.id}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => approve(true)}
                      disabled={resolving !== null}
                      className="c-btn c-btn-primary w-full"
                    >
                      {resolving === "force" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      {t("Đây là 2 hóa đơn khác nhau — vẫn ghi", "Two different receipts — record it")}
                    </button>
                    <button
                      onClick={() => resolveDuplicate("trash")}
                      disabled={resolving !== null}
                      className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] py-2.5 rounded-xl font-bold text-sm hover:bg-[var(--color-border)] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {resolving === "trash" && <Loader2 size={16} className="animate-spin" />}
                      {t("Đưa ảnh vào thùng rác + xóa giao dịch vừa tạo", "Move image to trash + delete the new transaction")}
                    </button>
                    <button
                      onClick={() => resolveDuplicate("delete")}
                      disabled={resolving !== null}
                      className="c-btn c-btn-danger w-full"
                    >
                      {resolving === "delete" && <Loader2 size={16} className="animate-spin" />}
                      {t("Xóa luôn ảnh + giao dịch vừa tạo", "Delete image + the new transaction")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
              {/* Cột 1: ảnh */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] overflow-y-auto p-4 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  {t("Ảnh hóa đơn", "Receipt Images")}
                </h3>
                {previewIds.map((id) => (
                  <img
                    key={id}
                    src={`/api/drive/download?id=${id}`}
                    className="w-full rounded-lg shadow-sm border border-[var(--color-border)]"
                    alt="Receipt"
                  />
                ))}
              </div>

              {/* Cột 2: thông tin chung */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-y-auto p-6 flex flex-col">
                {error && (
                  <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
                    {error}
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    {t("Thông tin chung", "General Info")}
                  </h3>
                  <span className="text-xs bg-[var(--color-info-tint)] text-[var(--color-info)] px-2 py-1 rounded-full font-bold">
                    {t("Còn", "Left")} {queue.length}
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelClass}>{t("Ngày hóa đơn", "Date")}</label>
                    <input type="date" name="date" value={formData.date || ""} onChange={handleFormChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("Nhà cung cấp", "Supplier")}</label>
                    <input type="text" name="supplier" value={formData.supplier || ""} onChange={handleFormChange} className={inputClass} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>{t("Loại", "Type")}</label>
                      <select name="type" value={formData.type || "Expense"} onChange={handleFormChange} className={inputClass}>
                        <option value="Expense">Expense</option>
                        <option value="Income">Income</option>
                        <option value="Transfer">Transfer</option>
                        <option value="Refund">Refund</option>
                        <option value="Adjustment">Adjustment</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t("Nhóm", "Category")}</label>
                      <select name="categoryGroup" value={formData.categoryGroup || ""} onChange={handleFormChange} className={inputClass}>
                        <option value="">{t("— Chọn nhóm —", "— Select —")}</option>
                        {groupNames.map((c) => (
                          <option key={c} value={c}>
                            {label(c)}
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
                        list="review-subgroups"
                        value={formData.subGroup || ""}
                        onChange={handleFormChange}
                        className={inputClass}
                      />
                      <datalist id="review-subgroups">
                        {subGroupsOf(formData.categoryGroup || "").map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className={labelClass}>{t("Thanh toán", "Payment")}</label>
                      <select name="paymentMethod" value={formData.paymentMethod || "unknown"} onChange={handleFormChange} className={inputClass}>
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
                      <input type="number" name="subtotal" value={formData.subtotal || ""} onChange={handleFormChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Thuế", "Tax")}</label>
                      <input type="number" name="tax" value={formData.tax || ""} onChange={handleFormChange} className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>{t("Phí dịch vụ", "Service charge")}</label>
                      <input type="number" name="serviceCharge" value={formData.serviceCharge || ""} onChange={handleFormChange} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Giảm giá", "Discount")}</label>
                      <input type="number" name="discount" value={formData.discount || ""} onChange={handleFormChange} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>{t("Tổng tiền", "Total")}</label>
                    <input
                      type="number"
                      name="totalAmount"
                      value={formData.totalAmount || ""}
                      onChange={handleFormChange}
                      className={`${inputClass} font-bold text-lg`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t("Ghi chú", "Notes")}</label>
                    <textarea name="notes" value={formData.notes || ""} onChange={handleFormChange} rows={2} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Cột 3: chi tiết món hàng */}
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
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)] gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => approve(false)}
                  disabled={busy || !!duplicate}
                  className="c-btn c-btn-primary shadow"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {t("Duyệt & ghi vào sổ", "Approve & record")}
                </button>

                {formData.supplier && formData.categoryGroup && (
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveRule}
                      onChange={(e) => setSaveRule(e.target.checked)}
                      className="accent-[#66c2c2]"
                    />
                    {t(
                      `Lần sau tự chọn "${formData.categoryGroup}" cho ${formData.supplier}`,
                      `Always use "${formData.categoryGroup}" for ${formData.supplier}`
                    )}
                  </label>
                )}
              </div>
              <button
                onClick={backToList}
                disabled={busy}
                className="text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1 disabled:opacity-50"
              >
                <ArrowLeft size={14} /> {t("Về danh sách", "Back to list")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
