import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { google, drive_v3 } from "googleapis";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Kiểm soát truy cập tài liệu.
 *
 * Ứng dụng dùng MỘT refresh token Google Drive dùng chung cho mọi người dùng,
 * nên bất cứ fileId nào mà tài khoản đó với tới được đều tải về được — kể cả
 * file nằm ngoài Knowledge Hub (hoá đơn tài chính, tài liệu riêng tư...). Bản cũ
 * chỉ kiểm tra "đã đăng nhập chưa" rồi chuyển thẳng fileId sang Drive.
 *
 * Bảng `Material` hiện trống và không có chỗ nào ghi vào (module Knowledge đọc
 * thẳng từ Drive, xem DocumentsTab.tsx), nên không thể xác thực quyền sở hữu qua
 * DB — làm vậy sẽ chặn đứng mọi PDF. Thay vào đó, chỉ cho phép file nằm trong
 * cây thư mục Knowledge đã cấu hình.
 */
const MAX_PARENT_DEPTH = 10;

function allowedRoots(): string[] {
  return [
    process.env.GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID,
    process.env.GOOGLE_DRIVE_FOLDER_ID,
  ].filter((v): v is string => Boolean(v));
}

/** Lần ngược cây thư mục xem file có nằm dưới một trong các thư mục gốc cho phép không. */
async function isWithinAllowedFolder(
  drive: drive_v3.Drive,
  fileId: string,
  parents: string[] | undefined,
  roots: string[]
): Promise<boolean> {
  if (roots.includes(fileId)) return true;

  const seen = new Set<string>([fileId]);
  let frontier = parents ?? [];

  for (let depth = 0; depth < MAX_PARENT_DEPTH && frontier.length > 0; depth++) {
    if (frontier.some((p) => roots.includes(p))) return true;

    const next: string[] = [];
    for (const parentId of frontier) {
      if (seen.has(parentId)) continue;
      seen.add(parentId);
      try {
        const meta = await drive.files.get({
          fileId: parentId,
          fields: "id, parents",
        });
        next.push(...(meta.data.parents ?? []));
      } catch {
        // Không đọc được thư mục cha (đã xoá hoặc mất quyền) — bỏ qua nhánh này.
      }
    }
    frontier = next;
  }

  return false;
}

/** Content-Disposition an toàn cho tên file tiếng Việt (RFC 5987). */
function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
      return new NextResponse("File ID is required", { status: 400 });
    }

    const roots = allowedRoots();
    if (roots.length === 0) {
      console.error(
        "Drive download: chưa cấu hình GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID hoặc GOOGLE_DRIVE_FOLDER_ID"
      );
      return new NextResponse("Drive folder not configured", { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3000"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Lấy metadata trước — vừa để kiểm tra quyền, vừa để trả đúng Content-Type.
    const meta = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size, parents",
    });

    const allowed = await isWithinAllowedFolder(
      drive,
      fileId,
      meta.data.parents ?? undefined,
      roots
    );
    if (!allowed) {
      // 404 chứ không phải 403: đừng xác nhận cho người gọi biết fileId đó có tồn tại.
      return new NextResponse("Not found", { status: 404 });
    }

    const fileName = meta.data.name || "document";
    // Bản cũ gán cứng "application/pdf" cho mọi file, nên .docx trong danh sách
    // nguồn sẽ render hỏng trong iframe.
    const mimeType = meta.data.mimeType || "application/octet-stream";

    const fileRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Disposition": contentDisposition(fileName),
      // Tài liệu riêng tư — không cho CDN/proxy dùng chung cache.
      "Cache-Control": "private, max-age=300",
    };
    if (meta.data.size) {
      headers["Content-Length"] = String(meta.data.size);
    }

    const body = Readable.toWeb(
      fileRes.data as unknown as Readable
    ) as ReadableStream;

    return new NextResponse(body, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download file";
    console.error("Drive download error:", error);
    return new NextResponse(message, { status: 500 });
  }
}
