import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectPlatform, PLATFORM_LABELS } from "@/lib/videoLibrary";
import { subTopicsByTopic, topicNames, videoOwnerId } from "@/lib/videoQueue";
import { readShareTicket } from "@/lib/videoShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/video/share/form?t=<vé>
 *
 * Dữ liệu cho trang `/video-share`: đề tài (thư mục Drive), nhãn con theo từng
 * đề tài — đúng hai nguồn ô chọn trên web dùng — và bản ghi cũ nếu link này đã
 * từng lưu. Xác thực bằng vé, không bằng phiên: xem `signShareTicket`.
 */
export async function GET(req: Request) {
  const sourceUrl = readShareTicket(new URL(req.url).searchParams.get("t"));
  if (!sourceUrl) {
    return NextResponse.json(
      { success: false, error: "Phiên chia sẻ đã hết hạn — bấm Chia sẻ lại từ TikTok/Facebook." },
      { status: 401 }
    );
  }

  try {
    const userId = await videoOwnerId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Chưa có tài khoản nào trong hệ thống." }, { status: 503 });
    }

    // Không trả đề tài "mặc định": trang bắt người dùng tự chọn mỗi lần — bản
    // đầu chọn sẵn đề tài lần lưu gần nhất và video không liên quan bị lưu nhầm
    // vào đó.
    const [topics, subTopics, existing] = await Promise.all([
      topicNames(userId),
      subTopicsByTopic(userId),
      prisma.videoItem.findFirst({ where: { userId, sourceUrl } }),
    ]);

    const platform = detectPlatform(sourceUrl);
    return NextResponse.json({
      success: true,
      sourceUrl,
      platform,
      platformLabel: PLATFORM_LABELS[platform] ?? platform,
      topics,
      subTopics,
      existing: existing
        ? { topic: existing.topic, subTopic: existing.subTopic, title: existing.title, status: existing.status }
        : null,
    });
  } catch (error) {
    console.error("Video share form error:", error);
    return NextResponse.json({ success: false, error: "Không tải được dữ liệu" }, { status: 500 });
  }
}
