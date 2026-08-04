import { NextResponse } from "next/server";
import { getDriveClient, INVOICE_ROOT_FOLDER_ID, getOrCreateFolderIds, listFilesInFolder } from "@/lib/drive";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
    
    const files = await listFilesInFolder(drive, folderIds.REVIEW);
    const jsonFiles = files.filter(f => f.name?.startsWith("draft_") && f.name?.endsWith(".json"));
    
    return NextResponse.json({ success: true, count: jsonFiles.length, files: jsonFiles });
  } catch (error) {
    console.error("Failed to list pending files:", error);
    return NextResponse.json({ success: false, error: "Server Error", count: 0 }, { status: 500 });
  }
}
