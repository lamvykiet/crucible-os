import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { botUserId, esc, ownerChatId, sendMessage } from "@/lib/telegram";
import { todayVn } from "@/lib/botParse";

export const runtime = "nodejs";

/**
 * Nhắc ghi chi tiêu 3 lần mỗi ngày — 12h, 17h, 22h giờ Việt Nam. Vercel Cron
 * gọi (`vercel.json`: 05:00, 10:00, 15:00 UTC).
 *
 * Gói Hobby: mỗi lịch cron chạy tối đa MỘT lần/ngày và có thể lệch tới 59 phút
 * (gọi lúc 12:00–12:59), nên ba mốc là ba lịch riêng, và buổi nào được suy từ
 * giờ thật lúc chạy chứ không tin vào phút chính xác.
 *
 * Hai trường hợp, theo người dùng chốt 18/10:
 *   - Hôm nay chưa có giao dịch nào → nhắc nhập.
 *   - Đã có → báo đã chi bao nhiêu, hỏi còn khoản nào khác không.
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

  // "Hôm nay" là NGÀY GIAO DỊCH theo giờ Việt Nam — giao dịch lưu ngày ở
  // 00:00 UTC của ngày đó. Phải chặn cả đầu trên: lịch trả góp sinh sẵn giao
  // dịch cho các tháng sau.
  const today = todayVn();
  const dayStart = new Date(`${today}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const [txs, pending] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: dayStart, lt: dayEnd } },
      select: { type: true, supplier: true, totalAmount: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.draftReceipt.count({ where: { userId, status: "Pending" } }),
  ]);

  const hourVn = (new Date().getUTCHours() + 7) % 24;
  const slot = hourVn < 15 ? "☀️ Nhắc buổi trưa" : hourVn < 20 ? "🌇 Nhắc buổi chiều" : "🌙 Nhắc cuối ngày";
  const dm = `${today.slice(8, 10)}/${today.slice(5, 7)}`;
  const vnd = (n: number) => `${n.toLocaleString("vi-VN")} đ`;

  const lines = [`<b>${slot}</b> · ${dm}`];
  if (txs.length === 0) {
    lines.push("Bạn chưa nhập giao dịch nào của hôm nay, hãy nhập các giao dịch.");
    lines.push("<i>Nhắn mình, gửi tin thoại hoặc ảnh hoá đơn.</i>");
  } else {
    const spent = txs.filter((t) => t.type === "Expense");
    const total = spent.reduce((s, t) => s + t.totalAmount, 0);
    lines.push(
      spent.length
        ? `Hôm nay bạn đã chi <b>${vnd(total)}</b> qua ${spent.length} giao dịch:`
        : `Hôm nay bạn chưa có khoản chi nào (đã ghi ${txs.length} khoản thu/khác).`
    );
    const shown = spent.slice(0, 8).map((t) => `  • ${esc(t.supplier)} — ${vnd(t.totalAmount)}`);
    if (spent.length > 8) shown.push(`  … và ${spent.length - 8} giao dịch nữa`);
    if (shown.length) lines.push(shown.join("\n"));
    lines.push("Còn giao dịch nào khác không? Hãy nhập vào đi.");
  }
  if (pending > 0) lines.push(`\n📋 Còn <b>${pending}</b> bản nháp chờ duyệt — /cho để xem.`);

  await sendMessage(chat, lines.join("\n"));
  return NextResponse.json({ ok: true, slot, transactions: txs.length, pending });
}
