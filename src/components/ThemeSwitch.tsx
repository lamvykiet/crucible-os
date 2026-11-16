"use client";

import { Moon, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";

/**
 * Toggle kính lỏng cho sáng/tối (skill `suong-som-design` 7.5, P12).
 *
 * `role="switch"`: BẬT = giao diện tối. Núm trái + mặt trời là sáng, núm phải
 * + mặt trăng là tối. Bản nhỏ 44×26 (không có chữ "Sáng/Tối" trong rãnh) để
 * vừa cột sidebar thu gọn và thanh trên điện thoại — nhãn đi qua
 * `aria-label`/`title`. Chỉ dùng cho nút sáng/tối.
 */
export default function ThemeSwitch({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t("Dark mode", "Giao diện tối")}
      title={dark ? t("Dark mode is on", "Đang bật giao diện tối") : t("Light mode is on", "Đang bật giao diện sáng")}
      onClick={toggleTheme}
      className={`c-switch ${className}`}
    >
      <span className="c-switch-track" aria-hidden>
        <span className="c-switch-knob">
          {dark ? <Moon size={12} strokeWidth={2.2} /> : <Sun size={12} strokeWidth={2.2} />}
        </span>
      </span>
    </button>
  );
}
