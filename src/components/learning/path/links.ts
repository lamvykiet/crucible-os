import type { ExtraKind, LessonKind } from "@/lib/learningPath";

/** Nhãn hai thứ tiếng cho từng loại bài / chức năng trong lộ trình. */
export const KIND_LABEL: Record<LessonKind | ExtraKind, [string, string]> = {
  grammar: ["Grammar", "Ngữ pháp"],
  typing: ["Sentence typing", "Gõ câu"],
  translate: ["Translation", "Dịch câu"],
  listening: ["Listening", "Nghe"],
  reading: ["Reading", "Đọc"],
  speaking: ["Speaking", "Nói"],
  writing: ["Writing", "Viết"],
  readTranslate: ["Read & translate", "Đọc & dịch"],
  video: ["Video", "Video"],
  mistakes: ["Mistake review", "Ôn lỗi sai"],
  vocab: ["Vocabulary", "Từ vựng"],
};

/** Một câu mô tả việc cần làm cho chức năng xoay vòng trong kế hoạch. */
export const EXTRA_NOTE: Record<ExtraKind, [string, string]> = {
  listening: ["One listening passage at your level", "Một bài nghe đúng cấp"],
  reading: ["One reading passage at your level", "Một bài đọc đúng cấp"],
  speaking: ["Answer one speaking question out loud", "Trả lời thành tiếng một câu hỏi Speaking"],
  writing: ["Write one short task", "Viết một bài ngắn"],
  readTranslate: ["Translate a paragraph of a bilingual text", "Dịch một đoạn bài song ngữ"],
  video: ["Dictation or shadowing on a video", "Chép chính tả hoặc nói nhại theo video"],
  mistakes: ["Review what you got wrong this week", "Ôn lại các câu đã sai"],
  vocab: ["Today's words in your 30-day course", "Từ của hôm nay trong giáo trình 30 ngày"],
};

export function lessonHref(languageId: string, kind: LessonKind, pointId: string) {
  if (kind === "grammar") {
    return `/learning/languages/${languageId}/grammar?point=${encodeURIComponent(pointId)}&from=path`;
  }
  return `/learning/languages/${languageId}/path/lesson?point=${encodeURIComponent(pointId)}&kind=${kind}`;
}

export function extraHref(languageId: string, kind: ExtraKind) {
  const base = `/learning/languages/${languageId}`;
  const map: Record<ExtraKind, string> = {
    listening: `${base}/listening`,
    reading: `${base}/reading`,
    speaking: `${base}/speaking`,
    writing: `${base}/writing`,
    readTranslate: `${base}/read-translate`,
    video: `${base}/video`,
    mistakes: `${base}/mistakes`,
    vocab: `${base}/vocabulary`,
  };
  return map[kind];
}
