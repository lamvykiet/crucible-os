/**
 * Lộ trình học — phần tính toán thuần (không đụng DB, có test).
 *
 * Khuôn học từ aioenglish.com/lo-trinh: mỗi cấp chia thành chương, mỗi chương
 * là chuỗi bài; nút "Học tiếp" luôn trỏ vào bài chưa xong đầu tiên; kế hoạch
 * hôm nay gom vài bài vừa số phút đặt ra. Nội dung và cách chia là của dự án:
 *
 * - Chương = một họ ngữ pháp (family) có điểm ở cấp đó.
 * - Mỗi điểm ngữ pháp = 3 bài: Ngữ pháp → Gõ câu → Dịch câu (hai bài sau dùng
 *   chung 8 câu AI soạn riêng cho điểm đó).
 * - Kế hoạch hôm nay xoay thêm một chức năng khác mỗi ngày (nghe, đọc, nói,
 *   viết, đọc & dịch, video, ôn lỗi sai) để không kỹ năng nào nằm im.
 */

import type { GrammarFamily } from "@/lib/grammar/types";

export const PATH_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type PathLevel = (typeof PATH_LEVELS)[number];
export const isPathLevel = (v: unknown): v is PathLevel => PATH_LEVELS.includes(v as PathLevel);

export type LessonKind = "grammar" | "typing" | "translate";

/** Số phút ước lượng cho mỗi loại bài — dùng cho kế hoạch và ước lượng thời gian. */
export const LESSON_MINUTES: Record<LessonKind, number> = { grammar: 6, typing: 10, translate: 8 };

/** Số câu mỗi bộ câu của một điểm ngữ pháp, và ngưỡng xong của từng bài. */
export const SENTENCES_PER_POINT = 8;
export const typingDoneAt = (total: number) => total;
export const translateDoneAt = (total: number) => Math.ceil(total * 0.75);

export interface PathLesson {
  key: string;
  kind: LessonKind;
  pointId: string;
  pointTitle: string;
  chapterIndex: number;
}

export interface PathChapter {
  index: number;
  id: string;
  title: string;
  lessons: PathLesson[];
}

export const lessonKey = (pointId: string, kind: LessonKind) => `${pointId}:${kind}`;

/**
 * Dựng chương cho một cấp. `withSentences` = thứ tiếng gõ được bằng chữ Latin
 * (Gõ câu/Dịch câu chỉ có ở đó); không thì mỗi điểm chỉ còn bài ngữ pháp.
 */
export function buildChapters(families: GrammarFamily[], level: string, withSentences: boolean): PathChapter[] {
  const chapters: PathChapter[] = [];
  for (const family of families) {
    const points = family.groups.flatMap((g) => g.points).filter((p) => p.level === level);
    if (points.length === 0) continue;
    const index = chapters.length + 1;
    const kinds: LessonKind[] = withSentences ? ["grammar", "typing", "translate"] : ["grammar"];
    chapters.push({
      index,
      id: family.id,
      title: family.title,
      lessons: points.flatMap((p) =>
        kinds.map((kind) => ({ key: lessonKey(p.id, kind), kind, pointId: p.id, pointTitle: p.title, chapterIndex: index }))
      ),
    });
  }
  return chapters;
}

export const allLessons = (chapters: PathChapter[]) => chapters.flatMap((c) => c.lessons);

export const lessonsMinutes = (lessons: PathLesson[]) =>
  lessons.reduce((sum, l) => sum + LESSON_MINUTES[l.kind], 0);

/**
 * Band IELTS mục tiêu → cấp CEFR cần học xong. Khoảng quy đổi theo `bookBand.ts`
 * (A2 ≈ 3.0–3.5, B1 ≈ 4.0–5.0, B2 ≈ 5.5–6.5, C1 ≈ 7.0+).
 */
export function bandToLevel(band: string): PathLevel {
  const b = Number(band);
  if (!Number.isFinite(b) || b < 3) return "A1";
  if (b < 4) return "A2";
  if (b < 5.5) return "B1";
  if (b < 7) return "B2";
  return "C1";
}

/** Band IELTS tương đương khi học xong một cấp — để ghi "chặng đường tới IELTS x". */
export const LEVEL_BAND: Record<PathLevel, string> = {
  A1: "2.5", A2: "3.5", B1: "5.0", B2: "6.5", C1: "7.5",
};

export const nextLevel = (level: PathLevel): PathLevel | null => {
  const i = PATH_LEVELS.indexOf(level);
  return i >= 0 && i < PATH_LEVELS.length - 1 ? PATH_LEVELS[i + 1] : null;
};

/** Số ngày ước lượng, làm tròn lên; 0 phút còn lại = 0 ngày. */
export const etaDays = (minutes: number, perDay: number) =>
  minutes <= 0 ? 0 : Math.ceil(minutes / Math.max(5, perDay));

/** "khoảng 3 tuần", "khoảng 4 tháng" — luôn có chữ khoảng, vì đây là ước lượng. */
export function etaLabel(days: number): { en: string; vi: string } {
  if (days <= 0) return { en: "done", vi: "đã xong" };
  if (days < 14) return { en: `about ${days} days`, vi: `khoảng ${days} ngày` };
  if (days < 60) {
    const w = Math.round(days / 7);
    return { en: `about ${w} weeks`, vi: `khoảng ${w} tuần` };
  }
  const m = Math.round(days / 30);
  return { en: `about ${m} months`, vi: `khoảng ${m} tháng` };
}

/* ── Kế hoạch hôm nay ─────────────────────────────────────────────────────── */

export type ExtraKind =
  | "listening" | "reading" | "speaking" | "writing" | "readTranslate" | "video" | "mistakes" | "vocab";

/**
 * Chức năng xoay vòng theo thứ trong tuần (0 = Chủ nhật). Mỗi ngày một thứ,
 * để trong một tuần chạm đủ bốn kỹ năng thi, cộng đọc & dịch, video, ôn lỗi.
 */
export const ROTATION: Record<number, ExtraKind> = {
  1: "listening", 2: "reading", 3: "speaking", 4: "writing", 5: "readTranslate", 6: "video", 0: "mistakes",
};

export const EXTRA_MINUTES: Record<ExtraKind, number> = {
  listening: 10, reading: 10, speaking: 10, writing: 15, readTranslate: 12, video: 12, mistakes: 6, vocab: 8,
};

export interface PlanItem {
  key: string;
  kind: LessonKind | ExtraKind;
  minutes: number;
  done: boolean;
  lesson?: PathLesson;
}

/**
 * Gom kế hoạch hôm nay.
 *
 * Bài lộ trình đã làm HÔM NAY vẫn nằm trong kế hoạch (có dấu ✓) để người học
 * thấy mình đã đi được bao nhiêu; sau đó nối các bài chưa xong theo thứ tự cho
 * tới khi chạm ngân sách phút. Luôn có ít nhất một bài chưa xong nếu còn bài.
 */
export function planToday(args: {
  lessons: PathLesson[];
  isDone: (l: PathLesson) => boolean;
  doneToday: (l: PathLesson) => boolean;
  minutesPerDay: number;
  extras: { kind: ExtraKind; done: boolean }[];
}): PlanItem[] {
  const extras: PlanItem[] = args.extras.map((e) => ({
    key: `extra:${e.kind}`, kind: e.kind, minutes: EXTRA_MINUTES[e.kind], done: e.done,
  }));
  let budget = args.minutesPerDay - extras.reduce((s, e) => s + e.minutes, 0);

  const items: PlanItem[] = [];
  for (const l of args.lessons) {
    if (args.doneToday(l)) {
      items.push({ key: l.key, kind: l.kind, minutes: LESSON_MINUTES[l.kind], done: true, lesson: l });
      budget -= LESSON_MINUTES[l.kind];
    }
  }
  let added = 0;
  for (const l of args.lessons) {
    if (args.isDone(l)) continue;
    const m = LESSON_MINUTES[l.kind];
    if (added > 0 && budget - m < 0) break;
    items.push({ key: l.key, kind: l.kind, minutes: m, done: false, lesson: l });
    budget -= m;
    added++;
  }
  return [...items, ...extras];
}

/** Đầu ngày theo giờ Việt Nam (UTC+7), dạng Date UTC — để so "làm hôm nay". */
export function startOfTodayVN(now = new Date()) {
  const shifted = new Date(now.getTime() + 7 * 3600 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 7 * 3600 * 1000);
}

/** Thứ trong tuần theo giờ Việt Nam (0 = Chủ nhật). */
export const weekdayVN = (now = new Date()) => new Date(now.getTime() + 7 * 3600 * 1000).getUTCDay();

/* ── Kiểm tra lên cấp ─────────────────────────────────────────────────────── */

export const TEST_SECTION_SIZE = 12;
export const TEST_PASS_TOTAL = 29;
export const TEST_PASS_SECTION = 7;
export const TEST_MINUTES = 40;

/** Thời gian chờ sau lần trượt thứ n liên tiếp: 24 giờ, 3 ngày, rồi 7 ngày. */
export function cooldownHours(consecutiveFails: number) {
  if (consecutiveFails <= 0) return 0;
  if (consecutiveFails === 1) return 24;
  if (consecutiveFails === 2) return 72;
  return 168;
}

export function gradeTest(sections: { vocab: number; grammar: number; reading: number }) {
  const total = sections.vocab + sections.grammar + sections.reading;
  const passed =
    total >= TEST_PASS_TOTAL &&
    sections.vocab >= TEST_PASS_SECTION &&
    sections.grammar >= TEST_PASS_SECTION &&
    sections.reading >= TEST_PASS_SECTION;
  return { total, passed };
}
