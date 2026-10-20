import { Readable } from "node:stream";
import type { VideoItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildFileName, detectPlatform, driveClient, ensureTopicFolder, listTopics,
  normalizeSubTopic, videoRootId,
} from "@/lib/videoLibrary";
import { isResolvable, resolveVideo } from "@/lib/videoResolver";
import { cleanVideoTitle } from "@/lib/videoShare";

/**
 * Hàng đợi video — phần dùng chung giữa giao diện web (`/api/video/queue`,
 * `/api/video/fetch`) và Shortcut chia sẻ (`/api/video/share`).
 *
 * Hai đường ghi cùng một bảng nên phải đi qua cùng một hàm: nếu Shortcut tự viết
 * bản riêng thì luật gộp nhãn con hay "dán lại link thì cập nhật" chỉ đúng ở một
 * đầu, và thư viện vỡ thành hai bộ nhãn.
 */

/**
 * Chủ sở hữu cho các route xác thực bằng token (Shortcut không có phiên đăng nhập).
 *
 * Ưu tiên `BOT_USER_ID` — bot ghi chi tiêu cũng dựa vào nó; chưa đặt thì lấy
 * người dùng đầu tiên, đúng như `/api/video/upload` vẫn làm.
 */
export async function videoOwnerId(): Promise<string | null> {
  if (process.env.BOT_USER_ID) return process.env.BOT_USER_ID;
  const owner = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  return owner?.id ?? null;
}

/**
 * Các nhãn con đã từng dùng, gom theo đề tài.
 *
 * Đọc toàn bộ lịch sử chứ không chỉ 200 mục hiện ra ở danh sách: nhãn gõ từ
 * nửa năm trước vẫn phải gợi ý lại được, nếu không mỗi lần gõ lại đẻ một biến
 * thể mới và bộ lọc vỡ vụn.
 */
export async function subTopicsByTopic(userId: string): Promise<Record<string, string[]>> {
  const rows = await prisma.videoItem.findMany({
    where: { userId, NOT: { subTopic: null } },
    select: { topic: true, subTopic: true },
    distinct: ["topic", "subTopic"],
    orderBy: { subTopic: "asc" },
  });

  const grouped: Record<string, string[]> = {};
  for (const row of rows) {
    if (!row.subTopic) continue;
    (grouped[row.topic] ??= []).push(row.subTopic);
  }
  return grouped;
}

/**
 * Nhãn con của một đề tài, nhãn dùng gần nhất lên đầu.
 *
 * Trên điện thoại danh sách là một popup cuộn bằng ngón tay: lưu video thường
 * đi thành cụm cùng một nhãn, nên nhãn vừa dùng nằm đầu là đỡ cuộn nhất.
 */
export async function recentSubTopics(userId: string, topic: string): Promise<string[]> {
  const rows = await prisma.videoItem.findMany({
    where: { userId, topic, NOT: { subTopic: null } },
    select: { subTopic: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return [...new Set(rows.map((r) => r.subTopic!))];
}

/**
 * Tên đề tài để chọn — đọc từ thư mục Drive, như ô chọn trên web.
 *
 * Drive lỗi hoặc chưa cấu hình thì lùi về đề tài đã dùng trong DB, rồi tới
 * "Khác": "Choose from List" của Shortcuts gặp danh sách rỗng là báo lỗi và
 * dừng hẳn, người dùng mất luôn link vừa chia sẻ.
 */
export async function topicNames(userId: string): Promise<string[]> {
  const root = videoRootId();
  if (root) {
    try {
      const topics = await listTopics(driveClient(), root);
      if (topics.length > 0) return topics.map((t) => t.name);
    } catch (error) {
      console.error("Không đọc được đề tài từ Drive:", error);
    }
  }
  const used = await prisma.videoItem.findMany({
    where: { userId },
    select: { topic: true },
    distinct: ["topic"],
    orderBy: { topic: "asc" },
  });
  return used.length > 0 ? used.map((u) => u.topic) : ["Khác"];
}

/**
 * Gộp nhãn chỉ khác nhau hoa thường hoặc dấu cách về đúng một biến thể đã có.
 *
 * Không có bước này thì "Mẫu in", "mẫu in" và "Mẫu  in" thành ba nhãn riêng,
 * và bộ lọc theo nhãn con — thứ duy nhất khiến tính năng này có ích — chia đôi
 * cùng một đống video.
 */
export async function canonicalSubTopic(
  userId: string,
  topic: string,
  raw: unknown
): Promise<string | null> {
  const value = normalizeSubTopic(raw);
  if (!value) return null;

  const seen = await prisma.videoItem.findFirst({
    where: { userId, topic, subTopic: { equals: value, mode: "insensitive" } },
    select: { subTopic: true },
    orderBy: { createdAt: "asc" },
  });
  return seen?.subTopic ?? value;
}

export interface EnqueueInput {
  sourceUrl: string;
  topic: string;
  subTopic?: unknown;
  title?: string | null;
  note?: string | null;
}

/**
 * Đưa một link vào hàng đợi.
 *
 * Dán lại đúng link đã có thì cập nhật đề tài thay vì đẻ thêm bản ghi —
 * chuyện này xảy ra suốt khi lướt lại một video đã lưu.
 */
export async function enqueueVideo(
  userId: string,
  input: EnqueueInput
): Promise<{ item: VideoItem; duplicate: boolean }> {
  const { sourceUrl, topic } = input;
  const title = input.title?.trim() || null;
  const note = input.note?.trim() || null;

  const existing = await prisma.videoItem.findFirst({ where: { userId, sourceUrl } });
  const subTopic = await canonicalSubTopic(userId, topic, input.subTopic);

  if (existing) {
    const item = await prisma.videoItem.update({
      where: { id: existing.id },
      data: {
        topic,
        // Dán lại mà bỏ trống nhãn con thì giữ nhãn cũ, đừng xoá nó đi.
        subTopic: subTopic ?? existing.subTopic,
        title: title || existing.title,
        note: note || existing.note,
      },
    });
    return { item, duplicate: true };
  }

  const item = await prisma.videoItem.create({
    data: {
      sourceUrl,
      platform: detectPlatform(sourceUrl),
      topic,
      subTopic,
      title,
      note,
      status: "pending",
      userId,
    },
  });
  return { item, duplicate: false };
}

/**
 * Trần kích thước của luồng server tự tải.
 *
 * Thấp hơn mức 200MB của /api/video/upload: ở đó file đã nằm sẵn trên điện
 * thoại, còn ở đây server phải vừa tải xuống vừa đẩy lên trong cùng 60 giây.
 */
export const FETCH_MAX_BYTES = 150 * 1024 * 1024;

/** Lỗi kèm mã HTTP để route trả thẳng ra, còn luồng chạy nền chỉ ghi log. */
export class VideoFetchError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "VideoFetchError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Tải một video pending về Drive — toàn bộ làm ở server, không cần điện thoại.
 *
 * Vì sao trước đây không làm thế này: ghi chú cũ trong dự án nói app không tự
 * tải được vì Vercel "không cài được yt-dlp, filesystem chỉ đọc, giới hạn 60
 * giây". Hai lý do đầu đã hết hiệu lực — fdown.vn trả link .mp4 trực tiếp nên
 * không cần yt-dlp, và luồng dưới đây đi thẳng từ bộ nhớ lên Drive nên không
 * đụng filesystem. Lý do thứ ba thì đo được: một video 32MB tải mất 2,1 giây.
 *
 * Giới hạn thật sự còn lại là FETCH_MAX_BYTES và trần 60 giây. Video quá lớn
 * hoặc mạng chậm sẽ chạm trần — lúc đó mới cần tới Shortcut và /api/video/pending.
 *
 * Ném `ResolveError` (fdown.vn hỏng) hoặc `VideoFetchError` (mọi thứ còn lại).
 */
export async function saveVideoToDrive(item: VideoItem) {
  const root = videoRootId();
  if (!root) {
    throw new VideoFetchError("Chưa cấu hình GOOGLE_DRIVE_VIDEO_FOLDER_ID", 503);
  }
  if (item.status === "saved") {
    throw new VideoFetchError("Video này đã lưu rồi", 409);
  }
  if (!isResolvable(detectPlatform(item.sourceUrl))) {
    throw new VideoFetchError("Chỉ tải tự động được Facebook và TikTok", 400);
  }

  const resolved = await resolveVideo(item.sourceUrl);

  const fileRes = await fetch(resolved.best.url, { redirect: "follow", cache: "no-store" });
  if (!fileRes.ok) {
    throw new VideoFetchError(`Không tải được video (HTTP ${fileRes.status})`, 502);
  }

  // Chặn theo Content-Length trước khi đọc, để một video khổng lồ không kịp
  // ngốn hết bộ nhớ function rồi mới bị từ chối.
  const declared = Number(fileRes.headers.get("content-length") || 0);
  if (declared > FETCH_MAX_BYTES) {
    throw new VideoFetchError(
      `Video ${Math.round(declared / 1024 / 1024)}MB, vượt trần ${FETCH_MAX_BYTES / 1024 / 1024}MB của luồng tự động.`,
      413
    );
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  if (buffer.length === 0) throw new VideoFetchError("Tệp rỗng", 502);
  // Kiểm lại sau khi tải: không phải server nào cũng gửi Content-Length.
  if (buffer.length > FETCH_MAX_BYTES) {
    throw new VideoFetchError(`Video vượt trần ${FETCH_MAX_BYTES / 1024 / 1024}MB.`, 413);
  }

  // Tiêu đề fdown.vn là mô tả nguyên văn, kèm cả đuôi hashtag — bỏ đi trước
  // khi nó thành tên file trên Drive.
  const title = item.title || cleanVideoTitle(resolved.title);

  const drive = driveClient();
  const folderId = await ensureTopicFolder(drive, root, item.topic);

  const created = await drive.files.create({
    requestBody: {
      name: buildFileName(item.topic, title || resolved.title),
      parents: [folderId],
      // Thư viện video đọc link gốc từ đây, nên mở file trong Drive vẫn biết
      // nó đến từ đâu mà không cần tra lại app.
      description: item.sourceUrl,
    },
    media: { mimeType: "video/mp4", body: Readable.from(buffer) },
    fields: "id, name, size",
  });

  const updated = await prisma.videoItem.update({
    where: { id: item.id },
    data: {
      status: "saved",
      driveFileId: created.data.id,
      driveFileName: created.data.name,
      sizeBytes: buffer.length,
      savedAt: new Date(),
      title: title || resolved.title,
    },
  });

  return { item: updated, quality: resolved.best.label, sizeBytes: buffer.length };
}
