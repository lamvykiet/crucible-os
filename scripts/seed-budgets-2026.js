/**
 * Tạo ngân sách tháng cho cả năm 2026.
 *
 * Vì sao là ngân sách THÁNG chứ không phải NĂM: API dashboard chỉ đọc
 * `budget.findMany({ period: "YYYY-MM" })` rồi lọc `periodType === "monthly"`
 * (src/app/api/finance/dashboard/route.ts). Ngân sách năm sẽ không hiện ở đâu cả
 * cho tới khi phần đó được bổ sung.
 *
 * Số tiền dưới đây là TẠM TÍNH — sửa trực tiếp trong bảng BUDGETS rồi chạy lại
 * với --overwrite để cập nhật. Script bỏ qua dòng đã có sẵn nếu không có cờ đó,
 * nên ngân sách bạn tự đặt tay sẽ không bị ghi đè.
 *
 *   node scripts/seed-budgets-2026.js            # xem trước, không ghi gì
 *   node scripts/seed-budgets-2026.js --apply    # ghi vào DB
 *   node scripts/seed-budgets-2026.js --apply --overwrite
 *   node scripts/seed-budgets-2026.js --undo     # xoá đúng các dòng script này tạo
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const YEAR = '2026';
const MARKER = '[seed-2026]';

// monthly: số tiền mỗi tháng (VND). basis: căn cứ, để bạn biết con số nào đáng tin.
const BUDGETS = [
  { group: 'Groceries',         monthly: 1_000_000, basis: 'chi thực tế 2026: 314k–1.713k/tháng' },
  { group: 'Housing',           monthly: 1_000_000, basis: 'chi thực tế 2026: 426k–1.142k/tháng' },
  { group: 'Food & Dining',     monthly:   700_000, basis: 'chi thực tế 2026: 339k–657k/tháng' },
  { group: 'Transportation',    monthly:   500_000, basis: 'chỉ có 1 giao dịch 400k, độ tin cậy thấp' },
  { group: 'Personal',          monthly:   400_000, basis: 'chi thực tế 2026: 355k và 378k' },
  { group: 'Bills & Utilities', monthly:   500_000, basis: 'CHƯA có lịch sử — điện, nước, internet, 5G' },
  { group: 'Shopping',          monthly:   500_000, basis: 'CHƯA có lịch sử' },
  { group: 'Entertainment',     monthly:   300_000, basis: 'CHƯA có lịch sử' },
  { group: 'Health & Fitness',  monthly:   300_000, basis: 'CHƯA có lịch sử' },
  { group: 'Assets & Equipment', monthly: 2_000_000, basis: 'CHƯA có lịch sử — 24tr/năm cho thiết bị, chi giật cục' },
];

const months = Array.from({ length: 12 }, (_, i) => `${YEAR}-${String(i + 1).padStart(2, '0')}`);
const fmt = (n) => n.toLocaleString('vi-VN') + ' ₫';

(async () => {
  const apply = process.argv.includes('--apply');
  const overwrite = process.argv.includes('--overwrite');
  const undo = process.argv.includes('--undo');

  const user = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!user) throw new Error('Không tìm thấy user nào trong DB');
  console.log(`User: ${user.email}\n`);

  if (undo) {
    const doomed = await prisma.budget.findMany({
      where: { userId: user.id, period: { startsWith: YEAR }, notes: { contains: MARKER } },
    });
    console.log(`Sẽ xoá ${doomed.length} dòng do script tạo (dòng bạn tự đặt tay không bị đụng).`);
    if (apply) {
      const r = await prisma.budget.deleteMany({
        where: { userId: user.id, period: { startsWith: YEAR }, notes: { contains: MARKER } },
      });
      console.log(`Đã xoá ${r.count} dòng.`);
    } else {
      console.log('Thêm --apply để thực sự xoá.');
    }
    return;
  }

  const existing = await prisma.budget.findMany({
    where: { userId: user.id, period: { startsWith: YEAR } },
  });
  const seen = new Map(existing.map((b) => [`${b.period}|${b.categoryGroup}`, b]));

  let created = 0, updated = 0, kept = 0;
  for (const row of BUDGETS) {
    for (const period of months) {
      const key = `${period}|${row.group}`;
      const hit = seen.get(key);
      const notes = `${MARKER} tạm tính — ${row.basis}`;

      if (hit) {
        const mine = (hit.notes || '').includes(MARKER);
        if (overwrite && mine) {
          if (apply) await prisma.budget.update({ where: { id: hit.id }, data: { amount: row.monthly, notes } });
          updated++;
        } else {
          kept++;
        }
        continue;
      }
      if (apply) {
        await prisma.budget.create({
          data: { periodType: 'monthly', period, categoryGroup: row.group, amount: row.monthly, notes, userId: user.id },
        });
      }
      created++;
    }
  }

  const total = BUDGETS.reduce((s, b) => s + b.monthly, 0);
  console.log('Ngân sách tháng dự kiến:');
  BUDGETS.forEach((b) => console.log(`  ${b.group.padEnd(20)} ${fmt(b.monthly).padStart(14)}   ${b.basis}`));
  console.log(`  ${'TỔNG'.padEnd(20)} ${fmt(total).padStart(14)}   → ${fmt(total * 12)}/năm\n`);
  console.log(`Tạo mới: ${created} dòng | Cập nhật: ${updated} | Giữ nguyên (đã có sẵn): ${kept}`);
  if (!apply) console.log('\nĐây mới là xem trước. Thêm --apply để ghi vào DB.');
})().catch((e) => { console.error('LỖI:', e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
