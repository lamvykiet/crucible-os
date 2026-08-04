"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, FileText, Check, AlertCircle, Trash2, Plus, Play } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface ReviewQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export default function ReviewQueueModal({ isOpen, onClose }: ReviewQueueModalProps) {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Form State for current item
  const [draftFileId, setDraftFileId] = useState("");
  const [formData, setFormData] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [driveFileIds, setDriveFileIds] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchQueue();
    } else {
      setQueue([]);
      setCurrentIndex(-1);
    }
  }, [isOpen]);

  const fetchQueue = async () => {
    try {
      const res = await fetch("/api/finance/transaction/drafts");
      const data = await res.json();
      if (data.success) {
        setQueue(data.drafts || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const processNext = async () => {
    if (queue.length === 0) return;
    const nextItem = queue[0];
    
    setIsProcessing(true);
    setError("");
    
    // Drafts contain the previously confirmed data
    const draftData = nextItem.data;
    setDraftFileId(nextItem.draftFileId);
    setDriveFileIds(draftData.driveFileIds || []);
    setFormData(draftData.formData || {});
    setItems(draftData.items || []);
    
    if (draftData.driveFileIds && draftData.driveFileIds.length > 0) {
      setPreviewUrl(`/api/drive/download?id=${draftData.driveFileIds[0]}`);
    }
    
    setCurrentIndex(0);
    setIsProcessing(false);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (idx: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { productName: "", quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const handleRemoveItem = (idx: number) => {
    const newItems = [...items];
    newItems.splice(idx, 1);
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!formData.totalAmount || isNaN(Number(formData.totalAmount))) {
      setError("Vui lòng nhập tổng tiền hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { draftFileId, formData, items, driveFileIds };
      const res = await fetch("/api/finance/transaction/process-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        // Success. Pop queue and process next
        const remaining = queue.slice(1);
        setQueue(remaining);
        setDuplicateWarning(null);
        setCurrentIndex(-1);
        if (remaining.length === 0) onClose();
      } else if (data.isDuplicate) {
        // Duplicate detected by backend. Backend already deleted the files.
        setDuplicateWarning(data.message || "Phát hiện trùng lặp. Đã tự động xóa file tải lên.");
      } else {
        setError(data.error || "Có lỗi xảy ra");
      }
    } catch (err) {
      setError("Lỗi kết nối");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeDuplicateWarning = () => {
    // Since backend already deleted it, we just remove it from queue and go back to list
    const remaining = queue.slice(1);
    setQueue(remaining);
    setDuplicateWarning(null);
    setCurrentIndex(-1);
    if (remaining.length === 0) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className={`bg-[var(--color-surface)] rounded-3xl w-full ${currentIndex >= 0 ? "max-w-6xl h-[90vh]" : "max-w-xl"} shadow-xl overflow-hidden flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--color-text)]" style={{fontFamily: 'var(--font-display)'}}>
            {t("Duyệt hóa đơn tự động", "Batch Process OCR")}
          </h2>
          <button onClick={onClose} disabled={isProcessing || isSubmitting} className="text-[var(--color-text-faint)] hover:text-[var(--color-error)]">
            <X size={20} />
          </button>
        </div>

        {currentIndex === -1 ? (
          // List View
          <div className="p-6 overflow-y-auto">
            {error && <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">{error}</div>}
            
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-[var(--color-text-muted)]">
                Có <strong>{queue.length}</strong> hóa đơn đang chờ xử lý.
              </p>
              <button 
                onClick={processNext} 
                disabled={queue.length === 0 || isProcessing}
                className="bg-[#66c2c2] hover:bg-[var(--color-success)] text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {t("Bắt đầu duyệt", "Start Processing")}
              </button>
            </div>

            <div className="space-y-3">
              {queue.map((q, i) => (
                <div key={q.draftFileId} className="flex items-center gap-4 bg-[var(--color-surface-2)] p-4 rounded-xl border border-[var(--color-border)]">
                  <div className="w-10 h-10 bg-[var(--color-info-tint)] text-[var(--color-info)] rounded-lg flex items-center justify-center flex-none">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 truncate">
                    <p className="font-bold text-sm text-[var(--color-text)] truncate">{q.data.formData?.supplier || "Hóa đơn mới"}</p>
                    <p className="text-xs text-[var(--color-text-faint)]">{new Date(q.data.formData?.date || Date.now()).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {queue.length === 0 && (
                <div className="text-center text-[var(--color-text-faint)] py-10">Không còn hóa đơn nào trong hàng đợi.</div>
              )}
            </div>
          </div>
        ) : (
          // Review View (3 Columns)
          <div className="flex flex-col flex-1 overflow-hidden relative">
            {duplicateWarning && (
              <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-[var(--color-surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                  <div className="flex items-center gap-3 text-[var(--color-error)] mb-4">
                    <AlertCircle size={24} />
                    <h3 className="font-bold text-lg">{t("Đã hủy hóa đơn", "Scan Rejected")}</h3>
                  </div>
                  <p className="text-sm text-[var(--color-text)] mb-6 text-center">
                    {duplicateWarning}
                  </p>
                  <button onClick={closeDuplicateWarning} className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] py-2 rounded-xl font-bold text-sm hover:bg-[var(--color-border)]">
                    {t("Đóng", "Close")}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
              {/* Column 1: Preview */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] flex items-center justify-center p-4 overflow-hidden">
                <img src={previewUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-sm border border-[var(--color-border)]" alt="Receipt Preview" />
              </div>

              {/* Column 2: Form Info */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-y-auto p-6 flex flex-col">
                  {error && <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">{error}</div>}
                  
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">{t("Thông tin chung", "General Info")}</h3>
                    <span className="text-xs bg-[var(--color-info-tint)] text-[var(--color-info)] px-2 py-1 rounded-full font-bold">
                      Hóa đơn 1/{queue.length}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Ngày hóa đơn</label>
                       <input type="date" name="date" value={formData.date || ""} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Nhà cung cấp</label>
                       <input type="text" name="supplier" value={formData.supplier || ""} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Loại</label>
                         <select name="type" value={formData.type || "Expense"} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm">
                           <option value="Expense">Expense</option>
                           <option value="Income">Income</option>
                           <option value="Transfer">Transfer</option>
                         </select>
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Nhóm</label>
                         <select name="categoryGroup" value={formData.categoryGroup || "Other"} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm">
                           {(formData.type === "Income" ? INCOME_CATEGORIES : formData.type === "Transfer" ? TRANSFER_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Tạm tính</label>
                         <input type="number" name="subtotal" value={formData.subtotal || ""} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Thuế</label>
                         <input type="number" name="tax" value={formData.tax || ""} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Giảm giá</label>
                         <input type="number" name="discount" value={formData.discount || ""} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Tổng tiền</label>
                         <input type="number" name="totalAmount" value={formData.totalAmount || ""} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm font-bold text-lg" />
                       </div>
                     </div>
                  </div>
              </div>

              {/* Column 3: Line Items */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface)] overflow-y-auto p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">Chi tiết món hàng</h3>
                    <button onClick={handleAddItem} className="text-xs flex items-center gap-1 bg-[var(--color-surface-2)] px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]">
                      <Plus size={14} /> Thêm dòng
                    </button>
                  </div>
                  
                  <div className="border border-[var(--color-border)] rounded-xl overflow-hidden overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] uppercase border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-3 py-2">Mặt hàng</th>
                          <th className="px-3 py-2 w-16">SL</th>
                          <th className="px-3 py-2 w-28">Đơn giá</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]/50">
                            <td className="px-2 py-2"><input type="text" value={item.productName} onChange={(e) => handleItemChange(idx, "productName", e.target.value)} className="w-full bg-transparent p-1 border border-[var(--color-border)] focus:border-[var(--color-info)] rounded" placeholder="Tên SP" /></td>
                            <td className="px-2 py-2"><input type="number" value={item.quantity} onChange={(e) => handleItemChange(idx, "quantity", e.target.value)} className="w-full bg-transparent p-1 border border-[var(--color-border)] focus:border-[var(--color-info)] rounded text-center" /></td>
                            <td className="px-2 py-2"><input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)} className="w-full bg-transparent p-1 border border-[var(--color-border)] focus:border-[var(--color-info)] rounded text-right" /></td>
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => handleRemoveItem(idx)} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] p-1"><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center py-4 text-[var(--color-text-faint)]">Không có dữ liệu mặt hàng</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
               <div className="flex items-center gap-2">
                 <button onClick={handleSubmit} disabled={isSubmitting || !!duplicateWarning} className="bg-[#66c2c2] hover:bg-[var(--color-success)] text-white px-6 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2 disabled:opacity-50">
                   {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                   {t("Xét duyệt (Approve)", "Approve")}
                 </button>
               </div>
               <button onClick={() => setCurrentIndex(-1)} disabled={isSubmitting} className="text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                 Về danh sách
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
