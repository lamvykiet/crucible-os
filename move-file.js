const { google } = require('googleapis');
require('dotenv').config();

async function main() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3000"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const fileId = "1JWkRyOX9mGX6o3PtStCgPIP0bu0ghJWn"; // image_1783354204726.jpg
  const fromFolderId = "13BnOY4iikvTFrTgDudJhx1lrxzbPXm2g"; // Review_Invoices
  const toFolderId = "1z6CyjIJUyvzYjVF08GGC3xeiBpwC4yhQ"; // Incoming_Invoices

  try {
    await drive.files.update({
      fileId: fileId,
      addParents: toFolderId,
      removeParents: fromFolderId,
      fields: "id, parents",
    });
    console.log("Moved file to Incoming_Invoices successfully!");
  } catch(e) {
    console.error("Error moving file:", e.message);
  }
}

main();
