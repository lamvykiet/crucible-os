import { EN_COLLOCATIONS } from "./collocations/en";
import type { CollocationPack } from "./collocations/types";

export type { CollocationItem, CollocationSet, CollocationPack, CollocationKind } from "./collocations/types";
export { KIND_LABEL, checkAnswer } from "./collocations/types";

/**
 * Sổ đăng ký bộ kết hợp từ.
 *
 * Hiện mới có tiếng Anh. Bốn mảng này (kết hợp từ, cụm động từ, cấu tạo từ,
 * giới từ) là chỗ người học biết đủ từ mà viết ra vẫn không tự nhiên — và chúng
 * hoàn toàn riêng theo từng thứ tiếng, nên không có bộ dùng chung: tiếng Trung
 * thì chỗ tương đương là lượng từ đi với danh từ nào, tiếng Hàn là trợ từ nào
 * đi với động từ nào.
 */
const PACKS: Record<string, CollocationPack> = { en: EN_COLLOCATIONS };

export const collocationsFor = (code: string): CollocationPack | null => PACKS[code] ?? null;

export function findCollocationSet(code: string, setId: string) {
  const pack = collocationsFor(code);
  if (!pack) return null;
  const set = pack.sets.find((s) => s.id === setId);
  return set ? { pack, set } : null;
}
