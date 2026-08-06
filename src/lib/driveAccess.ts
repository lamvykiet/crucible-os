import { google, drive_v3 } from "googleapis";

/**
 * Kiểm soát truy cập Google Drive.
 *
 * Ứng dụng dùng MỘT refresh token Drive dùng chung cho mọi người dùng, nên bất
 * cứ fileId nào tài khoản đó với tới được đều tải về được — kể cả file nằm
 * ngoài phạm vi module đang gọi. Mọi route đụng tới Drive vì thế đều phải hỏi
 * "file này có nằm trong cây thư mục cho phép không" trước khi đọc.
 *
 * Logic đó trước đây được chép lại trong từng route; gom về đây để chỗ nào cũng
 * xét đúng một cách.
 */

const MAX_PARENT_DEPTH = 10;

export function driveClient(): drive_v3.Drive {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3000"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oauth2Client });
}

/** Thư mục gốc của Knowledge Hub và thư viện video. KHÔNG gồm thư mục hoá đơn. */
export function knowledgeRoots(): string[] {
  return [
    process.env.GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID,
    process.env.GOOGLE_DRIVE_VIDEO_FOLDER_ID,
  ].filter((v): v is string => Boolean(v));
}

/** Lần ngược cây thư mục xem file có nằm dưới một trong các thư mục gốc không. */
export async function isWithinAllowedFolder(
  drive: drive_v3.Drive,
  fileId: string,
  parents: string[] | undefined,
  roots: string[]
): Promise<boolean> {
  if (roots.includes(fileId)) return true;

  const seen = new Set<string>([fileId]);
  let frontier = parents ?? [];

  for (let depth = 0; depth < MAX_PARENT_DEPTH && frontier.length > 0; depth++) {
    if (frontier.some((p) => roots.includes(p))) return true;

    const next: string[] = [];
    for (const parentId of frontier) {
      if (seen.has(parentId)) continue;
      seen.add(parentId);
      try {
        const meta = await drive.files.get({ fileId: parentId, fields: "id, parents" });
        next.push(...(meta.data.parents ?? []));
      } catch {
        // Thư mục cha đã xoá hoặc mất quyền — bỏ qua nhánh này.
      }
    }
    frontier = next;
  }

  return false;
}

/** Tiện ích: lấy metadata rồi kiểm tra quyền trong một lần gọi. */
export async function getAllowedFile(
  drive: drive_v3.Drive,
  fileId: string,
  roots: string[],
  fields = "id, name, mimeType, size, modifiedTime, parents"
): Promise<drive_v3.Schema$File | null> {
  const meta = await drive.files.get({ fileId, fields });
  const ok = await isWithinAllowedFolder(drive, fileId, meta.data.parents ?? undefined, roots);
  return ok ? meta.data : null;
}
