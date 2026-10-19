"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import MobileNav from "@/components/MobileNav";
import MobileTopBar from "@/components/MobileTopBar";
import { SceneSlotProvider } from "@/components/Scene";

/**
 * Khung ngoài của ứng dụng — hai tầng của hệ v3:
 *
 *   1. Thanh kính (`TopNav` từ 768px, `MobileTopBar` dưới 768px) dính đỉnh.
 *      Nó đứng TRƯỚC phông cảnh với margin-bottom âm, nên phông nằm phía sau
 *      nó lúc đầu trang mà thanh vẫn dính được qua cả trang khi cuộn.
 *   2. Phông cảnh `.c-scene` — trang đặt tiêu đề + widget kính vào bằng
 *      `<SceneHero>` (src/components/Scene.tsx).
 *   3. Tấm nền kem `.c-main` trườn lên 80px che đáy phông; mọi nội dung chi
 *      tiết nằm ở đây.
 *
 * Không có sidebar. Điện thoại có dock kính `MobileNav` năm mục ở đáy.
 *
 * Đệm, bề rộng khung và nhịp dọc của `<main>` do `.c-main` trong globals.css
 * quy định, không đặt bằng utility ở đây — để mọi trang có cùng một nhịp.
 */
export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  if (pathname === "/login") {
    return <main className="min-h-screen w-full bg-[var(--color-bg)]">{children}</main>;
  }

  return (
    <SceneSlotProvider value={slot}>
      <div className="c-shell">
        <TopNav />
        <MobileTopBar />
        <div className="c-scene">
          <span className="c-scene-sun" aria-hidden />
          <div className="c-scene-inner" ref={setSlot} />
        </div>
        <main className="c-main">{children}</main>
        <MobileNav />
      </div>
    </SceneSlotProvider>
  );
}
