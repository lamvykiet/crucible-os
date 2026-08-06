import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  detectPlatform, isValidHttpUrl, driveClient, videoRootId, listTopics,
} from "@/lib/videoLibrary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hàng đợi video: dán link ở đây, Shortcut trên điện thoại tải và đẩy file lên.
 *
 * Trả kèm danh sách đề tài đọc từ thư mục Drive, để ô chọn đề tài không phải là
 * một mảng viết cứng lệch với thư mục thật.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const items = await prisma.videoItem.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    let topics: { id: string; name: string }[] = [];
    const root = videoRootId();
    if (root) {
      try {
        topics = await listTopics(driveClient(), root);
      } catch (error) {
        console.error("Không đọc được đề tài từ Drive:", error);
      }
    }

    return NextResponse.json({
      success: true,
      items,
      topics,
      pendingCount: items.filter((i) => i.status === "pending").length,
      configured: Boolean(root),
    });
  } catch (error) {
    console.error("List video queue error:", error);
    return NextResponse.json(
      { success: false, error: "Server Error", items: [], topics: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const sourceUrl = String(body.sourceUrl ?? "").trim();
    const topic = String(body.topic ?? "").trim();

    if (!isValidHttpUrl(sourceUrl)) {
      return NextResponse.json({ success: false, error: "Link không hợp lệ" }, { status: 400 });
    }
    if (!topic) {
      return NextResponse.json({ success: false, error: "Chưa chọn đề tài" }, { status: 400 });
    }

    // Dán lại đúng link đã có thì cập nhật đề tài thay vì đẻ thêm bản ghi —
    // chuyện này xảy ra suốt khi lướt lại một video đã lưu.
    const existing = await prisma.videoItem.findFirst({
      where: { userId: user.id, sourceUrl },
    });
    if (existing) {
      const updated = await prisma.videoItem.update({
        where: { id: existing.id },
        data: { topic, title: body.title?.trim() || existing.title, note: body.note?.trim() || existing.note },
      });
      return NextResponse.json({ success: true, item: updated, duplicate: true });
    }

    const item = await prisma.videoItem.create({
      data: {
        sourceUrl,
        platform: detectPlatform(sourceUrl),
        topic,
        title: body.title?.trim() || null,
        note: body.note?.trim() || null,
        status: "pending",
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được";
    console.error("Add video error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    // Chỉ xoá bản ghi; file trên Drive giữ nguyên. Xoá file là việc của Drive,
    // và người dùng gần như không bao giờ muốn mất video khi chỉ dọn danh sách.
    const result = await prisma.videoItem.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete video error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
