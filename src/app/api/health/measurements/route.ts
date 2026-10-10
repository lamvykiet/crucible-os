import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { measurementData, ownProfile, validDate } from "@/lib/healthServer";

export const dynamic = "force-dynamic";

/** Hai lần đo cách nhau dưới mức này là cùng một phiếu nhập hai lần. */
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

/** Toàn bộ số đo của một người, cũ trước mới sau (đúng thứ tự vẽ biểu đồ). */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const profile = await ownProfile(user.id, new URL(req.url).searchParams.get("profileId"));
    if (!profile) return NextResponse.json({ success: false, error: "Không tìm thấy hồ sơ" }, { status: 404 });
    const measurements = await prisma.bodyMeasurement.findMany({
      where: { profileId: profile.id },
      orderBy: { measuredAt: "asc" },
    });
    return NextResponse.json({ success: true, measurements });
  } catch (error) {
    console.error("GET /api/health/measurements", error);
    return NextResponse.json({ success: false, error: "Không tải được số đo" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const profile = await ownProfile(user.id, body.profileId);
    if (!profile) return NextResponse.json({ success: false, error: "Chưa chọn người được đo" }, { status: 400 });
    const measuredAt = validDate(body.measuredAt);
    if (!measuredAt) return NextResponse.json({ success: false, error: "Thời gian đo không hợp lệ" }, { status: 400 });

    // Nhập lại cùng một phiếu là chuyện rất dễ xảy ra (tải PDF hai lần). Chặn
    // lại và hỏi, trừ khi người dùng đã xác nhận đó là hai lần đo khác nhau.
    if (!body.force) {
      const dup = await prisma.bodyMeasurement.findFirst({
        where: {
          profileId: profile.id,
          measuredAt: {
            gte: new Date(measuredAt.getTime() - DUPLICATE_WINDOW_MS),
            lte: new Date(measuredAt.getTime() + DUPLICATE_WINDOW_MS),
          },
        },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { success: false, duplicate: true, error: `${profile.name} đã có một lần đo vào đúng thời điểm này` },
          { status: 409 }
        );
      }
    }

    const data = measurementData(body, false);
    const measurement = await prisma.bodyMeasurement.create({
      data: { ...data, measuredAt, profileId: profile.id, userId: user.id },
    });
    // Chiều cao đổi chậm; hồ sơ giữ số mới nhất để form nhập tay điền sẵn.
    if (typeof data.heightCm === "number" && data.heightCm !== profile.heightCm) {
      const latest = await prisma.bodyMeasurement.findFirst({
        where: { profileId: profile.id },
        orderBy: { measuredAt: "desc" },
        select: { id: true },
      });
      if (latest?.id === measurement.id) {
        await prisma.healthProfile.update({ where: { id: profile.id }, data: { heightCm: data.heightCm } });
      }
    }
    return NextResponse.json({ success: true, measurement });
  } catch (error) {
    console.error("POST /api/health/measurements", error);
    return NextResponse.json({ success: false, error: "Không lưu được số đo" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const own = await prisma.bodyMeasurement.findFirst({ where: { id: String(body.id ?? ""), userId: user.id } });
    if (!own) return NextResponse.json({ success: false, error: "Không tìm thấy lần đo" }, { status: 404 });
    const data: Record<string, unknown> = measurementData(body, true);
    if (body.measuredAt !== undefined) {
      const at = validDate(body.measuredAt);
      if (!at) return NextResponse.json({ success: false, error: "Thời gian đo không hợp lệ" }, { status: 400 });
      data.measuredAt = at;
    }
    // Chuyển lần đo sang người khác (chọn nhầm lúc nhập).
    if (body.profileId !== undefined && body.profileId !== own.profileId) {
      const target = await ownProfile(user.id, body.profileId);
      if (!target) return NextResponse.json({ success: false, error: "Không tìm thấy hồ sơ" }, { status: 404 });
      data.profileId = target.id;
    }
    const measurement = await prisma.bodyMeasurement.update({ where: { id: own.id }, data });
    return NextResponse.json({ success: true, measurement });
  } catch (error) {
    console.error("PUT /api/health/measurements", error);
    return NextResponse.json({ success: false, error: "Không lưu được số đo" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const { count } = await prisma.bodyMeasurement.deleteMany({ where: { id, userId: user.id } });
    if (!count) return NextResponse.json({ success: false, error: "Không tìm thấy lần đo" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/health/measurements", error);
    return NextResponse.json({ success: false, error: "Không xoá được lần đo" }, { status: 500 });
  }
}
