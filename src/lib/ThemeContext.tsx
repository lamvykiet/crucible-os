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
 * Việc chống nháy màu KHÔNG do JavaScript đảm nhiệm. globals.css đã có
 * @media (prefers-color-scheme: dark), nên bảng màu đúng được áp ngay từ lúc
 * trình duyệt phân tích CSS, trước cả khi React chạy.
 *
 * (Bản trước dùng một script nội tuyến trong <head>. Không hoạt động: React
 * chèn thẻ <script> qua DOM API chứ không qua bộ phân tích HTML, mà script chèn
 * kiểu đó thì trình duyệt không thực thi. Đổi sang next/script với
 * beforeInteractive cũng không xong — nội dung chỉ nằm trong payload RSC.)
 *
 * Context này chỉ lo phần GHI ĐÈ TƯỜNG MINH: khi người dùng bấm nút, ta ghi
 * data-theme lên <html> và lưu vào localStorage.
 */

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

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
  // Render đầu tiên phải khớp HTML từ server, nên khởi tạo "light" rồi mới
  // đồng bộ sau khi mount. Không gây nháy màu vì màu thật do CSS quyết định —
  // state này chỉ để nút bấm hiển thị đúng nhãn Sáng/Tối.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const explicit = storedTheme();
    if (explicit) {
      document.documentElement.dataset.theme = explicit;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(explicit);
    } else {
      setThemeState(systemTheme());
    }
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

  // Theo dõi cài đặt hệ điều hành, nhưng chỉ khi người dùng chưa chọn tay.
  // CSS đã tự đổi màu; ở đây chỉ cần cập nhật nhãn trên nút.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (storedTheme()) return;
      setThemeState(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
      theme: "light" as Theme,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
