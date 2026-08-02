import { NextResponse } from "next/server";
import { getDriveClient, deleteFile } from "@/lib/drive";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { driveFileIds } = body;

    if (!driveFileIds || !Array.isArray(driveFileIds)) {
      return NextResponse.json({ success: false, error: "Missing driveFileIds" }, { status: 400 });
    }

    const drive = getDriveClient();
    for (const id of driveFileIds) {
      await deleteFile(drive, id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete drive files:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
