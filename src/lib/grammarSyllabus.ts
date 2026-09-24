import { EN_SYLLABUS } from "./grammar/en";
import { FR_SYLLABUS } from "./grammar/fr";
import { CMN_SYLLABUS } from "./grammar/cmn";
import { YUE_SYLLABUS } from "./grammar/yue";
import { KO_SYLLABUS } from "./grammar/ko";
import type { GrammarFamily, GrammarSyllabus } from "./grammar/types";

export type { GrammarPoint, GrammarGroup, GrammarFamily, GrammarSyllabus } from "./grammar/types";

/**
 * Sổ đăng ký các khung ngữ pháp.
 *
 * Ngữ pháp KHÔNG phải một mục dùng chung: mỗi thứ tiếng có ngữ pháp của nó, và
 * một điểm quan trọng bậc nhất ở tiếng này có thể không tồn tại ở tiếng kia —
 * tiếng Hàn có hệ kính ngữ bắt buộc, tiếng Trung có lượng từ và bổ ngữ, tiếng
 * Pháp có giống và chia động từ, còn tiếng Anh không có cái nào trong số đó.
 * Nên mỗi thứ tiếng một file khung riêng, và cả thang cấp độ cũng riêng.
 *
 * Từng khung nằm trong `src/lib/grammar/`. Thêm một thứ tiếng mới thì thêm một
 * file ở đó rồi ghi vào bảng dưới đây.
 */
const SYLLABUSES: Record<string, GrammarSyllabus> = {
  en: EN_SYLLABUS,
  fr: FR_SYLLABUS,
  cmn: CMN_SYLLABUS,
  yue: YUE_SYLLABUS,
  ko: KO_SYLLABUS,
};

/** Khung của một thứ tiếng. Chưa có khung riêng thì trả `null`. */
export const syllabusFor = (code: string): GrammarSyllabus | null =>
  SYLLABUSES[code] ?? null;

/** Những thứ tiếng đã có khung, để hiện danh sách. */
export const languagesWithGrammar = () => Object.keys(SYLLABUSES);

/**
 * Thang CEFR.
 *
 * Vẫn xuất ra đây vì phần luyện đọc và luyện nghe dùng nó để chọn độ khó bài
 * tập — chỗ đó chưa phân theo thứ tiếng. Đừng nhầm nó là thang chung cho mọi
 * thứ tiếng: khung ngữ pháp lấy thang từ chính `syllabus.levels`.
 */
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";
export const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export const countPoints = (families: GrammarFamily[]) =>
  families.reduce((sum, f) => sum + f.groups.reduce((s, g) => s + g.points.length, 0), 0);

/** Đếm theo từng cấp độ, cho các chip lọc. Cấp lấy từ thang của chính khung đó. */
export function countByLevel(syllabus: GrammarSyllabus) {
  const counts: Record<string, number> = Object.fromEntries(
    syllabus.levels.map((level) => [level, 0])
  );
  for (const family of syllabus.families) {
    for (const g of family.groups) {
      for (const p of g.points) {
        // Điểm mang cấp không có trong thang là lỗi soạn khung. Đếm gộp vào
        // thay vì lặng lẽ bỏ qua, để nó lộ ra trên giao diện.
        counts[p.level] = (counts[p.level] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * Tra một điểm ngữ pháp theo id, trong khung của đúng thứ tiếng đó.
 *
 * Phải truyền mã tiếng: id điểm chỉ duy nhất trong phạm vi một khung, và hai
 * thứ tiếng hoàn toàn có thể trùng id (`negation.basic` chẳng hạn). Tra nhầm
 * khung thì bài học sinh ra sẽ nói về ngữ pháp của một thứ tiếng khác.
 */
export function findPoint(code: string, pointId: string) {
  const syllabus = syllabusFor(code);
  if (!syllabus) return null;
  for (const family of syllabus.families) {
    for (const group of family.groups) {
      const point = group.points.find((p) => p.id === pointId);
      if (point) return { syllabus, family, group, point };
    }
  }
  return null;
}
