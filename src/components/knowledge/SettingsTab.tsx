"use client";

import { Settings, Save, Link as LinkIcon, Info } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function SettingsTab() {
  const { t } = useLanguage();

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t("Settings & Integration", "Cài đặt & Tích hợp")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("Configure your Google Drive folders for Knowledge Hub and Finance OCR.", "Cấu hình thư mục Google Drive cho Knowledge Hub và Finance OCR.")}
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
          <Settings className="text-[var(--color-text-faint)]" size={24} />
          <h3 className="text-xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t("Drive Folder Links", "Liên kết thư mục Drive")}
          </h3>
        </div>

        {/* Instructions */}
        <div className="bg-[var(--color-info-tint)] border-l-4 border-blue-500 p-4 rounded-r-lg text-sm text-blue-800">
          <h4 className="font-bold flex items-center gap-2 mb-2">
            <Info size={16} /> {t("How to get Folder ID", "Cách lấy ID Thư mục")}
          </h4>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>{t("Open Google Drive in your browser.", "Mở Google Drive trên trình duyệt.")}</li>
            <li>{t("Navigate to the folder you want to link.", "Vào thư mục bạn muốn liên kết.")}</li>
            <li>{t("Look at the URL. It will look like: https://drive.google.com/drive/folders/", "Nhìn lên thanh địa chỉ (URL). Nó sẽ có dạng: https://drive.google.com/drive/folders/")}<strong>1A2b3C4d5E6f7G8h9I0j</strong></li>
            <li>{t("Copy that ID string and paste it below.", "Copy chuỗi ID đó và dán vào ô bên dưới.")}</li>
          </ol>
        </div>

        <div className="space-y-5">
          {/* Knowledge Hub Folder */}
          <div>
            <label className="block text-sm font-bold text-[var(--color-text)] mb-1">
              {t("Knowledge Hub Document Folder ID", "ID Thư mục Tài liệu (Knowledge Hub)")}
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              {t("This folder will be used to display your documents in the File Explorer.", "Thư mục này sẽ hiển thị trong phần Explorer của Knowledge Hub.")}
            </p>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={18} />
              <input 
                type="text" 
                placeholder="Ví dụ: 1A2b3C4d5E6f7G8h9I0j"
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-[var(--color-info)] focus:bg-[var(--color-surface)] transition-colors"
                defaultValue={process.env.NEXT_PUBLIC_DRIVE_FOLDER_ID || ""}
              />
            </div>
          </div>

          {/* Finance OCR Folder */}
          <div>
            <label className="block text-sm font-bold text-[var(--color-text)] mb-1">
              {t("Finance OCR Image Folder ID", "ID Thư mục Hóa đơn (Finance OCR)")}
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              {t("Images uploaded to this folder will be processed by the OCR engine for Finance OS.", "Ảnh hóa đơn tải lên thư mục này sẽ được xử lý bởi OCR cho Sổ chi tiêu.")}
            </p>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={18} />
              <input 
                type="text" 
                placeholder="Ví dụ: 0Z9y8X7w6V5u4T3s2R1q"
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-[var(--color-info)] focus:bg-[var(--color-surface)] transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white rounded-lg px-6 py-2.5 font-bold flex items-center gap-2 shadow-sm">
            <Save size={18} /> {t("Save Settings", "Lưu Cài đặt")}
          </button>
        </div>
      </div>
    </div>
  );
}
