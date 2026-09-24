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
