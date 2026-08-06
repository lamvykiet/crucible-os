import { google, drive_v3 } from "googleapis";

/**
 * Tiện ích dùng chung cho thư viện video.
 *
 * Ứng dụng không tự tải video — xem ghi chú trên model `VideoItem`. Ở đây chỉ
 * có phần nhận diện nền tảng từ link và xếp file vào đúng thư mục đề tài.
 */

export const VIDEO_PLATFORMS = ["tiktok", "facebook", "youtube", "instagram", "other"] as const;
export type VideoPlatform = (typeof VIDEO_PLATFORMS)[number];

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  instagram: "Instagram",
  other: "Khác",
};

/** Đoán nền tảng từ tên miền. Link rút gọn (vt.tiktok.com, fb.watch) cũng bắt được. */
export function detectPlatform(url: string): VideoPlatform {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }

  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("facebook.com") || host === "fb.watch" || host.includes("fb.com")) return "facebook";
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  if (host.includes("instagram.com")) return "instagram";
  return "other";
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function driveClient(): drive_v3.Drive {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3000"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oauth2Client });
}

export function videoRootId(): string | null {
  return process.env.GOOGLE_DRIVE_VIDEO_FOLDER_ID || null;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Thư mục đề tài; tạo mới nếu chưa có để đề tài lạ không làm hỏng lượt upload. */
export async function ensureTopicFolder(
  drive: drive_v3.Drive,
  rootId: string,
  topic: string
): Promise<string> {
  const safe = topic.replace(/'/g, "\\'");
  const found = await drive.files.list({
    q: `'${rootId}' in parents and name = '${safe}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id)",
  });
  if (found.data.files?.length) return found.data.files[0].id!;

  const created = await drive.files.create({
    requestBody: { name: topic, mimeType: FOLDER_MIME, parents: [rootId] },
    fields: "id",
  });
  return created.data.id!;
}

/** Danh sách đề tài = các thư mục con của thư mục video. */
export async function listTopics(drive: drive_v3.Drive, rootId: string) {
  const res = await drive.files.list({
    q: `'${rootId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name)",
    orderBy: "name",
    pageSize: 200,
  });
  return (res.data.files ?? []).map((f) => ({ id: f.id!, name: f.name || "(không tên)" }));
}

/**
 * Tên file an toàn cho Drive, có ngày ở đầu để sắp xếp theo thời gian.
 * Ví dụ: `2026-08-06 · Nấu ăn · cach-lam-banh-mi.mp4`
 */
export function buildFileName(topic: string, title: string | null, fallbackExt = "mp4"): string {
  const date = new Date().toISOString().slice(0, 10);
  const base = (title || "video")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const hasExt = /\.[a-z0-9]{2,4}$/i.test(base);
  return `${date} · ${topic} · ${base}${hasExt ? "" : "." + fallbackExt}`;
}
