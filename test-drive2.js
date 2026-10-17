require('dotenv').config();
const { google } = require('googleapis');
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });
drive.files.list({
  q: "'1z6CyjIJUyvzYjVF08GGC3xeiBpwC4yhQ' in parents or '1iRf3AmoPXvISlKsxVwVwyvvPUS6J_g_m' in parents or '13BnOY4iikvTFrTgDudJhx1lrxzbPXm2g' in parents",
  fields: 'files(id, name, parents)'
}).then(res => console.log(JSON.stringify(res.data.files, null, 2))).catch(console.error);
