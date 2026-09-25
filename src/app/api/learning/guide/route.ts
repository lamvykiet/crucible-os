import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { guideFor } from "@/lib/skillGuides";
import type { SkillId } from "@/lib/languageSkills";

export const dynamic = "force-dynamic";

/**
 * Bài hướng dẫn cho một kỹ năng.
 *
 * Trả qua API chứ không nhập thẳng vào component: toàn bộ bài hướng dẫn cộng
 * lại khá nặng, mà mỗi trang chỉ cần đúng một bài. Nhập thẳng là bắt mọi trang
 * kỹ năng tải bài của mọi thứ tiếng.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = new URL(req.url).searchParams;
  const code = params.get("lang")?.trim() || "en";
  const skill = params.get("skill")?.trim() as SkillId | null;

  if (!skill) {
    return NextResponse.json({ success: false, error: "Thiếu tên kỹ năng" }, { status: 400 });
  }

  // Chưa có bài thì nói thẳng là chưa có, đừng trả bài của thứ tiếng khác.
  return NextResponse.json({ success: true, guide: guideFor(code, skill) });
}
