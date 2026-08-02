import { PrismaClient } from "@prisma/client";

// Một PrismaClient duy nhất cho cả process.
//
// Trước đây mỗi route handler tự `new PrismaClient()` ở module scope và gọi
// `$disconnect()` trong `finally`, tức là đóng connection pool sau MỖI request.
// Kèm theo hot-reload của dev server, mỗi lần sửa file lại sinh thêm một client
// mới mà client cũ không được thu hồi — đủ để cạn connection limit của Supabase.
//
// Giữ instance trên globalThis để hot-reload tái sử dụng. Ở production module
// chỉ được đánh giá một lần nên không cần gán global.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.NODE_ENV === "production" 
      ? "postgresql://postgres.xqysclaarffkeyhicbtx:Lamvykiet130110%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
      : process.env.DATABASE_URL,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Đừng gọi `prisma.$disconnect()` trong route handler — pool được dùng chung
// cho mọi request, đóng nó sẽ làm hỏng các request đang chạy song song.
