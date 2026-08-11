import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  buildFileName, detectPlatform, driveClient, ensureTopicFolder, videoRootId,
} from "@/lib/videoLibrary";
import { ResolveError, isResolvable, resolveVideo } from "@/lib/videoResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tải một video pending về Drive — toàn bộ làm ở server, không cần điện thoại.
 *
 * Vì sao trước đây không làm thế này: ghi chú cũ trong dự án nói app không tự
 * tải được vì Vercel "không cài được yt-dlp, filesystem chỉ đọc, giới hạn 60
 * giây". Hai lý do đầu đã hết hiệu lực — fdown.vn trả link .mp4 trực tiếp nên
 * không cần yt-dlp, và luồng dưới đây đi thẳng từ bộ nhớ lên Drive nên không
 * đụng filesystem. Lý do thứ ba thì đo được: một video 32MB tải mất 2,1 giây.
 *
 * Giới hạn thật sự còn lại là MAX_BYTES và trần 60 giây. Video quá lớn hoặc
 * mạng chậm sẽ chạm trần — lúc đó mới cần tới Shortcut và /api/video/pending.
 */

/**
 * Trần kích thước.
 *
 * Thấp hơn mức 200MB của /api/video/upload: ở đó file đã nằm sẵn trên điện
 * thoại, còn ở đây server phải vừa tải xuống vừa đẩy lên trong cùng 60 giây.
 */
const MAX_BYTES = 150 * 1024 * 1024;

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ success: false, error: "Thiếu 'id'" }, { status: 400 });
  }

  const root = videoRootId();
  if (!root) {
    return NextResponse.json(
      { success: false, error: "Chưa cấu hình GOOGLE_DRIVE_VIDEO_FOLDER_ID" },
      { status: 503 }
    );
  }

  try {
    const item = await prisma.videoItem.findFirst({ where: { id, userId: user.id } });
    if (!item) {
      return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
    }
    if (item.status === "saved") {
      return NextResponse.json({ success: false, error: "Video này đã lưu rồi" }, { status: 409 });
    }
    if (!isResolvable(detectPlatform(item.sourceUrl))) {
      return NextResponse.json(
        { success: false, error: "Chỉ tải tự động được Facebook và TikTok" },
        { status: 400 }
      );
    }

    const resolved = await resolveVideo(item.sourceUrl);

    const fileRes = await fetch(resolved.best.url, { redirect: "follow", cache: "no-store" });
    if (!fileRes.ok) {
      return NextResponse.json(
        { success: false, error: `Không tải được video (HTTP ${fileRes.status})` },
        { status: 502 }
      );
    }

    // Chặn theo Content-Length trước khi đọc, để một video khổng lồ không kịp
    // ngốn hết bộ nhớ function rồi mới bị từ chối.
    const declared = Number(fileRes.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Video ${Math.round(declared / 1024 / 1024)}MB, vượt trần ${MAX_BYTES / 1024 / 1024}MB của luồng tự động.`,
        },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ success: false, error: "Tệp rỗng" }, { status: 502 });
    }
    // Kiểm lại sau khi tải: không phải server nào cũng gửi Content-Length.
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `Video vượt trần ${MAX_BYTES / 1024 / 1024}MB.` },
        { status: 413 }
      );
    }

    const drive = driveClient();
    const folderId = await ensureTopicFolder(drive, root, item.topic);

    const created = await drive.files.create({
      requestBody: {
        name: buildFileName(item.topic, item.title || resolved.title),
        parents: [folderId],
        // Thư viện video đọc link gốc từ đây, nên mở file trong Drive vẫn biết
        // nó đến từ đâu mà không cần tra lại app.
        description: item.sourceUrl,
      },
      media: { mimeType: "video/mp4", body: Readable.from(buffer) },
      fields: "id, name, size",
    });

    const updated = await prisma.videoItem.update({
      where: { id: item.id },
      data: {
        status: "saved",
        driveFileId: created.data.id,
        driveFileName: created.data.name,
        sizeBytes: buffer.length,
        savedAt: new Date(),
        title: item.title || resolved.title,
      },
    });

    return NextResponse.json({
      success: true,
      item: updated,
      quality: resolved.best.label,
      sizeBytes: buffer.length,
    });
  } catch (err) {
    if (err instanceof ResolveError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    console.error("Video fetch error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
