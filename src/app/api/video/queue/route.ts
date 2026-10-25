import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isValidHttpUrl, driveClient, videoRootId, listTopics } from "@/lib/videoLibrary";
import { canonicalFlag, canonicalSubTopic, enqueueVideo, flagsByTopic, subTopicsByTopic } from "@/lib/videoQueue";

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
      // Nhãn con đã dùng, gom theo đề tài — nguồn cho ô gõ có gợi ý ở giao diện.
      subTopics: await subTopicsByTopic(user.id),
      // Flag (tầng thứ ba) đã dùng + bộ gợi ý sẵn, gom theo đề tài.
      flags: await flagsByTopic(user.id),
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

    // Dán lại đúng link đã có thì cập nhật thay vì đẻ thêm bản ghi — xem
    // `enqueueVideo`, cùng hàm với Shortcut chia sẻ.
    const { item, duplicate } = await enqueueVideo(user.id, {
      sourceUrl, topic, subTopic: body.subTopic, flag: body.flag, title: body.title, note: body.note,
    });
    if (duplicate) return NextResponse.json({ success: true, item, duplicate: true });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được";
    console.error("Add video error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Gắn / đổi nhãn con và flag cho một video đã lưu.
 *
 * Chỉ đụng trường nào body CÓ gửi: sửa nhãn con mà không gửi `flag` thì flag
 * giữ nguyên, và ngược lại.
 *
 * Thư viện có sẵn hàng chục video lưu trước khi có nhãn con. Không có đường sửa
 * lại thì tính năng phân loại chỉ áp dụng cho video tương lai, còn đống cũ nằm
 * ngoài mọi bộ lọc.
 */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const item = await prisma.videoItem.findFirst({ where: { id, userId: user.id } });
    if (!item) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    const data: { subTopic?: string | null; flag?: string | null } = {};
    if ("subTopic" in body) data.subTopic = await canonicalSubTopic(user.id, item.topic, body.subTopic);
    if ("flag" in body) data.flag = await canonicalFlag(user.id, item.topic, body.flag);

    const updated = await prisma.videoItem.update({ where: { id: item.id }, data });
    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Update video error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
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
