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
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 means list view
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  // Form State for current item
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
      const res = await fetch("/api/drive/pending-count");
      const data = await res.json();
      if (data.success) {
        setQueue(data.files || []);
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
    try {
      const res = await fetch("/api/ocr/from-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: nextItem.id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      const { data, driveFileIds: newIds } = result;
      setDriveFileIds(newIds);
      setFormData({
        date: data.date || new Date().toISOString().slice(0, 10),
        supplier: data.supplier || "",
        type: "Expense",
        categoryGroup: "Food & Dining",
        subtotal: data.subtotal?.toString() || "",
        tax: data.tax?.toString() || "",
        serviceCharge: data.serviceCharge?.toString() || "",
        discount: data.discount?.toString() || "",
        totalAmount: data.totalAmount?.toString() || "",
      });
      setItems(data.items || []);
      setPreviewUrl(`/api/drive/download?id=${nextItem.id}`);
      setCurrentIndex(0); // View current item

      if (data.date && data.supplier && data.totalAmount) {
        checkDuplicate(data.date, data.supplier, data.totalAmount);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process image");
      // Remove from queue so we can skip it
      setQueue(prev => prev.slice(1));
    } finally {
      setIsProcessing(false);
    }
  };

  const checkDuplicate = async (date: string, supplier: string, totalAmount: number) => {
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

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (idx: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!formData.totalAmount || isNaN(Number(formData.totalAmount))) {
      setError("Vui lòng nhập tổng tiền hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { ...formData, items, driveFileIds, source: "ocr" };
      const res = await fetch("/api/finance/transaction", {
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
        setCurrentIndex(-1); // Back to list view (or auto process next)
        if (remaining.length > 0) {
           // auto process next? No, wait for user to click or just auto trigger?
           // Let's go back to list view so they can see progress.
        } else {
          onClose();
        }
      } else {
        setError(data.error || "Có lỗi xảy ra");
      }
    } catch (err) {
      setError("Lỗi kết nối");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await fetch("/api/drive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveFileIds })
      });
      const remaining = queue.slice(1);
      setQueue(remaining);
      setDuplicateWarning(null);
      setCurrentIndex(-1);
      if (remaining.length === 0) onClose();
    } catch(e) {}
    setIsSubmitting(false);
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
                <div key={q.id} className="flex items-center gap-4 bg-[var(--color-surface-2)] p-4 rounded-xl border border-[var(--color-border)]">
                  <div className="w-10 h-10 bg-[var(--color-info-tint)] text-[var(--color-info)] rounded-lg flex items-center justify-center flex-none">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 truncate">
                    <p className="font-bold text-sm text-[var(--color-text)] truncate">{q.name}</p>
                    <p className="text-xs text-[var(--color-text-faint)]">{q.mimeType}</p>
                  </div>
                  {i === 0 && isProcessing && (
                    <Loader2 size={18} className="animate-spin text-[var(--color-info)]" />
                  )}
                </div>
              ))}
              {queue.length === 0 && (
                <div className="text-center text-[var(--color-text-faint)] py-10">Không còn hóa đơn nào trong hàng đợi.</div>
              )}
            </div>
          </div>
        ) : (
          // Review View
          <div className="flex flex-col flex-1 overflow-hidden relative">
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
                    <div><strong>Nhà cung cấp:</strong> {duplicateWarning.supplier}</div>
                    <div><strong>Ngày:</strong> {new Date(duplicateWarning.date).toLocaleDateString()}</div>
                    <div><strong>Tổng tiền:</strong> {duplicateWarning.totalAmount.toLocaleString()} đ</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={handleReject} className="w-full bg-[var(--color-error)] text-white py-2 rounded-xl font-bold text-sm">
                      {t("Xóa hóa đơn vừa tải", "Delete this scan")}
                    </button>
                    <button onClick={() => setDuplicateWarning(null)} className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] py-2 rounded-xl font-bold text-sm hover:bg-[var(--color-border)]">
                      {t("Giữ cả hai (Bỏ qua)", "Keep both (Ignore)")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
              {/* Left Side: Preview */}
              <div className="w-full md:w-1/3 bg-[var(--color-surface-2)] border-r border-[var(--color-border)] flex items-center justify-center p-4 overflow-hidden">
                <img src={previewUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-sm border border-[var(--color-border)]" alt="Receipt Preview" />
              </div>

              {/* Right Side: Form and Table */}
              <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="p-6">
                  {error && <div className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">{error}</div>}
                  
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">{t("Thông tin hóa đơn", "Invoice Details")}</h3>
                    <span className="text-xs bg-[var(--color-info-tint)] text-[var(--color-info)] px-2 py-1 rounded-full font-bold">
                      Hóa đơn 1/{queue.length}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Ngày hóa đơn</label>
                       <input type="date" name="date" value={formData.date} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Nhà cung cấp</label>
                       <input type="text" name="supplier" value={formData.supplier} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Loại giao dịch</label>
                       <select name="type" value={formData.type} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm">
                         <option value="Expense">Expense</option>
                         <option value="Income">Income</option>
                         <option value="Transfer">Transfer</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Nhóm chi tiêu</label>
                       <select name="categoryGroup" value={formData.categoryGroup} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm">
                         {(formData.type === "Income" ? INCOME_CATEGORIES : formData.type === "Transfer" ? TRANSFER_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Tạm tính</label>
                       <input type="number" name="subtotal" value={formData.subtotal} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Thuế</label>
                       <input type="number" name="tax" value={formData.tax} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Giảm giá</label>
                       <input type="number" name="discount" value={formData.discount} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">Tổng tiền</label>
                       <input type="number" name="totalAmount" value={formData.totalAmount} onChange={handleFormChange} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm font-bold text-lg" />
                     </div>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">Chi tiết món hàng</h3>
                    <button onClick={() => setItems([...items, { productName: "", quantity: 1, unitPrice: 0, totalPrice: 0 }])} className="text-xs flex items-center gap-1 bg-[var(--color-surface-2)] px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-border)]">
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
                            <td className="px-2 py-1"><input type="text" value={item.productName} onChange={(e) => handleItemChange(idx, "productName", e.target.value)} className="w-full bg-transparent p-1 border border-transparent rounded" /></td>
                            <td className="px-2 py-1"><input type="number" value={item.quantity} onChange={(e) => handleItemChange(idx, "quantity", e.target.value)} className="w-full bg-transparent p-1 border border-transparent rounded" /></td>
                            <td className="px-2 py-1"><input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)} className="w-full bg-transparent p-1 border border-transparent rounded" /></td>
                            <td className="px-2 py-1"><input type="number" value={item.totalPrice} onChange={(e) => handleItemChange(idx, "totalPrice", e.target.value)} className="w-full bg-transparent p-1 border border-transparent rounded" /></td>
                            <td className="px-2 py-1 text-center">
                              <button onClick={() => {
                                const newItems = [...items];
                                newItems.splice(idx, 1);
                                setItems(newItems);
                              }} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] p-1"><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-2)]">
               <div className="flex items-center gap-2">
                 <button onClick={handleSubmit} disabled={isSubmitting || !!duplicateWarning} className="bg-[#66c2c2] hover:bg-[var(--color-success)] text-white px-6 py-2 rounded-xl font-bold text-sm shadow flex items-center gap-2 disabled:opacity-50">
                   {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                   {t("Duyệt (Approve)", "Approve")}
                 </button>
                 <button onClick={handleReject} disabled={isSubmitting} className="bg-transparent border border-[var(--color-border)] hover:bg-[var(--color-error-tint)] hover:text-[var(--color-error)] text-[var(--color-text)] px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50">
                   {t("Bỏ qua (Xóa ảnh)", "Skip & Delete")}
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
