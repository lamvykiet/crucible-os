"use client";

import type { ReactNode } from "react";
import { SceneHero } from "@/components/Scene";

/**
 * Đầu trang của hệ Kính (demo `.hello`): nhãn ngày/kỳ nhỏ, tiêu đề lớn, một câu
 * KẾT LUẬN tính từ số liệu (chỗ cần nhấn thì bọc `<b>`), và khe `aside` bên phải
 * (ví dụ chọn tháng). Không widget, không tên function lặp lại — tên nằm ở một
 * chỗ duy nhất là `title`.
 *
 * Vẽ vào khe `<SceneHero>` của `MainLayoutWrapper` (dưới dải tab).
 */
export default function PageIntro({
  title,
  kicker,
  lede,
  aside,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <SceneHero>
      <div className="c-intro">
        <div className="c-hello">
          {kicker && <p className="c-kicker">{kicker}</p>}
          <h1 className="c-display">{title}</h1>
          {lede && <p className="c-hello-title">{lede}</p>}
        </div>
        {aside && <div className="c-intro-aside">{aside}</div>}
      </div>
    </SceneHero>
  );
}
