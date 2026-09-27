/**
 * Thang trình độ cho phần soạn bài của sách.
 *
 * Nói với AI "trình độ B1" là chưa đủ. Cùng một câu lệnh đó, model trả về câu
 * ví dụ dài hai mươi từ có `notwithstanding` rồi vẫn gắn nhãn B1 — vì "B1" với
 * nó là một cái tên, không phải một bộ ràng buộc. Nên mỗi cấp ở đây được mô tả
 * bằng những thứ ĐẾM ĐƯỢC: câu dài bao nhiêu từ, dùng được những thì nào, từ
 * nằm trong khoảng tần suất nào, chủ đề tới đâu.
 *
 * Cột `ielts` để người học quy chiếu, vì phần lớn người dùng nghĩ theo band
 * IELTS chứ không theo CEFR. Đó là khoảng quy đổi thông dụng, không phải bảng
 * đối chiếu chính thức của bên nào.
 *
 * Thang không phải CEFR (HSK, TOPIK) quy về cấp CEFR gần nhất rồi dùng chung mô
 * tả: ràng buộc ở đây là về ĐỘ PHỨC TẠP của câu, thứ không phụ thuộc kỳ thi.
 */

export interface Band {
  /** Khoảng band IELTS tương đương, để người học quy chiếu. */
  ielts: string;
  /** Độ dài câu ví dụ, tính bằng từ. */
  words: string;
  /** Vốn từ được phép dùng. */
  lexis: string;
  /** Cấu trúc được phép dùng. */
  grammar: string;
  /** Chủ đề và bối cảnh. */
  topics: string;
  /** Thứ KHÔNG được xuất hiện ở cấp này. */
  avoid: string;
}

const BANDS: Record<string, Band> = {
  A1: {
    ielts: "dưới 3.0",
    words: "5–8 từ",
    lexis: "600 từ thông dụng nhất, toàn từ cụ thể",
    grammar: "hiện tại đơn, hiện tại tiếp diễn, can, there is/are",
    topics: "bản thân, gia đình, nhà cửa, đồ ăn, số và giờ",
    avoid: "thì hoàn thành, câu điều kiện, mệnh đề quan hệ, cụm động từ, thể bị động",
  },
  A2: {
    ielts: "3.0–3.5",
    words: "6–11 từ",
    lexis: "1500 từ thông dụng nhất",
    grammar: "quá khứ đơn, tương lai với will và going to, so sánh, must/should",
    topics: "công việc thường ngày, mua sắm, đi lại, thời tiết, kể lại việc đã xảy ra",
    avoid: "quá khứ hoàn thành, câu điều kiện loại 3, đảo ngữ, mệnh đề rút gọn",
  },
  B1: {
    ielts: "4.0–5.0",
    words: "8–14 từ",
    lexis:
      "3000 từ thông dụng nhất, cộng cụm động từ và thành ngữ hay gặp trong hội thoại hằng ngày",
    grammar:
      "cả bốn nhóm thì cơ bản ở hiện tại và quá khứ, hiện tại hoàn thành, điều kiện loại 1 và 2, " +
      "bị động đơn giản, mệnh đề quan hệ, câu tường thuật, động từ nguyên thể và V-ing",
    topics:
      "trải nghiệm bản thân, kế hoạch, ý kiến ngắn, việc học và việc làm, du lịch, sức khoẻ, tin tức đơn giản",
    avoid:
      "đảo ngữ, mệnh đề nhượng bộ trang trọng, thức giả định, từ vựng học thuật, câu dài nhiều tầng phụ thuộc",
  },
  B2: {
    ielts: "5.5–6.5",
    words: "10–18 từ",
    lexis: "5000 từ, cộng cụm từ cố định và từ đánh giá sắc thái",
    grammar:
      "mọi thì, quá khứ hoàn thành tiếp diễn, điều kiện đảo, bị động đầy đủ, mệnh đề rút gọn, " +
      "wish và if only, cấu trúc nhấn mạnh",
    topics: "tranh luận, giả định, so sánh phương án, văn hoá, môi trường, công nghệ, xã hội",
    avoid: "từ chuyên ngành hẹp, lối viết luật hay khoa học, từ cổ",
  },
  C1: {
    ielts: "7.0–8.0",
    words: "12–24 từ",
    lexis: "8000 từ, cộng sắc thái và tính phù hợp văn phong",
    grammar: "đảo ngữ, thức giả định, mệnh đề phân từ, cấu trúc phức nhiều tầng",
    topics: "học thuật, chuyên môn, lập luận trừu tượng, bình luận sắc thái",
    avoid: "câu tối nghĩa vì cố tỏ ra phức tạp",
  },
  C2: {
    ielts: "8.5–9.0",
    words: "không giới hạn, nhưng phải gọn",
    lexis: "không giới hạn, kể cả cách dùng theo vùng và theo văn phong",
    grammar: "không giới hạn",
    topics: "mọi chủ đề, kể cả hài hước, ẩn ý, ám chỉ văn hoá",
    avoid: "lối viết rối rắm không cần thiết",
  },
};

/** Thang không phải CEFR quy về cấp CEFR gần nhất. */
const ALIASES: Record<string, string> = {
  // Giáo trình hay ghi cấp bằng tên bản in thay vì bằng cấp CEFR.
  elementary: "A2",
  "pre-intermediate": "A2",
  intermediate: "B1",
  "upper-intermediate": "B2",
  advanced: "C1",
  // HSK 1–6 và TOPIK 1–6.
  hsk1: "A1", hsk2: "A2", hsk3: "B1", hsk4: "B2", hsk5: "C1", hsk6: "C2",
  topik1: "A1", topik2: "A2", topik3: "B1", topik4: "B2", topik5: "C1", topik6: "C2",
};

/** Cấp CEFR của một nhãn trình độ bất kỳ. Không nhận ra thì coi là B1. */
export function cefrOf(level: string): keyof typeof BANDS {
  const raw = level.trim();
  const upper = raw.toUpperCase();
  if (upper in BANDS) return upper as keyof typeof BANDS;

  const key = raw.toLowerCase().replace(/[\s_]+/g, "-").replace(/-(\d)/, "$1");
  const mapped = ALIASES[key];
  if (mapped) return mapped as keyof typeof BANDS;

  // "B1+", "Level B2", "B2 First"… — bắt cấp CEFR nằm lẫn trong chuỗi.
  const found = upper.match(/\b([ABC][12])\b/);
  if (found && found[1] in BANDS) return found[1] as keyof typeof BANDS;

  return "B1";
}

export const bandOf = (level: string): Band => BANDS[cefrOf(level)];

/**
 * Đoạn ràng buộc trình độ để chèn vào câu lệnh cho AI.
 *
 * Viết thành mệnh lệnh đếm được, và nói rõ cả thứ PHẢI TRÁNH — cấm cụ thể ăn
 * hơn nhắc chung chung, vì model có sẵn xu hướng viết câu "đẹp" quá tầm người
 * học rồi vẫn tin là mình đang viết đúng cấp.
 */
export function bandBrief(level: string): string {
  const cefr = cefrOf(level);
  const b = BANDS[cefr];
  return `RÀNG BUỘC TRÌNH ĐỘ — cấp ${cefr} theo CEFR (tương đương IELTS ${b.ielts}). Mọi câu ví dụ và câu hỏi phải nằm trong khuôn này:
- Độ dài câu: ${b.words}. Câu dài hơn phải cắt ra.
- Vốn từ: ${b.lexis}. Ngoài khoảng đó thì đổi từ khác, đừng giữ lại rồi giải thích thêm.
- Cấu trúc được dùng: ${b.grammar}.
- Bối cảnh: ${b.topics}.
- KHÔNG dùng: ${b.avoid}.
Ngoại lệ duy nhất: chính điểm ngữ pháp mà unit này dạy thì được dùng, dù nó cao hơn cấp trên.
Tự soát lại trước khi trả: câu nào vượt khuôn thì viết lại, đừng trả ra rồi ghi chú là khó.`;
}
