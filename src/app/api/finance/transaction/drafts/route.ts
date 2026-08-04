import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDriveClient, INVOICE_ROOT_FOLDER_ID, getOrCreateFolderIds, listFilesInFolder } from "@/lib/drive";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
    
    const files = await listFilesInFolder(drive, folderIds.REVIEW);
    const jsonFiles = files.filter(f => f.name?.startsWith("draft_") && f.name?.endsWith(".json"));

    const drafts = [];

    for (const file of jsonFiles) {
      if (!file.id) continue;
      try {
        const fileRes = await drive.files.get({
          fileId: file.id,
          alt: "media"
        }, { responseType: 'stream' });

        const chunks: Buffer[] = [];
        for await (const chunk of fileRes.data as any) {
          chunks.push(Buffer.from(chunk));
        }
        const jsonString = Buffer.concat(chunks).toString("utf-8");
        const draftData = JSON.parse(jsonString);
        drafts.push({
          draftFileId: file.id,
          data: draftData
        });
      } catch (e) {
        console.error("Failed to read draft file", file.name, e);
      }
    }

    return NextResponse.json({ success: true, count: drafts.length, drafts });
  } catch (error: any) {
    console.error("List drafts error:", error);
    return NextResponse.json({ error: error.message || "Failed to list drafts" }, { status: 500 });
  }
}
