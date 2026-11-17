"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Clock, Languages, Pin, PinOff, Play, Search, Settings } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { MODULES, moduleFor } from "@/lib/modules";
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
 * `src/lib/modules.tsx`; KHÔNG còn tab con — tab con nằm ở dải `ModuleTabs` đầu
 * nội dung) · Cài đặt · ngôn ngữ · người dùng.
 *
 * Mục Tài chính có cây trạng thái hoá đơn (mặc định đóng, mở bằng mũi tên). Chỉ
 * có dòng "Chờ duyệt N" — số lấy từ `/api/drive/pending-count` như
 * `PendingReviewButton`, bấm thì mở `ReviewQueueModal`. Demo còn "Đã ghi sổ" và
 * "Trùng lặp" nhưng chưa có API nào trả hai số đó, nên bỏ — không bịa số.
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
  const [tree, setTree] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const expanded = hover || pinned;

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
            MODULES.map(({ key, href, icon: Icon, en, vi }) => {
              const label = t(en, vi);
              const active = current?.key === key;
              if (key !== "finance") {
                return (
                  <Link
                    key={key}
                    href={href}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className={`c-side-item ${active ? "active" : ""}`}
                    onMouseEnter={showTip(label)}
                  >
                    <Icon />
                    <span className="c-side-text">{label}</span>
                  </Link>
                );
              }
              return (
                <div key={key} className={`c-grp ${tree ? "exp" : ""}`}>
                  <div className="c-navrow">
                    <Link
                      href={href}
                      aria-label={pending > 0 ? `${label} (${pending})` : label}
                      aria-current={active ? "page" : undefined}
                      className={`c-side-item ${active ? "active" : ""}`}
                      onMouseEnter={showTip(label)}
                    >
                      <Icon />
                      <span className="c-side-text">{label}</span>
                      {pending > 0 && (
                        <span className="c-side-cnt c-side-text" title={t(`${pending} receipts to review`, `${pending} hoá đơn chờ duyệt`)}>
                          {pending > 99 ? "99+" : pending}
                        </span>
                      )}
                      {pending > 0 && <span className="c-side-dot" aria-hidden />}
                    </Link>
                    <button
                      type="button"
                      className="c-tg c-side-text"
                      aria-expanded={tree}
                      aria-controls="c-fin-tree"
                      aria-label={t("Show receipt status", "Mở trạng thái hoá đơn")}
                      title={t("Receipt status", "Trạng thái hoá đơn")}
                      onClick={() => setTree((v) => !v)}
                    >
                      <Play />
                    </button>
                  </div>
                  <div className="c-tree" id="c-fin-tree" role="group" aria-label={t("Receipt status", "Trạng thái hoá đơn")}>
                    <button type="button" className="c-sub w" onClick={() => openOverlay("review")}>
                      <Clock />
                      <span>{t("Pending review", "Chờ duyệt")}</span>
                      {pending > 0 && <span className="c-side-cnt">{pending}</span>}
                    </button>
                  </div>
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
