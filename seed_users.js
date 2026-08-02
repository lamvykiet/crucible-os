const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const prisma = new PrismaClient();

// Mật khẩu KHÔNG được viết cứng trong source. Bản trước để nguyên mật khẩu thật
// của 2 tài khoản trong file này.
//
//   SEED_PASSWORD=... node seed_users.js
const SEED_PASSWORD = process.env.SEED_PASSWORD;

const users = [
  {
    email: 'ruper@crucible.com',
    displayName: 'Lâm Vỹ Kiệt',
    role: 'admin'
  },
  {
    email: 'shirley@crucible.com',
    displayName: 'Trần Lý Trang Thanh',
    role: 'user'
  }
];

async function seed() {
  if (!SEED_PASSWORD) {
    console.error('Thiếu biến môi trường SEED_PASSWORD.');
    console.error('Chạy:  SEED_PASSWORD="..." node seed_users.js');
    process.exitCode = 1;
    return;
  }

  console.log('Seeding users...');
  for (const u of users) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: u.email,
      password: SEED_PASSWORD,
    });

    if (authError) {
      console.error(`Error creating ${u.email} in Auth:`, authError.message);
      continue;
    }

    const userId = authData.user?.id;
    if (!userId) {
      console.log(`User ${u.email} already exists or requires email confirmation.`);
      continue;
    }

    try {
      // `update` phải thật sự cập nhật. Bản cũ dùng `update: {}` nên khi bảng đã
      // có sẵn một bản ghi trùng email nhưng sai `id` (ví dụ 'user_123' do
      // import_finance.js tạo), lệnh upsert này im lặng không làm gì — kết quả là
      // Prisma.User.id không bao giờ khớp UUID của Supabase Auth, và mọi truy vấn
      // `where: { userId }` sau này trả về rỗng.
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          id: userId,
          displayName: u.displayName,
          role: u.role
        },
        create: {
          id: userId,
          email: u.email,
          displayName: u.displayName,
          role: u.role
        }
      });
      console.log(`✅ Created/updated user: ${u.displayName} (${u.email}) → ${userId}`);
    } catch (dbError) {
      console.error(`Error saving ${u.email} to DB:`, dbError.message);
      console.error('  Nếu lỗi liên quan tới khoá ngoại, hãy chạy scripts/fix-user-id.js trước.');
    }
  }
  console.log('Done!');
  await prisma.$disconnect();
}

seed();
