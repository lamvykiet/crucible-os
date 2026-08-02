/**
 * Chuyển toàn bộ dữ liệu từ một User.id sai (ví dụ 'user_123' do import_finance.js
 * đời cũ tạo ra) sang UUID thật của Supabase Auth.
 *
 * Vì sao cần: `auth.getUser()` trả về UUID, nên mọi truy vấn `where: { userId }`
 * sẽ không khớp bản ghi nào chừng nào Prisma.User.id còn là 'user_123'.
 * Dashboard sẽ hiện 0 đồng dù DB đầy dữ liệu.
 *
 * Lấy UUID ở đâu: Supabase Dashboard > Authentication > Users > cột User UID.
 *
 * MẶC ĐỊNH LÀ CHẠY THỬ. Phải thêm --apply mới thực sự ghi.
 *
 *   node scripts/fix-user-id.js --from user_123 --to <uuid>
 *   node scripts/fix-user-id.js --from user_123 --to <uuid> --apply
 *
 * Nên chạy /api/backup/export để sao lưu JSON trước khi --apply.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const FROM = arg('from');
const TO = arg('to');
const APPLY = process.argv.includes('--apply');

// Mọi bảng có khoá ngoại trỏ tới User.
const CHILD_MODELS = [
  'transaction',
  'category',
  'budget',
  'material',
  'dictionaryItem',
  'flashcard',
];

async function main() {
  if (!FROM || !TO) {
    console.error('Cách dùng: node scripts/fix-user-id.js --from <id cũ> --to <uuid mới> [--apply]');
    process.exitCode = 1;
    return;
  }
  if (!UUID_RE.test(TO)) {
    console.error(`--to phải là UUID Supabase Auth hợp lệ. Nhận được: ${TO}`);
    process.exitCode = 1;
    return;
  }
  if (FROM === TO) {
    console.error('--from và --to giống nhau, không có gì để làm.');
    process.exitCode = 1;
    return;
  }

  const oldUser = await prisma.user.findUnique({ where: { id: FROM } });
  if (!oldUser) {
    console.error(`Không tìm thấy user có id = ${FROM}`);
    process.exitCode = 1;
    return;
  }
  const existingTarget = await prisma.user.findUnique({ where: { id: TO } });

  // Đếm số bản ghi sẽ bị ảnh hưởng.
  const counts = {};
  for (const model of CHILD_MODELS) {
    counts[model] = await prisma[model].count({ where: { userId: FROM } });
  }

  console.log('\n=== KẾ HOẠCH ===');
  console.log(`  Từ : ${oldUser.id}  (${oldUser.email}, ${oldUser.displayName})`);
  console.log(`  Sang: ${TO}${existingTarget ? `  (đã tồn tại: ${existingTarget.email})` : '  (sẽ tạo mới)'}`);
  console.log('\n  Số bản ghi sẽ chuyển:');
  let total = 0;
  for (const [model, n] of Object.entries(counts)) {
    console.log(`    ${model.padEnd(16)} : ${n}`);
    total += n;
  }
  console.log(`    ${'TỔNG'.padEnd(16)} : ${total}`);

  if (!APPLY) {
    console.log('\n[CHẠY THỬ] Chưa ghi gì cả. Thêm --apply để thực hiện.');
    console.log('Nhớ sao lưu trước: mở /api/backup/export khi đang đăng nhập.\n');
    return;
  }

  console.log('\n[ĐANG GHI] ...');
  await prisma.$transaction(async (tx) => {
    if (!existingTarget) {
      // `email` là @unique nên không thể tồn tại hai bản ghi cùng email. Đổi
      // tạm email của bản ghi cũ để chỗ trống cho bản ghi mới.
      await tx.user.update({
        where: { id: FROM },
        data: { email: `${oldUser.email}.migrating` },
      });
      await tx.user.create({
        data: {
          id: TO,
          email: oldUser.email,
          displayName: oldUser.displayName,
          role: oldUser.role,
        },
      });
    }

    for (const model of CHILD_MODELS) {
      const res = await tx[model].updateMany({
        where: { userId: FROM },
        data: { userId: TO },
      });
      console.log(`  ${model.padEnd(16)} : chuyển ${res.count}`);
    }

    await tx.user.delete({ where: { id: FROM } });
  });

  console.log('\n✅ Xong. Chạy lại `node scripts/diagnose-users.js` để kiểm tra.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Lỗi:', e.message);
    console.error('Transaction đã rollback, dữ liệu không thay đổi.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
