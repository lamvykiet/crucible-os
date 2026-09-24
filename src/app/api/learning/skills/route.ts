import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { skillsFor } from "@/lib/languageSkills";
import type { Script } from "@/lib/languagePresets";

export const dynamic = "force-dynamic";

/**
 * Các kỹ năng của một thứ tiếng, kèm tiến độ.
 *
 * Danh sách kỹ năng nằm trong code vì nó là *chức năng của ứng dụng*, không
 * phải dữ liệu người dùng tạo ra. Bảng chỉ giữ phần thuộc về người dùng: đã
 * luyện bao nhiêu, lần cuối khi nào.
 *
 * Kỹ năng hiện ra phụ thuộc hệ chữ: tiếng Latin không có phần luyện viết chữ,
 * còn chữ Hán và Hangul thì có.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const languageId = new URL(req.url).searchParams.get("languageId")?.trim();
    if (!languageId) {
      return NextResponse.json({ success: false, error: "Thiếu languageId" }, { status: 400 });
    }

    const language = await prisma.language.findFirst({
      where: { id: languageId, userId: user.id },
    });
    if (!language) {
      return NextResponse.json({ success: false, error: "Không tìm thấy ngôn ngữ" }, { status: 404 });
    }

    const rows = await prisma.skillProgress.findMany({
      where: { userId: user.id, languageId },
    });

    const bySkill = Object.fromEntries(
      rows.map((r) => [
        r.skill,
        {
          xp: r.xp,
          lessonsDone: r.lessonsDone,
          minutes: r.minutes,
          lastPracticedAt: r.lastPracticedAt,
        },
      ])
    );

    return NextResponse.json({
      success: true,
      language: {
        id: language.id,
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        script: language.script,
        hasTones: language.hasTones,
      },
      skills: skillsFor(language.script as Script).map((s) => ({
        id: s.id,
        en: s.en,
        vi: s.vi,
        blurbEn: s.blurbEn,
        blurbVi: s.blurbVi,
        needsMic: s.needsMic ?? false,
        available: s.href !== null,
        href: s.href ? s.href(languageId) : null,
        progress: bySkill[s.id] ?? { xp: 0, lessonsDone: 0, minutes: 0, lastPracticedAt: null },
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được kỹ năng";
    console.error("Skills error:", error);
    return NextResponse.json({ success: false, error: message, skills: [] }, { status: 500 });
  }
}
