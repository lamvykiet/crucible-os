import { EVU_ELEMENTARY } from "./vocabPacks/evuElementary";
import type { VocabPack } from "./vocabPacks/types";

export type { PackWord, PackUnit, VocabPack } from "./vocabPacks/types";
export { countPackWords } from "./vocabPacks/types";

/**
 * Các bộ từ vựng rút từ giáo trình có sẵn.
 *
 * Khác với giáo trình sinh bằng AI ở chỗ TRÌNH TỰ: đi theo đúng thứ tự chủ đề
 * của sách. Cùng quy tắc lặp lại — mỗi ngày một bộ mới, mỗi bộ quay lại sau 10
 * ngày, năm vòng.
 */
const PACKS: Record<string, VocabPack> = {
  [EVU_ELEMENTARY.id]: EVU_ELEMENTARY,
};

export const packById = (id: string): VocabPack | null => PACKS[id] ?? null;

export const packsFor = (langCode: string) =>
  Object.values(PACKS).filter((p) => p.langCode === langCode);

/**
 * Trải bộ thành từng nhóm `perDay` từ, giữ NGUYÊN thứ tự bài trong sách.
 *
 * Không trộn ngẫu nhiên: học "The family" trọn một mạch rồi mới sang "Parts of
 * the body" thì các từ đỡ lẫn nhau, vì chúng cùng một trường nghĩa. Trộn lên là
 * mất đúng cái lợi của việc đi theo giáo trình.
 *
 * Từ xuất hiện ở nhiều bài chỉ lấy lần đầu — học lại cùng một từ ở ngày khác là
 * phí một ô trong mười ô của ngày đó.
 */
export function splitIntoDays(pack: VocabPack, perDay: number) {
  const seen = new Set<string>();
  const flat: { term: string; ipa: string; unit: number; unitTitle: string }[] = [];

  for (const unit of pack.units) {
    for (const word of unit.words) {
      const key = word.term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push({ term: word.term, ipa: word.ipa, unit: unit.unit, unitTitle: unit.title });
    }
  }

  const days: (typeof flat)[] = [];
  for (let i = 0; i < flat.length; i += perDay) days.push(flat.slice(i, i + perDay));
  return days;
}
