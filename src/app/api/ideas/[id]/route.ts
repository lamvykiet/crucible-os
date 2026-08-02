import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5_000;
const MAX_BLUEPRINT = 50_000;
const VALID_STATUS = ["active", "completed", "archived"];

// Next.js 16: params của route động là Promise, phải await.
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const body = await req.json();

    // Lọc theo cả id lẫn userId — không được để người dùng này sửa ý tưởng của
    // người khác chỉ vì đoán đúng id.
    const existing = await prisma.idea.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
    }

    const data: {
      title?: string;
      description?: string | null;
      status?: string;
      blueprint?: string | null;
      lastActiveAt?: Date;
    } = {};

    if (typeof body?.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json(
          { success: false, error: "Tiêu đề không được để trống" },
          { status: 400 }
        );
      }
      data.title = title.slice(0, MAX_TITLE);
    }

    if (typeof body?.description === "string") {
      data.description = body.description.trim().slice(0, MAX_DESCRIPTION) || null;
    }

    if (typeof body?.status === "string") {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `status phải là một trong: ${VALID_STATUS.join(", ")}` },
          { status: 400 }
        );
      }
      data.status = body.status;
    }

    if (typeof body?.blueprint === "string") {
      data.blueprint = body.blueprint.slice(0, MAX_BLUEPRINT) || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "Không có trường nào để cập nhật" },
        { status: 400 }
      );
    }

    // Mọi lần chỉnh sửa đều làm ý tưởng "sống lại", nên badge bỏ trống tự tắt.
    data.lastActiveAt = new Date();

    const idea = await prisma.idea.update({ where: { id }, data });

    return NextResponse.json({ success: true, data: { ...idea, isStale: false } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Idea update error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;

    // deleteMany với điều kiện userId: vừa xoá vừa kiểm tra quyền trong một
    // câu lệnh, không có khe hở giữa lúc đọc và lúc xoá.
    const result = await prisma.idea.deleteMany({ where: { id, userId: user.id } });

    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Idea delete error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
