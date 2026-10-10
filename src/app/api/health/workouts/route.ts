import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { WORKOUT_INCLUDE, exercisesData, ownProfile, validDate } from "@/lib/healthServer";

export const dynamic = "force-dynamic";

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

const intOrNull = (v: unknown, max: number) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) || n < 0 || n > max ? null : Math.round(n);
};

/**
 * Mọi buổi tập của một người, kèm bài và hiệp. Trả hết chứ không phân trang:
 * kỷ lục cá nhân phải tính trên TOÀN BỘ lịch sử, và vài trăm buổi vẫn chỉ là
 * vài chục KB.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const profile = await ownProfile(user.id, new URL(req.url).searchParams.get("profileId"));
    if (!profile) return NextResponse.json({ success: false, error: "Không tìm thấy hồ sơ" }, { status: 404 });
    const workouts = await prisma.workout.findMany({
      where: { profileId: profile.id },
      orderBy: { startedAt: "desc" },
      include: WORKOUT_INCLUDE,
    });
    return NextResponse.json({ success: true, workouts });
  } catch (error) {
    console.error("GET /api/health/workouts", error);
    return NextResponse.json({ success: false, error: "Không tải được buổi tập" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const profile = await ownProfile(user.id, body.profileId);
    if (!profile) return NextResponse.json({ success: false, error: "Chưa chọn người tập" }, { status: 400 });
    const startedAt = validDate(body.startedAt);
    if (!startedAt) return NextResponse.json({ success: false, error: "Thời gian tập không hợp lệ" }, { status: 400 });
    const exercises = exercisesData(body.exercises);
    if (!exercises.length) return NextResponse.json({ success: false, error: "Buổi tập chưa có bài nào" }, { status: 400 });

    if (!body.force) {
      const dup = await prisma.workout.findFirst({
        where: {
          profileId: profile.id,
          startedAt: {
            gte: new Date(startedAt.getTime() - DUPLICATE_WINDOW_MS),
            lte: new Date(startedAt.getTime() + DUPLICATE_WINDOW_MS),
          },
        },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { success: false, duplicate: true, error: `${profile.name} đã có một buổi tập bắt đầu đúng lúc này` },
          { status: 409 }
        );
      }
    }

    const workout = await prisma.workout.create({
      data: {
        profileId: profile.id,
        userId: user.id,
        title: String(body.title ?? "").trim().slice(0, 120) || "Buổi tập",
        startedAt,
        durationSec: intOrNull(body.durationSec, 86_400),
        calories: intOrNull(body.calories, 10_000),
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null,
        source: body.source === "import" ? "import" : "manual",
        exercises: { create: exercises },
      },
      include: WORKOUT_INCLUDE,
    });
    return NextResponse.json({ success: true, workout });
  } catch (error) {
    console.error("POST /api/health/workouts", error);
    return NextResponse.json({ success: false, error: "Không lưu được buổi tập" }, { status: 500 });
  }
}

/** Sửa buổi tập: thay toàn bộ bài và hiệp trong CÙNG một giao dịch. */
export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const own = await prisma.workout.findFirst({ where: { id: String(body.id ?? ""), userId: user.id } });
    if (!own) return NextResponse.json({ success: false, error: "Không tìm thấy buổi tập" }, { status: 404 });
    const startedAt = body.startedAt === undefined ? own.startedAt : validDate(body.startedAt);
    if (!startedAt) return NextResponse.json({ success: false, error: "Thời gian tập không hợp lệ" }, { status: 400 });
    const exercises = exercisesData(body.exercises);
    if (!exercises.length) return NextResponse.json({ success: false, error: "Buổi tập chưa có bài nào" }, { status: 400 });

    const workout = await prisma.$transaction(async (tx) => {
      await tx.workoutExercise.deleteMany({ where: { workoutId: own.id } });
      return tx.workout.update({
        where: { id: own.id },
        data: {
          title: String(body.title ?? own.title).trim().slice(0, 120) || own.title,
          startedAt,
          durationSec: intOrNull(body.durationSec, 86_400),
          calories: intOrNull(body.calories, 10_000),
          note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null,
          exercises: { create: exercises },
        },
        include: WORKOUT_INCLUDE,
      });
    });
    return NextResponse.json({ success: true, workout });
  } catch (error) {
    console.error("PUT /api/health/workouts", error);
    return NextResponse.json({ success: false, error: "Không lưu được buổi tập" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const { count } = await prisma.workout.deleteMany({ where: { id, userId: user.id } });
    if (!count) return NextResponse.json({ success: false, error: "Không tìm thấy buổi tập" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/health/workouts", error);
    return NextResponse.json({ success: false, error: "Không xoá được buổi tập" }, { status: 500 });
  }
}
