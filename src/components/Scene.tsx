"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Phông cảnh hoàng hôn đầu trang (hệ v3 — xem `1991-new-design/SKILL.md`).
 *
 * `MainLayoutWrapper` dựng phông cảnh NGOÀI `<main>` (tấm nền kem trườn lên
 * che đáy phông), nên trang không thể tự đặt nội dung vào đó bằng JSX thường.
 * Trang nào muốn có tiêu đề + widget kính trên phông thì bọc chúng trong
 * `<SceneHero>` — nó portal vào khe `.c-scene-inner`. Trang không dùng thì
 * phông chỉ còn một dải mỏng sau thanh điều hướng.
 *
 * Nội dung trong `<SceneHero>` vẫn thuộc cây React của trang (state, context,
 * modal đều bình thường) — chỉ vị trí DOM là nằm trên phông.
 */
const SceneSlotContext = createContext<HTMLElement | null>(null);

export const SceneSlotProvider = SceneSlotContext.Provider;

export function SceneHero({ children }: { children: React.ReactNode }) {
  const slot = useContext(SceneSlotContext);
  return slot ? createPortal(children, slot) : null;
}

const subscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  window.addEventListener("resize", cb);
  return () => {
    window.removeEventListener("scroll", cb);
    window.removeEventListener("resize", cb);
  };
};

/**
 * Tấm nền kem đã cuộn lên tới thanh điều hướng chưa. Thanh kính 30% đẹp trên
 * phông cảnh nhưng trên nền kem thì chữ trắng chìm — CSS đậm kính lên khi
 * `data-scrolled="true"`.
 */
export function useSheetUnderNav(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const sheet = document.querySelector(".c-main");
      return sheet ? sheet.getBoundingClientRect().top < 76 : false;
    },
    () => false,
  );
}
