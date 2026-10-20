import { NextResponse, after } from "next/server";
import { isValidHttpUrl, detectPlatform, videoRootId } from "@/lib/videoLibrary";
import { isResolvable } from "@/lib/videoResolver";
import { enqueueVideo, saveVideoToDrive, videoOwnerId } from "@/lib/videoQueue";
import { extractShareUrl, readShareTicket, videoTokenProblem } from "@/lib/videoShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Phần tải về Drive chạy trong `after()` và dùng chung trần thời gian này.
export const maxDuration = 60;

/**
 * POST /api/video/share  { ticket, topic, subTopic, title }
 *
 * Nút Lưu của trang `/video-share` — form mở từ Shortcut "Gửi vào Crucible"
 * (nút Chia sẻ trong TikTok / Facebook). Ghi link vào hàng đợi — CÙNG `enqueueVideo` với ô dán link trên
 * web, nên chia sẻ lại một video đã có thì cập nhật đề tài chứ không nhân bản.
 *
 * Trả lời ngay, rồi tải video về Drive ở nền bằng `saveVideoToDrive` — cùng
 * hàm với nút "tải ngay" trên web. Tải hỏng (video riêng tư, quá 150MB, quá 60
 * giây) thì bản ghi vẫn nằm ở trạng thái chờ, bấm tải lại trên web hoặc chạy
 * Shortcut "Crucible" đều được. Link không bao giờ mất vì bước tải.
 *
 * Xác thực bằng MỘT trong hai: vé của trang (`ticket` — link lấy từ vé, bỏ qua
 * `sourceUrl` trong body), hoặc `VIDEO_UPLOAD_TOKEN` trong header cho script và
 * Shortcut tự dựng muốn ghi thẳng `{ sourceUrl, topic, … }`.
 *
 * Luôn có `message` — câu trang hiện ra sau khi lưu, kể cả khi lỗi.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  let sourceUrl: string | null;
  if (body?.ticket !== undefined) {
    sourceUrl = readShareTicket(body.ticket);
    if (!sourceUrl) return reply(false, "Phiên chia sẻ đã hết hạn — bấm Chia sẻ lại từ TikTok/Facebook.", 401);
  } else {
    const problem = videoTokenProblem(req);
    if (problem) return reply(false, problem.error, problem.status);
    sourceUrl = extractShareUrl(body?.sourceUrl);
  }

  const topic = String(body?.topic ?? "").trim();
  const subTopic = String(body?.subTopic ?? "").trim() || null;
  const title = String(body?.title ?? "").trim() || null;

  if (!sourceUrl || !isValidHttpUrl(sourceUrl)) return reply(false, "Link không hợp lệ.", 400);
  if (!topic) return reply(false, "Chưa chọn đề tài.", 400);

  try {
    const userId = await videoOwnerId();
    if (!userId) return reply(false, "Chưa có tài khoản nào trong hệ thống.", 503);

    const { item, duplicate } = await enqueueVideo(userId, { sourceUrl, topic, subTopic, title });

    const where = subTopic ? `${topic} › ${subTopic}` : topic;
    if (item.status === "saved") {
      // File đã nằm trên Drive; đổi đề tài chỉ đổi nhãn trong app, không dời file.
      return reply(true, `Video này đã có trong thư viện — đã cập nhật vào «${where}».`, 200, item.id);
    }

    const autoFetch = Boolean(videoRootId()) && isResolvable(detectPlatform(sourceUrl));
    if (autoFetch) {
      after(async () => {
        try {
          await saveVideoToDrive(item);
        } catch (error) {
          // Không có ai để báo nữa — Shortcut đã nhận trả lời. Bản ghi vẫn chờ,
          // web hiện nó ở mục chờ tải với nút tải lại.
          console.error("Video share auto-fetch error:", error);
        }
      });
    }

    const head = duplicate ? `Đã cập nhật «${where}».` : `Đã lưu vào «${where}».`;
    const tail = autoFetch
      ? " Đang tải về Drive."
      : " Nền tảng này chưa tải tự động — video nằm ở mục chờ.";
    return reply(true, head + tail, 200, item.id);
  } catch (error) {
    console.error("Video share error:", error);
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    return reply(false, `Không lưu được: ${message}`, 500);
  }
}

function reply(success: boolean, message: string, status: number, itemId?: string) {
  return NextResponse.json(
    { success, message, ...(success ? {} : { error: message }), ...(itemId ? { itemId } : {}) },
    { status }
  );
}
