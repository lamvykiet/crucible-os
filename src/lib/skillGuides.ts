import { EN_GUIDES } from "./skillGuides/en";
import { CMN_GUIDES } from "./skillGuides/cmn";
import { FR_GUIDES, YUE_GUIDES, KO_GUIDES } from "./skillGuides/others";
import type { SkillGuide } from "./skillGuides/types";
import type { SkillId } from "./languageSkills";

export type { GuideBlock, GuideSection, SkillGuide } from "./skillGuides/types";

/**
 * Sổ đăng ký bài hướng dẫn kỹ năng.
 *
 * Bấm vào một kỹ năng thì phải có bài học trước, rồi mới tới bài tập — bài tập
 * chỉ đo được mình đang ở đâu chứ không dạy cách làm.
 *
 * Chưa phải kỹ năng nào của thứ tiếng nào cũng có bài. Thiếu thì giao diện nói
 * thẳng là chưa có và cho vào thẳng phần luyện, chứ không hiện một bài rỗng.
 */
const ALL: SkillGuide[] = [...EN_GUIDES, ...CMN_GUIDES, ...FR_GUIDES, ...YUE_GUIDES, ...KO_GUIDES];

export const guideFor = (code: string, skill: SkillId): SkillGuide | null =>
  ALL.find((g) => g.code === code && g.skill === skill) ?? null;

/** Những kỹ năng của thứ tiếng này đã có bài hướng dẫn. */
export const guidedSkills = (code: string): SkillId[] =>
  ALL.filter((g) => g.code === code).map((g) => g.skill);
