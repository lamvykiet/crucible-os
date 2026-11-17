"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Languages, Pin, PinOff, Search, Settings } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { MODULES, isTabActive, moduleFor } from "@/lib/modules";
import { useMe } from "@/lib/useMe";
import { useQuickActions } from "@/components/QuickActions";
import Logo from "@/components/Logo";

/**
 * Sidebar nổi bên trái, từ 768px (demo `.sidewrap`, quyết định 17/11/2026).
 *
 * Rail 64px bo tròn, cách mép 24px, chỉ cao bằng nội dung. Rê chuột nhanh qua
 * icon → tooltip tên mục; DỪNG ~300ms → bung 248px ĐÈ lên nội dung (không đẩy);
 * nút ghim giữ mở (lúc đó nội dung dịch sang phải, trạng thái nhớ trong máy).
 *
 * Nội dung: thương hiệu + ghim · ô tìm trang · các function (từ
 * `src/lib/modules.tsx`) · Cài đặt · ngôn ngữ · người dùng.
 *
 * Tab con là CÂY ngay dưới function (chủ dự án 17/11/2026; dải tab ngang ở đầu
 * nội dung đã ẩn trên máy tính, xem `SHOW_TOP_TABS` ở `ModuleTabs`). Danh sách
 * đọc từ `tabs` của `modules.tsx`, URL và cách tính tab đang chọn y hệt
 * `ModuleTabs` (`tab.href` + `isTabActive`). Function đang mở tự bung; mỗi lúc
 * chỉ bung MỘT; bấm lại function đang bung thì thu cây, bấm lúc đang thu thì bung
 * lại. Rail thu gọn không hiện cây (CSS `.c-grp.exp .c-tree`).
 *
 * Số hoá đơn chờ duyệt (`/api/drive/pending-count`, như `PendingReviewButton`) là
 * badge trên hàng Tài chính; bấm badge mở `ReviewQueueModal`. Không còn dòng cây
 * "Chờ duyệt" — "Đã ghi sổ"/"Trùng lặp" chưa có API trả số nên không bịa.
 *
 * Kính ở `::before` (không làm khối chứa cho `position: fixed`).
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

// So khớp không dấu: gõ "tai chinh" ra "Tài chính".
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { open: openOverlay, pending } = useQuickActions();
  const me = useMe();
  const pinned = useSyncExternalStore(subscribePinned, readPinned, () => false);
  const current = moduleFor(pathname);

  const [hover, setHover] = useState(false);
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  // Người dùng bấm thu/bung cây của function `from`; sang function khác thì hết hiệu lực
  // và cây tự bung theo function đang mở.
  const [folded, setFold] = useState<{ from: string; open: boolean } | null>(null);
  const tabParam = useSearchParams().get("tab");
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const expanded = hover || pinned;
  const treeKey = current && current.tabs.length > 0 && !(folded?.from === current.key && !folded.open) ? current.key : null;

  const togglePin = () => {
    try {
      window.localStorage.setItem(PIN_KEY, pinned ? "0" : "1");
    } catch {
      // Trình duyệt chặn lưu trữ: ghim chỉ không được nhớ, vẫn bật/tắt được.
    }
    window.dispatchEvent(new Event(PIN_EVENT));
  };

  const onEnter = () => {
    clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => {
      setHover(true);
      setTip(null);
    }, 300);
  };
  const onLeave = () => {
    clearTimeout(openTimer.current);
    setTip(null);
    closeTimer.current = setTimeout(() => setHover(false), 150);
  };
  const showTip = (label: string) => (e: React.MouseEvent<HTMLElement>) => {
    if (expanded) return;
    const wrap = wrapRef.current?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    if (wrap) setTip({ label, top: r.top - wrap.top + r.height / 2 });
  };

  // Tìm trang: chức năng + tab con, so khớp không dấu.
  const q = fold(query.trim());
  const results = q
    ? MODULES.flatMap((m) => [
        { href: m.href, icon: m.icon, label: t(m.en, m.vi), sub: "" },
        ...m.tabs.map((tab) => ({ href: tab.href, icon: tab.icon, label: t(tab.en, tab.vi), sub: t(m.en, m.vi) })),
      ]).filter((r) => fold(r.label).includes(q) || fold(r.sub).includes(q))
    : [];
  const go = (href: string) => {
    setQuery("");
    router.push(href);
  };

  const name = me?.displayName?.trim() || "Crucible";

  return (
    <div className="c-sidewrap hidden md:block" ref={wrapRef}>
      <aside
        className={`c-side ${hover ? "open" : ""} ${pinned ? "pinned" : ""}`}
        aria-label={t("Navigation", "Điều hướng")}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div className="c-side-head">
          <Link href="/" className="c-side-brand" aria-label="Crucible">
            <Logo />
            <span className="c-side-text">Crucible</span>
          </Link>
          <button
            type="button"
            onClick={togglePin}
            aria-pressed={pinned}
            aria-label={pinned ? t("Unpin sidebar", "Bỏ ghim thanh bên") : t("Pin sidebar", "Ghim thanh bên")}
            title={pinned ? t("Unpin sidebar", "Bỏ ghim thanh bên") : t("Pin sidebar", "Ghim thanh bên")}
            className="c-side-pin c-side-text"
          >
            {pinned ? <PinOff /> : <Pin />}
          </button>
        </div>

        <label className="c-side-search">
          <Search />
          <input
            className="c-side-text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) go(results[0].href);
              if (e.key === "Escape") setQuery("");
            }}
            placeholder={t("Find a page…", "Tìm trang…")}
            aria-label={t("Find a page", "Tìm trang")}
          />
        </label>

        <nav className="c-side-scroll">
          {q ? (
            results.length > 0 ? (
              results.map((r) => (
                <button key={r.href} type="button" className="c-side-item" onClick={() => go(r.href)}>
                  <r.icon />
                  <span className="c-side-text">
                    {r.label}
                    {r.sub && <span className="c-side-cnt"> · {r.sub}</span>}
                  </span>
                </button>
              ))
            ) : (
              <p className="c-side-text px-3 py-2 text-[13px] text-[var(--glass-muted)]">{t("No page matches", "Không có trang khớp")}</p>
            )
          ) : (
            MODULES.map(({ key, href, icon: Icon, en, vi, tabs }) => {
              const label = t(en, vi);
              const active = current?.key === key;
              const hasTree = tabs.length > 0;
              const exp = treeKey === key;
              const badge = key === "finance" ? pending : 0;
              const onRow = (e: React.MouseEvent) => {
                if (!hasTree) return;
                if (!active) {
                  setFold(null); // sang function khác: điều hướng + tự bung
                  return;
                }
                // Đang ở function này: bấm chỉ thu/bung cây, không tải lại trang (khỏi mất ?tab=).
                e.preventDefault();
                setFold({ from: key, open: !exp });
              };
              return (
                <div key={key} className={`c-grp ${exp ? "exp" : ""}`}>
                  <div className="c-navrow">
                    <Link
                      href={href}
                      aria-label={badge > 0 ? `${label} (${badge})` : label}
                      aria-current={active ? "page" : undefined}
                      aria-expanded={hasTree ? exp : undefined}
                      aria-controls={hasTree ? `c-tree-${key}` : undefined}
                      className={`c-side-item ${active ? "active" : ""} ${badge > 0 ? "has-badge" : ""}`}
                      onMouseEnter={showTip(label)}
                      onClick={onRow}
                    >
                      <Icon />
                      <span className="c-side-text">{label}</span>
                      {badge > 0 && <span className="c-side-dot" aria-hidden />}
                    </Link>
                    {badge > 0 && (
                      <button
                        type="button"
                        className="c-pendbtn c-side-text"
                        title={t(`${badge} receipts to review — open`, `${badge} hoá đơn chờ duyệt — mở`)}
                        aria-label={t(`${badge} receipts to review`, `${badge} hoá đơn chờ duyệt`)}
                        onClick={() => openOverlay("review")}
                      >
                        {badge > 99 ? "99+" : badge}
                      </button>
                    )}
                  </div>
                  {hasTree && (
                    <div className="c-tree" id={`c-tree-${key}`} role="group" aria-label={label}>
                      {tabs.map((tab, i) => {
                        const TabIcon = tab.icon;
                        const on = isTabActive(tab, pathname, tabParam, i === 0);
                        const tl = t(tab.en, tab.vi);
                        return (
                          <Link
                            key={tab.href}
                            href={tab.href}
                            scroll={false}
                            aria-current={on ? "page" : undefined}
                            className={`c-sub ${on ? "on" : ""}`}
                          >
                            <TabIcon />
                            <span>{tl}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <div className="c-side-sep" />
        <Link
          href="/settings"
          aria-label={t("Settings", "Cài đặt")}
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={`c-side-item ${pathname.startsWith("/settings") ? "active" : ""}`}
          onMouseEnter={showTip(t("Settings", "Cài đặt"))}
        >
          <Settings />
          <span className="c-side-text">{t("Settings", "Cài đặt")}</span>
        </Link>
        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "vi" : "en")}
          aria-label={t("Toggle language", "Đổi ngôn ngữ")}
          className="c-side-item"
          onMouseEnter={showTip(t("Language", "Ngôn ngữ"))}
        >
          <Languages />
          <span className="c-side-text">{t("Language", "Ngôn ngữ")}</span>
          <span className="c-side-cnt c-side-text">{language.toUpperCase()}</span>
        </button>

        <div className="c-side-foot" title={me?.email ?? undefined}>
          <span className="c-side-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>
          <span className="c-side-text">
            <b>{name}</b>
            <small>{me?.email ?? t("Personal account", "Tài khoản cá nhân")}</small>
          </span>
        </div>
      </aside>
      <div className={`c-side-tip ${tip ? "on" : ""}`} style={{ top: tip?.top ?? 0 }} aria-hidden>
        {tip?.label}
      </div>
    </div>
  );
}
