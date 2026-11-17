import { prisma } from "@/lib/prisma";
import { syllabusFor } from "@/lib/grammarSyllabus";
import { parseDeckSentences } from "@/lib/sentenceSources";
import {
  buildChapters, allLessons, planToday, lessonsMinutes, bandToLevel, etaDays, nextLevel, startOfTodayVN,
  weekdayVN, ROTATION, LEVEL_BAND, PATH_LEVELS, typingDoneAt, translateDoneAt, cooldownHours,
  isPathLevel, type PathLesson, type PathLevel, type ExtraKind,
} from "@/lib/learningPath";

/**
 * Đọc mọi thứ trang Lộ trình cần, từ dữ liệu THẬT:
 * - bài Ngữ pháp xong = `GrammarLesson.viewedAt`;
 * - bài Gõ câu / Dịch câu xong = số câu đã qua trong `SentenceLog` của bộ câu
 *   gắn với điểm ngữ pháp đó (`SentenceDeck.pointId`);
 * - từ đã học = các ngày đã mở của giáo trình 30 ngày cùng cấp;
 * - kiểm tra lên cấp = bảng `LevelTest`.
 * Không có bảng tiến độ riêng cho lộ trình, nên không bao giờ lệch với màn luyện.
 */

export interface LanguageLite {
  id: string;
  code: string;
  script: string;
}

export async function getPathPref(userId: string, languageId: string) {
  return prisma.learningPath.findUnique({ where: { userId_languageId: { userId, languageId } } });
}

/** Tiến độ bài theo điểm ngữ pháp của một cấp. */
async function lessonProgress(userId: string, code: string, pointIds: string[]) {
  const today = startOfTodayVN();
  const [grammar, decks] = await Promise.all([
    prisma.grammarLesson.findMany({
      where: { userId, langCode: code, pointId: { in: pointIds }, viewedAt: { not: null } },
      select: { pointId: true, viewedAt: true },
    }),
    prisma.sentenceDeck.findMany({
      where: { userId, langCode: code, pointId: { in: pointIds } },
      select: { id: true, pointId: true, sentences: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Một điểm có thể có nhiều bộ (bấm tạo lại) — lấy bộ mới nhất.
  const deckOf = new Map<string, { setId: string; total: number }>();
  for (const d of decks) {
    if (d.pointId) deckOf.set(d.pointId, { setId: `ai:${d.id}`, total: parseDeckSentences(d.sentences).length });
  }

  const setIds = [...deckOf.values()].map((d) => d.setId);
  const logs = setIds.length
    ? await prisma.sentenceLog.findMany({
        where: { userId, langCode: code, setId: { in: setIds } },
        select: { setId: true, mode: true, cleared: true, lastDoneAt: true },
      })
    : [];

  const stat = new Map<string, { cleared: number; today: boolean }>();
  for (const l of logs) {
    const k = `${l.setId}|${l.mode}`;
    const cur = stat.get(k) ?? { cleared: 0, today: false };
    if (l.cleared) cur.cleared++;
    if (l.lastDoneAt >= today) cur.today = true;
    stat.set(k, cur);
  }

  const viewed = new Map(grammar.map((g) => [g.pointId, g.viewedAt as Date]));

  const status = (l: PathLesson) => {
    if (l.kind === "grammar") {
      const at = viewed.get(l.pointId);
      return { done: Boolean(at), today: Boolean(at && at >= today), cleared: 0, total: 0 };
    }
    const deck = deckOf.get(l.pointId);
    if (!deck) return { done: false, today: false, cleared: 0, total: 0 };
    const s = stat.get(`${deck.setId}|${l.kind}`) ?? { cleared: 0, today: false };
    const need = l.kind === "typing" ? typingDoneAt(deck.total) : translateDoneAt(deck.total);
    const done = deck.total > 0 && s.cleared >= need;
    return { done, today: done && s.today, cleared: s.cleared, total: deck.total };
  };

  return status;
}

async function vocabInfo(userId: string, code: string, level: string) {
  const courses = await prisma.vocabCourse.findMany({
    where: { userId, langCode: code },
    select: {
      id: true, level: true, totalDays: true, wordsPerDay: true,
      sets: { select: { words: true, startedAt: true, lastReviewedAt: true } },
    },
  });
  const today = startOfTodayVN();
  const touchedToday = courses.some((c) =>
    c.sets.some((s) => (s.startedAt && s.startedAt >= today) || (s.lastReviewedAt && s.lastReviewedAt >= today))
  );
  const atLevel = courses
    .filter((c) => c.level === level)
    .sort((a, b) => b.sets.filter((s) => s.startedAt).length - a.sets.filter((s) => s.startedAt).length)[0];

  let learned = 0;
  if (atLevel) {
    for (const s of atLevel.sets) {
      if (!s.startedAt) continue;
      try {
        learned += (JSON.parse(s.words) as unknown[]).length;
      } catch {
        learned += atLevel.wordsPerDay;
      }
    }
  }
  return {
    hasCourse: courses.length > 0,
    touchedToday,
    learned,
    total: atLevel ? atLevel.totalDays * atLevel.wordsPerDay : null,
  };
}

async function extraDoneToday(userId: string, languageId: string, code: string, kind: ExtraKind) {
  const today = startOfTodayVN();
  const skillOf: Partial<Record<ExtraKind, string>> = {
    listening: "listening", reading: "reading", speaking: "speaking", writing: "writing",
  };
  const skill = skillOf[kind];
  if (skill) {
    const p = await prisma.skillProgress.findUnique({
      where: { userId_languageId_skill: { userId, languageId, skill } },
      select: { lastPracticedAt: true },
    });
    return Boolean(p?.lastPracticedAt && p.lastPracticedAt >= today);
  }
  if (kind === "readTranslate") {
    return (await prisma.readingText.count({ where: { userId, langCode: code, updatedAt: { gte: today } } })) > 0;
  }
  if (kind === "video") {
    return (await prisma.sentenceLog.count({
      where: { userId, langCode: code, setId: { startsWith: "video:" }, lastDoneAt: { gte: today } },
    })) > 0;
  }
  if (kind === "mistakes") {
    return (await prisma.mistakeItem.count({
      where: { userId, langCode: code, updatedAt: { gte: today }, OR: [{ rightStreak: { gt: 0 } }, { resolvedAt: { gte: today } }] },
    })) > 0;
  }
  return false;
}

async function testStatus(userId: string, languageId: string, level: string) {
  const tests = await prisma.levelTest.findMany({
    where: { userId, languageId },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: { id: true, level: true, startedAt: true, submittedAt: true, score: true, passed: true },
  });
  const open = tests.find((t) => !t.submittedAt && t.level === level && Date.now() - t.startedAt.getTime() < 45 * 60_000);
  // Đếm số lần trượt LIÊN TIẾP gần nhất (mọi cấp, như AIO).
  let fails = 0;
  for (const t of tests) {
    if (!t.submittedAt) continue;
    if (t.passed) break;
    fails++;
  }
  const lastFail = tests.find((t) => t.submittedAt && t.passed === false);
  const until = fails > 0 && lastFail?.submittedAt
    ? new Date(lastFail.submittedAt.getTime() + cooldownHours(fails) * 3600_000)
    : null;
  const last = tests.find((t) => t.submittedAt && t.level === level);
  return {
    openTestId: open?.id ?? null,
    cooldownUntil: until && until > new Date() ? until.toISOString() : null,
    lastScore: last?.score ?? null,
    lastPassed: last?.passed ?? null,
  };
}

export async function loadPathView(userId: string, lang: LanguageLite) {
  const pref = await getPathPref(userId, lang.id);
  const syllabus = syllabusFor(lang.code);
  if (!syllabus) return { available: false as const };

  const withSentences = lang.script === "latin";
  const level: PathLevel = pref && isPathLevel(pref.level) ? pref.level : "B1";
  const chapters = buildChapters(syllabus.families, level, withSentences);
  const lessons = allLessons(chapters);
  const status = await lessonProgress(userId, lang.code, [...new Set(lessons.map((l) => l.pointId))]);
  const st = new Map(lessons.map((l) => [l.key, status(l)]));

  const doneCount = lessons.filter((l) => st.get(l.key)!.done).length;
  const next = lessons.find((l) => !st.get(l.key)!.done) ?? null;
  const remainingMin = lessonsMinutes(lessons.filter((l) => !st.get(l.key)!.done));
  const perDay = pref?.minutesPerDay ?? 45;
  // Kế hoạch dành ~40% thời gian cho chức năng xoay vòng; lộ trình chạy phần còn lại.
  const pathPerDay = Math.max(10, Math.round(perDay * 0.6));

  // Ước lượng tới đích: phần còn lại của cấp này + trọn các cấp giữa chừng.
  const targetLevel = bandToLevel(pref?.targetBand ?? "6.5");
  let finalMin = remainingMin;
  const li = PATH_LEVELS.indexOf(level);
  const ti = PATH_LEVELS.indexOf(targetLevel);
  for (let i = li + 1; i <= ti; i++) {
    finalMin += lessonsMinutes(allLessons(buildChapters(syllabus.families, PATH_LEVELS[i], withSentences)));
  }

  const vocab = await vocabInfo(userId, lang.code, level);
  const rotation = ROTATION[weekdayVN()];
  const extras: { kind: ExtraKind; done: boolean }[] = [
    { kind: rotation, done: await extraDoneToday(userId, lang.id, lang.code, rotation) },
  ];
  if (vocab.hasCourse) extras.push({ kind: "vocab", done: vocab.touchedToday });

  const plan = planToday({
    lessons,
    isDone: (l) => st.get(l.key)!.done,
    doneToday: (l) => st.get(l.key)!.today,
    minutesPerDay: perDay,
    extras,
  });

  const test = await testStatus(userId, lang.id, level);
  const percent = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;

  return {
    available: true as const,
    pref: pref
      ? { level, targetBand: pref.targetBand, minutesPerDay: pref.minutesPerDay }
      : null,
    level,
    levelBand: LEVEL_BAND[level],
    nextLevel: nextLevel(level),
    targetLevel,
    chapters: chapters.map((c) => ({
      index: c.index,
      id: c.id,
      title: c.title,
      total: c.lessons.length,
      done: c.lessons.filter((l) => st.get(l.key)!.done).length,
      lessons: c.lessons.map((l) => ({ ...l, ...st.get(l.key)! })),
    })),
    stats: {
      lessonsDone: doneCount,
      lessonsTotal: lessons.length,
      wordsLearned: vocab.learned,
      wordsTotal: vocab.total,
    },
    percent,
    next,
    etaDays: etaDays(remainingMin, pathPerDay),
    finalEtaDays: etaDays(finalMin, pathPerDay),
    plan: plan.map((p) => ({ ...p, lesson: p.lesson ? { ...p.lesson, ...st.get(p.lesson.key)! } : undefined })),
    test,
  };
}

export type PathView = Awaited<ReturnType<typeof loadPathView>>;
