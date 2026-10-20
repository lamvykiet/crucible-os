import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Phần thuần của luồng "Chia sẻ → Crucible" (Shortcut trên iPhone).
 *
 * Chỉ dựa vào `node:crypto` — để chạy thử được bằng `node` trơn mà không cần
 * dựng cả Prisma lẫn Google Drive.
 */

/** Tiêu đề fdown.vn tự đặt khi video không có mô tả — không phải tiêu đề thật. */
const PLACEHOLDER_TITLES = new Set(["tiktok video", "facebook video"]);

/**
 * Tiêu đề video, bỏ hashtag.
 *
 * Mô tả TikTok/Facebook thường là một câu kèm đuôi "#fyp #xuhuong #3dprint…" —
 * đuôi đó vô nghĩa khi làm tên file trên Drive và chiếm hết chỗ trên ô nhập ở
 * điện thoại. Giữ nguyên emoji và @tên: người dùng chỉ yêu cầu bỏ phần #.
 *
 * Trả `null` khi không còn gì đáng giữ, để Shortcut hiện ô trống thay vì chữ
 * "TikTok video" mà người dùng phải xoá tay.
 */
export function cleanVideoTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    // \p{M}: tiếng Việt gõ kiểu tổ hợp tách dấu thành ký tự riêng (#xuhướng).
    .replace(/[#＃]+[\p{L}\p{N}\p{M}_]*/gu, " ")
    .replace(/\s+/g, " ")
    // Hashtag đứng cuối thường để lại dấu nối mồ côi: "Mẹo in 3D - #fyp".
    .replace(/[\s\-–—|·•:,]+$/u, "")
    .replace(/^[\s\-–—|·•:,]+/u, "")
    .trim()
    .slice(0, 150)
    .trim();
  if (!text || PLACEHOLDER_TITLES.has(text.toLowerCase())) return null;
  return text;
}

/**
 * Tham số theo dõi mà TikTok/Facebook gắn vào MỖI lần bấm chia sẻ.
 *
 * Không bỏ chúng thì cùng một video chia sẻ hai lần thành hai link khác nhau,
 * và bước "dán lại link đã có thì cập nhật" của hàng đợi không bao giờ khớp.
 */
const TRACKING_PARAMS = [
  "_t", "_r", "is_from_webapp", "sender_device", "sender_web_id", "share_app_id",
  "share_link_id", "social_sharing", "u_code", "timestamp", "user_id", "sec_uid",
  "mibextid", "rdid", "share_url", "sfnsn", "igsh", "igshid", "si", "fbclid",
];

/**
 * Lấy link đầu tiên trong thứ Share Sheet đưa sang.
 *
 * Có app đưa đúng một URL, có app đưa cả đoạn chữ "Xem video này… https://…".
 * Shortcut đã chạy "Get URLs from Input", nhưng server vẫn tự tách — dựng tay
 * thiếu bước đó thì luồng vẫn chạy.
 */
export function extractShareUrl(input: unknown): string | null {
  const match = String(input ?? "").match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;

  let url: URL;
  try {
    url = new URL(match[0].replace(/[).,;!?]+$/, ""));
  } catch {
    return null;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.includes(key) || key.startsWith("utm_")) url.searchParams.delete(key);
  }
  url.hash = "";
  return url.toString().replace(/\?$/, "");
}

/**
 * Kiểm `VIDEO_UPLOAD_TOKEN` cho các route Shortcut gọi.
 *
 * Shortcut không đăng nhập Supabase được, nên mọi route của nó dùng chung một
 * token — đúng cơ chế `/api/video/upload` và `/api/video/pending`. Nhận cả
 * `Authorization: Bearer …` lẫn `X-Upload-Token`: Shortcuts đặt header dễ sai.
 *
 * Trả `null` khi hợp lệ, ngược lại trả mã HTTP và câu lỗi để route trả thẳng.
 */
export function videoTokenProblem(req: Request): { status: number; error: string } | null {
  const expected = process.env.VIDEO_UPLOAD_TOKEN;
  if (!expected) return { status: 503, error: "Máy chủ chưa cấu hình VIDEO_UPLOAD_TOKEN" };
  const token =
    req.headers.get("x-upload-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return token === expected ? null : { status: 401, error: "Token không đúng" };
}

/**
 * Vé mở trang `/video-share` — form lưu video hiện ngay trên TikTok.
 *
 * Vì sao không dùng phiên đăng nhập: Shortcut mở trang bằng "Show Web Page"
 * (SFSafariViewController), mà từ iOS 11 nó KHÔNG dùng chung cookie với Safari
 * — người dùng sẽ thấy trang đăng nhập mỗi lần chia sẻ. Còn đưa
 * `VIDEO_UPLOAD_TOKEN` vào URL thì token nằm trong lịch sử trình duyệt.
 *
 * Nên Shortcut đổi token lấy một vé: HMAC bằng chính token đó, gắn chặt với
 * MỘT link và hết hạn sau một giờ. Lộ vé thì người khác chỉ lưu được đúng video
 * đó vào thư viện, trong một giờ.
 */
const TICKET_TTL_MS = 60 * 60 * 1000;

function ticketSignature(secret: string, payload: string): Buffer {
  return createHmac("sha256", secret).update(`video-share:${payload}`).digest();
}

export function signShareTicket(sourceUrl: string, now = Date.now()): string | null {
  const secret = process.env.VIDEO_UPLOAD_TOKEN;
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ u: sourceUrl, e: now + TICKET_TTL_MS })).toString("base64url");
  return `${payload}.${ticketSignature(secret, payload).toString("base64url")}`;
}

/** Link mà vé cho phép lưu, hoặc `null` nếu vé sai chữ ký / hết hạn / hỏng. */
export function readShareTicket(ticket: unknown, now = Date.now()): string | null {
  const secret = process.env.VIDEO_UPLOAD_TOKEN;
  if (!secret || typeof ticket !== "string") return null;
  const [payload, sig] = ticket.split(".");
  if (!payload || !sig) return null;

  const expected = ticketSignature(secret, payload);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data?.u !== "string" || typeof data?.e !== "number" || data.e < now) return null;
    return data.u;
  } catch {
    return null;
  }
}
