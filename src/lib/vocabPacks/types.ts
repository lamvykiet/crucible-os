/**
 * Bộ từ vựng rút từ một giáo trình có sẵn.
 *
 * Vì sao chỉ lưu DANH SÁCH TỪ chứ không lưu nghĩa: từ vựng và phiên âm là dữ
 * kiện về ngôn ngữ, không ai sở hữu. Nhưng lời giải thích, câu ví dụ và bài tập
 * của một cuốn sách thì có bản quyền — nên nghĩa và ví dụ ở đây sinh ra ở phía
 * ứng dụng, không chép từ sách.
 *
 * Cái bộ này mang lại là TRÌNH TỰ: học theo đúng thứ tự chủ đề mà giáo trình đã
 * sắp, thay vì để AI bốc từ ngẫu nhiên theo cấp độ.
 */

export interface PackWord {
  term: string;
  /** Phiên âm theo hệ của thứ tiếng đó. */
  ipa: string;
}

export interface PackUnit {
  unit: number;
  /** Phần lớn trong sách, ví dụ "People", "At home". */
  section: string;
  title: string;
  words: PackWord[];
}

export interface VocabPack {
  /** Định danh bền, cũng là cờ phân loại gắn vào từ trong ngân hàng. */
  id: string;
  /** Tên hiển thị, đặt theo tên tài liệu gốc. */
  title: string;
  langCode: string;
  level: string;
  note: string;
  units: PackUnit[];
}

/** Đếm số từ (không trùng) của cả bộ. */
export const countPackWords = (pack: VocabPack) =>
  new Set(pack.units.flatMap((u) => u.words.map((w) => w.term.toLowerCase()))).size;
