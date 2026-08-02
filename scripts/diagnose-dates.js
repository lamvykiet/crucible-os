/**
 * Chẩn đoán chỉ-đọc: phân bố ngày của Transaction + kiểm tra lệch timezone khi import.
 * KHÔNG ghi gì vào DB.
 *
 *   node scripts/diagnose-dates.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function fmt(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

async function main() {
  const txs = await prisma.transaction.findMany({
    orderBy: { date: 'asc' },
    select: { id: true, date: true, type: true, totalAmount: true, supplier: true },
  });

  console.log('\n=== 10 giao dịch đầu (raw UTC vs giờ VN UTC+7) ===');
  for (const t of txs.slice(0, 10)) {
    const utc = t.date.toISOString();
    const vn = new Date(t.date.getTime() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    console.log(`  ${utc}  →  VN ${vn}  | ${t.type.padEnd(8)} ${fmt(t.totalAmount).padStart(18)}`);
  }

  // Phần giờ:phút:giây có đồng nhất không? Nếu tất cả là 16:59:30Z thì
  // đây là dấu hiệu lệch timezone lúc import, không phải giờ giao dịch thật.
  const timeOfDay = new Map();
  for (const t of txs) {
    const key = t.date.toISOString().slice(11, 19);
    timeOfDay.set(key, (timeOfDay.get(key) || 0) + 1);
  }
  console.log('\n=== Phân bố phần GIỜ (UTC) của Transaction.date ===');
  for (const [k, v] of [...timeOfDay.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}Z : ${v} giao dịch`);
  }
  if (timeOfDay.size === 1) {
    console.log('  → Chỉ 1 giá trị giờ duy nhất: đây là artifact của import, KHÔNG phải giờ thật.');
  }

  // Gom theo tháng, so sánh cách hiểu UTC vs giờ VN.
  // Nếu 2 cột lệch nhau, ranh giới tháng đang bị tính sai.
  const byMonthUtc = new Map();
  const byMonthVn = new Map();
  for (const t of txs) {
    const mUtc = t.date.toISOString().slice(0, 7);
    const mVn = new Date(t.date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 7);
    byMonthUtc.set(mUtc, (byMonthUtc.get(mUtc) || 0) + 1);
    byMonthVn.set(mVn, (byMonthVn.get(mVn) || 0) + 1);
  }

  const allMonths = [...new Set([...byMonthUtc.keys(), ...byMonthVn.keys()])].sort();
  console.log('\n=== Số giao dịch theo tháng: hiểu theo UTC vs hiểu theo giờ VN ===');
  console.log('  Tháng      UTC   VN(+7)   lệch');
  let anyDrift = false;
  for (const m of allMonths) {
    const a = byMonthUtc.get(m) || 0;
    const b = byMonthVn.get(m) || 0;
    const flag = a !== b ? '  <-- LỆCH' : '';
    if (a !== b) anyDrift = true;
    console.log(`  ${m}   ${String(a).padStart(3)}   ${String(b).padStart(3)}   ${flag}`);
  }
  console.log(anyDrift
    ? '\n  → Ranh giới tháng phụ thuộc timezone. Dashboard sẽ ra số khác nhau tuỳ nơi deploy.'
    : '\n  → Không có giao dịch nào nằm sát ranh giới tháng (hiện tại).');

  // Tháng mà UI mặc định mở
  const DEFAULT_MONTH = '2026-08';
  const inDefault = txs.filter((t) => t.date.toISOString().slice(0, 7) === DEFAULT_MONTH);
  console.log(`\n=== Tháng UI mở mặc định (${DEFAULT_MONTH}) ===`);
  console.log(`  ${inDefault.length} giao dịch`);
  if (inDefault.length === 0) {
    console.log('  → Dashboard mở ra là 0 đồng, KHÔNG PHẢI do lỗi code mà do tháng này chưa có dữ liệu.');
  }

  await prisma.$disconnect();
  console.log('');
}

main().catch((e) => {
  console.error('Lỗi:', e.message);
  process.exitCode = 1;
});
