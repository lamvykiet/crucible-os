import { createHash } from "node:crypto";

/**
 * Gọi Telegram Bot API — chỉ phần bot ghi chi tiêu cần, không kéo thư viện.
 *
 * Cấu hình (biến môi trường trên Vercel):
 *   TELEGRAM_BOT_TOKEN  token từ @BotFather
 *   TELEGRAM_CHAT_ID    chat id của CHỦ bot — mọi tin từ người khác bị bỏ qua
 *   BOT_USER_ID         id người dùng Crucible mà bot ghi sổ thay
 *
 * Mã bí mật của webhook suy ra từ token (`webhookSecret`) nên khỏi phải đặt
 * thêm một biến nữa: ai không có token thì không đoán được nó.
 */

export interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TgPhotoSize {
  file_id: string;
  file_size?: number;
  width: number;
  height: number;
}

export interface TgMessage {
  message_id: number;
  date: number;
  chat: { id: number };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
  audio?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
  reply_to_message?: TgMessage;
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  data?: string;
  message?: TgMessage;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export type ReplyMarkup =
  | { inline_keyboard: InlineButton[][] }
  | { force_reply: true; input_field_placeholder?: string };

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export function ownerChatId(): number | null {
  const raw = process.env.TELEGRAM_CHAT_ID;
  return raw && /^-?\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
}

export function botUserId(): string | null {
  return process.env.BOT_USER_ID || null;
}

/** Telegram chỉ nhận [A-Za-z0-9_-], tối đa 256 ký tự — hex của sha256 là vừa. */
export function webhookSecret(): string | null {
  const token = botToken();
  return token ? createHash("sha256").update(`crucible-webhook:${token}`).digest("hex") : null;
}

export class TelegramError extends Error {}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = botToken();
  if (!token) throw new TelegramError("Chưa cấu hình TELEGRAM_BOT_TOKEN");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!json?.ok) throw new TelegramError(`${method}: ${json?.description ?? res.status}`);
  return json.result as T;
}

/** Chữ thuần → an toàn cho parse_mode HTML. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sendMessage(chatId: number, html: string, replyMarkup?: ReplyMarkup, replyTo?: number) {
  return tg<TgMessage>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
  });
}

export async function editMessage(
  chatId: number,
  messageId: number,
  html: string,
  replyMarkup?: { inline_keyboard: InlineButton[][] }
) {
  try {
    await tg("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: html,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: replyMarkup ?? { inline_keyboard: [] },
    });
  } catch (error) {
    // Bấm hai lần cùng một nút: nội dung y hệt → Telegram báo lỗi, không sao.
    if (!String(error).includes("message is not modified")) throw error;
  }
}

export function answerCallback(id: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) }).catch(() => undefined);
}

/** Bot tải được tối đa 20MB mỗi tệp — đủ cho ảnh hoá đơn và tin thoại. */
export async function downloadFile(fileId: string): Promise<{ data: Buffer; path: string }> {
  const file = await tg<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new TelegramError("Telegram không trả đường dẫn tệp");
  const res = await fetch(`https://api.telegram.org/file/bot${botToken()}/${file.file_path}`);
  if (!res.ok) throw new TelegramError(`Không tải được tệp (${res.status})`);
  return { data: Buffer.from(await res.arrayBuffer()), path: file.file_path };
}
