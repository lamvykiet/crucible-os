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

  const rootId = "15eiMHfvceCn9XscFshzZ14G9Mf5U1v2E";
  const res = await drive.files.list({
    q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
  });
  console.log(res.data.files);
}

main();
