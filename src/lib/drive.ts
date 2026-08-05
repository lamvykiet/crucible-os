import { google, drive_v3 } from "googleapis";

export function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3000"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

export const INVOICE_ROOT_FOLDER_ID = "15eiMHfvceCn9XscFshzZ14G9Mf5U1v2E";

// Sáu thư mục này là bản sao cấu trúc Expense_OCR_System của dự án "Sổ Chi Tiêu"
// trước đây. ERROR và TRASH trước đây thiếu, nên ảnh OCR hỏng nằm kẹt vĩnh viễn
// ở Incoming, còn ảnh bị coi là trùng thì bị `files.delete` xoá thẳng.
export const FOLDER_NAMES = {
  INCOMING: "Incoming_Invoices",
  REVIEW: "Review_Invoices",
  PROCESSING: "Processing_Invoices",
  APPROVED: "Approved_Invoices",
  ERROR: "Error_Invoices",
  TRASH: "Trash_Invoices",
};

/**
 * Ensures the required subfolders exist under the root folder and returns their IDs.
 */
export async function getOrCreateFolderIds(drive: drive_v3.Drive, rootId: string) {
  const res = await drive.files.list({
    q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
  });

  const existingFolders = res.data.files || [];
  const folderIds: Record<string, string> = {};

  for (const [key, name] of Object.entries(FOLDER_NAMES)) {
    const found = existingFolders.find(f => f.name === name);
    if (found && found.id) {
      folderIds[key] = found.id;
    } else {
      // Create it
      const created = await drive.files.create({
        requestBody: {
          name: name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [rootId],
        },
        fields: "id",
      });
      folderIds[key] = created.data.id!;
    }
  }

  return folderIds;
}

export async function uploadToDrive(drive: drive_v3.Drive, buffer: Buffer, mimeType: string, filename: string, folderId: string) {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType,
      body: stream,
    },
    fields: "id",
  });

  return res.data.id;
}

export async function moveFile(drive: drive_v3.Drive, fileId: string, fromFolderId: string, toFolderId: string) {
  await drive.files.update({
    fileId: fileId,
    addParents: toFolderId,
    removeParents: fromFolderId,
    fields: "id, parents",
  });
}

/**
 * Chuyển file sang thư mục đích mà không cần biết trước nó đang nằm ở đâu.
 *
 * Mọi nơi gọi `moveFile` đều phải tự `files.get` lấy `parents` rồi truyền
 * `parents[0]` vào — lặp lại ở 5 chỗ, và sai khi file có nhiều thư mục cha
 * (Drive cho phép) vì chỉ gỡ đúng một cha, file vẫn hiện ở chỗ cũ. Hàm này gỡ
 * toàn bộ cha hiện tại.
 *
 * Trả về false nếu không chuyển được — nơi gọi tự quyết định coi đó là lỗi hay
 * không, thay vì nuốt ngoại lệ trong im lặng.
 */
export async function moveFileTo(drive: drive_v3.Drive, fileId: string, toFolderId: string): Promise<boolean> {
  try {
    const meta = await drive.files.get({ fileId, fields: "parents" });
    const parents = meta.data.parents ?? [];

    if (parents.length === 1 && parents[0] === toFolderId) return true;

    await drive.files.update({
      fileId,
      addParents: toFolderId,
      removeParents: parents.join(","),
      fields: "id, parents",
    });
    return true;
  } catch (error) {
    console.error(`Drive: không chuyển được file ${fileId} sang ${toFolderId}:`, error);
    return false;
  }
}

/** Chuyển nhiều file cùng lúc; luôn chạy hết danh sách kể cả khi một file lỗi. */
export async function moveFilesTo(drive: drive_v3.Drive, fileIds: string[], toFolderId: string) {
  await Promise.all(fileIds.map((id) => moveFileTo(drive, id, toFolderId)));
}

export async function deleteFile(drive: drive_v3.Drive, fileId: string) {
  try {
    await drive.files.delete({
      fileId: fileId,
    });
  } catch (error) {
    console.error("Failed to delete file from drive:", error);
  }
}

export async function listFilesInFolder(drive: drive_v3.Drive, folderId: string) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: "files(id, name, mimeType, thumbnailLink)",
  });
  return res.data.files || [];
}


