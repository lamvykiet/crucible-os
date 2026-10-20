import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectPlatform, isValidHttpUrl, PLATFORM_LABELS } from "@/lib/videoLibrary";
import { isResolvable, resolveVideo } from "@/lib/videoResolver";
import { topicNames, videoOwnerId } from "@/lib/videoQueue";
import { cleanVideoTitle, extractShareUrl, videoTokenProblem } from "@/lib/videoShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Chờ fdown.vn tối đa ngần này để lấy tiêu đề.
 *
 * Người dùng đang đứng trong TikTok nhìn popup quay vòng; quá lâu thì thà để
 * trống ô tiêu đề cho họ gõ còn hơn. Lượt giải link thường mất 1–3 giây.
 */
const TITLE_TIMEOUT_MS = 8000;

/**
 * POST /api/video/share/prepare  { "url": "<thứ Share Sheet đưa sang>" }
 *
 * Bước 1 của Shortcut "Gửi vào Crucible": nhận link vừa bấm chia sẻ, trả tiêu
 * đề video (đã bỏ hashtag) và danh sách đề tài để Shortcut hiện popup.
 *
 * Route này KHÔNG ghi gì — người dùng còn có thể bấm Huỷ ở popup. Ghi là việc
 * của `POST /api/video/share`.
 *
 * Mọi trường trả về đều PHẲNG và luôn có mặt (chuỗi rỗng thay vì null): mỗi tầng
 * lồng là thêm một action "Get Dictionary Value" trong Shortcut, còn null làm
 * ô "Ask for Input" hiện chữ thừa. Lỗi thì có `error` — Shortcut chỉ kiểm đúng
 * một điều: `error` có giá trị hay không.
 */
export async function POST(req: Request) {
  const problem = videoTokenProblem(req);
  if (problem) return NextResponse.json({ success: false, error: problem.error }, { status: problem.status });

  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const sourceUrl = extractShareUrl(body?.url);
  if (!sourceUrl || !isValidHttpUrl(sourceUrl)) {
    return NextResponse.json(
      { success: false, error: "Không thấy link video trong nội dung vừa chia sẻ." },
      { status: 400 }
    );
  }

  try {
    const userId = await videoOwnerId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Chưa có tài khoản nào trong hệ thống." }, { status: 503 });
    }

    const platform = detectPlatform(sourceUrl);
    const [existing, topics, rawTitle] = await Promise.all([
      prisma.videoItem.findFirst({ where: { userId, sourceUrl } }),
      topicNames(userId),
      fetchTitle(sourceUrl),
    ]);

    // Link đã lưu trước đó: đưa đề tài cũ lên đầu danh sách và giữ tiêu đề cũ,
    // để chia sẻ lại chỉ cần bấm đồng ý qua các popup.
    const ordered = existing
      ? [existing.topic, ...topics.filter((t) => t !== existing.topic)]
      : topics;

    return NextResponse.json({
      success: true,
      sourceUrl,
      platform,
      platformLabel: PLATFORM_LABELS[platform] ?? platform,
      title: existing?.title || cleanVideoTitle(rawTitle) || "",
      topics: ordered,
      existing: existing ? (existing.status === "saved" ? "saved" : "pending") : "",
    });
  } catch (error) {
    console.error("Video share prepare error:", error);
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Tiêu đề gốc của video, hoặc null nếu không lấy được kịp.
 *
 * TikTok oEmbed từng trả `title` nhưng nay không còn (đo 20/10/2026), nên dùng
 * chính fdown.vn mà luồng tải đang dùng — nó trả mô tả video ở cả TikTok lẫn
 * Facebook. Nền tảng khác thì để người dùng tự gõ.
 */
async function fetchTitle(url: string): Promise<string | null> {
  if (!isResolvable(detectPlatform(url))) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), TITLE_TIMEOUT_MS);
    });
    const resolved = await Promise.race([resolveVideo(url), timeout]);
    return resolved?.title ?? null;
  } catch {
    // Video riêng tư, đã gỡ, fdown.vn trục trặc — vẫn lưu link được, chỉ thiếu
    // tiêu đề gợi ý.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
