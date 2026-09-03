import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Tuỳ chọn học và phần thưởng.
 *
 * Tạo dòng mặc định ngay lần đọc đầu tiên, để mọi màn hình sau này không phải
 * xử lý trường hợp "chưa có tuỳ chọn nào".
 */
async function ensurePref(userId: string) {
  const existing = await prisma.learnerPref.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.learnerPref.create({ data: { userId } });
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const pref = await ensurePref(user.id);
    return NextResponse.json({ success: true, pref });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được tuỳ chọn";
    console.error("Get prefs error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    await ensurePref(user.id);

    // Danh sách trắng: không cho body tự ý ghi đè userId hay số kim cương
    // bằng một con số bịa.
    const allowed = [
      "background", "unlockedBackgrounds", "videoBackground", "weatherEffect",
      "contentAlign", "colorTheme", "newCardLimit", "relearnLimit",
      "skipExerciseOnNew", "lowercaseAnswers",
    ] as const;

    const data = Object.fromEntries(
      allowed.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])
    );

    // Hạn mức phải nằm trong khoảng dùng được: 0 thì không bao giờ có thẻ để ôn,
    // còn 9999 thì hàng ôn phình tới mức chẳng ai học nổi.
    if (data.newCardLimit !== undefined) {
      data.newCardLimit = Math.min(200, Math.max(0, Number(data.newCardLimit) || 0));
    }
    if (data.relearnLimit !== undefined) {
      data.relearnLimit = Math.min(500, Math.max(0, Number(data.relearnLimit) || 0));
    }

    const pref = await prisma.learnerPref.update({ where: { userId: user.id }, data });
    return NextResponse.json({ success: true, pref });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được tuỳ chọn";
    console.error("Update prefs error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
