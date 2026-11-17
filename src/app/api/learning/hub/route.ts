import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { staticSetsFor } from "@/lib/sentences";
import { syllabusFor, countPoints } from "@/lib/grammarSyllabus";
import { buildChapters, allLessons, isPathLevel } from "@/lib/learningPath";

export const dynamic = "force-dynamic";

/**
 * Số liệu THẬT cho hàng "Hôm nay học gì?" của một thứ tiếng — mỗi thẻ chức
 * năng hiện một con số đếm từ DB hoặc từ kho viết sẵn, không có số trang trí.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const languageId = new URL(req.url).searchParams.get("languageId") ?? "";
    const lang = await prisma.language.findFirst({
      where: { id: languageId, userId: user.id },
      select: { id: true, code: true, script: true },
    });
    if (!lang) return NextResponse.json({ success: false, error: "Không tìm thấy thứ tiếng này" }, { status: 404 });

    const syllabus = syllabusFor(lang.code);
    const [pref, aiDecks, cards, readings, videos, mistakes, dictionary] = await Promise.all([
      prisma.learningPath.findUnique({ where: { userId_languageId: { userId: user.id, languageId: lang.id } } }),
      prisma.sentenceDeck.count({ where: { userId: user.id, langCode: lang.code, pointId: null } }),
      prisma.dictionaryItem.count({ where: { userId: user.id, languageId: lang.id } }),
      prisma.readingText.count({ where: { userId: user.id, langCode: lang.code } }),
      prisma.videoLesson.count({ where: { userId: user.id, langCode: lang.code } }),
      prisma.mistakeItem.count({ where: { userId: user.id, langCode: lang.code, resolvedAt: null } }),
      prisma.dictionaryItem.count({ where: { userId: user.id, languageId: lang.id, definition: { not: "" } } }),
    ]);

    const level = pref && isPathLevel(pref.level) ? pref.level : null;
    const pathLessons = syllabus && level
      ? allLessons(buildChapters(syllabus.families, level, lang.script === "latin")).length
      : null;

    return NextResponse.json({
      success: true,
      latin: lang.script === "latin",
      counts: {
        path: { level, lessons: pathLessons },
        sentences: staticSetsFor(lang.code).reduce((s, set) => s + set.sentences.length, 0),
        aiDecks,
        cards,
        grammar: syllabus ? countPoints(syllabus.families) : 0,
        readings,
        videos,
        mistakes,
        dictionary,
      },
    });
  } catch (error) {
    console.error("Learning hub error:", error);
    return NextResponse.json({ success: false, error: "Không đọc được số liệu" }, { status: 500 });
  }
}
