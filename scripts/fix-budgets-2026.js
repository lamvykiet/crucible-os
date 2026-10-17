/**
 * Sửa hậu quả của scripts/seed-budgets-2026.js: 5 nhóm ngân sách được tạo theo
 * bản code cũ trên USB, không tồn tại trong cây `Category` đang chạy thật, nên
 * ô Ngân sách vs Thực chi hiện chúng với thực chi bằng 0 vĩnh viễn.
 *
 * Đồng thời bổ sung nhánh tài sản/thiết bị vào cây danh mục.
 *
 * Vì sao "Home Appliances" không thành con của "Assets & Equipment": bảng
 * Category chỉ có hai cấp (parentId trỏ thẳng về nhóm gốc). Đẩy Home Appliances
 * xuống làm con sẽ làm 5 mục con hiện tại của nó thành cấp ba — không lưu được.
 * Nên nhóm mới đứng ngang hàng, chỉ nhận phần Home Appliances chưa có chỗ.
 *
 * Chỉ đụng vào các dòng ngân sách mang dấu [seed-2026]; ngân sách bạn tự đặt
 * tay không bị ảnh hưởng. Chạy lại nhiều lần cho cùng một kết quả.
 *
 *   node scripts/fix-budgets-2026.js            # xem trước
 *   node scripts/fix-budgets-2026.js --apply
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const MARKER = '[seed-2026]';

// Nhóm mới cần thêm vào cây danh mục.
const NEW_GROUP = {
  name: 'Assets & Equipment',
  nameVi: 'Tài sản & thiết bị',
  children: [
    ['Work Equipment', 'Thiết bị làm việc'],      // iPad, MacBook, PC, máy in 3D
    ['Personal Devices', 'Thiết bị cá nhân'],     // điện thoại, đồng hồ
    ['Vehicle Purchase', 'Mua xe'],               // tiền mua xe; xăng/bảo dưỡng vẫn ở Transportation
  ],
};

// Đổi tên: nhóm cũ -> tên chuẩn trong cây thật.
const RENAME = {
  'Health & Fitness': 'Health',
  'Entertainment': 'Entertainment & Subscriptions',
};

// Gộp: nhóm cũ bị xoá, ngân sách nhóm đích đặt lại thành số tuyệt đối.
const MERGE = {
  'Bills & Utilities': { into: 'Housing', newAmount: 1_500_000, why: 'điện/nước/internet nằm trong Housing của cây thật' },
  'Shopping': { into: 'Personal', newAmount: 900_000, why: 'quần áo/đồ cá nhân nằm trong Personal của cây thật' },
};

(async () => {
  const user = await prisma.user.findFirst({ select: { id: true, email: true } });
  console.log(`User: ${user.email} | chế độ: ${APPLY ? 'GHI THẬT' : 'xem trước'}\n`);

  // --- 1. Nhóm danh mục mới ---
  const roots = await prisma.category.findMany({ where: { parentId: null, kind: 'expense_group' } });
  const exists = roots.find((r) => r.name === NEW_GROUP.name);
  if (exists) {
    console.log(`[danh mục] "${NEW_GROUP.name}" đã có, bỏ qua.`);
  } else {
    console.log(`[danh mục] Thêm nhóm "${NEW_GROUP.name}" (${NEW_GROUP.nameVi}) + ${NEW_GROUP.children.length} mục con:`);
    NEW_GROUP.children.forEach(([n, vi]) => console.log(`             ${n} — ${vi}`));
    if (APPLY) {
      const parentId = require('crypto').randomUUID();
      await prisma.$executeRawUnsafe(
        'INSERT INTO "Category" (id, kind, name, "nameVi", active, "parentId", "userId") VALUES ($1,$2,$3,$4,true,NULL,$5)',
        parentId, 'expense_group', NEW_GROUP.name, NEW_GROUP.nameVi, user.id
      );
      for (const [n, vi] of NEW_GROUP.children) {
        await prisma.$executeRawUnsafe(
          'INSERT INTO "Category" (id, kind, name, "nameVi", active, "parentId", "userId") VALUES ($1,$2,$3,$4,true,$5,$6)',
          require('crypto').randomUUID(), 'expense_group', n, vi, parentId, user.id
        );
      }
      console.log('             → đã thêm.');
    }
  }

  // --- 2. Đổi tên nhóm ngân sách ---
  console.log('\n[ngân sách] Đổi tên:');
  for (const [from, to] of Object.entries(RENAME)) {
    const n = await prisma.budget.count({ where: { userId: user.id, categoryGroup: from, notes: { contains: MARKER } } });
    console.log(`             ${from} -> ${to}  (${n} dòng)`);
    if (APPLY && n) {
      await prisma.budget.updateMany({
        where: { userId: user.id, categoryGroup: from, notes: { contains: MARKER } },
        data: { categoryGroup: to },
      });
    }
  }

  // --- 3. Gộp nhóm ---
  console.log('\n[ngân sách] Gộp:');
  for (const [from, cfg] of Object.entries(MERGE)) {
    const n = await prisma.budget.count({ where: { userId: user.id, categoryGroup: from, notes: { contains: MARKER } } });
    console.log(`             ${from} -> ${cfg.into}, đặt ${cfg.into} = ${cfg.newAmount.toLocaleString('vi-VN')} ₫/tháng  (${n} dòng bị xoá)`);
    console.log(`               lý do: ${cfg.why}`);
    if (APPLY) {
      await prisma.budget.updateMany({
        where: { userId: user.id, categoryGroup: cfg.into, notes: { contains: MARKER } },
        data: { amount: cfg.newAmount },
      });
      await prisma.budget.deleteMany({ where: { userId: user.id, categoryGroup: from, notes: { contains: MARKER } } });
    }
  }

  // --- 4. Đối chiếu lại ---
  const groups = await prisma.category.findMany({ where: { parentId: null, kind: 'expense_group' }, select: { name: true } });
  const valid = new Set(groups.map((g) => g.name));
  const bg = await prisma.budget.groupBy({ by: ['categoryGroup'], where: { userId: user.id, period: { startsWith: '2026' } }, _count: { _all: true }, _sum: { amount: true } });
  console.log('\n[kết quả] Ngân sách 2026 sau khi sửa:');
  bg.sort((a, b) => (b._sum.amount || 0) - (a._sum.amount || 0)).forEach((g) => {
    const ok = valid.has(g.categoryGroup) ? '✓' : '✗ KHÔNG có trong cây danh mục';
    console.log(`   ${ok} ${g.categoryGroup.padEnd(32)} ${g._count._all} dòng  ${((g._sum.amount || 0) / g._count._all).toLocaleString('vi-VN').padStart(11)} ₫/tháng`);
  });
  if (!APPLY) console.log('\nXem trước. Thêm --apply để ghi.');
  await prisma.$disconnect();
})().catch(async (e) => { console.error('LỖI:', e.message); await prisma.$disconnect(); process.exitCode = 1; });
