"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { moduleFor } from "@/lib/modules";
import { useMe } from "@/lib/useMe";
import { useQuickActions } from "@/components/QuickActions";

/**
 * Thanh trên của máy tính (demo `.top`): ngữ cảnh bên trái (người dùng · function
 * đang mở), ô "Hỏi Crucible…" ở giữa, nút sáng/tối và chuông bên phải. Điện thoại
 * dùng `MobileTopBar`.
 *
 * Ô "Hỏi Crucible…" CHỈ là ô nhập: dự án chưa có trợ lý chung (chat hiện nằm
 * trong từng tài liệu ở Knowledge), nên Enter nói thẳng điều đó thay vì giả vờ
 * trả lời. ⌘K / Ctrl+K đưa con trỏ vào ô (không đụng phím nào của trình duyệt).
 *
 * Chuông: chấm hiện khi có hoá đơn chờ duyệt (số thật từ `QuickActions`); bấm
 * mở popover, từ đó mở hàng đợi duyệt. Không có gì thì nói "chưa có thông báo".
 */
export default function TopBar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { pending, open } = useQuickActions();
  const me = useMe();
  const mod = moduleFor(pathname);
  const [note, setNote] = useState(false);
  const [bell, setBell] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setBell(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const name = me?.displayName?.trim() || "Crucible";
  const where = mod ? t(mod.en, mod.vi) : pathname.startsWith("/settings") ? t("Settings", "Cài đặt") : "";

  return (
    <div className="c-top hidden md:grid">
      <div className="c-ctx">
        <span className="c-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>
        <span>
          <b>{name}</b>
          {where && <> · {where}</>}
        </span>
      </div>

      <label className="c-ask">
        <Search />
        <input
          id="c-ask-input"
          ref={inputRef}
          placeholder={t("Ask Crucible…", "Hỏi Crucible…")}
          aria-label={t("Ask Crucible", "Hỏi Crucible")}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            setNote(true);
            clearTimeout(noteTimer.current);
            noteTimer.current = setTimeout(() => setNote(false), 5000);
          }}
          onBlur={() => setNote(false)}
        />
        <kbd className="c-kbd">⌘K</kbd>
        {note && (
          <p className="c-ask-note" role="status">
            {t(
              "Ask Crucible isn't connected to an assistant yet. Chat currently lives inside each document in Knowledge.",
              "Hỏi Crucible chưa nối với trợ lý chung. Hiện chat nằm trong từng tài liệu ở mục Knowledge.",
            )}
          </p>
        )}
      </label>

      <div className="c-top-right">
        <button
          type="button"
          className="c-round"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("Switch to light", "Chuyển sang sáng") : t("Switch to dark", "Chuyển sang tối")}
          title={theme === "dark" ? t("Light mode", "Giao diện sáng") : t("Dark mode", "Giao diện tối")}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>
        <button
          type="button"
          className="c-round"
          onClick={() => setBell((v) => !v)}
          aria-label={t("Notifications", "Thông báo")}
          aria-expanded={bell}
          title={t("Notifications", "Thông báo")}
        >
          <Bell />
          {pending > 0 && <span className="c-dot" aria-hidden />}
        </button>
        {bell && (
          <>
            <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setBell(false)} />
            <div className="c-pop" role="dialog" aria-label={t("Notifications", "Thông báo")}>
              <p className="c-pop-head">{t("Notifications", "Thông báo")}</p>
              {pending > 0 ? (
                <button
                  type="button"
                  className="c-pop-row"
                  onClick={() => {
                    setBell(false);
                    open("review");
                  }}
                >
                  <span>
                    {t(`${pending} receipts to review`, `${pending} hoá đơn chờ duyệt`)}
                    <small>{t("Scanned, not in the ledger yet", "Đã quét, chưa ghi sổ")}</small>
                  </span>
                </button>
              ) : (
                <p className="c-pop-empty">{t("No new notifications.", "Chưa có thông báo mới.")}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
