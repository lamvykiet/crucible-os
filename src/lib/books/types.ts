/**
 * Một cuốn sách được trải thành ĐƯỜNG HỌC.
 *
 * Mỗi bước trên đường là một unit. Khác danh sách phẳng ở chỗ nó cho thấy mình
 * đang ở đâu trong cả cuốn: đã qua bao nhiêu, còn bao nhiêu, và bài ôn nằm chỗ
 * nào — thứ mà một danh sách cuộn dọc không nói ra được.
 *
 * Về nguồn: cấu trúc sách (có bao nhiêu unit, tên unit, thứ tự) và danh sách từ
 * đều là DỮ KIỆN. Lời giải thích, câu ví dụ và bài tập của sách thì có bản
 * quyền — không chép. Phần dạy trong ứng dụng tự viết hoặc sinh ra lúc học.
 */

export type StepKind = "grammar" | "vocabulary" | "review";

export interface BookWord {
  term: string;
  ipa: string;
}

export interface BookStep {
  /** Vị trí trên đường, đếm từ 1 và liên tục. */
  step: number;
  /** Số hiệu in trong sách: "12" cho unit, "R4" cho bài ôn. */
  label: string;
  kind: StepKind;
  title: string;
  /** Phần lớn trong sách, dùng làm mốc dọc đường. */
  section?: string;
  /** Có từ thì hiện luôn trong unit; chưa có thì bước vẫn đứng trên đường. */
  words?: BookWord[];
}

export interface Book {
  id: string;
  title: string;
  langCode: string;
  level: string;
  note: string;
  /** Ghi rõ phần nào lấy từ sách, phần nào ứng dụng tự viết. */
  provenance: string;
  steps: BookStep[];
}

export const stepWordCount = (book: Book) =>
  book.steps.reduce((n, s) => n + (s.words?.length ?? 0), 0);
