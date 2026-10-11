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
    datasourceUrl: process.env.DATABASE_URL?.replace("db.xqysclaarffkeyhicbtx.supabase.co:5432", "aws-0-ap-southeast-1.pooler.supabase.com:6543").replace("?pgbouncer=true", "") + "?pgbouncer=true",
    // Giới hạn của transaction tương tác. Mặc định Prisma là 5 s chạy + 2 s chờ
    // kết nối — quá giờ là transaction bị đóng giữa chừng và lệnh kế tiếp báo
    // "Transaction not found". Đã gặp thật 11/10: duyệt hoá đơn chạy ~15–20
    // truy vấn nối tiếp, mà hàm Vercel khi đó nằm ở Mỹ (iad1) còn DB ở
    // Singapore, mỗi truy vấn ~230 ms. Gốc rễ đã sửa bằng `vercel.json`
    // (regions: sin1); con số này là lưới an toàn khi mạng chậm bất thường.
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
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
