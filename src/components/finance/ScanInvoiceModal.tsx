"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, Loader2, AlertCircle, Plus, Trash2, Check } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface ScanInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const INCOME_CATEGORIES = ["Salary", "Investment", "Business", "Gift", "Other Income"];
const TRANSFER_CATEGORIES = ["Transfer Out", "Transfer In"];

export default function ScanInvoiceModal({ isOpen, onClose, onSuccess }: ScanInvoiceModalProps) {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [driveFileIds, setDriveFileIds] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplier: "",
    type: "Expense",
    categoryGroup: "Food & Dining",
    subGroup: "",
    subtotal: "",
    tax: "",
    serviceCharge: "",
    discount: "",
    totalAmount: "",
    paymentMethod: "cash",
    notes: ""
  });

  const [items, setItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep("upload");
      setSelectedFiles([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      setDriveFileIds([]);
      setDuplicateWarning(null);
      setError("");
    }
  }, [isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 3) {
      setError(t("Chỉ được tải lên tối đa 3 ảnh cùng lúc", "Max 3 images allowed"));
      return;
    }

    setSelectedFiles(files);
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);

    setError("");
    setIsScanning(true);

    const formDataUpload = new FormData();
    files.forEach(f => formDataUpload.append("file", f));

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formDataUpload,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Có lỗi xảy ra khi quét hóa đơn");

      const { data, driveFileIds: newDriveFileIds } = result;
      setDriveFileIds(newDriveFileIds);

      // Populate Form
      setFormData(prev => ({
        ...prev,
        date: data.date || prev.date,
        supplier: data.supplier || "",
        subtotal: data.subtotal?.toString() || "",
        tax: data.tax?.toString() || "",
        serviceCharge: data.serviceCharge?.toString() || "",
        discount: data.discount?.toString() || "",
        totalAmount: data.totalAmount?.toString() || "",
      }));

      setItems(data.items || []);
      setStep("review");

      // Check Duplicate
      if (data.date && data.supplier && data.totalAmount) {
        checkDuplicate(data.date, data.supplier, data.totalAmount, newDriveFileIds);
      }

    } catch (err: any) {
      setError(err.message || "Không thể quét hóa đơn. Vui lòng thử lại.");
      setSelectedFiles([]);
      setPreviewUrls([]);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const checkDuplicate = async (date: string, supplier: string, totalAmount: number, currentDriveIds: string[]) => {
    try {
      const res = await fetch("/api/finance/transaction/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, supplier, totalAmount })
      });
      const result = await res.json();
      if (result.success && result.isDuplicate) {
        setDuplicateWarning(result.data);
      }
    } catch (e) {}
  };

  const handleCancelDuplicate = async () => {
    // Delete drive files
    if (driveFileIds.length > 0) {
      await fetch("/api/drive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveFileIds })
      });
    }
    onClose();
  };

  const handleIgnoreDuplicate = () => {
    setDuplicateWarning(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { productName: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!formData.totalAmount || isNaN(Number(formData.totalAmount))) {
      setError("Vui lòng nhập tổng tiền hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        items,
        driveFileIds,
        source: "ocr"
      };

      const res = await fetch("/api/finance/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Có lỗi xảy ra");
      }
    } catch (err) {
      setError("Không thể kết nối đến máy chủ");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className={`bg-[var(--color-surface)] rounded-3xl w-full ${step === "review" ? "max-w-6xl h-[90vh]" : "max-w-md"} shadow-xl overflow-hidden flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--color-text)]" style={{fontFamily: 'var(--font-display)'}}>
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
            {error && <div className="mb-6 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl w-full">{error}</div>}
            
            {isScanning ? (
              <div className="py-8 flex flex-col items-center">
                <Loader2 size={48} className="animate-spin text-[var(--color-info)] mb-4" />
                <p className="font-bold text-[var(--color-text)]">{t("Đang phân tích hóa đơn...", "Analyzing receipt...")}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{t("Vui lòng đợi trong giây lát.", "Please wait.")}</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-[var(--color-info-tint)] text-[var(--color-info)] rounded-full flex items-center justify-center mb-6">
                  <FileText size={32} />
                </div>
                <h3 className="font-bold text-[var(--color-text)] text-lg mb-2">{t("Tải lên hóa đơn", "Upload Receipt")}</h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-8">
                  {t("Hỗ trợ JPG, PNG. Có thể chọn tối đa 3 ảnh cho 1 hóa đơn dài.", "Supports JPG, PNG. Max 3 images for a long receipt.")}
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
            {duplicateWarning && (
              <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-[var(--color-surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                  <div className="flex items-center gap-3 text-[var(--color-warning)] mb-4">
                    <AlertCircle size={24} />
                    <h3 className="font-bold text-lg">{t("Phát hiện trùng lặp", "Duplicate Detected")}</h3>
                  </div>
                  <p className="text-sm text-[var(--color-text)] mb-2">
                    {t("Hóa đơn này dường như đã được nhập vào hệ thống:", "This invoice seems to already exist:")}
                  </p>
                  <div className="bg-[var(--color-surface-2)] p-3 rounded-xl mb-6 text-sm">
                    <div><strong>{t("Nhà cung cấp:", "Supplier:")}</strong> {duplicateWarning.supplier}</div>
                    <div><strong>{t("Ngày:", "Date:")}</strong> {new Date(duplicateWarning.date).toLocaleDateString()}</div>
                    <div><strong>{t("Tổng tiền:", "Total:")}</strong> {duplicateWarning.totalAmount.toLocaleString()} đ</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={handleCancelDuplicate} className="w-full bg-[var(--color-error)] text-white py-2 rounded-xl font-bold text-sm">
                      {t("Xóa hóa đơn vừa chụp", "Delete new scan")}
                    </button>
                    <button onClick={handleIgnoreDuplicate} className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] py-2 rounded-xl font-bold text-sm hover:bg-[var(--color-border)]">
                      {t("Giữ cả hai (Bỏ qua)", "Keep both (Ignore)")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
              {/* Left Side: Images Preview */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] overflow-y-auto p-4 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-[var(--color-text)]">{t("Ảnh hóa đơn", "Receipt Images")}</h3>
                {previewUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Receipt ${i+1}`} className="w-full rounded-lg shadow-sm border border-[var(--color-border)]" />
                ))}
              </div>

              {/* Right Side: Form and Table */}
              <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="p-6">
                  {error && <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">{error}</div>}
                  
                  <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">{t("Thông tin hóa đơn", "Invoice Details")}</h3>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">{t("Ngày hóa đơn", "Date")}</label>
                       <input type="date" name="date" value={formData.date} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">{t("Nhà cung cấp", "Supplier")}</label>
                       <input type="text" name="supplier" value={formData.supplier} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">{t("Loại giao dịch", "Type")}</label>
                       <select name="type" value={formData.type} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm">
                         <option value="Expense">Expense</option>
                         <option value="Income">Income</option>
                         <option value="Transfer">Transfer</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">{t("Nhóm chi tiêu", "Category")}</label>
                       <select name="categoryGroup" value={formData.categoryGroup} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm">
                         {(formData.type === "Income" ? INCOME_CATEGORIES : formData.type === "Transfer" ? TRANSFER_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">{t("Tạm tính", "Subtotal")}</label>
                       <input type="number" name="subtotal" value={formData.subtotal} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">{t("Thuế", "Tax")}</label>
                       <input type="number" name="tax" value={formData.tax} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">{t("Giảm giá", "Discount")}</label>
                       <input type="number" name="discount" value={formData.discount} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">{t("Tổng tiền", "Total")}</label>
                       <input type="number" name="totalAmount" value={formData.totalAmount} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm font-bold text-lg" />
                     </div>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">{t("Chi tiết món hàng", "Line Items")}</h3>
                    <button onClick={handleAddItem} className="text-xs flex items-center gap-1 bg-[var(--color-surface-2)] px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]">
                      <Plus size={14} /> Thêm dòng
                    </button>
                  </div>
                  
                  <div className="border border-[var(--color-border)] rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] uppercase border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-3 py-2">Tên sản phẩm</th>
                          <th className="px-3 py-2 w-16">SL</th>
                          <th className="px-3 py-2 w-28">Đơn giá</th>
                          <th className="px-3 py-2 w-32">Thành tiền</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]/50">
                            <td className="px-2 py-1">
                              <input type="text" value={item.productName} onChange={(e) => handleItemChange(idx, "productName", e.target.value)} className="w-full bg-transparent p-1 border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-info)] rounded" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" value={item.quantity} onChange={(e) => handleItemChange(idx, "quantity", e.target.value)} className="w-full bg-transparent p-1 border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-info)] rounded" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)} className="w-full bg-transparent p-1 border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-info)] rounded" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" value={item.totalPrice} onChange={(e) => handleItemChange(idx, "totalPrice", e.target.value)} className="w-full bg-transparent p-1 border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-info)] rounded" />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <button onClick={() => handleRemoveItem(idx)} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] p-1">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-[var(--color-text-faint)]">Không có dữ liệu mặt hàng</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
               <div className="flex items-center gap-2">
                 <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || !!duplicateWarning}
                  className="bg-[#66c2c2] hover:bg-[var(--color-success)] text-white px-6 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2 disabled:opacity-50"
                 >
                   {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                   {t("Duyệt (Approve)", "Approve")}
                 </button>
                 <button 
                  onClick={handleCancelDuplicate}
                  disabled={isSubmitting}
                  className="bg-transparent border border-[var(--color-border)] hover:bg-[var(--color-error-tint)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] text-[var(--color-text)] px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
                 >
                   {t("Từ chối (Reject)", "Reject")}
                 </button>
               </div>
               <button onClick={onClose} className="text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                 Đóng
               </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
