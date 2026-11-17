"use client";

import { createContext, useContext } from "react";
import { createPortal } from "react-dom";

/**
 * Hai khe "portal" của vỏ giao diện (`MainLayoutWrapper`).
 *
 * `MainLayoutWrapper` dựng phần đầu trang NGOÀI `<main>`, nên trang không thể tự
 * đặt nội dung vào đó bằng JSX thường. Hai khe:
 *
 *   - `<SceneHero>`   — phần tóm tắt dưới dải tab (tên function, câu kết luận,
 *                       widget). Trang không dùng thì khe rỗng và ẩn hẳn.
 *   - `<PageActions>` — nút hành động của trang, nằm BÊN PHẢI dải tab con
 *                       (`.c-facts`): thường là một nút chính (`c-btn-primary`) và
 *                       một nút phụ (`c-btn-secondary`).
 *
 * Nội dung trong khe vẫn thuộc cây React của trang (state, context, modal đều
 * bình thường) — chỉ vị trí DOM khác.
 */
const SceneSlotContext = createContext<HTMLElement | null>(null);
const ActionsSlotContext = createContext<HTMLElement | null>(null);

export const SceneSlotProvider = SceneSlotContext.Provider;
export const ActionsSlotProvider = ActionsSlotContext.Provider;

export function SceneHero({ children }: { children: React.ReactNode }) {
  const slot = useContext(SceneSlotContext);
  return slot ? createPortal(children, slot) : null;
}

export function PageActions({ children }: { children: React.ReactNode }) {
  const slot = useContext(ActionsSlotContext);
  return slot ? createPortal(children, slot) : null;
}
