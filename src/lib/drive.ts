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

export const FOLDER_NAMES = {
  INCOMING: "Incoming_Invoices",
  REVIEW: "Review_Invoices",
  PROCESSING: "Processing_Invoices",
  APPROVED: "Approved_Invoices",
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


