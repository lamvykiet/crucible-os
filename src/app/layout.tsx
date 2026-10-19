import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Playfair, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import MainLayoutWrapper from "@/components/MainLayoutWrapper";

// Font nạp bằng next/font chứ không phải `@import url(fonts.googleapis.com)`:
// CSS @import chặn render — trình duyệt phải tải xong stylesheet của Google rồi
// mới vẽ. next/font tự host file font và nội tuyến @font-face, bỏ được một
// round-trip sang domain khác.

// Hai giọng chữ của hệ v3 "Mật ong & Bạch đàn" (chốt 19/10/2026 — xem
// 1991-new-design/SKILL.md). Cả hai có bộ chữ tiếng Việt.
//
// Tiêu đề lớn — Bricolage Grotesque cực đậm, hẹp 85%, VIẾT HOA. Chỉ cho
// tiêu đề trang, tên trang trên thanh điện thoại và logo.
// `axes` chỉ dùng được với font biến thiên, nên không khai báo `weight`.
const display = Bricolage_Grotesque({
  subsets: ["latin", "vietnamese"],
  axes: ["wdth"],
  variable: "--font-display-src",
  display: "swap",
});

// Mọi chữ và SỐ còn lại — Playfair (bản 2.0, có trục optical size): chữ nhỏ
// tự dày nét lên, số lớn trên widget tự thanh lại.
const text = Playfair({
  subsets: ["latin", "vietnamese"],
  axes: ["opsz"],
  variable: "--font-body-src",
  display: "swap",
});

// Nhãn siêu nhỏ trong huy hiệu — Fragment Mono → JetBrains Mono. Dùng dè.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400"],
  variable: "--font-mono-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crucible OS",
  description: "Personal Second Brain & Financial OS",
};

// Next tự chèn thẻ viewport mặc định, nhưng mặc định đó KHÔNG có
// viewport-fit=cover. Thiếu nó thì env(safe-area-inset-*) luôn trả 0, và thanh
// nav dưới cùng nằm lọt dưới vạch home indicator của iPhone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#cfc9d6" },
    { media: "(prefers-color-scheme: dark)", color: "#cfc9d6" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Theme sáng là mặc định của hệ, và nó do `:root` trong globals.css áp ngay
    // lúc trình duyệt phân tích CSS — không nháy màu, không cần script khởi
    // tạo. ThemeProvider chỉ đặt data-theme khi người dùng chọn tay.
    <html
      lang="vi"
      className={`${display.variable} ${text.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            <MainLayoutWrapper>{children}</MainLayoutWrapper>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
