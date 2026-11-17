"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Languages, Moon, Settings, Sun } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { MODULES, moduleFor } from "@/lib/modules";
import ModuleTabs from "@/components/ModuleTabs";

/**
 * Sidebar kính bên trái cho màn hình từ 768px (thay thanh trên `TopNav` từ
 * 13/11/2026, theo mẫu "Glassy Dashboard" chủ dự án chọn).
 *
 * Hai trạng thái:
 *   - Thu gọn (mặc định): cột icon hẹp 68px.
 *   - Bung ra: rê chuột vào hoặc Tab tới (`:hover` / `:focus-within`) là bung
 *     thành panel 248px đè lên nội dung; bấm nút ‹ › ở góc để GHIM mở — lúc đó
 *     nội dung dịch sang phải nhường chỗ. Trạng thái ghim nhớ trong máy.
 *
 * Nội dung: thương hiệu · nhóm Function (mọi function, Tài chính có số hoá
 * đơn chờ duyệt) · nhóm tab con của function đang mở · nhóm Hệ thống (cài đặt,
 * ngôn ngữ, sáng/tối) · thẻ người dùng. Danh sách function và tab lấy từ
 * `src/lib/modules.tsx` — cùng nguồn với `MobileTopBar` của điện thoại.
 *
 * Kính đặt lớp mờ ở `::before` (không làm khối chứa cho `position: fixed`).
 */

const PIN_KEY = "crucible.sidebar.pinned";
const PIN_EVENT = "crucible-sidebar-pin";

function readPinned(): boolean {
  try {
    return window.localStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribePinned(cb: () => void) {
  window.addEventListener(PIN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PIN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export default function Sidebar() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const pinned = useSyncExternalStore(subscribePinned, readPinned, () => false);
  const current = moduleFor(pathname);

  const [pending, setPending] = useState(0);
  const [me, setMe] = useState<{ displayName: string | null; email: string | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const get = (url: string) =>
      fetch(url, { signal: controller.signal }).then((r) => r.json()).catch(() => null);
    get("/api/drive/pending-count").then((j) => {
      if (j?.success) setPending(j.count ?? 0);
    });
    get("/api/me").then((j) => {
      if (j?.success) setMe({ displayName: j.displayName, email: j.email });
    });
    return () => controller.abort();
  }, []);

  const togglePin = () => {
    try {
      window.localStorage.setItem(PIN_KEY, pinned ? "0" : "1");
    } catch {
      // Trình duyệt chặn lưu trữ: ghim chỉ không được nhớ, vẫn bật/tắt được.
    }
    window.dispatchEvent(new Event(PIN_EVENT));
  };

  const name = me?.displayName?.trim() || "Crucible";
  const initial = name.charAt(0).toUpperCase();

  return (
    <aside
      className={`c-side hidden md:flex ${pinned ? "pinned" : ""}`}
      aria-label={t("Navigation", "Điều hướng")}
    >
      <div className="c-side-head">
        <Link href="/" className="c-side-brand" aria-label="Crucible">
          <span className="c-logo-mark">C</span>
          <span className="c-side-text c-side-brand-text">
            <b>Crucible</b>
            <small>{t("Life OS", "Hệ điều hành cá nhân")}</small>
          </span>
        </Link>
        <button
          type="button"
          onClick={togglePin}
          aria-pressed={pinned}
          aria-label={pinned ? t("Collapse sidebar", "Thu gọn thanh bên") : t("Keep sidebar open", "Ghim mở thanh bên")}
          className="c-side-pin"
        >
          {pinned ? <ChevronLeft size={14} strokeWidth={2.2} /> : <ChevronRight size={14} strokeWidth={2.2} />}
        </button>
      </div>

      <nav className="c-side-scroll">
        <p className="c-side-label"><span className="c-side-text">{t("Functions", "Function")}</span></p>
        {MODULES.map(({ key, href, icon: Icon, en, vi }) => {
          const label = t(en, vi);
          const badge = key === "finance" && pending > 0 ? pending : 0;
          return (
            <Link
              key={key}
              href={href}
              title={label}
              aria-label={badge ? `${label} (${badge})` : label}
              aria-current={current?.key === key ? "page" : undefined}
              className={`c-side-item ${current?.key === key ? "active" : ""}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="c-side-text">{label}</span>
              {badge > 0 && <span className="c-side-badge">{badge > 99 ? "99+" : badge}</span>}
            </Link>
          );
        })}

        {current && current.tabs.length > 0 && (
          <>
            <p className="c-side-label"><span className="c-side-text">{t(current.en, current.vi)}</span></p>
            <Suspense>
              <ModuleTabs variant="side" />
            </Suspense>
          </>
        )}
      </nav>

      <div className="c-side-foot">
        <p className="c-side-label"><span className="c-side-text">{t("System", "Hệ thống")}</span></p>
        <Link
          href="/settings"
          title={t("Settings", "Cài đặt")}
          aria-label={t("Settings", "Cài đặt")}
          className={`c-side-item ${pathname.startsWith("/settings") ? "active" : ""}`}
        >
          <Settings size={18} strokeWidth={1.8} />
          <span className="c-side-text">{t("Settings", "Cài đặt")}</span>
        </Link>
        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "vi" : "en")}
          title={t("Language", "Ngôn ngữ")}
          aria-label={t("Toggle language", "Đổi ngôn ngữ")}
          className="c-side-item"
        >
          <Languages size={18} strokeWidth={1.8} />
          <span className="c-side-text">{t("Language", "Ngôn ngữ")}</span>
          <span className="c-side-text c-side-meta">{language.toUpperCase()}</span>
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          title={t("Light / dark", "Sáng / tối")}
          aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")}
          className="c-side-item"
        >
          {theme === "dark" ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
          <span className="c-side-text">{theme === "dark" ? t("Light mode", "Giao diện sáng") : t("Dark mode", "Giao diện tối")}</span>
        </button>

        <div className="c-side-user" title={me?.email ?? undefined}>
          <span className="c-side-avatar" aria-hidden>{initial}</span>
          <span className="c-side-text c-side-user-text">
            <b>{name}</b>
            {me?.email && <small>{me.email}</small>}
          </span>
        </div>
      </div>
    </aside>
  );
}
