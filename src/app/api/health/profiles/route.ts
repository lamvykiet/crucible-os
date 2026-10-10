import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Dữ liệu hồ sơ từ body, bỏ khoá lạ. `partial` = PUT. */
function profileData(body: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (!partial || body[key] !== undefined) data[key] = value;
  };
  const n = (v: unknown, min: number, max: number) => {
    if (v === null || v === undefined || v === "") return null;
    const x = Number(v);
    return Number.isFinite(x) && x >= min && x <= max ? x : null;
  };
  set("name", String(body.name ?? "").trim().slice(0, 60));
  set("sex", body.sex === "female" ? "female" : "male");
  set("birthYear", n(body.birthYear, 1900, new Date().getFullYear()));
  set("heightCm", n(body.heightCm, 50, 250));
  set("targetWeightKg", n(body.targetWeightKg, 10, 400));
  if (data.name === "") delete data.name;
  return data;
}

/**
 * Danh sách người được theo dõi, kèm ngày đo gần nhất và buổi tập gần nhất —
 * thanh chọn người cần biết "lâu chưa đo" mà không phải tải hết lịch sử.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const profiles = await prisma.healthProfile.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        measurements: { orderBy: { measuredAt: "desc" }, take: 1, select: { measuredAt: true } },
        workouts: { orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true } },
        _count: { select: { measurements: true, workouts: true } },
      },
    });
    return NextResponse.json({
      success: true,
      profiles: profiles.map(({ measurements, workouts, _count, ...p }) => ({
        ...p,
        lastMeasuredAt: measurements[0]?.measuredAt ?? null,
        lastWorkoutAt: workouts[0]?.startedAt ?? null,
        measurementCount: _count.measurements,
        workoutCount: _count.workouts,
      })),
    });
  } catch (error) {
    console.error("GET /api/health/profiles", error);
    return NextResponse.json({ success: false, error: "Không tải được danh sách người" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const data = profileData(await req.json(), false);
    if (!data.name) return NextResponse.json({ success: false, error: "Chưa nhập tên" }, { status: 400 });
    const count = await prisma.healthProfile.count({ where: { userId: user.id } });
    const profile = await prisma.healthProfile.create({
      data: { ...(data as { name: string }), sortOrder: count, userId: user.id },
    });
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("POST /api/health/profiles", error);
    return NextResponse.json({ success: false, error: "Không tạo được hồ sơ" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const own = await prisma.healthProfile.findFirst({ where: { id: String(body.id ?? ""), userId: user.id } });
    if (!own) return NextResponse.json({ success: false, error: "Không tìm thấy hồ sơ" }, { status: 404 });
    const profile = await prisma.healthProfile.update({ where: { id: own.id }, data: profileData(body, true) });
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("PUT /api/health/profiles", error);
    return NextResponse.json({ success: false, error: "Không lưu được hồ sơ" }, { status: 500 });
  }
}

/**
 * Lưu kho thay vì xoá: số đo và buổi tập vẫn còn. Xoá hẳn một người là mất cả
 * lịch sử sức khoẻ — việc đó không nên chỉ cách một cú bấm.
 */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const own = await prisma.healthProfile.findFirst({ where: { id, userId: user.id } });
    if (!own) return NextResponse.json({ success: false, error: "Không tìm thấy hồ sơ" }, { status: 404 });
    await prisma.healthProfile.update({ where: { id }, data: { archivedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/health/profiles", error);
    return NextResponse.json({ success: false, error: "Không lưu kho được hồ sơ" }, { status: 500 });
  }
}
