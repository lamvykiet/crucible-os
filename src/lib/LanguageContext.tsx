"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "vi";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (en: string, vi: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);

  // Ngôn ngữ đã lưu chỉ đọc được ở phía client. Render đầu tiên buộc phải khớp
  // với HTML do server sinh ra ("en"), rồi mới chuyển sang lựa chọn thật —
  // nếu đọc localStorage ngay trong useState initializer thì text sẽ lệch và
  // React báo lỗi hydration. Vì vậy setState trong effect ở đây là cố ý.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("app_language");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "en" || saved === "vi") setLanguage(saved);
    } catch {
      // Chế độ riêng tư có thể chặn localStorage.
    }
    setMounted(true);
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem("app_language", lang);
    } catch {
      // bỏ qua
    }
  };

  const t = (en: string, vi: string) => {
    return language === "en" ? en : vi;
  };

  // Provider phải bọc children ở MỌI lần render. Bản cũ trả về <>{children}</>
  // khi chưa mounted, nên useLanguage() rơi vào nhánh không có context và trả
  // về hàm t() giả luôn trả tiếng Anh — đó là lý do trang luôn loé tiếng Anh
  // một nhịp trước khi đổi sang tiếng Việt.
  return (
    <LanguageContext.Provider
      value={{ language: mounted ? language : "en", setLanguage: handleSetLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    // Return a dummy context for server side rendering if needed, though we only use it on client
    return { language: "en" as Language, setLanguage: () => {}, t: (en: string) => en };
  }
  return context;
}
