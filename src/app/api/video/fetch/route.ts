import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { VideoFetchError, saveVideoToDrive } from "@/lib/videoQueue";
import { ResolveError } from "@/lib/videoResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nút "tải ngay" trên web: server tải một video pending về Drive.
 *
 * Phần việc thật nằm ở `saveVideoToDrive` (`src/lib/videoQueue.ts`) — cùng hàm
 * Shortcut chia sẻ gọi chạy nền, nên luật đặt tên file, trần kích thước và cách
 * đánh dấu "đã lưu" chỉ có một chỗ.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ success: false, error: "Thiếu 'id'" }, { status: 400 });
  }

  try {
    const item = await prisma.videoItem.findFirst({ where: { id, userId: user.id } });
    if (!item) {
      return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
    }

    const result = await saveVideoToDrive(item);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof VideoFetchError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
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
