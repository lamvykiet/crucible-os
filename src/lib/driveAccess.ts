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

export const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Loại tệp không phải tài liệu — không bao giờ hiện trong danh sách nguồn. */
const NON_DOCUMENT_MIMES = [
  "application/vnd.google-apps.script",
  "application/vnd.google-apps.shortcut",
  "application/vnd.google-apps.form",
];

export interface FlatFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  modifiedTime?: string | null;
  webViewLink?: string | null;
  thumbnailLink?: string | null;
  /** Đường dẫn thư mục cha, ví dụ "CFA / 6. Fixed Income". Rỗng nếu nằm ngay gốc. */
  path: string;
}

/**
 * Liệt kê toàn bộ tài liệu trong một cây thư mục, trả về danh sách phẳng.
 *
 * Tài liệu thật của người dùng nằm sâu ba cấp (Finance / CFA / 6. Fixed Income /
 * file.pdf). Panel Nguồn chỉ liệt kê con trực tiếp và lại vô hiệu hoá các thư
 * mục, nên mở không gian học một lĩnh vực chỉ thấy vài thư mục bấm không được —
 * không có đường nào chạm tới file. Một danh sách nguồn phẳng cũng đúng với
 * cách người ta dùng nó: chọn tài liệu để hỏi, không phải duyệt ổ đĩa.
 *
 * Duyệt theo từng tầng và có trần độ sâu để một cây bất thường không kéo dài vô
 * hạn.
 */
export async function listFilesRecursive(
  drive: drive_v3.Drive,
  rootId: string,
  { maxDepth = 4, maxFiles = 500 }: { maxDepth?: number; maxFiles?: number } = {}
): Promise<FlatFile[]> {
  const files: FlatFile[] = [];
  let frontier: Array<{ id: string; path: string }> = [{ id: rootId, path: "" }];

  const excluded = NON_DOCUMENT_MIMES.map((m) => `mimeType != '${m}'`).join(" and ");

  for (let depth = 0; depth < maxDepth && frontier.length > 0 && files.length < maxFiles; depth++) {
    const next: Array<{ id: string; path: string }> = [];

    const pages = await Promise.all(
      frontier.map(async (node) => {
        try {
          const res = await drive.files.list({
            q: `'${node.id}' in parents and trashed = false and ${excluded}`,
            fields: "files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink)",
            pageSize: 200,
            orderBy: "folder, name",
          });
          return { node, items: res.data.files ?? [] };
        } catch {
          // Một thư mục con không đọc được không nên làm hỏng cả danh sách.
          return { node, items: [] };
        }
      })
    );

    for (const { node, items } of pages) {
      for (const f of items) {
        if (!f.id) continue;
        if (f.mimeType === FOLDER_MIME) {
          next.push({ id: f.id, path: node.path ? `${node.path} / ${f.name}` : f.name || "" });
        } else if (files.length < maxFiles) {
          files.push({
            id: f.id,
            name: f.name || "(không tên)",
            mimeType: f.mimeType || "application/octet-stream",
            size: f.size ?? null,
            modifiedTime: f.modifiedTime ?? null,
            webViewLink: f.webViewLink ?? null,
            thumbnailLink: f.thumbnailLink ?? null,
            path: node.path,
          });
        }
      }
    }

    frontier = next;
  }

  return files;
}
