/**
 * Chuẩn hoá Transaction.date về đúng UTC midnight.
 *
 * Vì sao cần: import_finance.js đời cũ ghi thẳng giá trị mà `xlsx` trả về. Kết
 * quả là cả 74 dòng hiện có đều mang cùng mốc 16:59:30Z — tức 23:59:30 giờ VN
 * của NGÀY HÔM TRƯỚC so với ngày thật trên bảng tính (artifact làm tròn serial
 * number của Excel).
 *
 * Hiện chưa gây sai tháng vì các ngày rơi vào giữa tháng (25–27), nhưng một
 * giao dịch ngày mùng 1 sẽ bị đẩy sang tháng trước và làm sai toàn bộ báo cáo.
 *
 * Cách sửa: đọc mốc thời gian theo giờ VN (UTC+7), cộng bù 1 phút để vượt qua
 * ranh giới nửa đêm, lấy Y/M/D rồi ghi lại ở UTC midnight.
 *
 * MẶC ĐỊNH LÀ CHẠY THỬ. Phải thêm --apply mới thực sự ghi.
 *
 *   node scripts/normalize-dates.js
 *   node scripts/normalize-dates.js --apply
 *
 * Nên chạy /api/backup/export để sao lưu JSON trước khi --apply.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const TZ_OFFSET_HOURS = Number(process.env.APP_TZ_OFFSET_HOURS ?? 7);

function normalize(date) {
  // Đưa về giờ tường VN, cộng bù 1 phút để 23:59:30 vượt sang ngày kế tiếp.
  const shifted = new Date(
    date.getTime() + TZ_OFFSET_HOURS * 3600 * 1000 + 60 * 1000
  );
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate()
    )
  );
}

async function main() {
  const txs = await prisma.transaction.findMany({
    select: { id: true, date: true, supplier: true, totalAmount: true },
    orderBy: { date: 'asc' },
  });

  const changes = [];
  for (const t of txs) {
    const next = normalize(t.date);
    if (next.getTime() !== t.date.getTime()) {
      changes.push({ id: t.id, from: t.date, to: next, supplier: t.supplier });
    }
  }

  console.log(`\nMúi giờ dùng để diễn giải: UTC+${TZ_OFFSET_HOURS}`);
  console.log(`Tổng số Transaction : ${txs.length}`);
  console.log(`Cần chuẩn hoá       : ${changes.length}\n`);

  if (changes.length === 0) {
    console.log('Không có gì để sửa.\n');
    return;
  }

  console.log('=== 15 thay đổi đầu tiên ===');
  for (const c of changes.slice(0, 15)) {
    const monthMoved =
      c.from.toISOString().slice(0, 7) !== c.to.toISOString().slice(0, 7);
    console.log(
      `  ${c.from.toISOString()}  →  ${c.to.toISOString()}` +
        (monthMoved ? '   <-- ĐỔI THÁNG' : '')
    );
  }

  const monthMovers = changes.filter(
    (c) => c.from.toISOString().slice(0, 7) !== c.to.toISOString().slice(0, 7)
  );
  if (monthMovers.length > 0) {
    console.log(
      `\n  Cảnh báo: ${monthMovers.length} giao dịch sẽ chuyển sang tháng khác.`
    );
    console.log('  Số liệu tổng hợp của các tháng đó sẽ thay đổi.');
  }

  if (!APPLY) {
    console.log('\n[CHẠY THỬ] Chưa ghi gì cả. Thêm --apply để thực hiện.');
    console.log('Nhớ sao lưu trước: mở /api/backup/export khi đang đăng nhập.\n');
    return;
  }

  console.log('\n[ĐANG GHI] ...');
  await prisma.$transaction(
    changes.map((c) =>
      prisma.transaction.update({
        where: { id: c.id },
        data: { date: c.to },
      })
    )
  );
  console.log(`✅ Đã cập nhật ${changes.length} giao dịch.\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ Lỗi:', e.message);
    console.error('Transaction đã rollback, dữ liệu không thay đổi.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
