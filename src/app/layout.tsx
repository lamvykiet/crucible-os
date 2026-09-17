import type { Metadata, Viewport } from "next";
import {
  Playfair_Display,
  Plus_Jakarta_Sans,
  Cormorant_Garamond,
  Inter,
  Roboto_Mono,
} from "next/font/google";
import "./globals.css";
import "./origin-skin.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";

// Trước đây font được nạp bằng `@import url(fonts.googleapis.com)` ở dòng đầu
// globals.css. CSS @import chặn render: trình duyệt phải tải xong stylesheet
// của Google rồi mới vẽ. next/font tự host file font và nội tuyến khai báo
// @font-face, nên bỏ được một round-trip tới domain khác.
const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  variable: "--font-display-src",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
});

// Ba giọng chữ của lớp da thử nghiệm "Origin" (xem src/app/origin-skin.css).
// Chỉ có tác dụng khi <html data-skin="origin">; ngoài ra chúng chỉ nằm im.
// Cormorant Garamond thay cho Lyon Display: đây là serif duy nhất trên Google
// Fonts vừa có trọng lượng 300 vừa có bộ ký tự tiếng Việt. Bản thay thế mà
// tài liệu Origin gợi ý (DM Serif Display) không có dấu tiếng Việt.
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400"],
  variable: "--font-origin-display-src",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-origin-body-src",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-origin-mono-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crucible OS",
  description: "Personal Second Brain & Financial OS",
};

// Next tự chèn thẻ viewport mặc định, nhưng mặc định đó KHÔNG có viewport-fit=cover.
// Thiếu nó thì env(safe-area-inset-*) luôn trả 0, và thanh nav dưới cùng nằm lọt
// dưới vạch home indicator của iPhone.
// themeColor để thanh trạng thái trình duyệt khớp nền app ở cả hai bảng màu.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F0E4" },
    { media: "(prefers-color-scheme: dark)", color: "#291C0E" },
  ],
};

import MainLayoutWrapper from "@/components/MainLayoutWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Không đặt cứng data-theme ở đây nữa. Bản cũ ghi thẳng data-theme="dark",
    // nên toàn bộ token màu chạy ở bảng tối trong khi các component lại viết
    // cứng nền trắng và chữ xám đậm — chính là nguyên nhân giao diện nhìn vỡ.
    // THEME_INIT_SCRIPT sẽ đặt thuộc tính này trước khi trình duyệt vẽ.
    <html
      lang="vi"
      className={`${playfair.variable} ${jakarta.variable} ${cormorant.variable} ${inter.variable} ${robotoMono.variable}`}
      suppressHydrationWarning
    >
      {/* Không cần script khởi tạo theme: chế độ tối mặc định do
          @media (prefers-color-scheme: dark) trong globals.css lo, nên không
          bao giờ nháy màu. ThemeProvider chỉ đặt data-theme khi người dùng
          bấm nút chọn tay. */}
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
