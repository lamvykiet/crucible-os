import { EN_NOTES } from "./enNotes";
import type { GrammarNote } from "./types";

/**
 * Sổ đăng ký ghi chú soạn tay, tách khỏi khung để giao diện import được mà
 * không kéo theo cả năm khung ngữ pháp vào bundle của trình duyệt.
 *
 * Ghi chú hiện ngay khi mở bài, không chờ AI — nên vẫn đọc được khi Gemini hết
 * hạn mức. Thứ tiếng nào chưa có thì đơn giản là không có ghi chú.
 */
const NOTES: Record<string, Record<string, GrammarNote>> = {
  en: EN_NOTES,
};

export const grammarNote = (code: string, pointId: string): GrammarNote | null =>
  NOTES[code]?.[pointId] ?? null;

/** Gói ghi chú thành vài dòng cho lời nhắc AI, để bài sinh ra không nói ngược với nó. */
export function noteForPrompt(note: GrammarNote | null): string {
  if (!note) return "";
  const lines: string[] = [];
  if (note.rules?.length) {
    lines.push("Quy tắc đã chốt (bài phải khớp, không được nói ngược):");
    lines.push(...note.rules.map((r) => `- ${r}`));
  }
  if (note.mistakes?.length) {
    lines.push("Lỗi người học hay mắc ở điểm này:");
    lines.push(...note.mistakes.map((m) => `- Sai: ${m.wrong} → Đúng: ${m.right} (${m.why})`));
  }
  return lines.join("\n");
}
