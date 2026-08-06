import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import {
  detectPlatform, driveClient, videoRootId, ensureTopicFolder, buildFileName,
} from "@/lib/videoLibrary";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Điểm nhận video từ Shortcut trên iPhone.
 *
 * Shortcut không đăng nhập Supabase được, nên dùng một token dùng chung đặt
 * trong `VIDEO_UPLOAD_TOKEN` — đúng cơ chế `APP_TOKEN` mà dự án "Sổ Chi Tiêu"
 * trước đây đã dùng cho cùng bài toán này.
 *
 * Nhận multipart: `file`, `sourceUrl`, `topic`, `title?`. Đẩy file vào thư mục
 * đề tài trên Drive, ghi link gốc vào phần Description của file (để mở Drive
 * vẫn truy được nguồn), rồi đánh dấu bản ghi trong hàng đợi là đã lưu.
 */
export async function POST(req: Request) {
  const expected = process.env.VIDEO_UPLOAD_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { success: false, error: "Máy chủ chưa cấu hình VIDEO_UPLOAD_TOKEN" },
      { status: 503 }
    );
  }

  // Chấp nhận cả header lẫn field trong form: Shortcuts đặt header dễ sai chính tả.
  const headerToken =
    req.headers.get("x-upload-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  try {
    const form = await req.formData();
    const token = headerToken || String(form.get("token") ?? "");

    if (token !== expected) {
      return NextResponse.json({ success: false, error: "Token không đúng" }, { status: 401 });
    }

    const file = form.get("file");
    const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
    const topicInput = String(form.get("topic") ?? "").trim();
    const title = String(form.get("title") ?? "").trim() || null;

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Thiếu tệp video" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ success: false, error: "Tệp rỗng" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `Tệp vượt quá ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    const root = videoRootId();
    if (!root) {
      return NextResponse.json(
        { success: false, error: "Chưa cấu hình GOOGLE_DRIVE_VIDEO_FOLDER_ID" },
        { status: 503 }
      );
    }

    // Khớp với bản ghi đã dán link trước đó (nếu có) để lấy đúng đề tài người
    // dùng đã chọn trong app, thay vì tin vào tham số Shortcut gửi lên.
    const queued = sourceUrl
      ? await prisma.videoItem.findFirst({ where: { sourceUrl }, orderBy: { createdAt: "desc" } })
      : null;

    const topic = queued?.topic || topicInput || "Khác";

    const drive = driveClient();
    const folderId = await ensureTopicFolder(drive, root, topic);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const created = await drive.files.create({
      requestBody: {
        name: buildFileName(topic, title || queued?.title || file.name),
        parents: [folderId],
        // Thư viện video đọc link gốc từ đây, nên mở file trong Drive vẫn biết
        // nó đến từ đâu mà không cần tra lại app.
        description: sourceUrl || undefined,
      },
      media: { mimeType: file.type || "video/mp4", body: stream },
      fields: "id, name, size",
    });

    const driveFileId = created.data.id!;
    const item = queued
      ? await prisma.videoItem.update({
          where: { id: queued.id },
          data: {
            status: "saved",
            driveFileId,
            driveFileName: created.data.name,
            sizeBytes: buffer.length,
            savedAt: new Date(),
            title: title || queued.title,
          },
        })
      : // Shortcut gửi lên một link chưa từng dán trong app — vẫn nhận, và tạo
        // bản ghi cho nó, miễn là biết chủ sở hữu.
        await (async () => {
          const owner = await prisma.user.findFirst({ select: { id: true } });
          if (!owner) return null;
          return prisma.videoItem.create({
            data: {
              sourceUrl: sourceUrl || `drive:${driveFileId}`,
              platform: sourceUrl ? detectPlatform(sourceUrl) : "other",
              topic,
              title,
              status: "saved",
              driveFileId,
              driveFileName: created.data.name,
              sizeBytes: buffer.length,
              savedAt: new Date(),
              userId: owner.id,
            },
          });
        })();

    return NextResponse.json({
      success: true,
      topic,
      driveFileId,
      fileName: created.data.name,
      itemId: item?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tải lên được";
    console.error("Video upload error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
