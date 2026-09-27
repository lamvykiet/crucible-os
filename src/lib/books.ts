import { DESTINATION_B1 } from "./books/destinationB1";
import { EVU_ELEMENTARY } from "./vocabPacks/evuElementary";
import type { Book } from "./books/types";

export type { Book, BookStep, BookWord, StepKind } from "./books/types";
export { stepWordCount } from "./books/types";

/**
 * Sách trải thành đường học.
 *
 * `English Vocabulary in Use` dựng lại từ bộ từ vựng đã có, không chép dữ liệu
 * sang chỗ thứ hai — một danh sách từ nằm ở hai nơi là sớm muộn lệch nhau.
 */
const EVU_BOOK: Book = {
  id: EVU_ELEMENTARY.id,
  title: EVU_ELEMENTARY.title,
  langCode: EVU_ELEMENTARY.langCode,
  level: EVU_ELEMENTARY.level,
  note: EVU_ELEMENTARY.note,
  provenance:
    "Danh sách từ và phiên âm rút từ mục lục tra cứu cuối sách. Nghĩa, câu ví dụ và phần dạy do ứng dụng tự viết — không chép nội dung sách.",
  steps: EVU_ELEMENTARY.units.map((u, i) => ({
    step: i + 1,
    label: String(u.unit),
    kind: "vocabulary" as const,
    title: u.title,
    section: u.section,
    words: u.words.map((w) => ({ term: w.term, ipa: w.ipa })),
  })),
};

const BOOKS: Record<string, Book> = {
  [EVU_BOOK.id]: EVU_BOOK,
  [DESTINATION_B1.id]: DESTINATION_B1,
};

export const bookById = (id: string): Book | null => BOOKS[id] ?? null;
export const booksFor = (langCode: string) =>
  Object.values(BOOKS).filter((b) => b.langCode === langCode);
