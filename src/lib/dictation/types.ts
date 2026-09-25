/**
 * Bộ câu dùng cho nghe chép chính tả và nói nhại.
 *
 * Vì sao soạn tay chứ không sinh bằng AI: câu để chép chính tả phải ĐỨNG YÊN.
 * Người học nghe đi nghe lại một câu nhiều lần qua nhiều ngày, và tiến độ được
 * ghi theo vị trí câu trong bộ — câu đổi mỗi lần mở là tiến độ thành vô nghĩa.
 * Thêm nữa, hạn mức AI của dự án tính theo ngày, mà chép chính tả là thứ người
 * ta làm hàng chục câu một buổi.
 *
 * Chép chính tả khác hẳn phần luyện nghe đã có. Luyện nghe hiện tại hỏi "bài
 * này nói về gì" — nghe sót vài chữ vẫn trả lời đúng. Chép chính tả bắt viết
 * lại TỪNG CHỮ, nên nó lộ ra đúng những âm mình vẫn nghe nhầm bấy lâu.
 */

export interface DictationLine {
  /** Câu viết theo chính tả chuẩn của thứ tiếng đó. */
  text: string;
  /** Phiên âm theo hệ của thứ tiếng: pinyin, jyutping, IPA, romaja. */
  phonetic: string;
  /** Nghĩa tiếng Việt. Chỉ hiện sau khi đã chấm. */
  meaning: string;
}

export interface DictationSet {
  /** Định danh bền. Đừng đổi sau khi phát hành: tiến độ lưu theo id này. */
  id: string;
  title: string;
  /** Cấp theo thang của chính thứ tiếng đó (HSK, CEFR, TOPIK...). */
  level: string;
  /** Một câu nói rõ bộ này luyện cái gì. */
  note: string;
  lines: DictationLine[];
}

export interface DictationPack {
  code: string;
  /** Tên thang cấp độ, để hiện cạnh chip lọc. */
  scale: string;
  levels: string[];
  /**
   * Người học gõ lại bằng gì.
   *
   * `script` là gõ đúng chữ viết (chữ Hán, Hangul). `phonetic` là gõ phiên âm
   * (pinyin, jyutping, romaja) — cần cho người chưa gõ được chữ, và cho máy
   * chưa cài bộ gõ. Chấp nhận CẢ HAI là đúng, vì mục tiêu của bài là nghe ra
   * được câu, không phải thi gõ bàn phím.
   */
  accepts: ("script" | "phonetic")[];
  sets: DictationSet[];
}

/**
 * So câu gõ với câu đúng, trả về tỷ lệ khớp và chỗ sai.
 *
 * Bỏ dấu câu và khoảng trắng trước khi so: gõ thiếu dấu phẩy không phải nghe
 * sai. Nhưng dấu thanh thì giữ — "mā" khác "mà", và đó chính là thứ đang luyện.
 *
 * Với chữ Hán thì mỗi chữ là một đơn vị; với chữ Latin thì tách theo từ. So
 * từng chữ Hán một thì mới chỉ ra được đúng chữ nào nghe hụt.
 */
export function compareLine(input: string, expected: string) {
  const strip = (s: string) =>
    s
      .normalize("NFC")
      .replace(/[.,!?;:"'。，！？；：、""''《》…—\-()（）]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const hasHan = /[㐀-鿿]/.test(expected);
  const split = (s: string) =>
    hasHan ? Array.from(strip(s).replace(/\s/g, "")) : strip(s).toLowerCase().split(" ").filter(Boolean);

  const want = split(expected);
  const got = split(input);

  // So theo vị trí, và đánh dấu phần thiếu hoặc thừa ở cuối. Đủ để chỉ ra chỗ
  // sai mà không cần thuật toán khoảng cách sửa đổi — câu chép chính tả ngắn,
  // và sai lệch thường là thay chữ chứ không phải chèn thêm.
  const marks = want.map((unit, i) => ({
    unit,
    typed: got[i] ?? "",
    correct: (got[i] ?? "") === unit,
  }));

  const correct = marks.filter((m) => m.correct).length;
  const extra = Math.max(0, got.length - want.length);

  return {
    marks,
    correct,
    total: want.length,
    extra,
    accuracy: want.length === 0 ? 0 : Math.round((correct / want.length) * 100),
    perfect: correct === want.length && extra === 0,
  };
}
