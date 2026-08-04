require('dotenv').config();
const { google } = require('googleapis');
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });
drive.files.list({
  q: "'15eiMHfvceCn9XscFshzZ14G9Mf5U1v2E' in parents",
  fields: 'files(id, name)'
}).then(res => console.log(res.data.files)).catch(console.error);
