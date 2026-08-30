import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  detectPlatform, isValidHttpUrl, driveClient, videoRootId, listTopics,
  normalizeSubTopic,
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
      // Nhãn con đã dùng, gom theo đề tài — nguồn cho ô gõ có gợi ý ở giao diện.
      subTopics: await subTopicsByTopic(user.id),
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

/**
 * Các nhãn con đã từng dùng, gom theo đề tài.
 *
 * Đọc toàn bộ lịch sử chứ không chỉ 200 mục hiện ra ở danh sách: nhãn gõ từ
 * nửa năm trước vẫn phải gợi ý lại được, nếu không mỗi lần gõ lại đẻ một biến
 * thể mới và bộ lọc vỡ vụn.
 */
async function subTopicsByTopic(userId: string): Promise<Record<string, string[]>> {
  const rows = await prisma.videoItem.findMany({
    where: { userId, NOT: { subTopic: null } },
    select: { topic: true, subTopic: true },
    distinct: ["topic", "subTopic"],
    orderBy: { subTopic: "asc" },
  });

  const grouped: Record<string, string[]> = {};
  for (const row of rows) {
    if (!row.subTopic) continue;
    (grouped[row.topic] ??= []).push(row.subTopic);
  }
  return grouped;
}

/**
 * Gộp nhãn chỉ khác nhau hoa thường hoặc dấu cách về đúng một biến thể đã có.
 *
 * Không có bước này thì "Mẫu in", "mẫu in" và "Mẫu  in" thành ba nhãn riêng,
 * và bộ lọc theo nhãn con — thứ duy nhất khiến tính năng này có ích — chia đôi
 * cùng một đống video.
 */
async function canonicalSubTopic(
  userId: string,
  topic: string,
  raw: unknown
): Promise<string | null> {
  const value = normalizeSubTopic(raw);
  if (!value) return null;

  const seen = await prisma.videoItem.findFirst({
    where: { userId, topic, subTopic: { equals: value, mode: "insensitive" } },
    select: { subTopic: true },
    orderBy: { createdAt: "asc" },
  });
  return seen?.subTopic ?? value;
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
    const subTopic = await canonicalSubTopic(user.id, topic, body.subTopic);

    if (existing) {
      const updated = await prisma.videoItem.update({
        where: { id: existing.id },
        data: {
          topic,
          // Dán lại mà bỏ trống nhãn con thì giữ nhãn cũ, đừng xoá nó đi.
          subTopic: subTopic ?? existing.subTopic,
          title: body.title?.trim() || existing.title,
          note: body.note?.trim() || existing.note,
        },
      });
      return NextResponse.json({ success: true, item: updated, duplicate: true });
    }

    const item = await prisma.videoItem.create({
      data: {
        sourceUrl,
        platform: detectPlatform(sourceUrl),
        topic,
        subTopic,
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

/**
 * Gắn / đổi nhãn con cho một video đã lưu.
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

    const updated = await prisma.videoItem.update({
      where: { id: item.id },
      data: { subTopic: await canonicalSubTopic(user.id, item.topic, body.subTopic) },
    });
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
