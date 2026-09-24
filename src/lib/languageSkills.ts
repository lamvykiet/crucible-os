/**
 * Các kỹ năng của một thứ tiếng.
 *
 * Đây là *chức năng của ứng dụng*, không phải thư mục Drive. "Luyện nói" không
 * phải một chỗ chứa tài liệu — nó là một chế độ học. Tổ chức kỹ năng thành thư
 * mục sẽ buộc người dùng tạo tay bảy thư mục rỗng cho mỗi thứ tiếng, rồi vẫn
 * không có gì để bấm vào bên trong.
 *
 * Cách chia dựa trên lối học chia nhỏ theo kỹ năng, mỗi lượt ngắn và có tiến độ
 * riêng — kiểu tổ chức đã thành chuẩn ở các ứng dụng học ngôn ngữ. Nhưng nội
 * dung và cách chấm là của dự án này.
 */

import type { Script } from "@/lib/languagePresets";

export type SkillId =
  | "vocabulary"
  | "grammar"
  | "listening"
  | "reading"
  | "writing"
  | "speaking"
  | "pronunciation"
  | "writingSystem";

export interface Skill {
  id: SkillId;
  en: string;
  vi: string;
  /** Một câu nói rõ luyện cái này được gì. */
  blurbEn: string;
  blurbVi: string;
  /** Đường dẫn tới màn luyện. `null` = chưa dựng xong. */
  href: ((languageId: string) => string) | null;
  /** Chỉ hiện với hệ chữ nào. Bỏ trống = mọi thứ tiếng. */
  onlyScripts?: Script[];
  /** Có cần micro không — để báo trước thay vì bật lên mới hỏi quyền. */
  needsMic?: boolean;
}

export const SKILLS: Skill[] = [
  {
    id: "vocabulary",
    en: "Vocabulary", vi: "Từ vựng",
    blurbEn: "A 30-day course, 10 words a day, each set repeating five times.",
    blurbVi: "Giáo trình 30 ngày, mỗi ngày 10 từ, mỗi bộ lặp lại 5 vòng.",
    href: (id) => `/learning/languages/${id}/vocabulary`,
  },
  {
    id: "grammar",
    en: "Grammar", vi: "Ngữ pháp",
    blurbEn: "175 points from A1 to C1, each with its own practice set.",
    blurbVi: "175 điểm ngữ pháp từ A1 tới C1, mỗi điểm có bài luyện riêng.",
    href: () => "/learning/grammar",
  },
  {
    id: "listening",
    en: "Listening", vi: "Nghe",
    blurbEn: "A short talk played aloud, with questions. The transcript stays hidden until you answer.",
    blurbVi: "Một đoạn nói ngắn phát thành tiếng, kèm câu hỏi. Lời thoại bị giấu tới khi bạn trả lời xong.",
    href: (id) => `/learning/languages/${id}/listening`,
  },
  {
    id: "reading",
    en: "Reading", vi: "Đọc",
    blurbEn: "Short passages at your level, with questions and instant lookup.",
    blurbVi: "Bài đọc ngắn đúng tầm, kèm câu hỏi và tra từ tại chỗ.",
    href: (id) => `/learning/languages/${id}/reading`,
  },
  {
    id: "writing",
    en: "Writing", vi: "Viết",
    blurbEn: "Write to a prompt, get a band estimate and line-by-line fixes.",
    blurbVi: "Viết theo đề, nhận ước lượng band và sửa từng câu.",
    href: (id) => `/learning/languages/${id}/writing`,
  },
  {
    id: "speaking",
    en: "Speaking", vi: "Nói",
    blurbEn: "Answer out loud across all three exam parts, assessed on four criteria.",
    blurbVi: "Trả lời thành tiếng theo cả ba phần thi, chấm trên bốn tiêu chí.",
    href: (id) => `/learning/languages/${id}/speaking`,
    needsMic: true,
  },
  {
    id: "pronunciation",
    en: "Pronunciation", vi: "Phát âm",
    blurbEn: "One hard sound at a time: hear the model, say it, get told what went wrong.",
    blurbVi: "Mỗi lượt một âm khó: nghe mẫu, đọc lại, được chỉ ra sai ở đâu.",
    href: (id) => `/learning/languages/${id}/pronunciation`,
    needsMic: true,
  },
  {
    id: "writingSystem",
    en: "Writing system", vi: "Luyện viết chữ",
    // Chưa dựng. Tập viết ĐÚNG THỨ TỰ NÉT cần dữ liệu nét cho từng chữ (cỡ
    // hàng nghìn chữ Hán), tức là thêm một gói phụ thuộc — nên để `null` và nói
    // thẳng là chưa có. Trước đây mục này trỏ sang `/learning/flashcards`, mà
    // thẻ ghi nhớ không phải tập viết: bấm vào là ra một thứ khác hẳn.
    blurbEn: "Trace characters stroke by stroke.",
    blurbVi: "Tập viết từng nét của chữ.",
    href: null,
    onlyScripts: ["hanzi", "hangul"],
  },
];

/** Kỹ năng hợp với thứ tiếng này. Chữ Latin thì không có phần luyện viết chữ. */
export const skillsFor = (script: Script) =>
  SKILLS.filter((s) => !s.onlyScripts || s.onlyScripts.includes(script));

export const skillById = (id: string) => SKILLS.find((s) => s.id === id) ?? null;

/**
 * Cấp của một kỹ năng, suy từ điểm tích luỹ.
 *
 * Ngưỡng nới rộng dần: cấp đầu đạt nhanh để thấy mình đang đi, cấp sau chậm lại
 * để còn chỗ mà tiến trong nhiều tháng.
 */
export function skillLevel(xp: number) {
  const thresholds = [0, 50, 150, 350, 700, 1200, 2000, 3200, 5000];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) if (xp >= thresholds[i]) level = i + 1;

  const floor = thresholds[level - 1];
  const ceiling = thresholds[level] ?? floor;
  const span = Math.max(1, ceiling - floor);

  return {
    level,
    /** Phần trăm đã đi trong cấp hiện tại; cấp cuối luôn đầy. */
    percent: level >= thresholds.length ? 100 : Math.round(((xp - floor) / span) * 100),
    toNext: level >= thresholds.length ? 0 : ceiling - xp,
  };
}
