import { NextResponse } from "next/server";
import { google, drive_v3 } from "googleapis";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Thư viện video.
 *
 * Ứng dụng KHÔNG tải video. Việc tải do một shortcut trên iOS làm: shortcut
 * tải video rồi tự đẩy lên Google Drive, vào thư mục con theo loại
 * (ví dụ "Tài chính", "Marketing"). Route này chỉ đọc lại cây thư mục đó.
 *
 * Vì sao không tải trong app: hệ thống phải chạy hoàn toàn miễn phí trên
 * Vercel. Serverless ở đó không cài được binary (yt-dlp), filesystem chỉ đọc,
 * và mỗi function có giới hạn thời gian — không thể tải một video vài chục MB.
 * Đẩy việc tải ra thiết bị của người dùng là cách duy nhất giữ được tính năng
 * mà vẫn miễn phí.
 *
 * Cấu trúc Drive mà route này mong đợi:
 *
 *   <GOOGLE_DRIVE_VIDEO_FOLDER_ID>/
 *     ├── Tài chính/     ← mỗi thư mục con là một "loại"
 *     │     ├── video-a.mp4
 *     │     └── video-b.mp4
 *     └── Marketing/
 *           └── video-c.mp4
 *
 * Video nằm thẳng ở thư mục gốc được gom vào loại "Chưa phân loại".
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";
const UNCATEGORIZED = "Chưa phân loại";

function driveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3000"
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });
  return google.drive({ version: "v3", auth: oauth2Client });
}

async function listChildren(drive: drive_v3.Drive, parentId: string) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false`,
    // `description` là nơi shortcut có thể ghi link nguồn.
    fields:
      "files(id, name, mimeType, size, modifiedTime, description, webViewLink, thumbnailLink, videoMediaMetadata(durationMillis,width,height))",
    pageSize: 200,
    orderBy: "modifiedTime desc",
  });
  return res.data.files ?? [];
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  // KHÔNG fallback sang GOOGLE_DRIVE_FOLDER_ID: biến đó trỏ tới thư mục hoá đơn
  // (Expense_OCR_System), nên khi chưa đặt biến video thì màn hình này lặng lẽ
  // liệt kê Incoming_Invoices / Approved_Invoices như thể đó là các loại video.
  // Thà báo "chưa cấu hình" còn hơn hiện dữ liệu của module khác.
  const rootId = process.env.GOOGLE_DRIVE_VIDEO_FOLDER_ID;

  if (!rootId) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Chưa cấu hình GOOGLE_DRIVE_VIDEO_FOLDER_ID trong .env — đây là thư mục Drive mà shortcut iOS đẩy video vào.",
        code: "NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  try {
    const drive = driveClient();
    const top = await listChildren(drive, rootId);

    const categoryFolders = top.filter((f) => f.mimeType === FOLDER_MIME);
    const looseVideos = top.filter(
      (f) => f.mimeType !== FOLDER_MIME && f.mimeType?.startsWith("video/")
    );

    // Đọc song song các thư mục loại. Số lượng loại vốn nhỏ (vài cái) nên
    // không cần lo giới hạn tốc độ của Drive API.
    const categories = await Promise.all(
      categoryFolders.map(async (folder) => {
        const children = await listChildren(drive, folder.id!);
        const videos = children.filter((f) => f.mimeType?.startsWith("video/"));
        return {
          id: folder.id!,
          name: folder.name || "(không tên)",
          webViewLink: folder.webViewLink ?? null,
          videos: videos.map(toVideo),
        };
      })
    );

    if (looseVideos.length > 0) {
      categories.push({
        id: rootId,
        name: UNCATEGORIZED,
        webViewLink: null,
        videos: looseVideos.map(toVideo),
      });
    }

    const totalVideos = categories.reduce((s, c) => s + c.videos.length, 0);

    return NextResponse.json({
      success: true,
      data: {
        categories: categories.filter((c) => c.videos.length > 0),
        totalVideos,
        totalCategories: categories.filter((c) => c.videos.length > 0).length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Video library error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function toVideo(f: drive_v3.Schema$File) {
  const durationMs = f.videoMediaMetadata?.durationMillis;
  return {
    id: f.id!,
    name: f.name || "(không tên)",
    mimeType: f.mimeType || "video/mp4",
    sizeBytes: f.size ? Number(f.size) : null,
    modifiedTime: f.modifiedTime ?? null,
    // Shortcut có thể ghi link nguồn vào phần mô tả của file trên Drive.
    sourceUrl: f.description || null,
    webViewLink: f.webViewLink ?? null,
    thumbnailLink: f.thumbnailLink ?? null,
    durationSec: durationMs ? Math.round(Number(durationMs) / 1000) : null,
  };
}
