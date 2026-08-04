import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDriveClient, INVOICE_ROOT_FOLDER_ID, getOrCreateFolderIds, moveFile, uploadToDrive } from "@/lib/drive";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { driveFileIds, formData, items } = body;

    if (!driveFileIds || driveFileIds.length === 0) {
      return NextResponse.json({ error: "Missing driveFileIds" }, { status: 400 });
    }

    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);

    // 1. Save JSON draft
    const draftData = { formData, items, driveFileIds };
    const jsonBuffer = Buffer.from(JSON.stringify(draftData), "utf-8");
    await uploadToDrive(
      drive, 
      jsonBuffer, 
      "application/json", 
      `draft_${driveFileIds[0]}.json`, 
      folderIds.REVIEW
    );

    // 2. Move images to REVIEW
    for (const id of driveFileIds) {
      try {
         const fileMeta = await drive.files.get({ fileId: id, fields: "parents" });
         if (fileMeta.data.parents && fileMeta.data.parents.length > 0) {
           await moveFile(drive, id, fileMeta.data.parents[0], folderIds.REVIEW);
         }
      } catch (e) {
         console.error("Failed to move file to Review:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Save draft error:", error);
    return NextResponse.json({ error: error.message || "Failed to save draft" }, { status: 500 });
  }
}
