import { NextResponse } from "next/server";
import { google } from "googleapis";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId') || process.env.GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3000"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Bản cũ chỉ nhận PDF và thư mục, nên .docx, .xlsx, Google Docs, .md, ảnh
    // trong thư mục Knowledge đều vô hình — dù /api/drive/download đã trả đúng
    // Content-Type cho chúng và AI đọc được nội dung. Nay lấy mọi thứ trừ hai
    // loại không phải tài liệu: Apps Script và shortcut.
    const EXCLUDED = [
      "application/vnd.google-apps.script",
      "application/vnd.google-apps.shortcut",
      "application/vnd.google-apps.form",
    ];
    const query =
      `'${folderId}' in parents and trashed=false and ` +
      EXCLUDED.map((m) => `mimeType != '${m}'`).join(" and ");

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink)",
      pageSize: 200,
      orderBy: "folder, modifiedTime desc", // Folders first, then by date
    });

    return NextResponse.json({ files: response.data.files || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files";
    console.error("Drive list error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
