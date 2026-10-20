import { NextResponse } from "next/server";
import { detectPlatform } from "@/lib/videoLibrary";
import { isResolvable, resolveVideo } from "@/lib/videoResolver";
import { cleanVideoTitle, readShareTicket } from "@/lib/videoShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Chờ fdown.vn tối đa ngần này. Lượt giải link thường mất 3–5 giây; quá lâu
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
 * TikTok oEmbed từng trả `title` nhưng nay không còn (đo 20/10/2026), nên dùng
 * chính fdown.vn mà luồng tải đang dùng. Nền tảng khác thì để người dùng gõ.
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
    // Video riêng tư, đã gỡ, fdown.vn trục trặc — vẫn lưu link được, chỉ thiếu
    // tiêu đề gợi ý.
    return NextResponse.json({ success: true, title: "" });
  } finally {
    clearTimeout(timer);
  }
}
