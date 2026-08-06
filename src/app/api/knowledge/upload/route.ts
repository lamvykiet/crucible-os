import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { requireUser } from "@/lib/auth";
import { driveClient, knowledgeRoots, isWithinAllowedFolder } from "@/lib/driveAccess";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Thêm nguồn: tải tài liệu từ máy lên thư mục Knowledge trên Drive.
 *
 * Nút "Thêm nguồn" ở panel Nguồn trước đây không có `onClick` — không có đường
 * nào đưa tài liệu vào hệ thống từ trong ứng dụng, phải mở Drive ra làm tay.
 */

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const roots = knowledgeRoots();
    if (roots.length === 0) {
      return NextResponse.json(
        { success: false, error: "Chưa cấu hình GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requestedFolder = formData.get("folderId");

    if (!file) {
      return NextResponse.json({ success: false, error: "Chưa chọn tệp" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: `Tệp vượt quá ${MAX_FILE_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    const drive = driveClient();

    // Mặc định vào thư mục Knowledge gốc. Nếu client chỉ định thư mục con, phải
    // kiểm tra nó thật sự nằm trong cây được phép — nếu không, một folderId bất
    // kỳ sẽ biến API này thành chỗ ghi tuỳ ý vào Drive của người dùng.
    let parentId = roots[0];
    if (typeof requestedFolder === "string" && requestedFolder) {
      const meta = await drive.files.get({ fileId: requestedFolder, fields: "id, mimeType, parents" });
      const isFolder = meta.data.mimeType === "application/vnd.google-apps.folder";
      const allowed = await isWithinAllowedFolder(
        drive,
        requestedFolder,
        meta.data.parents ?? undefined,
        roots
      );
      if (!isFolder || !allowed) {
        return NextResponse.json(
          { success: false, error: "Thư mục đích không hợp lệ" },
          { status: 403 }
        );
      }
      parentId = requestedFolder;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const created = await drive.files.create({
      requestBody: { name: file.name, parents: [parentId] },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink",
    });

    return NextResponse.json({ success: true, file: created.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tải lên được";
    console.error("Knowledge upload error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
