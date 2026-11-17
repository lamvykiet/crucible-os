"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import ModuleTabs from "@/components/ModuleTabs";
import QuickDock from "@/components/QuickDock";
import { QuickActionsProvider, useQuickActions } from "@/components/QuickActions";
import { ActionsSlotProvider, SceneSlotProvider } from "@/components/Scene";

/**
 * Khung ngoài của ứng dụng — hệ Kính (quyết định 17/11/2026, nguồn:
 * `1991-new-design/demo/clean/demo.html`). MỘT lớp: không phông cảnh, không tấm
 * nền kem; mọi thứ nằm thẳng trên nền gradient ấm cố định (`.c-shell::before`).
 *
 *   máy tính  : `Sidebar` nổi bên trái (rail 64px, rê chuột bung đè lên) ·
 *               `TopBar` (ngữ cảnh · hỏi · sáng/tối · chuông) · dải tab con
 *   điện thoại: `MobileTopBar` dính đỉnh · dải tab con cuộn ngang
 *   cả hai    : `.c-scene` (phần tóm tắt, trang tự đặt qua `<SceneHero>`) ·
 *               `<main class="c-main">` · `QuickDock` thao tác nhanh ở đáy
 *
 * Đệm, bề rộng khung và nhịp dọc do `.c-top/.c-fbar/.c-scene/.c-main` trong
 * globals.css quy định, không đặt bằng utility ở đây — để mọi trang cùng nhịp.
 * Không có `z-index` trên `.c-main` (xem globals.css).
 *
 * `<main key={version}>`: sau khi dock/hàng đợi ghi xong một giao dịch, trang
 * đang mở được dựng lại để tải số liệu mới.
 */
export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // `/video-share` là form mở từ nút Chia sẻ của TikTok, hiện trong khung web
  // nhỏ của Shortcut — không có chỗ, cũng không có phiên đăng nhập, cho thanh
  // điều hướng.
  if (pathname === "/login" || pathname === "/video-share") {
    return <main className="c-bg min-h-screen w-full">{children}</main>;
  }

  return (
    <QuickActionsProvider>
      <Shell>{children}</Shell>
    </QuickActionsProvider>
  );
}

// Dock thao tác nhanh chỉ hiện ở Tổng quan và Tài chính (quyết định của chủ
// dự án 17/11/2026): các nút của nó — thêm khoản chi, quét hoá đơn — là việc
// của hai chỗ đó; ở Học tập, Sức khoẻ… nó chỉ che nội dung.
const DOCK_PATHS = ["/", "/finance"];
const showsDock = (path: string) =>
  DOCK_PATHS.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`)));

function Shell({ children }: { children: React.ReactNode }) {
  const { version } = useQuickActions();
  const pathname = usePathname();
  const dock = showsDock(pathname);
  const [scene, setScene] = useState<HTMLDivElement | null>(null);
  const [actions, setActions] = useState<HTMLDivElement | null>(null);

  return (
    <ActionsSlotProvider value={actions}>
      <SceneSlotProvider value={scene}>
        <div className={dock ? "c-shell" : "c-shell no-dock"}>
          <Sidebar />
          <MobileTopBar />
          <TopBar />
          <Suspense>
            <ModuleTabs actionsRef={setActions} />
          </Suspense>
          <div className="c-scene">
            <div className="c-scene-inner" ref={setScene} />
          </div>
          <main className="c-main" key={version}>
            {children}
          </main>
          {dock && <QuickDock />}
        </div>
      </SceneSlotProvider>
    </ActionsSlotProvider>
  );
}
