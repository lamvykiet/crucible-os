require('dotenv').config();
const { google } = require('googleapis');
const xlsx = require('xlsx');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET
);

oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function main() {
  const spreadsheetId = '1Rq5VVMBVWThxqSfFOAMQdIus638onAeHm44fWZqZso0';
  
  try {
    const res = await drive.files.export({
      fileId: spreadsheetId,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }, { responseType: 'arraybuffer' });
    
    const workbook = xlsx.read(res.data, { type: 'buffer' });
    
    console.log('Available tabs:', workbook.SheetNames);
    
    // Preview important tabs
    const tabs = ['Categories', 'Budgets', 'Receipts', 'Receipt_Items'];
    for (const tab of tabs) {
      if (workbook.SheetNames.includes(tab)) {
        const sheet = workbook.Sheets[tab];
        const json = xlsx.utils.sheet_to_json(sheet).slice(0, 2);
        console.log(`\nPreview of ${tab}:`);
        console.table(json);
      }
    }
  } catch (error) {
    console.error('Error fetching sheet:', error.message);
  }
}

main();
