import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
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

export const metadata: Metadata = {
  title: "Crucible OS",
  description: "Personal Second Brain & Financial OS",
};

// Next tự đặt thẻ viewport mặc định, nhưng mặc định đó không có viewport-fit=cover
// — thiếu nó thì env(safe-area-inset-*) luôn trả về 0 và bottom nav sẽ nằm dưới
// thanh home indicator của iPhone. themeColor để thanh trạng thái trình duyệt
// khớp với nền của app ở cả hai bảng màu.
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
      className={`${playfair.variable} ${jakarta.variable}`}
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
