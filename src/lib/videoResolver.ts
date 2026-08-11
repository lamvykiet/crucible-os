import { detectPlatform, type VideoPlatform } from "@/lib/videoLibrary";

/**
 * Đổi link Facebook / TikTok thành link tải trực tiếp.
 *
 * Mắt xích còn thiếu của luồng video: `/api/video/queue` giữ link trang web,
 * `/api/video/upload` nhận file có sẵn — nhưng giữa hai đầu đó không có gì
 * biến link thành file. Tải thẳng link trang chỉ nhận về `text/html`, không
 * phải video.
 *
 * Việc giải link làm ở server chứ không ở Shortcut, vì Shortcut không đọc được
 * cookie nên không tự làm được vòng bắt tay CSRF của fdown.vn. Server chỉ
 * resolve — vài KB, vài trăm ms; việc tải mấy chục MB vẫn do điện thoại làm,
 * nên Vercel free vẫn chịu được.
 *
 * Giao thức fdown.vn (Laravel):
 *   1. GET trang tương ứng  → cookie `fdown-session` + <meta name="csrf-token">
 *   2. POST {url} kèm header X-CSRF-TOKEN + cookie đó
 *   3. Trả {success, html} — HTML chứa các thẻ <a> trỏ tới /media/stream/...
 *   4. Link /media/stream 302 sang dl.fdown.vn, KHÔNG cần cookie và trả
 *      `Content-Disposition: attachment`, nên tải thẳng được.
 *
 * Đây là API nội bộ của fdown.vn, không có tài liệu và có thể đổi bất cứ lúc
 * nào. Mọi thứ dễ vỡ gom hết vào file này để chỉ phải sửa một chỗ.
 */

const ORIGIN = "https://fdown.vn";

/** UA iPhone — fdown trả markup giống hệt, nhưng đỡ bị chặn hơn UA mặc định. */
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/** Nền tảng fdown.vn tải được. Các nền tảng khác trong queue phải làm tay. */
export type ResolvablePlatform = Extract<VideoPlatform, "facebook" | "tiktok">;

export function isResolvable(platform: VideoPlatform): platform is ResolvablePlatform {
  return platform === "facebook" || platform === "tiktok";
}

export interface VideoOption {
  /** Nhãn gốc fdown trả về, ví dụ "720p (HD)" hoặc "MP4 HD (không logo)". */
  label: string;
  /** Link tải trực tiếp, dùng được ngay, không cần cookie. */
  url: string;
  hd: boolean;
  /** Chỉ có nghĩa với TikTok. */
  noWatermark: boolean;
}

export interface ResolvedVideo {
  platform: ResolvablePlatform;
  sourceUrl: string;
  title: string;
  author: string | null;
  /** Đã sắp xếp: bản tốt nhất nằm đầu, để bên gọi chỉ cần lấy phần tử [0]. */
  options: VideoOption[];
  best: VideoOption;
  /** Tên file gợi ý, đã bỏ ký tự Drive không nhận. */
  filename: string;
}

export type ResolveErrorCode =
  | "UNSUPPORTED_URL"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_REJECTED"
  | "NO_OPTIONS";

export class ResolveError extends Error {
  readonly code: ResolveErrorCode;

  constructor(message: string, code: ResolveErrorCode) {
    super(message);
    this.name = "ResolveError";
    this.code = code;
  }
}

/** Cấu hình theo nền tảng — hai "luồng" khác nhau đúng ở ba dòng này. */
const ENDPOINTS: Record<
  ResolvablePlatform,
  { page: string; endpoint: string; streamPath: string }
> = {
  facebook: {
    page: `${ORIGIN}/`,
    endpoint: `${ORIGIN}/api/download`,
    streamPath: "/media/stream/",
  },
  tiktok: {
    page: `${ORIGIN}/tiktok-downloader`,
    endpoint: `${ORIGIN}/api/tiktok/download`,
    streamPath: "/media/tk-stream/",
  },
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|#38);/g, "&")
    .replace(/&(?:lt|#60);/g, "<")
    .replace(/&(?:gt|#62);/g, ">")
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:#0?39|apos|#x27);/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Lấy nội dung phần tử đầu tiên mang class đã cho. */
function pickByClass(html: string, className: string): string | null {
  const m = html.match(
    new RegExp(`class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/`, "i")
  );
  const text = m ? stripTags(m[1]) : "";
  return text || null;
}

/**
 * Bước 1–2: lấy phiên + token rồi POST.
 *
 * Laravel nhận token qua header `X-CSRF-TOKEN` khớp với session, nên đọc thẳng
 * thẻ <meta> là đủ — không cần giải mã cookie XSRF-TOKEN.
 */
async function callFdown(platform: ResolvablePlatform, url: string): Promise<string> {
  const cfg = ENDPOINTS[platform];

  let pageRes: Response;
  try {
    pageRes = await fetch(cfg.page, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
    });
  } catch (err) {
    throw new ResolveError(
      `Không kết nối được fdown.vn: ${(err as Error).message}`,
      "UPSTREAM_UNAVAILABLE"
    );
  }
  if (!pageRes.ok) {
    throw new ResolveError(
      `fdown.vn trả ${pageRes.status} khi mở trang.`,
      "UPSTREAM_UNAVAILABLE"
    );
  }

  const page = await pageRes.text();
  const token = page.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i)?.[1];
  if (!token) {
    throw new ResolveError(
      "Không tìm thấy csrf-token trên trang fdown.vn — site có thể đã đổi cấu trúc.",
      "UPSTREAM_UNAVAILABLE"
    );
  }

  // Chỉ giữ phần `name=value` của mỗi Set-Cookie.
  const cookies = pageRes.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  let apiRes: Response;
  try {
    apiRes = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-TOKEN": token,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookies,
        Referer: cfg.page,
        Origin: ORIGIN,
      },
      body: JSON.stringify({ url }),
      cache: "no-store",
    });
  } catch (err) {
    throw new ResolveError(
      `fdown.vn không phản hồi: ${(err as Error).message}`,
      "UPSTREAM_UNAVAILABLE"
    );
  }

  const payload = (await apiRes.json().catch(() => null)) as {
    success?: boolean;
    html?: string;
    message?: string;
  } | null;

  if (!payload?.success || !payload.html) {
    throw new ResolveError(
      payload?.message ||
        `fdown.vn từ chối link (HTTP ${apiRes.status}). Video có thể ở chế độ riêng tư hoặc đã bị gỡ.`,
      "UPSTREAM_REJECTED"
    );
  }
  return payload.html;
}

/** Bước 3–4: bóc các thẻ <a> tải về khỏi mẩu HTML fdown trả lại. */
function parseOptions(html: string, platform: ResolvablePlatform): VideoOption[] {
  const { streamPath } = ENDPOINTS[platform];
  const anchor = new RegExp(
    `<a\\s[^>]*href="(${ORIGIN.replace(/\//g, "\\/")}${streamPath.replace(
      /\//g,
      "\\/"
    )}[^"]+)"[^>]*>([\\s\\S]*?)<\\/a>`,
    "gi"
  );

  const seen = new Set<string>();
  const options: VideoOption[] = [];

  for (const m of html.matchAll(anchor)) {
    const url = decodeEntities(m[1]);
    if (seen.has(url)) continue;
    seen.add(url);

    // Facebook để chất lượng ở .btn__quality-mobile "(720p (HD))";
    // TikTok để ở .tk-format-row__label "MP4 HD (không logo)".
    const inner = m[2];
    const raw =
      pickByClass(inner, "btn__quality-mobile") ??
      pickByClass(inner, "tk-format-row__label") ??
      stripTags(inner);

    // Facebook bọc cả nhãn trong ngoặc: "(720p (HD))" → "720p (HD)". Chỉ bóc
    // khi có ngoặc ở CẢ hai đầu, nếu không "MP4 HD (không logo)" sẽ mất dấu
    // đóng ngoặc của nó. (Không cần cờ /s: stripTags đã gộp khoảng trắng.)
    const label = raw.replace(/^\((.*)\)$/, "$1").trim() || "MP4";

    options.push({
      label,
      url,
      hd: /\bhd\b|1080|1440|2160|2k|4k/i.test(label),
      noWatermark: platform === "tiktok" && !/có\s*logo|watermark/i.test(label),
    });
  }

  // Tốt nhất lên đầu. Với TikTok, "không logo" quan trọng hơn cả nhãn HD.
  const score = (o: VideoOption) => (o.noWatermark ? 4 : 0) + (o.hd ? 2 : 0);
  const height = (o: VideoOption) => Number(o.label.match(/(\d{3,4})p/)?.[1] ?? 0);
  options.sort((a, b) => score(b) - score(a) || height(b) - height(a));

  return options;
}

/** Bỏ ký tự Drive/iOS không nhận, rồi cắt ngắn cho tên file dễ đọc. */
function safeFilename(title: string, platform: ResolvablePlatform): string {
  const base =
    title
      .replace(/[\\/:*?"<>|#[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || (platform === "tiktok" ? "TikTok video" : "Facebook video");
  return `${base}.mp4`;
}

export async function resolveVideo(rawUrl: string): Promise<ResolvedVideo> {
  const url = rawUrl.trim();
  const platform = detectPlatform(url);

  if (!isResolvable(platform)) {
    throw new ResolveError(
      "Chỉ tải được link Facebook và TikTok. Các nền tảng khác phải lưu tay.",
      "UNSUPPORTED_URL"
    );
  }

  const html = await callFdown(platform, url);
  const options = parseOptions(html, platform);

  if (options.length === 0) {
    throw new ResolveError(
      "fdown.vn không trả về link tải nào cho video này.",
      "NO_OPTIONS"
    );
  }

  const title =
    pickByClass(html, "tk-result__title") ??
    pickByClass(html, "media-result__title") ??
    (platform === "tiktok" ? "TikTok video" : "Facebook video");

  return {
    platform,
    sourceUrl: url,
    title,
    author: pickByClass(html, "tk-result__username"),
    options,
    best: options[0],
    filename: safeFilename(title, platform),
  };
}
