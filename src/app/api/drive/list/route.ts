import { NextResponse } from "next/server";
import { google } from "googleapis";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId') || process.env.GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3000"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Fetch PDF files and Folders
    const query = `'${folderId}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.google-apps.folder') and trashed=false`;
    
    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType, modifiedTime, webViewLink, thumbnailLink)",
      pageSize: 100,
      orderBy: "folder, modifiedTime desc", // Folders first, then by date
    });

    return NextResponse.json({ files: response.data.files || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files";
    console.error("Drive list error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
