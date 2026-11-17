/**
 * Cắt văn bản thành đoạn cho Đọc & dịch — bằng code, giữ nguyên từng chữ gốc.
 *
 * Đoạn quá dài (> MAX_WORDS) tách tiếp ở ranh giới câu; mảnh quá ngắn (tiêu đề
 * phụ, chú thích ảnh) bị bỏ. Tối đa MAX_PARAS đoạn — bài dài hơn thì lấy phần
 * đầu, đủ cho một buổi luyện và vừa một lượt dịch của AI.
 */

export const MAX_WORDS = 110;
export const MAX_PARAS = 14;
const MIN_WORDS = 6;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function splitParagraphs(raw: string): string[] {
  const blocks = raw
    .replace(/\r\n?/g, "\n")
    // Dòng bị ngắt giữa đoạn (dán từ PDF, email) — không kết thúc bằng dấu
    // câu — thì nối vào dòng sau; dòng kết thúc bằng dấu câu là hết đoạn.
    .replace(/([^.!?:"”’)\n])[ \t]*\n(?=[^\n])/g, "$1 ")
    .split(/\n+/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => words(b) >= MIN_WORDS);

  const out: string[] = [];
  for (const block of blocks) {
    if (words(block) <= MAX_WORDS) {
      out.push(block);
    } else {
      const sentences = block.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [block];
      let cur = "";
      for (const s of sentences) {
        if (cur && words(cur + s) > MAX_WORDS) {
          out.push(cur.trim());
          cur = "";
        }
        cur += s;
      }
      if (cur.trim()) out.push(cur.trim());
    }
    if (out.length >= MAX_PARAS) break;
  }
  return out.slice(0, MAX_PARAS);
}
