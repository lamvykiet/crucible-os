"use client";

import { Save, Link as LinkIcon, Info } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function KnowledgeSettings() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t("Liên kết Drive API", "Liên kết Drive API")}</h2>
        <p className="text-[var(--color-text-muted)] text-sm">{t("Cấu hình thư mục Google Drive cho Knowledge Hub và Finance OCR", "Cấu hình thư mục Google Drive cho Knowledge Hub và Finance OCR")}</p>
      </div>

      <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-sm p-6 space-y-6">
        
        {/* Instructions */}
        <div className="bg-[var(--color-info-tint)] border-l-4 border-blue-500 p-4 rounded-r-lg text-sm text-blue-800">
          <h4 className="font-bold flex items-center gap-2 mb-2">
            <Info size={16} /> {t("Cách lấy ID Thư mục", "Cách lấy ID Thư mục")}
          </h4>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>{t("Mở Google Drive trên trình duyệt.", "Mở Google Drive trên trình duyệt.")}</li>
            <li>{t("Vào thư mục bạn muốn liên kết.", "Vào thư mục bạn muốn liên kết.")}</li>
            <li>{t("Nhìn lên thanh địa chỉ (URL). Nó sẽ có dạng: https://drive.google.com/drive/folders/", "Nhìn lên thanh địa chỉ (URL). Nó sẽ có dạng: https://drive.google.com/drive/folders/")}<strong>1A2b3C4d5E6f7G8h9I0j</strong></li>
            <li>{t("Copy chuỗi ID đó và dán vào ô bên dưới.", "Copy chuỗi ID đó và dán vào ô bên dưới.")}</li>
          </ol>
        </div>

        <div className="space-y-5">
          {/* Knowledge Hub Folder */}
          <div>
            <label className="block text-sm font-bold text-[var(--color-text)] mb-1">
              {t("ID Thư mục Tài liệu (Knowledge Hub)", "ID Thư mục Tài liệu (Knowledge Hub)")}
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              {t("Thư mục này sẽ hiển thị trong phần Explorer của Knowledge Hub.", "Thư mục này sẽ hiển thị trong phần Explorer của Knowledge Hub.")}
            </p>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={18} />
              <input 
                type="text" 
                placeholder="Ví dụ: 1A2b3C4d5E6f7G8h9I0j"
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] focus:bg-[var(--color-surface)] transition-colors"
                defaultValue={process.env.NEXT_PUBLIC_DRIVE_FOLDER_ID || ""}
              />
            </div>
          </div>

          {/* Finance OCR Folder */}
          <div>
            <label className="block text-sm font-bold text-[var(--color-text)] mb-1">
              {t("ID Thư mục Hóa đơn (Finance OCR)", "ID Thư mục Hóa đơn (Finance OCR)")}
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              {t("Ảnh hóa đơn tải lên thư mục này sẽ được xử lý bởi OCR cho Sổ chi tiêu.", "Ảnh hóa đơn tải lên thư mục này sẽ được xử lý bởi OCR cho Sổ chi tiêu.")}
            </p>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={18} />
              <input 
                type="text" 
                placeholder="Ví dụ: 0Z9y8X7w6V5u4T3s2R1q"
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-info)] focus:bg-[var(--color-surface)] transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white rounded-xl px-6 py-2.5 font-bold flex items-center gap-2 shadow-sm">
            <Save size={18} /> {t("Lưu Cài đặt", "Lưu Cài đặt")}
          </button>
        </div>
      </div>
    </div>
  );
}
