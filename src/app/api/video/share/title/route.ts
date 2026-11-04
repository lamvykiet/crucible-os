import { NextResponse } from "next/server";
import { detectPlatform } from "@/lib/videoLibrary";
import { isResolvable, resolveVideo } from "@/lib/videoResolver";
import { cleanVideoTitle, readShareTicket } from "@/lib/videoShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Chờ bộ giải link tối đa ngần này. tikwm.com thường mất khoảng 1 giây,
 * fdown.vn (Facebook, hoặc dự phòng cho TikTok) 3–5 giây; quá lâu
 * thì thà để trống ô tiêu đề cho người dùng gõ.
 */
const TITLE_TIMEOUT_MS = 12000;

/**
 * GET /api/video/share/title?t=<vé>
 *
 * Tiêu đề video đã bỏ hashtag — chính là phần mô tả dưới video TikTok
 * ("We don't know if we wake up tomorrow #LearnOnTikTok…" → bỏ phần #).
 *
 * Tách khỏi `/form` vì nó chậm: trang hiện form ngay, ô tiêu đề tự điền khi
 * route này trả về.
 *
 * Nguồn là `resolveVideo` — cùng hàm luồng tải dùng: TikTok qua tikwm.com
 * (fdown.vn bị Cloudflare chặn từ khoảng 01/11/2026), Facebook qua fdown.vn nên
 * hiện thường rỗng. TikTok oEmbed không còn trả `title` (đo 20/10/2026).
 */
export async function GET(req: Request) {
  const sourceUrl = readShareTicket(new URL(req.url).searchParams.get("t"));
  if (!sourceUrl) return NextResponse.json({ success: false, title: "" }, { status: 401 });
  if (!isResolvable(detectPlatform(sourceUrl))) return NextResponse.json({ success: true, title: "" });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), TITLE_TIMEOUT_MS);
    });
    const resolved = await Promise.race([resolveVideo(sourceUrl), timeout]);
    return NextResponse.json({ success: true, title: cleanVideoTitle(resolved?.title) ?? "" });
  } catch {
    // Video riêng tư, đã gỡ, bộ giải link trục trặc — vẫn lưu link được, chỉ thiếu
    // tiêu đề gợi ý.
    return NextResponse.json({ success: true, title: "" });
  } finally {
    clearTimeout(timer);
  }
}
