/**
 * Kết hợp từ, cụm động từ, cấu tạo từ và giới từ.
 *
 * Bốn thứ này là chỗ người học biết đủ từ mà viết ra vẫn không tự nhiên: không
 * ai nói *do a mistake* hay *strong rain*, nhưng không có quy tắc nào suy ra
 * được — chỉ có học từng cụm.
 *
 * Soạn tay, không sinh bằng AI. Đây là dữ kiện về tiếng Anh (người bản ngữ nói
 * thế nào), và dữ kiện thì phải ổn định; sinh mới mỗi lần mở là mỗi lần một
 * đáp án khác. Nó cũng chạy được khi hết hạn mức AI.
 *
 * Về nguồn: bản thân việc "make a mistake chứ không phải do a mistake" là sự
 * thật về tiếng Anh, không ai sở hữu. Câu ví dụ và lời giải thích dưới đây do
 * dự án tự viết, không chép từ sách nào.
 */

export type CollocationKind =
  | "collocation"
  | "phrasal"
  | "wordform"
  | "preposition"
  | "idiom"
  | "topic"
  | "academic";

export interface CollocationItem {
  /** Câu có chỗ trống, đánh dấu bằng ___ */
  sentence: string;
  /** Đáp án đúng. */
  answer: string;
  /** Đáp án khác cũng chấp nhận được. */
  alt?: string[];
  /** Vì sao là từ đó, giải thích bằng tiếng Việt. */
  note: string;
}

export interface CollocationSet {
  /** Định danh bền. Đừng đổi: tiến độ khoá theo id này. */
  id: string;
  title: string;
  kind: CollocationKind;
  level: string;
  note: string;
  items: CollocationItem[];
}

export interface CollocationPack {
  code: string;
  scale: string;
  levels: string[];
  sets: CollocationSet[];
  references?: string[];
}

export const KIND_LABEL: Record<CollocationKind, { en: string; vi: string }> = {
  collocation: { en: "Collocations", vi: "Kết hợp từ" },
  phrasal: { en: "Phrasal verbs", vi: "Cụm động từ" },
  wordform: { en: "Word formation", vi: "Cấu tạo từ" },
  preposition: { en: "Prepositions", vi: "Giới từ đi kèm" },
  idiom: { en: "Idioms", vi: "Thành ngữ" },
  topic: { en: "Topic vocabulary", vi: "Từ vựng theo chủ đề" },
  academic: { en: "Academic vocabulary", vi: "Từ vựng học thuật" },
};

/** So đáp án: bỏ hoa thường và khoảng trắng thừa, giữ nguyên chữ. */
export function checkAnswer(input: string, item: CollocationItem) {
  const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const mine = clean(input);
  const accepted = [item.answer, ...(item.alt ?? [])].map(clean);
  return { correct: accepted.includes(mine), answer: item.answer };
}
