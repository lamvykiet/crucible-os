"use client";

import { ShieldCheck, Database, LogOut } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function GeneralSettings() {
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t("Tổng Quan & Tài Khoản", "Tổng Quan & Tài Khoản")}</h2>
        <p className="text-[var(--color-text-muted)] text-sm">{t("Quản lý dữ liệu và cấu hình tài khoản cá nhân", "Quản lý dữ liệu và cấu hình tài khoản cá nhân")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-full bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center mb-4">
              <Database size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2 text-[var(--color-text)]" style={{fontFamily: 'var(--font-display)'}}>{t("Data Safety & Backup", "An toàn Dữ liệu & Sao lưu")}</h3>
            <p className="text-[var(--color-text-muted)] text-sm mb-6">
              {t("Xuất toàn bộ dữ liệu của bạn (Tài chính, Từ điển, Flashcard...) ra định dạng JSON an toàn.", "Xuất toàn bộ dữ liệu của bạn (Tài chính, Từ điển, Flashcard...) ra định dạng JSON an toàn.")}
            </p>
          </div>
          
          <a href="/api/backup/export" download className="c-btn bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text)] w-full flex items-center justify-center gap-2 rounded-xl">
            <ShieldCheck size={18} /> {t("Tải xuống bản sao lưu JSON", "Tải xuống bản sao lưu JSON")}
          </a>
        </div>

        {/* Account Card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-error)] rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-error)]"></div>
          <div>
            <div className="w-12 h-12 rounded-full bg-[var(--color-error-tint)] text-[var(--color-error)] flex items-center justify-center mb-4">
              <LogOut size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2 text-[var(--color-text)]" style={{fontFamily: 'var(--font-display)'}}>{t("Tài Khoản", "Tài Khoản")}</h3>
            <p className="text-[var(--color-text-muted)] text-sm mb-6">
              {t("Phiên đăng nhập hiện tại. Bấm đăng xuất để bảo vệ dữ liệu khi dùng chung thiết bị.", "Phiên đăng nhập hiện tại. Bấm đăng xuất để bảo vệ dữ liệu khi dùng chung thiết bị.")}
            </p>
          </div>
          
          <button onClick={handleLogout} className="c-btn w-full bg-[var(--color-error-tint)] text-[var(--color-error)] border border-transparent hover:bg-[var(--color-error)] hover:text-white rounded-xl transition-colors">
            {t("Đăng xuất", "Đăng xuất")}
          </button>
        </div>
      </div>
    </div>
  );
}
