import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import MainLayoutWrapper from "@/components/MainLayoutWrapper";

// Font nạp bằng next/font chứ không phải `@import url(fonts.googleapis.com)`:
// CSS @import chặn render — trình duyệt phải tải xong stylesheet của Google rồi
// mới vẽ. next/font tự host file font và nội tuyến @font-face, bỏ được một
// round-trip sang domain khác.

// Ba giọng chữ của hệ AuthKit. Cả ba đều là bản thay thế mà tài liệu gợi ý
// cho chữ riêng của họ, và cả ba đều có bộ ký tự tiếng Việt.
//
// Tiêu đề — aeonikPro → Space Grotesk. Chỉ dùng 400/500: chữ display của hệ
// có uy lực nhờ cỡ lớn ở trọng lượng 500, không nhờ đậm.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-display-src",
  display: "swap",
});

// Thân bài và giao diện — Untitled Sans → Inter.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-body-src",
  display: "swap",
});

// Nhãn mắt viết hoa giãn chữ — dotDigital → JetBrains Mono.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
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
    { media: "(prefers-color-scheme: light)", color: "#05060f" },
    { media: "(prefers-color-scheme: dark)", color: "#05060f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Nền tối là mặc định của hệ, và nó do `:root` trong globals.css áp ngay
    // lúc trình duyệt phân tích CSS — không nháy màu, không cần script khởi
    // tạo. ThemeProvider chỉ đặt data-theme khi người dùng chọn tay.
    <html
      lang="vi"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
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
