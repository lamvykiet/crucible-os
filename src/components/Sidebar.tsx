"use client";

import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Languages, Moon, Settings, Sun, UserRound } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { MODULES, moduleFor } from "@/lib/modules";
import ModuleTabs from "@/components/ModuleTabs";
import SidebarContextWidget from "@/components/SidebarContextWidget";

/**
 * Sidebar kính bên trái cho màn hình từ 768px (thay thanh trên `TopNav` từ
 * 13/11/2026, theo mẫu "Glassy Dashboard" chủ dự án chọn).
 *
 * Hai trạng thái:
 *   - Thu gọn (mặc định): cột icon hẹp 68px. Function đang mở là viên
 *     `--action`; function có việc chờ (hoá đơn chưa duyệt) có chấm đất đỏ.
 *   - Bung ra: rê chuột vào hoặc Tab tới (`:hover` / `:focus-within`) là bung
 *     thành panel 248px đè lên nội dung; bấm nút ‹ › ở góc để GHIM mở — lúc đó
 *     nội dung dịch sang phải nhường chỗ. Trạng thái ghim nhớ trong máy.
 *
 * Nội dung (v4 "Sương sớm", skill mục 7.1–7.2, demo pins-17-11.html):
 *   thương hiệu · danh sách function, function đang mở có CÂY TAB CON thụt
 *   vào ngay bên dưới · widget ngữ cảnh của function đang mở · hàng hệ thống
 *   (cài đặt, ngôn ngữ, sáng/tối) · thẻ người dùng.
 * Danh sách function và tab lấy từ `src/lib/modules.tsx` — cùng nguồn với
 * `MobileTopBar` của điện thoại.
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
  const [pendingKey, setPendingKey] = useState(0);
  const [me, setMe] = useState<{ displayName: string | null; email: string | null } | null>(null);

  // Số hoá đơn chờ duyệt — cùng endpoint với `PendingReviewButton`. Đếm lại
  // mỗi lần đổi trang (vừa quét xong một hoá đơn ở trang Chi tiêu chẳng hạn)
  // và sau khi hàng duyệt mở từ widget đóng lại.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/drive/pending-count", { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) setPending(j.count ?? 0);
      })
      .catch(() => {
        // Badge không phải dữ liệu quan trọng — hỏng thì ẩn, không báo lỗi.
      });
    return () => controller.abort();
  }, [pathname, pendingKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/me", { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) setMe({ displayName: j.displayName, email: j.email });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const recount = useCallback(() => setPendingKey((k) => k + 1), []);

  const togglePin = () => {
    try {
      window.localStorage.setItem(PIN_KEY, pinned ? "0" : "1");
    } catch {
      // Trình duyệt chặn lưu trữ: ghim chỉ không được nhớ, vẫn bật/tắt được.
    }
    window.dispatchEvent(new Event(PIN_EVENT));
  };

  // Thẻ người dùng: tên hiển thị → phần trước @ của email → "Tài khoản".
  // Chữ cái đầu lấy từ tên/email; không có gì thì icon người — KHÔNG dùng
  // "C" (trùng logo ở đầu sidebar, ảnh chụp 16/11).
  const displayName = me?.displayName?.trim() || null;
  const emailName = me?.email?.split("@")[0] || null;
  const name = displayName || emailName || t("Account", "Tài khoản");
  const initial = (displayName || emailName || "").charAt(0).toUpperCase();

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
        {MODULES.map(({ key, href, icon: Icon, en, vi, tabs }) => {
          const label = t(en, vi);
          const badge = key === "finance" && pending > 0 ? pending : 0;
          const isCurrent = current?.key === key;
          return (
            <div key={key} className="contents">
              <Link
                href={href}
                title={label}
                aria-label={badge ? t(`${label} (${badge} receipts to review)`, `${label} (${badge} hoá đơn chờ duyệt)`) : label}
                aria-current={isCurrent ? "page" : undefined}
                // `open`: function đang mở (nền sương, cây tab con bên dưới).
                // Function không có tab con (Tổng quan) thì chính dòng này là
                // trang đang xem — viên `--action` như tab con đang chọn.
                className={`c-side-item ${isCurrent ? (tabs.length > 0 ? "open" : "active") : ""}`}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className="c-side-text">{label}</span>
                {badge > 0 && (
                  <span className="c-side-badge" aria-hidden>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
              {isCurrent && tabs.length > 0 && (
                <Suspense>
                  <ModuleTabs variant="side" />
                </Suspense>
              )}
            </div>
          );
        })}
      </nav>

      <div className="c-side-foot">
        <SidebarContextWidget pending={pending} onReviewed={recount} />

        <div className="c-side-sys" role="group" aria-label={t("System", "Hệ thống")}>
          <Link
            href="/settings"
            title={t("Settings", "Cài đặt")}
            aria-label={t("Settings", "Cài đặt")}
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            className={`c-side-item c-sys-settings ${pathname.startsWith("/settings") ? "active" : ""}`}
          >
            <Settings size={18} strokeWidth={1.8} />
            <span className="c-side-text">{t("Settings", "Cài đặt")}</span>
          </Link>
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "vi" : "en")}
            title={t("Language", "Ngôn ngữ")}
            aria-label={t("Toggle language", "Đổi ngôn ngữ")}
            className="c-side-item c-sys-lang"
          >
            <Languages size={18} strokeWidth={1.8} />
            <span className="c-side-text c-side-meta">{language.toUpperCase()}</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? t("Light mode", "Giao diện sáng") : t("Dark mode", "Giao diện tối")}
            aria-label={t("Toggle theme", "Đổi giao diện sáng/tối")}
            className="c-side-item c-sys-theme"
          >
            {theme === "dark" ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
          </button>
        </div>

        <div className="c-side-user" title={me?.email ?? undefined}>
          <span className="c-side-avatar" aria-hidden>
            {initial || <UserRound size={18} strokeWidth={1.8} />}
          </span>
          <span className="c-side-text c-side-user-text">
            <b>{name}</b>
            {me?.email && <small>{me.email}</small>}
          </span>
        </div>
      </div>
    </aside>
  );
}
