"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import MobileTopBar from "@/components/MobileTopBar";

export default function MainLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    // Token tên là --color-bg, không phải --color-background (biến đó không tồn
    // tại nên nền không được áp).
    return <main className="min-h-screen w-full bg-[var(--color-bg)]">{children}</main>;
  }

  // Bố cục cũ là inline style `display:flex` + `padding: 32px 40px` cố định, không
  // có breakpoint nào: trên màn 375px thì sidebar 256px nuốt gần hết bề ngang.
  // Nay mọi kích thước nằm ở lớp .c-shell-* trong globals.css, chuyển sang
  // top bar + bottom nav khi dưới 768px.
  return (
    <div className="c-shell">
      <Sidebar />
      <div className="c-shell-body">
        <MobileTopBar />
        <main className="c-shell-main">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
