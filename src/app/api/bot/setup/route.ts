import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { botToken, botUserId, ownerChatId, tg, webhookSecret } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * Nối bot Telegram vào Crucible — mở một lần trên trình duyệt ĐÃ ĐĂNG NHẬP:
 *   https://<tên miền>/api/bot/setup
 *
 * Gọi setWebhook với mã bí mật suy ra từ token, đặt danh sách lệnh, rồi báo
 * còn thiếu biến môi trường nào. Chạy lại bao nhiêu lần cũng được.
 *
 * Route này PHẢI đăng nhập (không nằm trong PUBLIC_PATHS): ai gọi được nó là
 * trỏ được webhook đi nơi khác.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const token = botToken();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Chưa đặt TELEGRAM_BOT_TOKEN trên Vercel" }, { status: 503 });
  }

  const webhookUrl = `${new URL(req.url).origin}/api/bot/telegram`;
  try {
    const me = await tg<{ username: string }>("getMe");
    await tg("setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret(),
      allowed_updates: ["message", "callback_query"],
      max_connections: 5,
    });
    await tg("setMyCommands", {
      commands: [
        { command: "help", description: "Cách dùng bot" },
        { command: "cho", description: "Các bản nháp đang chờ duyệt" },
      ],
    });
    const info = await tg<Record<string, unknown>>("getWebhookInfo");

    const configuredUser = botUserId();
    return NextResponse.json({
      ok: true,
      bot: `@${me.username}`,
      webhook: webhookUrl,
      webhookInfo: info,
      checklist: {
        TELEGRAM_BOT_TOKEN: "đã đặt",
        TELEGRAM_CHAT_ID: ownerChatId()
          ? "đã đặt"
          : `CHƯA — nhắn /start cho @${me.username}, bot sẽ trả lời chat id của bạn`,
        BOT_USER_ID:
          configuredUser === user.id
            ? "đã đặt, đúng tài khoản đang đăng nhập"
            : configuredUser
              ? `ĐANG TRỎ TỚI TÀI KHOẢN KHÁC — tài khoản đang đăng nhập là ${user.id}`
              : `CHƯA — đặt BOT_USER_ID=${user.id}`,
        RECEIPT_UPLOAD_TOKEN: process.env.RECEIPT_UPLOAD_TOKEN
          ? "đã đặt"
          : process.env.VIDEO_UPLOAD_TOKEN
            ? "chưa đặt — Shortcut dùng tạm VIDEO_UPLOAD_TOKEN"
            : "CHƯA — Shortcut chụp hoá đơn chưa chạy được",
        CRON_SECRET: process.env.CRON_SECRET ? "đã đặt" : "CHƯA — nhắc nhở 21:00 chưa chạy",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
