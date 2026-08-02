/**
 * Chẩn đoán chỉ-đọc: kiểm tra User.id trong Prisma có khớp Supabase Auth UUID không.
 *
 * Bối cảnh: seed_users.js gán User.id = Supabase auth UUID, còn import_finance.js
 * gán User.id = 'user_123' và dồn mọi giao dịch cho prisma.user.findFirst().
 * Nếu lệch, việc thêm `where: { userId }` vào API sẽ làm dashboard hiện 0 đồng.
 *
 * Script này KHÔNG ghi gì vào DB.
 *
 *   node scripts/diagnose-users.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// UUID v4 — định dạng Supabase Auth dùng cho auth.users.id
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmt(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

async function main() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });

  console.log('\n=== BẢNG User (Prisma) ===');
  if (users.length === 0) {
    console.log('  (trống — chưa có user nào)');
  }
  for (const u of users) {
    const looksLikeUuid = UUID_RE.test(u.id);
    const [txCount, budgetCount, catCount, materialCount, sum] = await Promise.all([
      prisma.transaction.count({ where: { userId: u.id } }),
      prisma.budget.count({ where: { userId: u.id } }),
      prisma.category.count({ where: { userId: u.id } }),
      prisma.material.count({ where: { userId: u.id } }),
      prisma.transaction.aggregate({
        where: { userId: u.id },
        _sum: { totalAmount: true },
      }),
    ]);

    console.log(`\n  ${looksLikeUuid ? '[OK]  ' : '[LỆCH]'} id = ${u.id}`);
    console.log(`         email       : ${u.email}`);
    console.log(`         displayName : ${u.displayName}  (role: ${u.role})`);
    console.log(`         id là UUID? : ${looksLikeUuid ? 'CÓ — khớp định dạng Supabase Auth' : 'KHÔNG — sẽ không khớp auth.getUser()'}`);
    console.log(`         Transaction : ${txCount}  (tổng ${fmt(sum._sum.totalAmount || 0)})`);
    console.log(`         Budget      : ${budgetCount}`);
    console.log(`         Category    : ${catCount}`);
    console.log(`         Material    : ${materialCount}`);
  }

  // Bản ghi mồ côi: userId trong Transaction không tồn tại trong User
  const knownIds = new Set(users.map((u) => u.id));
  const txGroups = await prisma.transaction.groupBy({
    by: ['userId'],
    _count: { _all: true },
  });

  const orphans = txGroups.filter((g) => !knownIds.has(g.userId));
  console.log('\n=== Giao dịch mồ côi (userId không có trong bảng User) ===');
  if (orphans.length === 0) {
    console.log('  Không có.');
  } else {
    for (const o of orphans) {
      console.log(`  [LỖI] userId = ${o.userId} — ${o._count._all} giao dịch`);
    }
  }

  // Phân bố ngày để kiểm tra biên timezone
  const range = await prisma.transaction.aggregate({
    _min: { date: true },
    _max: { date: true },
    _count: { _all: true },
  });
  console.log('\n=== Phạm vi dữ liệu Transaction ===');
  console.log(`  Tổng số     : ${range._count._all}`);
  console.log(`  Ngày sớm nhất: ${range._min.date ? range._min.date.toISOString() : '—'}`);
  console.log(`  Ngày muộn nhất: ${range._max.date ? range._max.date.toISOString() : '—'}`);

  // Các giá trị `type` thực tế trong DB — để biết Refund/Transfer có xuất hiện không
  const types = await prisma.transaction.groupBy({
    by: ['type'],
    _count: { _all: true },
  });
  console.log('\n=== Các giá trị Transaction.type có thật trong DB ===');
  for (const t of types) {
    console.log(`  ${String(t.type).padEnd(12)} : ${t._count._all}`);
  }

  // Budget period — kiểm tra định dạng YYYY-MM mà dashboard sẽ query
  const budgets = await prisma.budget.groupBy({
    by: ['period', 'periodType'],
    _count: { _all: true },
  });
  console.log('\n=== Budget theo period ===');
  if (budgets.length === 0) {
    console.log('  (trống — BvA sẽ không có gì để so sánh)');
  }
  for (const b of budgets) {
    console.log(`  period="${b.period}"  periodType="${b.periodType}"  → ${b._count._all} dòng`);
  }

  console.log('\n=== KẾT LUẬN ===');
  const bad = users.filter((u) => !UUID_RE.test(u.id));
  if (bad.length > 0) {
    console.log(`  CẦN REMAP: ${bad.length} user có id không phải UUID → ${bad.map((u) => u.id).join(', ')}`);
    console.log('  Thêm where:{userId} vào API sẽ làm các user này thấy 0 đồng.');
  } else if (users.length === 0) {
    console.log('  DB chưa có user nào. Cần chạy seed trước.');
  } else {
    console.log('  Tất cả User.id đều đúng định dạng UUID — an toàn để thêm scoping theo userId.');
    console.log('  (Vẫn cần đối chiếu thủ công với danh sách auth.users trên Supabase Dashboard.)');
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error('\nLỗi khi chẩn đoán:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
