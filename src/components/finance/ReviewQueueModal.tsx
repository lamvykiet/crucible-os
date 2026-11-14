"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, FileText, Check, AlertCircle, Plus, ArrowLeft, RefreshCw, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import SubGroupSelect from "./SubGroupSelect";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/invoice";
import { type SupplierSuggestion } from "@/lib/useSuppliers";
import SupplierInput from "./SupplierInput";
import AmountInput from "@/components/ui/AmountInput";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import LineItemsEditor from "./LineItemsEditor";
import AccountSelect from "./AccountSelect";
import { useAccounts } from "@/lib/useAccounts";
import ProjectSplitEditor from "./ProjectSplitEditor";
import type { Split } from "@/lib/projectCost";
import { useProjects } from "@/lib/useProjects";

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

// Cùng khuôn ô nhập và nhãn với TransactionModal. `text-base md:text-sm`: dưới
// 16px thì Safari iPhone phóng to trang khi chạm vào ô.
const inputClass =
  "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 min-h-11 text-base md:text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]";
const selectClass = `${inputClass} appearance-none pr-10`;
const labelClass = "c-overline block mb-2";
const chevron = (
  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
);

const PAYMENT_METHOD_EN: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  "e-wallet": "E-wallet",
  unknown: "Unknown",
};

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
  const accounts = useAccounts();
  const projects = useProjects();
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

  const { groupNames, label } = useCategories(formData.type);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/finance/transaction/drafts");
      const data = await res.json();
      if (data.success) setQueue(data.drafts || []);
      else setError(data.error || t("Failed to load the queue", "Không đọc được hàng đợi"));
    } catch {
      setError(t("Connection error", "Lỗi kết nối"));
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
        setError(data.error || t("Rescan failed", "Quét lại thất bại"));
      }
    } catch {
      setError(t("Connection error", "Lỗi kết nối"));
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
        setError(data.error || t("Could not open the receipt", "Không mở được hóa đơn"));
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
        accountId: str(d.accountId),
        projectSplits: Array.isArray(d.projectSplits) ? (d.projectSplits as Split[]) : [],
        notes: str(d.notes),
      });
      setItems(d.items || []);
      setPreviewIds((d.driveFileIds || "").split(",").filter(Boolean));
      setSaveRule(false);
    } catch {
      setError(t("Connection error", "Lỗi kết nối"));
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

  /**
   * Chọn một gợi ý thì điền luôn nhóm chi tiêu quen thuộc của nơi đó, nhưng
   * chỉ khi ô nhóm đang trống: nhóm do OCR và quy tắc phân loại đề xuất đáng
   * tin hơn thói quen chung.
   *
   * Ghi cả tên lẫn nhóm trong một lần cập nhật vì ô gợi ý gọi `onChange` ngay
   * trước `onSelect`; tách làm hai lần ghi thì lần sau xoá mất lần trước.
   */
  const applySupplierDefaults = (supplier: SupplierSuggestion) => {
    const preset = supplier.defaultsByType[formData.type || "Expense"];
    const fillCategory = preset && !formData.categoryGroup;
    setFormData({
      ...formData,
      supplier: supplier.name,
      ...(fillCategory
        ? { categoryGroup: preset.categoryGroup, subGroup: preset.subGroup || "" }
        : {}),
    });
  };

  /** Ô tiền trả về chuỗi số thô; formData ở màn này không có kiểu nên gom vào đây. */
  const setAmountField = (name: string, value: string) =>
    setFormData((prev: Record<string, unknown>) => ({ ...prev, [name]: value }));

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
      setError(t("Please enter a valid total", "Vui lòng nhập tổng tiền hợp lệ"));
      return;
    }
    if (!formData.date) {
      setError(t("Please enter the receipt date", "Vui lòng nhập ngày hóa đơn"));
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
        setError(data.error || t("Something went wrong", "Có lỗi xảy ra"));
      }
    } catch {
      setError(t("Connection error", "Lỗi kết nối"));
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
      else setError(data.error || t("Could not complete the action", "Không xử lý được"));
    } catch {
      setError(t("Connection error", "Lỗi kết nối"));
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
          activeDraft ? "max-w-6xl h-[90dvh]" : "max-w-xl"
        } max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col transition-all duration-300`}
      >
        <div className="shrink-0 p-5 md:p-6 border-b border-[var(--color-border)] flex justify-between items-center gap-3">
          <h2 className="c-h3 text-[var(--color-text)]">
            {t("Review Invoices", "Duyệt hóa đơn")}
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {!activeDraft ? (
          /* --- Danh sách chờ duyệt --------------------------------------- */
          <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
            {error && (
              <div role="alert" className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
                {error}
              </div>
            )}

            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              {t("There are", "Có")} <strong>{queue.length}</strong>{" "}
              {t("receipts waiting for review.", "hóa đơn đang chờ duyệt.")}
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
                      {draft.supplier || t("New receipt", "Hóa đơn mới")}
                    </p>
                    <p className="text-xs text-[var(--color-text-faint)]">
                      {draft.date ? new Date(draft.date).toLocaleDateString("vi-VN") : "—"} ·{" "}
                      {draft.items?.length || 0} {t("lines", "dòng")}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-[var(--color-text)] flex-none">
                    {draft.totalAmount ? `${draft.totalAmount.toLocaleString("vi-VN")} ₫` : "—"}
                  </div>
                </button>
              ))}

              {!isLoading && queue.length === 0 && (
                <div className="text-center text-[var(--color-text-faint)] py-10">
                  {t("The queue is empty.", "Không còn hóa đơn nào trong hàng đợi.")}
                </div>
              )}
            </div>

            {errorFiles.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
                <h3 className="c-h5 text-[var(--color-error)] mb-1">
                  {t("Failed scans", "Hóa đơn quét lỗi")} ({errorFiles.length})
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                  {t(
                    "Gemini could not read these images. Rescan to put them back in the queue.",
                    "Những ảnh này Gemini đọc không thành công. Bấm quét lại để đưa về hàng đợi."
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
                        className="c-btn c-btn-secondary c-btn-sm shrink-0 min-h-11 md:min-h-0"
                      >
                        {rescanning === f.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        {t("Rescan", "Quét lại")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* --- Màn hình duyệt chi tiết ----------------------------------- */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
            {duplicate && (
              <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-[var(--color-surface)] rounded-3xl p-5 md:p-6 w-full max-w-md max-h-full overflow-y-auto shadow-xl animate-in zoom-in-95">
                  <div className="flex items-center gap-3 text-[var(--color-warning)] mb-4">
                    <AlertCircle size={24} />
                    <h3 className="c-h4">
                      {t("Duplicate detected", "Phát hiện trùng lặp")}
                    </h3>
                  </div>
                  <p className="text-sm text-[var(--color-text)] mb-2">
                    {t(
                      "A transaction with the same date, supplier and amount already exists:",
                      "Đã có một giao dịch cùng ngày, cùng nhà cung cấp và cùng số tiền:"
                    )}
                  </p>
                  <div className="bg-[var(--color-surface-2)] p-3 rounded-xl mb-6 text-sm">
                    <div>
                      <strong>{t("Supplier:", "Nhà cung cấp:")}</strong> {duplicate.supplier}
                    </div>
                    <div>
                      <strong>{t("Date:", "Ngày:")}</strong>{" "}
                      {new Date(duplicate.date).toLocaleDateString("vi-VN")}
                    </div>
                    <div>
                      <strong>{t("Total:", "Tổng tiền:")}</strong>{" "}
                      {duplicate.totalAmount.toLocaleString("vi-VN")} ₫
                    </div>
                    <div className="text-[var(--color-text-muted)] text-xs mt-1">
                      {duplicate.categoryGroup} · {duplicate.itemCount} {t("lines", "dòng")} ·{" "}
                      {duplicate.id}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => approve(true)}
                      disabled={resolving !== null}
                      className="c-btn c-btn-primary w-full !whitespace-normal !leading-snug text-center"
                    >
                      {resolving === "force" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      {t("Two different receipts — record it", "Đây là 2 hóa đơn khác nhau — vẫn ghi")}
                    </button>
                    <button
                      onClick={() => resolveDuplicate("trash")}
                      disabled={resolving !== null}
                      className="c-btn c-btn-secondary w-full !whitespace-normal !leading-snug text-center"
                    >
                      {resolving === "trash" && <Loader2 size={16} className="animate-spin" />}
                      {t("Move image to trash + delete the new transaction", "Đưa ảnh vào thùng rác + xóa giao dịch vừa tạo")}
                    </button>
                    <button
                      onClick={() => resolveDuplicate("delete")}
                      disabled={resolving !== null}
                      className="c-btn c-btn-danger w-full !whitespace-normal !leading-snug text-center"
                    >
                      {resolving === "delete" && <Loader2 size={16} className="animate-spin" />}
                      {t("Delete image + the new transaction", "Xóa luôn ảnh + giao dịch vừa tạo")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-1 min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
              {/* Cột 1: ảnh */}
              <div className="w-full md:w-1/3 shrink-0 md:min-h-0 bg-[var(--color-surface-2)] border-b md:border-b-0 md:border-r border-[var(--color-border)] md:overflow-y-auto p-4 flex flex-col gap-4">
                <h3 className="c-h5 text-[var(--color-text)]">
                  {t("Receipt Images", "Ảnh hóa đơn")}
                </h3>
                {previewIds.map((id) => (
                  <img
                    key={id}
                    src={`/api/drive/download?id=${id}`}
                    className="w-full rounded-lg border border-[var(--color-border)]"
                    alt={t("Receipt", "Hoá đơn")}
                  />
                ))}
              </div>

              {/* Cột 2: thông tin chung */}
              <div className="w-full md:w-1/3 shrink-0 md:min-h-0 bg-[var(--color-surface)] border-b md:border-b-0 md:border-r border-[var(--color-border)] md:overflow-y-auto p-5 md:p-6 flex flex-col">
                {error && (
                  <div role="alert" className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
                    {error}
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <h3 className="c-h5 text-[var(--color-text)]">
                    {t("General Info", "Thông tin chung")}
                  </h3>
                  <span className="text-xs bg-[var(--color-info-tint)] text-[var(--color-info)] px-2.5 py-1 rounded-full font-bold tabular-nums">
                    {t("Left", "Còn")} {queue.length}
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelClass}>{t("Date", "Ngày hóa đơn")}</label>
                    <CustomDatePicker
                      value={formData.date || ""}
                      onChange={(v) => setAmountField("date", v)}
                      aria-label={t("Date", "Ngày")}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("Supplier", "Nhà cung cấp")}</label>
                    <SupplierInput
                      value={formData.supplier || ""}
                      onChange={(supplier) => setFormData({ ...formData, supplier })}
                      onSelect={applySupplierDefaults}
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-3">
                    <div>
                      <label className={labelClass}>{t("Type", "Loại")}</label>
                      <div className="relative">
                        <select name="type" value={formData.type || "Expense"} onChange={handleFormChange} className={selectClass}>
                          <option value="Expense">{t("Expense", "Chi tiêu")}</option>
                          <option value="Income">{t("Income", "Thu nhập")}</option>
                          <option value="Transfer">{t("Transfer", "Chuyển khoản")}</option>
                          <option value="Refund">{t("Refund", "Hoàn tiền")}</option>
                          <option value="Adjustment">{t("Adjustment", "Điều chỉnh")}</option>
                        </select>
                        {chevron}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>{t("Category", "Nhóm")}</label>
                      <div className="relative">
                        <select name="categoryGroup" value={formData.categoryGroup || ""} onChange={handleFormChange} className={selectClass}>
                          <option value="">{t("— Select —", "— Chọn nhóm —")}</option>
                          {groupNames.map((c) => (
                            <option key={c} value={c}>
                              {label(c)}
                            </option>
                          ))}
                        </select>
                        {chevron}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-3">
                    <div>
                      <label className={labelClass}>{t("Sub-group", "Nhóm phụ")}</label>
                      <SubGroupSelect
                        value={formData.subGroup || ""}
                        group={formData.categoryGroup || ""}
                        type={formData.type}
                        onChange={(subGroup) => setFormData((prev: typeof formData) => ({ ...prev, subGroup }))}
                        className={selectClass}
                        trailing={chevron}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Payment", "Thanh toán")}</label>
                      <div className="relative">
                        <select name="paymentMethod" value={formData.paymentMethod || "unknown"} onChange={handleFormChange} className={selectClass}>
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {t(PAYMENT_METHOD_EN[m] ?? m, PAYMENT_METHOD_LABELS[m])}
                            </option>
                          ))}
                        </select>
                        {chevron}
                      </div>
                    </div>
                  </div>

                  {/* Điền sẵn từ bản nháp, sửa lại được — đây là bước cuối cùng
                      trước khi vào sổ, nên cũng là chỗ cuối cùng còn kịp sửa. */}
                  <AccountSelect
                    accounts={accounts}
                    value={formData.accountId || ""}
                    onChange={(id) => setFormData((prev: Record<string, unknown>) => ({ ...prev, accountId: id }))}
                    type={formData.type || "Expense"}
                    paymentMethod={formData.paymentMethod}
                    selectClassName={inputClass}
                    labelClassName={labelClass}
                  />

                  <ProjectSplitEditor
                    projects={projects}
                    value={formData.projectSplits || []}
                    onChange={(splits) => setFormData((prev: Record<string, unknown>) => ({ ...prev, projectSplits: splits }))}
                    type={formData.type || "Expense"}
                    totalAmount={formData.totalAmount}
                    categoryGroup={formData.categoryGroup}
                    selectClassName={inputClass}
                    labelClassName={labelClass}
                  />

                  <div className="grid grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4 xl:gap-3">
                    <div>
                      <label className={labelClass}>{t("Subtotal", "Tạm tính")}</label>
                      <AmountInput name="subtotal" value={formData.subtotal || ""} onValueChange={(v) => setAmountField("subtotal", v)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Tax", "Thuế")}</label>
                      <AmountInput name="tax" value={formData.tax || ""} onValueChange={(v) => setAmountField("tax", v)} className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4 xl:gap-3">
                    <div>
                      <label className={labelClass}>{t("Service charge", "Phí dịch vụ")}</label>
                      <AmountInput name="serviceCharge" value={formData.serviceCharge || ""} onValueChange={(v) => setAmountField("serviceCharge", v)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Discount", "Giảm giá")}</label>
                      <AmountInput name="discount" value={formData.discount || ""} onValueChange={(v) => setAmountField("discount", v)} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>{t("Total", "Tổng tiền")}</label>
                    <AmountInput
                      name="totalAmount"
                      value={formData.totalAmount || ""}
                      onValueChange={(v) => setAmountField("totalAmount", v)}
                      className={`${inputClass} font-bold tabular-nums`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t("Notes", "Ghi chú")}</label>
                    <textarea name="notes" value={formData.notes || ""} onChange={handleFormChange} rows={2} className={`${inputClass} resize-none`} />
                  </div>
                </div>
              </div>

              {/* Cột 3: chi tiết món hàng */}
              <div className="w-full md:w-1/3 shrink-0 md:min-h-0 bg-[var(--color-surface)] md:overflow-y-auto p-5 md:p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="c-h5 text-[var(--color-text)]">
                    {t("Line Items", "Chi tiết món hàng")}
                  </h3>
                  <button
                    onClick={handleAddItem}
                    className="c-btn c-btn-secondary c-btn-sm min-h-11 md:min-h-0"
                  >
                    <Plus size={14} /> {t("Add row", "Thêm dòng")}
                  </button>
                </div>

                <LineItemsEditor
                  items={items}
                  onChange={handleItemChange}
                  onRemove={handleRemoveItem}
                />
              </div>
            </div>

            <div className="shrink-0 p-5 md:p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-wrap items-center justify-end gap-3">
              {formData.supplier && formData.categoryGroup && (
                <label className="w-full md:w-auto md:flex-1 md:min-w-0 flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveRule}
                    onChange={(e) => setSaveRule(e.target.checked)}
                    className="shrink-0 w-5 h-5 accent-[var(--color-primary)]"
                  />
                  {t(
                    `Always use "${formData.categoryGroup}" for ${formData.supplier}`,
                    `Lần sau tự chọn "${formData.categoryGroup}" cho ${formData.supplier}`
                  )}
                </label>
              )}
              <button
                onClick={backToList}
                disabled={busy}
                aria-label={t("Back to list", "Về danh sách")}
                className="c-btn c-btn-tertiary"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">{t("Back to list", "Về danh sách")}</span>
              </button>
              <button
                onClick={() => approve(false)}
                disabled={busy || !!duplicate}
                className="c-btn c-btn-primary"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {t("Approve & record", "Duyệt & ghi vào sổ")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
