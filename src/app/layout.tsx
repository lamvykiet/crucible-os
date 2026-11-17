import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import MainLayoutWrapper from "@/components/MainLayoutWrapper";

// Font nạp bằng next/font chứ không phải `@import url(fonts.googleapis.com)`:
// CSS @import chặn render — trình duyệt phải tải xong stylesheet của Google rồi
// mới vẽ. next/font tự host file font và nội tuyến @font-face, bỏ được một
// round-trip sang domain khác.

// Quyết định 17/11/2026 của chủ dự án (nguồn: 1991-new-design/demo/clean/demo.html):
// MỘT family cho toàn bộ chữ — Be Vietnam Pro, dấu tiếng Việt vẽ riêng chứ không
// ghép. Subset `vietnamese` chỉ chứa phần dấu; chữ Latin cơ bản nằm ở `latin`,
// nên phải khai cả hai. Không phải font biến thiên ⇒ liệt kê trọng lượng.
// 400/500/600 là đủ: theme đã hạ mọi `font-bold`/`font-black` của JSX về 600.
const sans = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-src",
  display: "swap",
});

// CHỮ SỐ mượn Inter (có tabular-nums), bản Be Vietnam Pro trên Google Fonts thì
// không. Demo dùng `@font-face "So"` với `unicode-range: U+0030-0039`: chỉ chữ số
// rơi vào Inter, chữ Việt đi kèm vẫn là Be Vietnam Pro. `next/font/google` không
// cho đặt `unicode-range`, nên file Inter (subset latin, 48 KB, OFL) nằm trong
// repo và nạp bằng `next/font/local` + `declarations` — vẫn tự host, vẫn nội tuyến.
// `--font-fig` = `var(--font-so), var(--font-sans)`: dùng cho `.num`, cột tiền, nhãn trục.
const figures = localFont({
  src: "./fonts/Inter-so.woff2",
  weight: "100 900",
  style: "normal",
  declarations: [{ prop: "unicode-range", value: "U+0030-0039" }],
  variable: "--font-so-src",
  display: "swap",
  adjustFontFallback: false,
});

// Chỉ còn dùng cho IPA, mã và bảng cú pháp (`font-mono` trong JSX). Không dùng
// cho giao diện.
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
    { media: "(prefers-color-scheme: light)", color: "#e6d6c0" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1814" },
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
      className={`${sans.variable} ${figures.variable} ${jetbrainsMono.variable}`}
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
