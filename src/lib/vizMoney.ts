import { compactMoney } from "@/lib/formatMoney";

/** Số lẻ theo kiểu chữ của ngôn ngữ: 14,1 (vi) · 14.1 (en). */
export const dec = (n: number, vi: boolean, digits = 1) =>
  n.toLocaleString(vi ? "vi-VN" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Số tiền viết đủ chữ trong câu: "12,4 triệu", "1,62 tỷ"; dưới một triệu thì viết cả số. */
export function wordMoney(n: number, vi: boolean): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const f = (v: number, d: number) => v.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: d });
  if (a >= 1e9) return `${sign}${f(a / 1e9, 2)} ${vi ? "tỷ" : "bn"}`;
  if (a >= 1e6) return `${sign}${f(a / 1e6, 1)} ${vi ? "triệu" : "m"}`;
  return `${sign}${a.toLocaleString(vi ? "vi-VN" : "en-US")} ₫`;
}

/** Số tiền rút gọn cho nhãn nhỏ, dấu âm là "−" (U+2212). */
export const shortMoney = (n: number, vi: boolean) => compactMoney(n, vi).replace("-", "−");

/** "17/11" từ ISO "2026-11-17". */
export const dm = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)}/${Number(m)}`;
};
