import type { Metadata, Viewport } from "next";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import MainLayoutWrapper from "@/components/MainLayoutWrapper";

// Font nạp bằng next/font chứ không phải `@import url(fonts.googleapis.com)`:
// CSS @import chặn render — trình duyệt phải tải xong stylesheet của Google rồi
// mới vẽ. next/font tự host file font và nội tuyến @font-face, bỏ được một
// round-trip sang domain khác.

// Ba giọng chữ của hệ Function. Cả ba đều có bộ ký tự tiếng Việt.
//
// Tiêu đề — Financier Display → Newsreader. Tài liệu gợi ý GT Super / Domaine
// / Tiempos, cả ba đều là font thương mại; Newsreader là serif biên tập
// tương phản cao gần nhất trên Google Fonts, và quan trọng là CÓ CHỮ NGHIÊNG —
// không có nghiêng thì mất luôn nước cờ đặc trưng nhất của hệ (roman xen
// nghiêng trong cùng một dòng tiêu đề). Chỉ nạp 300/400: serif không bao giờ
// đậm hơn trong hệ này.
const newsreader = Newsreader({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-display-src",
  display: "swap",
});

// Thân bài và giao diện — Ftbase → Inter.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
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
    { media: "(prefers-color-scheme: light)", color: "#fef9ef" },
    { media: "(prefers-color-scheme: dark)", color: "#fef9ef" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Giấy kem là mặc định của hệ, và nó do `:root` trong globals.css áp ngay
    // lúc trình duyệt phân tích CSS — không nháy màu, không cần script khởi
    // tạo. ThemeProvider chỉ đặt data-theme khi người dùng chọn tay.
    <html
      lang="vi"
      className={`${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable}`}
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
