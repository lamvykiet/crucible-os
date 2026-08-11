import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectPlatform } from "@/lib/videoLibrary";
import { ResolveError, isResolvable, resolveVideo } from "@/lib/videoResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Mỗi lượt resolve là hai request sang fdown.vn. BATCH_SIZE=3 nên tối đa khoảng
// 6 request, thừa sức trong hạn mức này.
export const maxDuration = 60;

/**
 * Việc đang chờ cho Shortcut: các video pending, kèm sẵn link tải trực tiếp.
 *
 * Vì sao không dùng `/api/video/queue`: route đó xác thực bằng phiên Supabase
 * (`requireUser`), mà Shortcut trên iPhone không đăng nhập được. Ở đây dùng
 * `VIDEO_UPLOAD_TOKEN` — đúng cơ chế `/api/video/upload` đang dùng, để Shortcut
 * chỉ phải giữ một bí mật duy nhất.
 *
 * Nhờ đọc hàng đợi từ server, người dùng dán link trên web ở BẤT KỲ thiết bị
 * nào (iPhone, iPad, MacBook) rồi chạy Shortcut ở đâu cũng được — Shortcut
 * không cần nhận link qua Share Sheet.
 *
 * ĐỊNH DẠNG TRẢ VỀ — đọc trước khi sửa:
 *
 * `items` luôn là MẢNG, và mỗi phần tử là object PHẲNG. Cả hai điều đó là ràng
 * buộc từ phía Shortcuts, không phải tuỳ hứng:
 *
 *   - Mảng: "Repeat with Each" chạy trên mảng rỗng thì không làm gì cả. Nhờ vậy
 *     Shortcut không cần khối `If` nào để xử lý trường hợp hàng đợi trống —
 *     mà `If` là thứ khó dựng đúng nhất trong Shortcuts.
 *   - Phẳng: mỗi tầng lồng nhau là thêm một action "Get Dictionary Value",
 *     tức thêm một chỗ dựng sai.
 *
 * Đừng gom `items` thành object hay lồng thêm tầng.
 */

/** Quét tối đa ngần này bản ghi chờ để tìm cái resolve được. */
const SCAN_LIMIT = 25;

/**
 * Số video trả về mỗi lượt gọi.
 *
 * Giữ nhỏ vì link fdown.vn có hạn dùng: resolve xong 10 cái rồi mới tải tuần tự
 * mỗi cái vài chục MB thì cái cuối có thể đã hết hạn. Ba cái một lượt, chạy lại
 * Shortcut nếu còn.
 */
const BATCH_SIZE = 3;

function tokenFrom(req: Request): string {
  return (
    req.headers.get("x-upload-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  );
}

export async function GET(req: Request) {
  const expected = process.env.VIDEO_UPLOAD_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { success: false, error: "Máy chủ chưa cấu hình VIDEO_UPLOAD_TOKEN", items: [] },
      { status: 503 }
    );
  }
  if (tokenFrom(req) !== expected) {
    return NextResponse.json(
      { success: false, error: "Token không đúng", items: [] },
      { status: 401 }
    );
  }

  try {
    const pending = await prisma.videoItem.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: SCAN_LIMIT,
    });

    const items: Record<string, string>[] = [];
    const skipped: { sourceUrl: string; reason: string }[] = [];

    for (const row of pending) {
      if (items.length >= BATCH_SIZE) break;

      // Queue nhận cả YouTube/Instagram, nhưng fdown.vn chỉ tải Facebook và
      // TikTok. Bỏ qua phần còn lại thay vì để Shortcut kẹt mãi ở một bản ghi.
      if (!isResolvable(detectPlatform(row.sourceUrl))) {
        skipped.push({ sourceUrl: row.sourceUrl, reason: "Nền tảng chưa hỗ trợ tải tự động" });
        continue;
      }

      try {
        const resolved = await resolveVideo(row.sourceUrl);
        items.push({
          id: row.id,
          sourceUrl: row.sourceUrl,
          topic: row.topic,
          title: row.title || resolved.title,
          platform: resolved.platform,
          filename: resolved.filename,
          downloadUrl: resolved.best.url,
          quality: resolved.best.label,
        });
      } catch (err) {
        // Video riêng tư, đã gỡ, hoặc fdown.vn đổi cấu trúc: ghi lại rồi thử
        // bản ghi kế tiếp. Không đụng vào DB — người dùng có thể muốn thử lại
        // sau, và xoá bản ghi là quyết định của họ.
        skipped.push({
          sourceUrl: row.sourceUrl,
          reason: err instanceof ResolveError ? err.message : "Không giải được link",
        });
      }
    }

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      /** Còn bao nhiêu bản ghi chờ chưa nằm trong lượt này. */
      remaining: Math.max(0, pending.length - items.length - skipped.length),
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Video pending error:", error);
    return NextResponse.json({ success: false, error: message, items: [] }, { status: 500 });
  }
}
