/**
 * Định dạng bài thi IELTS Academic.
 *
 * Phạm vi và giới hạn, nói rõ một lần ở đây:
 *
 *  - Cấu trúc bài thi (số phần, số câu, thời lượng, các dạng câu hỏi, thang
 *    band 0–9, tên bốn tiêu chí chấm viết) là THÔNG TIN CÔNG KHAI về cách kỳ
 *    thi vận hành. Dự án bám sát phần này để luyện tập cho sát thực tế.
 *
 *  - Đề thi thật và bảng mô tả band chính thức thuộc bản quyền của các tổ chức
 *    sở hữu kỳ thi. Dự án KHÔNG chép chúng. Đề ở đây do AI sinh mới, và mô tả
 *    tiêu chí bên dưới là cách diễn đạt của chính dự án này.
 *
 *  - Band do AI chấm là ƯỚC LƯỢNG để tự luyện, không phải điểm giám khảo. Giao
 *    diện phải nói rõ điều đó ở mọi chỗ hiện band.
 */

export interface ExamSection {
  id: "listening" | "reading" | "writing" | "speaking";
  en: string;
  vi: string;
  minutes: number;
  /** Số câu hỏi; phần Viết và Nói tính theo số bài nên để null. */
  questions: number | null;
  noteEn: string;
  noteVi: string;
}

/** Bốn phần, theo đúng thứ tự và thời lượng của bài thi thật. */
export const EXAM_SECTIONS: ExamSection[] = [
  {
    id: "listening",
    en: "Listening", vi: "Nghe",
    minutes: 30,
    questions: 40,
    noteEn: "Four recorded parts, played once, from a short dialogue to an academic talk.",
    noteVi: "Bốn phần ghi âm, chỉ phát một lần, từ hội thoại ngắn tới bài nói học thuật.",
  },
  {
    id: "reading",
    en: "Reading", vi: "Đọc",
    minutes: 60,
    questions: 40,
    noteEn: "Three passages that get harder, with no extra time to copy answers.",
    noteVi: "Ba bài đọc khó dần, và không có thêm thời gian để chép đáp án.",
  },
  {
    id: "writing",
    en: "Writing", vi: "Viết",
    minutes: 60,
    questions: null,
    noteEn: "Task 1 describes data in 150+ words; Task 2 argues a case in 250+ words.",
    noteVi: "Task 1 tả số liệu, tối thiểu 150 từ; Task 2 lập luận một vấn đề, tối thiểu 250 từ.",
  },
  {
    id: "speaking",
    en: "Speaking", vi: "Nói",
    minutes: 14,
    questions: null,
    noteEn: "Three parts: familiar questions, a long turn from a card, then a discussion.",
    noteVi: "Ba phần: hỏi đáp quen thuộc, nói dài theo thẻ đề, rồi thảo luận sâu hơn.",
  },
];

export interface WritingTaskSpec {
  id: "task1" | "task2";
  en: string;
  vi: string;
  minMinutes: number;
  minWords: number;
  /** Task 2 nặng gấp đôi Task 1 khi tính band phần Viết. */
  weight: number;
  briefEn: string;
  briefVi: string;
}

export const WRITING_TASKS: WritingTaskSpec[] = [
  {
    id: "task1",
    en: "Task 1 — Describe data", vi: "Task 1 — Mô tả số liệu",
    minMinutes: 20,
    minWords: 150,
    weight: 1,
    briefEn: "Summarise a chart, table, diagram or process. Report the facts, do not give opinions.",
    briefVi: "Tóm tắt một biểu đồ, bảng, sơ đồ hoặc quy trình. Thuật lại dữ kiện, không nêu ý kiến.",
  },
  {
    id: "task2",
    en: "Task 2 — Build an argument", vi: "Task 2 — Lập luận",
    minMinutes: 40,
    minWords: 250,
    weight: 2,
    briefEn: "Answer the question asked, take a clear position, and support it with reasons and examples.",
    briefVi: "Trả lời đúng câu hỏi được đặt ra, nêu rõ lập trường, và chống đỡ bằng lý lẽ và ví dụ.",
  },
];

/**
 * Bốn tiêu chí chấm phần Viết.
 *
 * Tên tiêu chí là thuật ngữ chính thức của kỳ thi — đó là dữ kiện. Phần mô tả
 * bên dưới do dự án tự viết, không phải bảng mô tả band chính thức.
 */
export const WRITING_CRITERIA = [
  {
    key: "taskResponse" as const,
    en: "Task response", vi: "Đáp ứng yêu cầu đề",
    whatEn: "Whether you actually answered the question asked, covered every part of it, and developed your ideas rather than just listing them.",
    whatVi: "Bạn có trả lời đúng câu hỏi được đặt ra không, có chạm hết mọi vế của đề không, và ý có được triển khai hay chỉ mới liệt kê.",
  },
  {
    key: "coherence" as const,
    en: "Coherence and cohesion", vi: "Mạch lạc và liên kết",
    whatEn: "Whether a reader can follow your line of thought: paragraphs that each do one job, and links that show how sentences relate.",
    whatVi: "Người đọc có bám theo được mạch suy nghĩ của bạn không: mỗi đoạn làm đúng một việc, và các câu nối với nhau rõ quan hệ.",
  },
  {
    key: "lexis" as const,
    en: "Lexical resource", vi: "Vốn từ",
    whatEn: "How wide and how accurate your word choice is, including collocation and spelling.",
    whatVi: "Vốn từ rộng tới đâu và dùng có chính xác không, gồm cả kết hợp từ và chính tả.",
  },
  {
    key: "grammar" as const,
    en: "Grammatical range and accuracy", vi: "Ngữ pháp",
    whatEn: "How varied your sentence structures are, and how often errors get in the way of meaning.",
    whatVi: "Câu cú có đa dạng không, và lỗi có thường xuyên cản trở việc hiểu không.",
  },
];

export type CriterionKey = (typeof WRITING_CRITERIA)[number]["key"];

/**
 * Làm tròn về nửa điểm gần nhất.
 *
 * Band của kỳ thi chỉ nhận số nguyên hoặc .5 — trả 6.3 là con số không tồn tại
 * trong thang điểm, và làm người học tưởng độ chính xác cao hơn thực tế.
 */
export const roundBand = (value: number) =>
  Math.max(0, Math.min(9, Math.round(value * 2) / 2));

/** Band phần Viết: trung bình bốn tiêu chí, Task 2 nặng gấp đôi Task 1. */
export function overallWritingBand(
  task1: number | null,
  task2: number | null
): number | null {
  if (task1 === null && task2 === null) return null;
  if (task1 === null) return roundBand(task2!);
  if (task2 === null) return roundBand(task1);
  return roundBand((task1 * 1 + task2 * 2) / 3);
}

/* ── Phần Nói ───────────────────────────────────────────────────────────── */

export interface SpeakingPartSpec {
  id: "part1" | "part2" | "part3";
  en: string;
  vi: string;
  /** Thời lượng nói của thí sinh, tính bằng giây. */
  seconds: number;
  /** Thời gian chuẩn bị trước khi nói. Chỉ Part 2 có. */
  prepSeconds: number;
  briefEn: string;
  briefVi: string;
}

/**
 * Ba phần của bài thi nói, kèm thời lượng.
 *
 * Part 2 là phần duy nhất có một phút chuẩn bị và buộc nói liền một mạch — đó
 * là chỗ khác biệt thật giữa ba phần, không phải độ khó câu hỏi. Nên đồng hồ
 * chuẩn bị chỉ chạy ở Part 2.
 */
export const SPEAKING_PARTS: SpeakingPartSpec[] = [
  {
    id: "part1",
    en: "Part 1 — Familiar topics", vi: "Part 1 — Chủ đề quen thuộc",
    seconds: 90,
    prepSeconds: 0,
    briefEn: "Short answers about yourself: where you live, what you do, what you like. Answer and add one reason — do not stop at yes or no.",
    briefVi: "Trả lời ngắn về chính bạn: ở đâu, làm gì, thích gì. Trả lời rồi thêm một lý do — đừng dừng ở có hoặc không.",
  },
  {
    id: "part2",
    en: "Part 2 — Long turn", vi: "Part 2 — Nói dài",
    seconds: 120,
    prepSeconds: 60,
    briefEn: "One minute to prepare, then speak for up to two minutes without stopping. Cover every bullet on the card.",
    briefVi: "Một phút chuẩn bị, rồi nói liền tối đa hai phút. Chạm hết mọi gạch đầu dòng trên thẻ đề.",
  },
  {
    id: "part3",
    en: "Part 3 — Discussion", vi: "Part 3 — Thảo luận",
    seconds: 150,
    prepSeconds: 0,
    briefEn: "Abstract questions growing out of Part 2. Give an opinion, then justify it and weigh the other side.",
    briefVi: "Câu hỏi trừu tượng nối từ Part 2. Nêu quan điểm, rồi chống đỡ nó và cân nhắc phía ngược lại.",
  },
];

/**
 * Bốn tiêu chí chấm phần Nói.
 *
 * Như phần Viết: tên tiêu chí là thuật ngữ công khai của kỳ thi, còn phần mô tả
 * bên dưới do dự án tự viết.
 *
 * Lưu ý về `pronunciation`: chấm phát âm từ bản gỡ băng là **không đáng tin** —
 * bản gỡ băng chỉ còn chữ, âm đã mất. Nên khi chấm bằng bản gỡ băng thì tiêu
 * chí này phải bỏ trống chứ không được đoán. Xem `src/app/api/learning/speaking`.
 */
export const SPEAKING_CRITERIA = [
  {
    key: "fluency" as const,
    en: "Fluency and coherence", vi: "Độ lưu loát và mạch lạc",
    whatEn: "Whether you keep going at a natural pace, and whether one idea leads into the next instead of restarting.",
    whatVi: "Bạn có giữ được nhịp nói tự nhiên không, và ý trước có dẫn sang ý sau hay cứ bắt đầu lại.",
  },
  {
    key: "lexis" as const,
    en: "Lexical resource", vi: "Vốn từ",
    whatEn: "How precisely you pick words for what you mean, and whether you can go around a word you do not know.",
    whatVi: "Bạn chọn từ có sát ý không, và khi bí một từ có nói vòng qua được không.",
  },
  {
    key: "grammar" as const,
    en: "Grammatical range and accuracy", vi: "Ngữ pháp",
    whatEn: "How varied your structures are when speaking, and whether slips get in the way of being understood.",
    whatVi: "Câu cú khi nói có đa dạng không, và lỗi có cản người nghe hiểu không.",
  },
  {
    key: "pronunciation" as const,
    en: "Pronunciation", vi: "Phát âm",
    whatEn: "How easy you are to follow: individual sounds, word stress, and the rise and fall across a sentence.",
    whatVi: "Người nghe có theo được dễ không: từng âm, trọng âm từ, và nhịp lên xuống của cả câu.",
  },
];

export type SpeakingCriterionKey = (typeof SPEAKING_CRITERIA)[number]["key"];

export const speakingPart = (id: string) =>
  SPEAKING_PARTS.find((p) => p.id === id) ?? SPEAKING_PARTS[0];

/**
 * Band phần Nói: trung bình các tiêu chí CHẤM ĐƯỢC.
 *
 * Bỏ qua tiêu chí `null` thay vì coi nó là 0 — chấm bằng bản gỡ băng thì phát
 * âm bỏ trống, và tính nó thành 0 sẽ kéo band tụt xuống một cách vô căn cứ.
 */
export function overallSpeakingBand(
  scores: Partial<Record<SpeakingCriterionKey, number | null>>
): number | null {
  const given = SPEAKING_CRITERIA.map((c) => scores[c.key]).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (given.length === 0) return null;
  return roundBand(given.reduce((a, b) => a + b, 0) / given.length);
}

/* ── Quy đổi điểm thô và band tổng ──────────────────────────────────────── */

/**
 * Điểm thô (trên 40) → band, XẤP XỈ.
 *
 * Đây KHÔNG phải bảng quy đổi chính thức của kỳ thi — bảng đó là tài liệu riêng
 * của họ, và nó còn xê dịch theo từng đề. Bảng dưới đây là ước lượng của dự án,
 * dựng theo mức độ khó tương đối vẫn được nói tới rộng rãi: phần Đọc nhích chặt
 * hơn phần Nghe ở quãng giữa.
 *
 * Dùng nó để biết mình đang ở quãng nào, đừng dùng để đoán chính xác band thi
 * thật. Giao diện phải nói rõ điều đó.
 */
const LISTENING_BANDS: [number, number][] = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6],
  [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0],
];

const READING_BANDS: [number, number][] = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
  [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0],
];

export function rawToBand(raw: number, section: "listening" | "reading"): number {
  const table = section === "reading" ? READING_BANDS : LISTENING_BANDS;
  const score = Math.max(0, Math.min(40, Math.round(raw)));
  return table.find(([floor]) => score >= floor)?.[1] ?? 0;
}

/**
 * Band tổng: trung bình bốn phần, làm tròn theo luật của kỳ thi.
 *
 * Luật làm tròn là quy tắc công bố công khai, không phải bảng quy đổi: phần lẻ
 * từ .25 đến dưới .75 lên nửa điểm, từ .75 trở lên lên nguyên điểm kế tiếp, dưới
 * .25 thì bỏ. Nên 6.125 thành 6.0, còn 6.25 thành 6.5.
 *
 * Thiếu phần nào thì trả null — trung bình ba phần không phải band tổng, và đưa
 * ra một con số nghe như band tổng trong khi chưa thi đủ là nói dối người học.
 */
export function overallExamBand(parts: {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
}): number | null {
  const all = [parts.listening, parts.reading, parts.writing, parts.speaking];
  if (all.some((band) => band === null || !Number.isFinite(band))) return null;

  const mean = (all as number[]).reduce((a, b) => a + b, 0) / 4;
  const whole = Math.floor(mean);
  const rest = mean - whole;

  if (rest < 0.25) return whole;
  if (rest < 0.75) return whole + 0.5;
  return whole + 1;
}
