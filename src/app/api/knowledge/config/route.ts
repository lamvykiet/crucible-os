import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { driveClient } from "@/lib/driveAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trạng thái cấu hình Drive.
 *
 * Màn hình cài đặt trước đây có hai ô nhập "ID thư mục" và một nút Lưu không có
 * `onClick` — và kể cả có handler thì cũng không lưu vào đâu được: các ID này
 * nằm trong biến môi trường, đọc lúc khởi động tiến trình. Sửa được từ trình
 * duyệt là điều bất khả thi, nên thay vì giả vờ, màn hình giờ báo cáo đúng thứ
 * đang được cấu hình và thư mục đó có đọc được hay không.
 */

const TARGETS = [
  {
    env: "GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID",
    label: "Thư mục tài liệu (Knowledge Hub)",
    required: true,
  },
  {
    env: "GOOGLE_DRIVE_VIDEO_FOLDER_ID",
    label: "Thư mục video",
    required: false,
  },
  {
    env: "GOOGLE_DRIVE_FOLDER_ID",
    label: "Thư mục hoá đơn (Finance OCR)",
    required: true,
  },
];

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const drive = driveClient();

  const folders = await Promise.all(
    TARGETS.map(async (target) => {
      const id = process.env[target.env];
      if (!id) {
        return { ...target, id: null, name: null, reachable: false, error: "Chưa cấu hình" };
      }
      try {
        const meta = await drive.files.get({ fileId: id, fields: "id, name, webViewLink" });
        return {
          ...target,
          id,
          name: meta.data.name ?? null,
          webViewLink: meta.data.webViewLink ?? null,
          reachable: true,
          error: null,
        };
      } catch (error) {
        return {
          ...target,
          id,
          name: null,
          reachable: false,
          error: error instanceof Error ? error.message : "Không đọc được thư mục",
        };
      }
    })
  );

  return NextResponse.json({
    success: true,
    folders,
    gemini: {
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      visionModel: process.env.GEMINI_VISION_MODEL || "gemini-3.6-flash",
    },
  });
}
