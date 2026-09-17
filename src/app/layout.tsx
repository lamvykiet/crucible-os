import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import MainLayoutWrapper from "@/components/MainLayoutWrapper";

// Font nạp bằng next/font chứ không phải `@import url(fonts.googleapis.com)`:
// CSS @import chặn render — trình duyệt phải tải xong stylesheet của Google rồi
// mới vẽ. next/font tự host file font và nội tuyến @font-face, bỏ được một
// round-trip sang domain khác.

// Chữ tiêu đề. Mở trục `wdth` để kéo rộng ra (xem --display-width trong
// globals.css): bề ngang lớn hơn mặc định chính là thứ tạo ra cảm giác
// "wide-set, architectural" của hệ. Đóng trục này lại là chữ lớn mất tính cách.
const archivo = Archivo({
  subsets: ["latin", "vietnamese"],
  axes: ["wdth"],
  variable: "--font-display-src",
  display: "swap",
});

// Chữ thân bài và giao diện. Font biến thiên nên đặt thẳng được trọng lượng
// 480 — nấc giữa regular và semibold, và là chữ ký của hệ.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-body-src",
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
    { media: "(prefers-color-scheme: light)", color: "#171721" },
    { media: "(prefers-color-scheme: dark)", color: "#171721" },
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
      className={`${archivo.variable} ${inter.variable}`}
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
