"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = "app_theme";

/**
 * Chế độ sáng/tối.
 *
 * SÁNG LÀ MẶC ĐỊNH, không theo cài đặt hệ điều hành: giấy kem là bản sắc của
 * design system, còn bảng tối là thứ người dùng chủ động chọn. Bảng sáng nằm
 * ngay trên `:root` trong globals.css nên được áp từ lúc trình duyệt phân tích
 * CSS, trước cả khi React chạy — không bao giờ nháy màu.
 *
 * (Bản trước dùng một script nội tuyến trong <head> để chống nháy. Không hoạt
 * động: React chèn thẻ <script> qua DOM API chứ không qua bộ phân tích HTML,
 * mà script chèn kiểu đó thì trình duyệt không thực thi. Đổi sang next/script
 * với beforeInteractive cũng không xong — nội dung chỉ nằm trong payload RSC.)
 *
 * Context này chỉ lo phần GHI ĐÈ TƯỜNG MINH: khi người dùng bấm nút, ta ghi
 * data-theme lên <html> và lưu vào localStorage.
 */

const DEFAULT_THEME: Theme = "light";

function storedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Render đầu tiên phải khớp HTML từ server, nên khởi tạo bằng mặc định rồi
  // mới đồng bộ sau khi mount. Không gây nháy màu vì màu thật do CSS quyết
  // định — state này chỉ để nút bấm hiển thị đúng nhãn Sáng/Tối.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const explicit = storedTheme();
    if (!explicit) return;
    document.documentElement.dataset.theme = explicit;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(explicit);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Chế độ riêng tư có thể chặn localStorage — đổi theme vẫn phải chạy.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Chưa có provider (render phía server) — trả giá trị trung tính thay vì
    // ném lỗi, giống cách useLanguage() đang làm.
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
