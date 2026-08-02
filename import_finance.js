require('dotenv').config();
const { google } = require('googleapis');
const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Cấu hình qua biến môi trường thay vì viết cứng trong source.
const SPREADSHEET_ID = process.env.FINANCE_SHEET_ID;
const IMPORT_USER_ID = process.env.IMPORT_USER_ID;

/**
 * Chuẩn hoá ngày về đúng UTC midnight.
 *
 * Bản cũ để nguyên giá trị mà `xlsx` trả về. Kết quả là cả 74 dòng trong DB đều
 * mang cùng một mốc giờ 16:59:30Z — tức 23:59:30 giờ VN của NGÀY HÔM TRƯỚC so
 * với ngày thật trên bảng tính (artifact làm tròn serial number của Excel).
 * Hiện tại chưa gây sai tháng vì các ngày rơi vào giữa tháng, nhưng một giao
 * dịch ngày mùng 1 sẽ bị đẩy sang tháng trước.
 */
function toUtcDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    // Serial Excel (hệ 1900), mốc 0 là 1899-12-30. Ngày thuần là số nguyên nên
    // phép nhân này ra đúng UTC midnight.
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
  }

  if (value instanceof Date) {
    // `cellDates: true` trả về Date theo giờ máy, thường lệch ~30 giây trước
    // nửa đêm. Cộng bù 1 phút rồi lấy Y/M/D theo giờ máy và dựng lại ở UTC.
    const d = new Date(value.getTime() + 60 * 1000);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  );
}

async function importData() {
  if (!SPREADSHEET_ID) {
    console.error('Thiếu FINANCE_SHEET_ID trong .env');
    process.exitCode = 1;
    return;
  }
  if (!IMPORT_USER_ID) {
    console.error('Thiếu IMPORT_USER_ID.');
    console.error('Đây phải là UUID Supabase Auth của người sở hữu dữ liệu.');
    console.error('Chạy `node scripts/diagnose-users.js` để xem các user hiện có.');
    console.error('Ví dụ:  IMPORT_USER_ID="<uuid>" node import_finance.js');
    process.exitCode = 1;
    return;
  }

  try {
    // Người sở hữu phải tồn tại sẵn. Bản cũ dùng `prisma.user.findFirst()` —
    // tức là dồn toàn bộ dữ liệu tài chính cho BẤT KỲ user nào nằm đầu bảng,
    // và tự tạo user 'user_123' với id không phải UUID nếu bảng rỗng. Chính
    // chỗ này đã làm Prisma.User.id lệch khỏi Supabase Auth.
    const user = await prisma.user.findUnique({ where: { id: IMPORT_USER_ID } });
    if (!user) {
      console.error(`Không tìm thấy user có id = ${IMPORT_USER_ID}`);
      console.error('Chạy `node seed_users.js` trước để tạo user.');
      process.exitCode = 1;
      return;
    }
    console.log(`Importing dữ liệu cho: ${user.displayName} <${user.email}> (${user.id})`);

    console.log('Fetching Google Sheet...');
    const res = await drive.files.export({
      fileId: SPREADSHEET_ID,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }, { responseType: 'arraybuffer' });

    const workbook = xlsx.read(res.data, { type: 'buffer', cellDates: true });

    // IMPORT CATEGORIES
    if (workbook.SheetNames.includes('Categories')) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets['Categories']);
      console.log(`Importing ${rows.length} Categories...`);
      for (const row of rows) {
        const data = {
          kind: row.kind || 'unknown',
          name: row.name || 'Unknown',
          active: row.active === 'TRUE' || row.active === true,
          userId: user.id
        };
        // `update` có nội dung thật, nên chạy lại script sẽ đồng bộ được thay
        // đổi từ Google Sheet. Bản cũ dùng `update: {}` nên lần chạy thứ hai
        // im lặng bỏ qua mọi chỉnh sửa.
        await prisma.category.upsert({
          where: { id: String(row.category_id) },
          update: data,
          create: { id: String(row.category_id), ...data }
        });
      }
    }

    // IMPORT BUDGETS
    if (workbook.SheetNames.includes('Budgets')) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets['Budgets']);
      console.log(`Importing ${rows.length} Budgets...`);
      for (const row of rows) {
        let period = String(row.period);
        if (row.period instanceof Date) {
          period = row.period.toISOString().substring(0, 7); // YYYY-MM
        }
        const data = {
          periodType: row.period_type,
          period: period,
          categoryGroup: row.expense_group,
          amount: Number(row.amount) || 0,
          userId: user.id
        };
        await prisma.budget.upsert({
          where: { id: String(row.budget_id) },
          update: data,
          create: { id: String(row.budget_id), ...data }
        });
      }
    }

    // IMPORT RECEIPTS & ITEMS
    if (workbook.SheetNames.includes('Receipts') && workbook.SheetNames.includes('Receipt_Items')) {
      const receipts = xlsx.utils.sheet_to_json(workbook.Sheets['Receipts']);
      const items = xlsx.utils.sheet_to_json(workbook.Sheets['Receipt_Items']);

      console.log(`Importing ${receipts.length} Receipts and ${items.length} Items...`);

      let skipped = 0;
      for (const r of receipts) {
        const rDate = toUtcDate(r.receipt_date);
        if (!rDate) {
          console.warn(`  Bỏ qua receipt ${r.receipt_id}: không đọc được receipt_date (${r.receipt_date})`);
          skipped++;
          continue;
        }

        const rItems = items.filter(i => String(i.receipt_id) === String(r.receipt_id));

        const data = {
          date: rDate,
          supplier: r.supplier || 'Unknown',
          type: r.transaction_type || 'Expense',
          categoryGroup: r.expense_group || 'Other',
          subtotal: Number(r.subtotal) || 0,
          discount: Number(r.discount) || 0,
          totalAmount: Number(r.total_amount) || 0,
          paymentMethod: r.payment_method || 'unknown',
          source: r.source || 'manual',
          driveFileId: r.drive_file_id || null,
          notes: r.notes || null,
          userId: user.id
        };

        await prisma.transaction.upsert({
          where: { id: String(r.receipt_id) },
          update: {
            ...data,
            // Dòng chi tiết được thay mới hoàn toàn — nếu không, chạy lại sẽ
            // nhân đôi các dòng item.
            items: {
              deleteMany: {},
              create: rItems.map(i => ({
                id: String(i.item_id),
                productName: i.product_name,
                quantity: Number(i.quantity) || 1,
                unitPrice: Number(i.unit_price) || 0,
                totalPrice: Number(i.total_price) || 0
              }))
            }
          },
          create: {
            id: String(r.receipt_id),
            ...data,
            items: {
              create: rItems.map(i => ({
                id: String(i.item_id),
                productName: i.product_name,
                quantity: Number(i.quantity) || 1,
                unitPrice: Number(i.unit_price) || 0,
                totalPrice: Number(i.total_price) || 0
              }))
            }
          }
        });
      }
      if (skipped > 0) console.warn(`Đã bỏ qua ${skipped} receipt do lỗi ngày tháng.`);
    }

    console.log('✅ Import completed successfully!');

  } catch (error) {
    console.error('❌ Error during import:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

importData();
