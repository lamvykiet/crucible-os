"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

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

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "32px 40px" }}>{children}</main>
    </div>
  );
}
