import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { syllabusFor, countByLevel, countPoints } from "@/lib/grammarSyllabus";

export const dynamic = "force-dynamic";

/**
 * Khung chương trình ngữ pháp, kèm tiến độ của người dùng.
 *
 * Khung nằm trong code chứ không trong cơ sở dữ liệu: thứ tự học và cấp độ của
 * từng điểm cần ổn định, và nếu để trong bảng thì mỗi lần muốn sửa một dòng
 * phải viết migration. Bảng chỉ giữ thứ thuộc về người dùng — đã xem bài nào,
 * luyện đúng bao nhiêu câu.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const langCode = new URL(req.url).searchParams.get("lang")?.trim() || "en";

    // Ngữ pháp là của từng thứ tiếng. Thứ tiếng chưa có khung riêng thì nói
    // thẳng là chưa có, đừng trả khung tiếng Anh ra cho người đang học tiếng Hàn.
    const syllabus = syllabusFor(langCode);
    if (!syllabus) {
      return NextResponse.json({
        success: true,
        families: [],
        scale: null,
        levels: [],
        references: [],
        total: 0,
        byLevel: {},
        viewedCount: 0,
        progress: {},
      });
    }

    const lessons = await prisma.grammarLesson.findMany({
      where: { userId: user.id, langCode },
      select: { pointId: true, viewedAt: true, practiceCount: true, correctCount: true },
    });

    const progress = Object.fromEntries(
      lessons.map((l) => [
        l.pointId,
        {
          viewed: l.viewedAt !== null,
          practiceCount: l.practiceCount,
          correctCount: l.correctCount,
        },
      ])
    );

    return NextResponse.json({
      success: true,
      families: syllabus.families,
      scale: syllabus.scale,
      levels: syllabus.levels,
      references: syllabus.references,
      total: countPoints(syllabus.families),
      byLevel: countByLevel(syllabus),
      viewedCount: lessons.filter((l) => l.viewedAt !== null).length,
      progress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được chương trình";
    console.error("Grammar syllabus error:", error);
    return NextResponse.json({ success: false, error: message, families: [] }, { status: 500 });
  }
}
