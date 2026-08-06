"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import MobileTopBar from "@/components/MobileTopBar";

/**
 * Khung ngoài của ứng dụng.
 *
 * Bản cũ dựng cứng một flex row: sidebar 256px + `padding: 32px 40px`, không có
 * một điểm ngắt nào. Trên điện thoại 390px, sidebar chiếm 256px và padding ăn
 * thêm 80px, chỉ còn ~54px cho nội dung — chữ vỡ từng dòng một.
 *
 * Theo design system: desktop dùng sidebar 248px bên trái, mobile dùng thanh
 * điều hướng dưới cùng 5 mục.
 */
export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    // Token tên là --color-bg, không phải --color-background (biến đó không tồn
    // tại nên nền không được áp).
    return <main className="min-h-screen w-full bg-[var(--color-bg)]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />
        {/* pb-24 chừa chỗ cho thanh nav dưới; từ md trở lên nav ẩn nên bỏ. */}
        <main className="flex-1 min-w-0 px-4 py-5 pb-24 md:px-10 md:py-8 md:pb-8">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
