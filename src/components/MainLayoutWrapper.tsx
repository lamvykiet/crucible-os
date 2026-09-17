"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import MobileNav from "@/components/MobileNav";
import MobileTopBar from "@/components/MobileTopBar";

/**
 * Khung ngoài của ứng dụng.
 *
 * Xếp DỌC: thanh điều hướng trên cùng, rồi nội dung. Bản cũ xếp ngang với
 * sidebar 248px bên trái — design system hiện tại không có sidebar, toàn bộ
 * điều hướng nằm trên thanh trên (xem `TopNav`).
 *
 * Trên điện thoại: `MobileTopBar` ở trên (chủ đề / ngôn ngữ / cài đặt) và
 * `MobileNav` năm mục ở dưới.
 *
 * Đệm, bề rộng khung và nhịp dọc của `<main>` do `.c-main` trong globals.css
 * quy định, không đặt bằng utility ở đây — để mọi trang có cùng một nhịp.
 */
export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <main className="min-h-screen w-full bg-[var(--color-bg)]">{children}</main>;
  }

  return (
    <div className="c-shell">
      <TopNav />
      <MobileTopBar />
      <main className="c-main">{children}</main>
      <MobileNav />
    </div>
  );
}
