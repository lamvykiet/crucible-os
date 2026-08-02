"use client";

import React, { useState, useRef } from "react";
import { X, Upload, FileText, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface ScanInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export default function ScanInvoiceModal({ isOpen, onClose, onSuccess }: ScanInvoiceModalProps) {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setIsScanning(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Có lỗi xảy ra khi quét hóa đơn");
      }

      onSuccess(result.data);
    } catch (err: any) {
      setError(err.message || "Không thể quét hóa đơn. Vui lòng thử lại.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--color-text)]" style={{fontFamily: 'var(--font-display)'}}>
            {t("Quét hóa đơn", "Scan Invoice")}
          </h2>
          <button 
            onClick={onClose}
            disabled={isScanning}
            className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8 text-center flex flex-col items-center justify-center">
          {error && <div className="mb-6 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl w-full">{error}</div>}
          
          {isScanning ? (
            <div className="py-8 flex flex-col items-center">
              <Loader2 size={48} className="animate-spin text-[var(--color-info)] mb-4" />
              <p className="font-bold text-[var(--color-text)]">{t("Đang AI quét dữ liệu...", "AI is analyzing receipt...")}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-2">{t("Quá trình này có thể mất 10-15 giây.", "This might take 10-15 seconds.")}</p>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-[var(--color-info-tint)] text-[var(--color-info)] rounded-full flex items-center justify-center mb-6">
                <FileText size={32} />
              </div>
              <h3 className="font-bold text-[var(--color-text)] text-lg mb-2">{t("Tải lên hóa đơn", "Upload Receipt")}</h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-8">
                {t("Hỗ trợ định dạng JPG, PNG, WEBP, HEIC, PDF. Kích thước tối đa 10MB.", "Supports JPG, PNG, WEBP, HEIC, PDF. Max size 10MB.")}
              </p>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" 
                className="hidden" 
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white font-bold px-8 py-3 rounded-full text-sm shadow-sm transition-colors flex items-center gap-2 w-full justify-center"
              >
                <Upload size={18} />
                {t("Chọn tệp", "Select File")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
