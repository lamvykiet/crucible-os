import { NextResponse, after } from "next/server";
import { webhookSecret, type TgUpdate } from "@/lib/telegram";
import { handleUpdate } from "@/lib/botHandler";

export const runtime = "nodejs";
// OCR một ảnh mất 20–40 s, có khi phải nhảy model — phần đó chạy trong after()
// nhưng vẫn tính vào thời gian sống của hàm.
export const maxDuration = 120;

/**
 * Webhook của bot Telegram. CÔNG KHAI (xem `src/proxy.ts`) vì Telegram không
 * đăng nhập Supabase được; xác thực bằng header `X-Telegram-Bot-Api-Secret-Token`
 * mà chính mình đặt lúc gọi setWebhook (`api/bot/setup`), cộng với việc chỉ
 * nhận tin từ đúng TELEGRAM_CHAT_ID — kiểm ở `handleUpdate`.
 *
 * Trả 200 NGAY rồi mới xử lý: Telegram chờ lâu sẽ gửi lại cùng update.
 */
export async function POST(req: Request) {
  const secret = webhookSecret();
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (update) {
    const appUrl = new URL(req.url).origin;
    after(() =>
      handleUpdate(update, appUrl).catch((error) => console.error("Telegram update failed:", error))
    );
  }
  return NextResponse.json({ ok: true });
}
