import { NextResponse } from "next/server";
import { isValidHttpUrl } from "@/lib/videoLibrary";
import { extractShareUrl, signShareTicket, videoTokenProblem } from "@/lib/videoShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/video/share/prepare  { "url": "<thứ Share Sheet đưa sang>" }
 *
 * Bước duy nhất Shortcut "Gửi vào Crucible" gọi: đổi `VIDEO_UPLOAD_TOKEN` lấy
 * `formUrl` — trang `/video-share` kèm vé ký sẵn cho đúng link này (xem
 * `signShareTicket`). Shortcut mở `formUrl` bằng "Show Web Page" là xong việc
 * của nó; chọn đề tài, nhãn con, tiêu đề đều làm trên trang đó, giống ô "Lưu
 * một video" trên web.
 *
 * Phải trả lời NHANH: không lấy tiêu đề ở đây (fdown.vn mất 3–5 giây) — trang
 * tự gọi `/api/video/share/title` sau khi đã hiện form.
 *
 * Lỗi cũng trả `formUrl`, trỏ tới trang báo lỗi. Nhờ vậy Shortcut không cần
 * khối "If" nào — khối đó dựng sai một chút là cả Shortcut hỏng.
 */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const fail = (error: string, status: number) =>
    NextResponse.json(
      { success: false, error, formUrl: `${origin}/video-share?error=${encodeURIComponent(error)}` },
      { status }
    );

  const problem = videoTokenProblem(req);
  if (problem) return fail(problem.error, problem.status);

  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const sourceUrl = extractShareUrl(body?.url);
  if (!sourceUrl || !isValidHttpUrl(sourceUrl)) {
    return fail("Không thấy link video trong nội dung vừa chia sẻ.", 400);
  }

  const ticket = signShareTicket(sourceUrl);
  if (!ticket) return fail("Máy chủ chưa cấu hình VIDEO_UPLOAD_TOKEN", 503);

  return NextResponse.json({
    success: true,
    sourceUrl,
    formUrl: `${origin}/video-share?t=${encodeURIComponent(ticket)}`,
  });
}
