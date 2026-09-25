import { CMN_DICTATION } from "./dictation/cmn";
import { EN_DICTATION } from "./dictation/en";
import { FR_DICTATION } from "./dictation/fr";
import { YUE_DICTATION } from "./dictation/yue";
import { KO_DICTATION } from "./dictation/ko";
import type { DictationPack } from "./dictation/types";

export type { DictationLine, DictationSet, DictationPack } from "./dictation/types";
export { compareLine } from "./dictation/types";

/**
 * Sổ đăng ký các bộ câu chép chính tả, mỗi thứ tiếng một bộ riêng.
 *
 * Giống khung ngữ pháp: không có bộ dùng chung, vì chỗ khó khi NGHE của mỗi thứ
 * tiếng khác hẳn nhau. Tiếng Trung là thanh điệu và âm uốn lưỡi; tiếng Pháp là
 * phụ âm câm và nối âm; tiếng Hàn là biến âm giữa hai âm tiết; tiếng Anh là âm
 * cuối bị nuốt và đuôi -s, -ed.
 */
const PACKS: Record<string, DictationPack> = {
  cmn: CMN_DICTATION,
  en: EN_DICTATION,
  fr: FR_DICTATION,
  yue: YUE_DICTATION,
  ko: KO_DICTATION,
};

export const dictationFor = (code: string): DictationPack | null => PACKS[code] ?? null;

/** Tra một bộ theo id, kèm gói chứa nó. */
export function findSet(code: string, setId: string) {
  const pack = dictationFor(code);
  if (!pack) return null;
  const set = pack.sets.find((s) => s.id === setId);
  return set ? { pack, set } : null;
}
