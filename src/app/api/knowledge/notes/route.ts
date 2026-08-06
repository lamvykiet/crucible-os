import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { driveClient, knowledgeRoots, isWithinAllowedFolder } from "@/lib/driveAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ghi chú gắn với một tài liệu.
 *
 * Lưu vào `DocumentAnnotation`, bảng đã có trong schema từ đầu nhưng chưa một
 * dòng code nào ghi vào — panel Studio chỉ có nút "Thêm ghi chú" không gắn
 * handler và dòng chữ "Ghi chú đã lưu sẽ hiện ở đây".
 */

/** Tìm (hoặc tạo) bản ghi Material tương ứng với một file trên Drive. */
async function materialFor(driveFileId: string, userId: string) {
  const existing = await prisma.material.findUnique({ where: { driveFileId } });
  if (existing) return existing;

  // Ghi chú có thể được tạo cho tài liệu mà AI chưa đọc được nội dung (video,
  // tệp nén). Vẫn cần một Material để treo ghi chú vào, nên tạo bản tối thiểu.
  const drive = driveClient();
  const roots = knowledgeRoots();
  const meta = await drive.files.get({ fileId: driveFileId, fields: "id, name, mimeType, parents" });
  const allowed = await isWithinAllowedFolder(drive, driveFileId, meta.data.parents ?? undefined, roots);
  if (!allowed) return null;

  return prisma.material.create({
    data: {
      driveFileId,
      title: meta.data.name || "(không tên)",
      type: (meta.data.mimeType || "file").split("/").pop() || "file",
      mimeType: meta.data.mimeType || null,
      userId,
    },
  });
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const fileId = new URL(req.url).searchParams.get("fileId");
    if (!fileId) {
      return NextResponse.json({ success: false, error: "Thiếu fileId" }, { status: 400 });
    }

    const material = await prisma.material.findUnique({ where: { driveFileId: fileId } });
    if (!material || material.userId !== user.id) {
      // Chưa có ghi chú nào là chuyện bình thường, không phải lỗi.
      return NextResponse.json({ success: true, notes: [] });
    }

    const notes = await prisma.documentAnnotation.findMany({
      where: { materialId: material.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error("List notes error:", error);
    return NextResponse.json({ success: false, error: "Server Error", notes: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { fileId, content } = await req.json();
    if (!fileId || !content?.trim()) {
      return NextResponse.json({ success: false, error: "Thiếu nội dung ghi chú" }, { status: 400 });
    }

    const material = await materialFor(fileId, user.id);
    if (!material || material.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu" }, { status: 404 });
    }

    const note = await prisma.documentAnnotation.create({
      data: {
        content: content.trim(),
        // `position` dành cho ghi chú neo vào một vị trí trong tài liệu — chưa
        // có trình đọc nào chọn được đoạn văn, nên tạm để rỗng.
        position: "",
        materialId: material.id,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được ghi chú";
    console.error("Create note error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
    }

    // Xác thực quyền qua Material rồi mới xoá — DocumentAnnotation không có
    // userId riêng.
    const note = await prisma.documentAnnotation.findUnique({
      where: { id },
      include: { material: { select: { userId: true } } },
    });
    if (!note || note.material.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Không tìm thấy ghi chú" }, { status: 404 });
    }

    await prisma.documentAnnotation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete note error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
