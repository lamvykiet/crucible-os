"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { QUICK_ACTIONS, useQuickActions, type QuickKey } from "@/components/QuickActions";

/**
 * Dock thao tác nhanh + menu "+" (demo `.dock` / `.qmenu`, quyết định 17/11/2026
 * — thay quyết định gỡ dock đáy 23/10/2026).
 *
 *   - Máy tính: dock kính giữa đáy, luôn hiện. Bấm "+" mở popover có keycap.
 *   - Điện thoại (≤ 767px): dock thu gọn (bỏ vạch ngăn và nút Hỏi), TỰ ẨN khi
 *     lướt xuống, hiện lại khi lướt lên / dừng 600ms / chạm cuối trang. Bấm "+"
 *     mở sheet từ đáy.
 *
 * Mọi hành động nối vào hộp thoại thật (`QuickActionsProvider`) hoặc điều hướng.
 *
 * PHÍM TẮT: keycap chỉ là NHÃN. ⌘N / ⌘U / ⌘H / ⌘M là phím của trình duyệt và hệ
 * điều hành (cửa sổ mới, xem nguồn, ẩn, thu nhỏ), ⌘I của Safari — gắn vào là
 * tranh phím. Thay vào đó, KHI MENU ĐANG MỞ gõ chữ cái (N, I, U, H, M) chạy hàng
 * tương ứng; không đụng phím nào của trình duyệt.
 *
 * Dock và menu không chứa modal nào, nên `transform` của chúng (ẩn/hiện) không
 * thành khối chứa của modal — modal render qua portal ở `QuickActionsProvider`.
 */
export default function QuickDock() {
  const { t } = useLanguage();
  const router = useRouter();
  const { open } = useQuickActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mx, setMx] = useState<number | null>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const run = useCallback(
    (key: QuickKey) => {
      setMenuOpen(false);
      const a = QUICK_ACTIONS.find((x) => x.key === key);
      if (a?.href) router.push(a.href);
      else if (key === "expense" || key === "income" || key === "scan") open(key);
    },
    [router, open],
  );

  const toggleMenu = useCallback(() => {
    // Căn mũi tên của popover theo tâm nút "+" (nút nằm giữa dock, dock có thể
    // lệch tâm màn hình khi bề rộng đổi).
    const r = plusRef.current?.getBoundingClientRect();
    if (r) setMx(r.left + r.width / 2);
    setMenuOpen((v) => !v);
  }, []);

  // Esc đóng; chữ cái chạy hàng tương ứng khi menu đang mở.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        plusRef.current?.focus();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const hit = QUICK_ACTIONS.find((a) => a.menu && a.letter.toLowerCase() === e.key.toLowerCase());
      if (hit) {
        e.preventDefault();
        run(hit.key);
      }
    };
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, run]);

  // Tự ẩn khi lướt xuống (chỉ ≤ 767px). Một listener scroll passive + rAF.
  useEffect(() => {
    const mm = window.matchMedia("(max-width: 767px)");
    let lastY = window.scrollY;
    let ticking = false;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!mm.matches) {
          setHidden(false);
          return;
        }
        const y = window.scrollY;
        const d = y - lastY;
        const end = window.innerHeight + y >= document.documentElement.scrollHeight - 4;
        if (end || y <= 0) setHidden(false);
        else if (d > 8) {
          setHidden(true);
          lastY = y;
        } else if (d < -8) {
          setHidden(false);
          lastY = y;
        }
        clearTimeout(idle);
        idle = setTimeout(() => setHidden(false), 600);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(idle);
    };
  }, []);

  const act = (key: QuickKey) => QUICK_ACTIONS.find((a) => a.key === key)!;
  const label = (key: QuickKey) => t(act(key).en, act(key).vi);
  const ask = t("Ask Crucible", "Hỏi Crucible");

  const dockBtn = (key: QuickKey) => {
    const a = act(key);
    const Icon = a.icon;
    return (
      <button type="button" className="c-dk" data-tip={label(key)} aria-label={label(key)} onClick={() => run(key)}>
        <Icon strokeWidth={1.75} />
      </button>
    );
  };

  return (
    <>
      <div className={`c-qscrim ${menuOpen ? "on" : ""}`} onClick={() => setMenuOpen(false)} />
      <div
        ref={menuRef}
        className={`c-qmenu ${menuOpen ? "on" : ""}`}
        role="menu"
        aria-label={t("Quick log", "Ghi nhanh")}
        aria-hidden={!menuOpen}
        style={mx === null ? undefined : ({ "--mx": `${mx}px` } as React.CSSProperties)}
      >
        <div className="c-qgrab" aria-hidden />
        <div className="c-qhead">{t("Quick log", "Ghi nhanh")}</div>
        {QUICK_ACTIONS.filter((a) => a.menu).map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.key} type="button" role="menuitem" className="c-qrow" tabIndex={menuOpen ? 0 : -1} onClick={() => run(a.key)}>
              <Icon strokeWidth={1.75} />
              <span>{t(a.en, a.vi)}</span>
              <span className="c-kcs" aria-hidden>
                <span className="c-kc">⌘</span>
                <span className="c-kc">{a.letter}</span>
              </span>
            </button>
          );
        })}
        <i className="c-qcaret" />
      </div>

      <nav className={`c-dock ${hidden && !menuOpen ? "hide" : ""} ${menuOpen ? "qopen" : ""}`} aria-label={t("Quick actions", "Thao tác nhanh")}>
        {dockBtn("expense")}
        {dockBtn("scan")}
        <button
          ref={plusRef}
          type="button"
          className={`c-dk ctr ${menuOpen ? "open" : ""}`}
          aria-label={t("Open quick log menu", "Mở menu ghi nhanh")}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <Plus strokeWidth={2} />
        </button>
        {dockBtn("habit")}
        {dockBtn("timer")}
        <span className="c-dk-sep" aria-hidden />
        <button
          type="button"
          className="c-dk only-d"
          data-tip={ask}
          aria-label={ask}
          onClick={() => document.getElementById("c-ask-input")?.focus()}
        >
          <Sparkles strokeWidth={1.75} />
        </button>
      </nav>
    </>
  );
}
