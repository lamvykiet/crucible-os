import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { botUserId, ownerChatId, sendMessage } from "@/lib/telegram";
import { todayVn } from "@/lib/botParse";

export const runtime = "nodejs";

/**
 * Nhắc ghi chi tiêu lúc 21:00 giờ Việt Nam — Vercel Cron gọi (`vercel.json`,
 * 14:00 UTC). Gói Hobby chỉ cho cron chạy mỗi ngày một lần, vừa đủ cho việc này.
 *
 * CÔNG KHAI ở `src/proxy.ts` vì cron không mang phiên đăng nhập; Vercel gửi kèm
 * `Authorization: Bearer $CRON_SECRET`, thiếu hay sai là từ chối.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const chat = ownerChatId();
  const userId = botUserId();
  if (!chat || !userId) return NextResponse.json({ ok: false, error: "Bot chưa cấu hình" }, { status: 503 });

  // "Hôm nay" theo giờ Việt Nam: giao dịch mang ngày hôm nay, hoặc được nhập
  // trong hôm nay (kể cả khi là khoản của hôm qua) — cả hai đều là đã ghi.
  // Phải chặn cả đầu trên: lịch trả góp sinh sẵn giao dịch cho các tháng sau,
  // `date >= hôm nay` trơn thì lúc nào cũng "đã ghi" và bot không bao giờ nhắc.
  const today = todayVn();
  const dayStart = new Date(`${today}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const createdStart = new Date(dayStart.getTime() - 7 * 3600_000);
  const [logged, pending] = await Promise.all([
    prisma.transaction.count({
      where: {
        userId,
        OR: [{ date: { gte: dayStart, lt: dayEnd } }, { createdAt: { gte: createdStart } }],
      },
    }),
    prisma.draftReceipt.count({ where: { userId, status: "Pending" } }),
  ]);

  const dm = `${today.slice(8, 10)}/${today.slice(5, 7)}`;
  const lines: string[] = [];
  if (logged === 0) {
    lines.push(`🌙 Hôm nay (${dm}) chưa có khoản nào được ghi. Có gì chi tiêu không? Nhắn mình hoặc gửi ảnh hoá đơn nhé.`);
  }
  if (pending > 0) lines.push(`📋 Còn <b>${pending}</b> bản nháp chờ duyệt — /cho để xem.`);
  if (lines.length) await sendMessage(chat, lines.join("\n\n"));

  return NextResponse.json({ ok: true, logged, pending, sent: lines.length > 0 });
}
