import { NextResponse } from "next/server";
import { google, drive_v3 } from "googleapis";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Số liệu tổng quan cho Knowledge Hub.
 *
 * Trước đây 5 ô widget trên trang này là số viết cứng (3 tài liệu, 1 cũ,
 * 4 thẻ, 1 phiên ý tưởng, 0 bộ nhớ AI) và bảng "tài liệu gần đây" là một mảng
 * 2 dòng bịa sẵn kèm cả driveId giả ("1A2B3C4D5E6F...").
 *
 * Hai ô không có nguồn dữ liệu nào trong hệ thống — "Thẻ Dữ Liệu" và "Bộ Nhớ
 * Phản Hồi AI" — đã bị bỏ hẳn thay vì hiển thị số bịa.
 */

const STALE_DAYS = 30;
const FOLDER_MIME = "application/vnd.google-apps.folder";

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

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const staleBefore = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

  // Ý tưởng luôn đọc được (từ DB). Tài liệu phụ thuộc Drive nên có thể lỗi
  // riêng — khi đó vẫn trả phần còn lại thay vì hỏng cả trang.
  let ideaCount = 0;
  let staleIdeaCount = 0;
  try {
    const ideas = await prisma.idea.findMany({
      where: { userId: user.id },
      select: { status: true, lastActiveAt: true },
    });
    ideaCount = ideas.length;
    staleIdeaCount = ideas.filter(
      (i) => i.status === "active" && i.lastActiveAt.getTime() < staleBefore
    ).length;
  } catch (error) {
    // Bảng Idea chưa được tạo (chưa chạy `prisma db push`) — coi như 0.
    console.warn("Ideas unavailable for summary:", error);
  }

  let documents: drive_v3.Schema$File[] = [];
  let driveError: string | null = null;

  const folderId =
    process.env.GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    driveError = "Chưa cấu hình thư mục Drive";
  } else {
    try {
      const drive = driveClient();
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false and mimeType != '${FOLDER_MIME}'`,
        fields: "files(id, name, mimeType, size, modifiedTime, webViewLink)",
        pageSize: 200,
        orderBy: "modifiedTime desc",
      });
      documents = res.data.files ?? [];
    } catch (error) {
      driveError = error instanceof Error ? error.message : "Không đọc được Drive";
      console.error("Drive summary error:", error);
    }
  }

  const staleDocuments = documents.filter(
    (d) => d.modifiedTime && new Date(d.modifiedTime).getTime() < staleBefore
  );

  return NextResponse.json({
    success: true,
    data: {
      totalDocuments: documents.length,
      staleDocuments: staleDocuments.length,
      totalIdeas: ideaCount,
      staleIdeas: staleIdeaCount,
      staleDays: STALE_DAYS,
      driveError,
      // Bảng "gần đây" — dữ liệu thật, không còn driveId bịa.
      recent: documents.slice(0, 8).map((d) => ({
        id: d.id!,
        name: d.name || "(không tên)",
        mimeType: d.mimeType || "application/octet-stream",
        sizeBytes: d.size ? Number(d.size) : null,
        modifiedTime: d.modifiedTime ?? null,
        webViewLink: d.webViewLink ?? null,
        isStale: Boolean(
          d.modifiedTime && new Date(d.modifiedTime).getTime() < staleBefore
        ),
      })),
    },
  });
}
