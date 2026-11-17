"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import { isTabActive, moduleFor } from "@/lib/modules";

/**
 * Dải tab con ở ĐẦU vùng nội dung (demo `.fbar`, quyết định 17/11/2026 — thay
 * nhóm tab trong sidebar và hàng tab của thanh trên điện thoại).
 *
 * Danh sách tab đọc từ `src/lib/modules.tsx` (đừng chép sang chỗ khác). Nền dải
 * là kính trắng đục, tab có icon kèm chữ, tab đang chọn là viên mực. Bên phải là
 * khe `.c-facts` cho `<PageActions>` của trang (ref được `MainLayoutWrapper` giữ).
 *
 * Điện thoại: dải cuộn ngang, chỉ tab đang chọn hiện chữ (CSS `.c-tl`).
 * Đọc `useSearchParams()` nên nơi dùng phải bọc `<Suspense>`.
 */
export default function ModuleTabs({ actionsRef }: { actionsRef?: (el: HTMLDivElement | null) => void }) {
  const pathname = usePathname();
  const tabParam = useSearchParams().get("tab");
  const { t } = useLanguage();
  const tabs = moduleFor(pathname)?.tabs ?? [];

  return (
    <div className="c-fbar">
      {tabs.length > 0 && (
        <nav className="c-ftabs" aria-label={t("Sections", "Mục con")}>
          <div className="c-ftrack">
            {tabs.map((tab, i) => {
              const Icon = tab.icon;
              const active = isTabActive(tab, pathname, tabParam, i === 0);
              const label = t(tab.en, tab.vi);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  className={`c-ftab ${active ? "on" : ""}`}
                  ref={(el) => {
                    // Tab đang chọn (vd. Lịch sử, tab thứ tám của Tài chính) có thể nằm
                    // ngoài khung cuộn: đưa nó vào giữa. Chỉnh `scrollLeft` thay vì
                    // scrollIntoView để không kéo cả trang theo chiều dọc.
                    const track = el?.parentElement;
                    if (el && active && track && track.scrollWidth > track.clientWidth) {
                      track.scrollLeft = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2;
                    }
                  }}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span className="c-tl">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <div className="c-facts" ref={actionsRef} />
    </div>
  );
}
