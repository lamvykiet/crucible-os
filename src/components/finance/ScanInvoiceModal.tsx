"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, Loader2, AlertCircle, Plus, Check, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import SubGroupSelect from "./SubGroupSelect";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/invoice";
import { pickSuggestedGroup } from "@/lib/classify";
import { type SupplierSuggestion } from "@/lib/useSuppliers";
import SupplierInput from "./SupplierInput";
import { todayLocalIso } from "@/lib/localDate";
import AmountInput from "@/components/ui/AmountInput";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import LineItemsEditor from "./LineItemsEditor";
import AccountSelect from "./AccountSelect";
import { useAccounts } from "@/lib/useAccounts";
import ProjectSplitEditor from "./ProjectSplitEditor";
import type { Split } from "@/lib/projectCost";
import { useProjects } from "@/lib/useProjects";

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
  accountId: "",
  projectSplits: [] as Split[],
  language: "",
  notes: "",
};

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

/** OCR trả null cho những gì không đọc được — ô nhập cần chuỗi rỗng, không phải "null". */
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function ScanInvoiceModal({ isOpen, onClose, onSuccess }: ScanInvoiceModalProps) {
  const { t } = useLanguage();
  const accounts = useAccounts();
  const projects = useProjects();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "review" | "saved">("upload");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [driveFileIds, setDriveFileIds] = useState<string[]>([]);
  const [driveFileName, setDriveFileName] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [items, setItems] = useState<LineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { groupNames, label } = useCategories(formData.type);

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
      setError(t("Max 3 images allowed", "Chỉ được tải lên tối đa 3 ảnh cùng lúc"));
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
        const err = new Error(result.error || t("Something went wrong while scanning the receipt", "Có lỗi xảy ra khi quét hóa đơn"));
        (err as any).movedToError = result.movedToError;
        throw err;
      }

      const { data, suggestion, driveFileIds: newIds, driveFileName: name } = result;
      setDriveFileIds(newIds || []);
      setDriveFileName(name || "");

      // Quy tắc phân loại của người dùng được ưu tiên tuyệt đối; gợi ý của
      // Gemini chỉ dùng khi không quy tắc nào khớp, và cũng chỉ khi nó trỏ tới
      // một danh mục có thật.
      const suggested = suggestion?.categoryGroup || pickSuggestedGroup(data.items || [], groupNames);

      setFormData({
        ...EMPTY_FORM,
        date: str(data.date) || todayLocalIso(),
        supplier: str(data.supplier),
        type: suggestion?.type || "Expense",
        categoryGroup: suggested || "",
        subGroup: suggestion?.subGroup || "",
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
              "The image was moved to Error_Invoices on Drive; you can rescan it later.",
              "Ảnh đã được chuyển vào thư mục Error_Invoices trên Drive, bạn có thể quét lại sau."
            )}`
          : err.message || t("Scan failed. Please try again.", "Không thể quét hóa đơn. Vui lòng thử lại.")
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

  /**
   * Chọn một gợi ý thì điền luôn nhóm chi tiêu quen thuộc của nơi đó, nhưng
   * chỉ khi ô nhóm đang trống: nhóm do OCR/quy tắc phân loại đề xuất, hay do
   * người dùng tự chọn, đều đáng tin hơn thói quen chung.
   */
  const applySupplierDefaults = (supplier: SupplierSuggestion) => {
    setFormData((prev) => {
      if (prev.categoryGroup) return prev;
      const preset = supplier.defaultsByType[prev.type || "Expense"];
      if (!preset) return prev;
      return { ...prev, categoryGroup: preset.categoryGroup, subGroup: preset.subGroup || "" };
    });
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
      setError(t("Please enter a valid total", "Vui lòng nhập tổng tiền hợp lệ"));
      return;
    }
    if (!formData.date) {
      setError(t("Please enter the receipt date", "Vui lòng nhập ngày hóa đơn"));
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
        // Không đóng modal ngay. Bản cũ đóng cái rụp, nên người dùng bấm "Xác
        // nhận" xong thấy màn hình trở lại như cũ và đinh ninh là đã ghi sổ —
        // trong khi mới chỉ lưu nháp, và còn một bước duyệt nữa mới vào sổ.
        onSuccess();
        setStep("saved");
      } else {
        setError(data.error || t("Failed to save draft", "Có lỗi xảy ra khi lưu nháp"));
      }
    } catch {
      setError(t("Cannot reach the server", "Không thể kết nối đến máy chủ"));
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
          step === "review" ? "max-w-6xl h-[90dvh]" : "max-w-md"
        } max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col transition-all duration-300`}
      >
        <div className="shrink-0 p-5 md:p-6 border-b border-[var(--color-border)] flex justify-between items-center gap-3">
          <h2 className="c-h3 text-[var(--color-text)]">
            {step === "saved"
              ? t("Saved to the queue", "Đã lưu vào hàng đợi")
              : step === "review"
                ? t("Check the scan", "Soát kết quả quét")
                : t("Scan a receipt", "Quét hóa đơn")}
          </h2>
          <button
            onClick={onClose}
            disabled={isScanning || isSubmitting}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {step === "upload" && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 text-center flex flex-col items-center">
            {error && (
              <div role="alert" className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl w-full text-left">
                {error}
              </div>
            )}

            {isScanning ? (
              <div className="py-8 flex flex-col items-center">
                <Loader2 size={48} className="animate-spin text-[var(--color-info)] mb-4" />
                <p className="font-bold text-[var(--color-text)]">
                  {t("Analyzing receipt...", "Đang phân tích hóa đơn...")}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  {t("Please wait.", "Vui lòng đợi trong giây lát.")}
                </p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-[var(--color-info-tint)] text-[var(--color-info)] rounded-full flex items-center justify-center mb-6">
                  <FileText size={32} />
                </div>
                <h3 className="c-h4 text-[var(--color-text)] mb-2">
                  {t("Upload Receipt", "Tải lên hóa đơn")}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-8">
                  {t(
                    "Supports JPG, PNG. Max 3 images for a long receipt.",
                    "Hỗ trợ JPG, PNG. Có thể chọn tối đa 3 ảnh cho 1 hóa đơn dài."
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
                  className="c-btn c-btn-primary w-full"
                >
                  <Upload size={18} />
                  {t("Select Files (1-3)", "Chọn tệp (1-3 ảnh)")}
                </button>
              </>
            )}
          </div>
        )}

        {step === "saved" && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-success-tint)] text-[var(--color-success)] flex items-center justify-center mb-5">
              <Check size={32} />
            </div>

            <h3 className="c-h4 text-[var(--color-text)] mb-2">
              {t("Not in the ledger yet", "Chưa ghi vào sổ đâu nhé")}
            </h3>

            <p className="text-sm text-[var(--color-text-muted)] mb-1">
              {formData.supplier || t("Receipt", "Hoá đơn")} ·{" "}
              <strong className="text-[var(--color-text)]">
                {Number(formData.totalAmount || 0).toLocaleString("vi-VN")} ₫
              </strong>{" "}
              · {items.length} {t("lines", "dòng")}
            </p>

            <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-sm">
              {t(
                'It is waiting in the queue. Press the "Review invoices" button at the top of the page, check it once more, then "Approve & record".',
                'Hoá đơn đang nằm trong hàng đợi. Bấm nút "Duyệt hóa đơn" ở đầu trang, xem lại lần cuối rồi bấm "Duyệt & ghi vào sổ" thì giao dịch mới được ghi.'
              )}
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={resetState}
                className="c-btn c-btn-secondary flex-1"
              >
                {t("Scan another", "Quét tiếp")}
              </button>
              <button
                onClick={onClose}
                className="c-btn c-btn-primary flex-1"
              >
                {t("Close and review", "Đóng để đi duyệt")}
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex flex-1 min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
              {/* Cột trái: ảnh hóa đơn */}
              <div className="w-full md:w-1/3 shrink-0 md:min-h-0 bg-[var(--color-surface-2)] border-b md:border-b-0 md:border-r border-[var(--color-border)] md:overflow-y-auto p-4 flex flex-col gap-4">
                <h3 className="c-h5 text-[var(--color-text)]">
                  {t("Receipt Images", "Ảnh hóa đơn")}
                </h3>
                {previewUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={t(`Receipt ${i + 1}`, `Hoá đơn ${i + 1}`)}
                    className="w-full rounded-lg border border-[var(--color-border)]"
                  />
                ))}
              </div>

              {/* Cột giữa: thông tin chung */}
              <div className="w-full md:w-1/3 shrink-0 md:min-h-0 bg-[var(--color-surface)] border-b md:border-b-0 md:border-r border-[var(--color-border)] md:overflow-y-auto p-5 md:p-6 flex flex-col">
                {error && (
                  <div role="alert" className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
                    {error}
                  </div>
                )}

                {duplicateWarning && (
                  <div className="mb-4 text-sm bg-[var(--color-warning-tint)] text-[var(--color-warning)] p-3 rounded-xl flex gap-2">
                    <AlertCircle size={18} className="flex-none mt-0.5" />
                    <div>
                      <strong className="block">
                        {t("Possible duplicate", "Có thể trùng với giao dịch đã có")}
                      </strong>
                      {duplicateWarning.supplier} ·{" "}
                      {new Date(duplicateWarning.date).toLocaleDateString("vi-VN")} ·{" "}
                      {duplicateWarning.totalAmount.toLocaleString("vi-VN")} ₫
                      <span className="block mt-1 opacity-80">
                        {t(
                          "You can still save the draft; you will be asked again at approval.",
                          "Bạn vẫn lưu nháp được — hệ thống sẽ hỏi lại ở bước duyệt."
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <h3 className="c-h5 text-[var(--color-text)] mb-4">
                  {t("General Info", "Thông tin chung")}
                </h3>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelClass}>{t("Date", "Ngày hóa đơn")}</label>
                    <CustomDatePicker
                      value={formData.date}
                      onChange={(v) => setFormData((prev) => ({ ...prev, date: v }))}
                      aria-label={t("Date", "Ngày")}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("Supplier", "Nhà cung cấp")}</label>
                    <SupplierInput
                      value={formData.supplier}
                      onChange={(supplier) => setFormData((prev) => ({ ...prev, supplier }))}
                      onSelect={applySupplierDefaults}
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-3">
                    <div>
                      <label className={labelClass}>{t("Type", "Loại")}</label>
                      <div className="relative">
                        <select name="type" value={formData.type} onChange={handleFormChange} className={selectClass}>
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
                        <select name="categoryGroup" value={formData.categoryGroup} onChange={handleFormChange} className={selectClass}>
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
                        value={formData.subGroup}
                        group={formData.categoryGroup}
                        type={formData.type}
                        onChange={(subGroup) => setFormData((prev) => ({ ...prev, subGroup }))}
                        className={selectClass}
                        trailing={chevron}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Payment", "Thanh toán")}</label>
                      <div className="relative">
                        <select name="paymentMethod" value={formData.paymentMethod} onChange={handleFormChange} className={selectClass}>
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

                  {/* Chọn luôn ở bước quét, vì lúc cầm hoá đơn mới là lúc nhớ
                      rõ đã quẹt thẻ nào. Giá trị đi theo bản nháp sang bước
                      duyệt, sửa lại ở đó vẫn được. */}
                  <AccountSelect
                    accounts={accounts}
                    value={formData.accountId}
                    onChange={(id) => setFormData((prev) => ({ ...prev, accountId: id }))}
                    type={formData.type}
                    paymentMethod={formData.paymentMethod}
                    selectClassName={inputClass}
                    labelClassName={labelClass}
                  />

                  {/* Đi theo bản nháp (`DraftReceipt.projectSplits`) sang bước duyệt. */}
                  <ProjectSplitEditor
                    projects={projects}
                    value={formData.projectSplits}
                    onChange={(splits) => setFormData((prev) => ({ ...prev, projectSplits: splits }))}
                    type={formData.type}
                    totalAmount={formData.totalAmount}
                    categoryGroup={formData.categoryGroup}
                    selectClassName={inputClass}
                    labelClassName={labelClass}
                  />

                  <div className="grid grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4 xl:gap-3">
                    <div>
                      <label className={labelClass}>{t("Subtotal", "Tạm tính")}</label>
                      <AmountInput name="subtotal" value={formData.subtotal} onValueChange={(v) => setFormData((prev) => ({ ...prev, subtotal: v }))} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Tax", "Thuế")}</label>
                      <AmountInput name="tax" value={formData.tax} onValueChange={(v) => setFormData((prev) => ({ ...prev, tax: v }))} className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4 xl:gap-3">
                    <div>
                      <label className={labelClass}>{t("Service charge", "Phí dịch vụ")}</label>
                      <AmountInput name="serviceCharge" value={formData.serviceCharge} onValueChange={(v) => setFormData((prev) => ({ ...prev, serviceCharge: v }))} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>{t("Discount", "Giảm giá")}</label>
                      <AmountInput name="discount" value={formData.discount} onValueChange={(v) => setFormData((prev) => ({ ...prev, discount: v }))} className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>{t("Total", "Tổng tiền")}</label>
                    <AmountInput
                      name="totalAmount"
                      value={formData.totalAmount}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, totalAmount: v }))}
                      className={`${inputClass} font-bold tabular-nums`}
                    />
                    {totalMismatch && (
                      <p className="mt-1 text-xs text-[var(--color-warning)]">
                        {t("Subtotal + tax + fee − discount =", "Tạm tính + thuế + phí − giảm giá =")}{" "}
                        {computedTotal.toLocaleString("vi-VN")} ₫,{" "}
                        {t("differs from the total", "lệch với tổng tiền")}.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>{t("Notes", "Ghi chú")}</label>
                    <textarea name="notes" value={formData.notes} onChange={handleFormChange} rows={2} className={`${inputClass} resize-none`} />
                  </div>
                </div>
              </div>

              {/* Cột phải: chi tiết món hàng */}
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
                  namePlaceholder={t("Name", "Tên SP")}
                />

                {items.length > 0 && (
                  <p className="mt-3 text-xs text-[var(--color-text-muted)] text-right">
                    {t("Lines total:", "Tổng các dòng:")}{" "}
                    <strong className="text-[var(--color-text)]">
                      {itemsTotal.toLocaleString("vi-VN")} ₫
                    </strong>
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 p-5 md:p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-wrap items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="c-btn c-btn-tertiary"
              >
                {t("Close", "Đóng")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="c-btn c-btn-primary"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {t("Save draft — not recorded yet", "Lưu nháp, chưa ghi sổ")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
