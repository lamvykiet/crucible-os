import { EN_SENTENCES } from "./en";
import type { SentenceSet } from "./types";

export * from "./types";

/**
 * Bộ câu viết sẵn theo mã ngôn ngữ. Hiện mới có tiếng Anh; thứ tiếng khác vẫn
 * dùng được hai màn này qua bộ AI tạo và câu ví dụ trên thẻ.
 */
const PACKS: Record<string, SentenceSet[]> = {
  en: EN_SENTENCES,
};

export const staticSetsFor = (code: string): SentenceSet[] => PACKS[code] ?? [];

export const findStaticSet = (code: string, id: string) =>
  staticSetsFor(code).find((s) => s.id === id) ?? null;

export type SentenceMode = "typing" | "translate";
export const isSentenceMode = (v: unknown): v is SentenceMode => v === "typing" || v === "translate";
