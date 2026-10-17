import { NextResponse, after } from "next/server";
import { botUserId, ownerChatId } from "@/lib/telegram";
import { applyCorrection, loadBotContext, parseMessage } from "@/lib/botParse";
import {
  createDraftFromParsed,
  createFallbackDraft,
  draftAsCurrent,
  fillDraftFromImages,
  saveReceiptImages,
  updateDraftFromParsed,
  type DraftWithItems,
} from "@/lib/botDraft";
import { notifyDraft } from "@/lib/botHandler";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 3;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

/**
 * Điểm nhận của Shortcut iPhone ("Chụp hoá đơn", "Ghi chi tiêu").
 *
 * CÔNG KHAI ở `src/proxy.ts`, xác thực bằng RECEIPT_UPLOAD_TOKEN (chưa đặt thì
 * dùng tạm VIDEO_UPLOAD_TOKEN) — cùng cơ chế với `api/video/upload`.
 *
 * Multipart: `file` (0–3 ảnh) và/hoặc `text` (câu đọc chính tả).
 *
 * Với ảnh: trả lời "đã lưu" NGAY khi ảnh lên Drive và có bản nháp — chưa chờ
 * OCR. OCR mất 20–40 s, sát ngưỡng chờ mạng của Shortcut; bắt Shortcut chờ thì
 * hay báo lỗi giả trong khi ảnh thật ra đã lên. Kết quả đọc gửi qua Telegram.
 */
export async function POST(req: Request) {
  const expected = process.env.RECEIPT_UPLOAD_TOKEN || process.env.VIDEO_UPLOAD_TOKEN;
  const userId = botUserId();
  if (!expected || !userId) {
    return NextResponse.json(
      { success: false, message: "Máy chủ chưa cấu hình RECEIPT_UPLOAD_TOKEN / BOT_USER_ID" },
      { status: 503 }
    );
  }

  // Shortcuts đặt header dễ sai chính tả: nhận cả header lẫn field trong form.
  const headerToken =
    req.headers.get("x-upload-token") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, message: "Shortcut phải gửi dạng Form (multipart)" }, { status: 400 });
  }
  if ((headerToken || String(form.get("token") ?? "")) !== expected) {
    return NextResponse.json({ success: false, message: "Token không đúng" }, { status: 401 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  const text = String(form.get("text") ?? "").trim();
  const appUrl = new URL(req.url).origin;
  const viaTelegram = ownerChatId() !== null;

  if (files.length > MAX_FILES) {
    return NextResponse.json({ success: false, message: `Tối đa ${MAX_FILES} ảnh cho một hoá đơn` }, { status: 400 });
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, message: `Ảnh vượt quá ${MAX_FILE_BYTES / 1024 / 1024}MB` }, { status: 413 });
    }
    // Shortcut hay gửi ảnh không kèm loại tệp: coi như JPEG.
    if (f.type && !ALLOWED_MIME.includes(f.type)) {
      return NextResponse.json({ success: false, message: `Định dạng không hỗ trợ: ${f.type}` }, { status: 415 });
    }
  }

  if (files.length > 0) {
    const images = await Promise.all(
      files.map(async (f, i) => ({
        data: Buffer.from(await f.arrayBuffer()),
        mimeType: f.type || "image/jpeg",
        name: f.name && f.name !== "blob" ? f.name : `shortcut-${Date.now()}-${i + 1}.jpg`,
      }))
    );

    let draft;
    try {
      draft = await saveReceiptImages(userId, images);
    } catch (error) {
      console.error("Shortcut upload: Drive error:", error);
      return NextResponse.json(
        {
          success: false,
          message: "⚠️ CHƯA lưu được ảnh lên Drive. Ảnh vẫn còn trong album trên iPhone — đừng vứt hoá đơn, chạy lại sau.",
        },
        { status: 502 }
      );
    }

    after(async () => {
      try {
        const ctx = await loadBotContext(userId);
        const filled = await fillDraftFromImages(userId, draft, images, ctx);
        // Câu nói kèm theo ảnh ("thẻ VIB", "du lịch Đà Lạt") áp như chú thích.
        let final = filled.draft;
        if (!filled.error && text) {
          final = await updateDraftFromParsed(final, (await applyCorrection(ctx, draftAsCurrent(final), { text })).tx);
        }
        await notifyDraft(
          userId,
          final,
          appUrl,
          filled.error
            ? `📥 Ảnh từ Shortcut đã lưu trên Drive. ⚠️ Chưa đọc được: ${filled.error}`
            : "📥 Ảnh từ Shortcut đã lưu trên Drive:"
        );
      } catch (error) {
        console.error("Shortcut upload: post-processing failed:", error);
      }
    });

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      message: viaTelegram
        ? "✅ Đã lưu ảnh lên Drive. Kết quả đọc hoá đơn sẽ gửi qua Telegram."
        : "✅ Đã lưu ảnh lên Drive. Hoá đơn nằm trong hàng chờ Duyệt hoá đơn.",
    });
  }

  if (!text) return NextResponse.json({ success: false, message: "Không có ảnh hay nội dung nào" }, { status: 400 });

  // Chỉ có câu đọc chính tả: đọc ngay (vài giây) để Shortcut báo được đã hiểu gì.
  try {
    const ctx = await loadBotContext(userId);
    const parsed = await parseMessage(ctx, { text });
    if (parsed.transactions.length === 0) {
      return NextResponse.json({ success: false, message: parsed.reply || "Không thấy khoản thu chi nào" });
    }
    const drafts: DraftWithItems[] = [];
    for (const tx of parsed.transactions) drafts.push(await createDraftFromParsed(userId, tx));
    after(async () => {
      for (const d of drafts) await notifyDraft(userId, d, appUrl, "🎙 Từ Siri:").catch(() => undefined);
    });
    const summary = drafts
      .map((d) => `${d.supplier ?? "?"} ${d.totalAmount ? d.totalAmount.toLocaleString("vi-VN") + " đ" : "(chưa có số tiền)"}`)
      .join("; ");
    return NextResponse.json({
      success: true,
      message: `📝 Đã tạo nháp: ${summary}.${viaTelegram ? " Bấm ✅ trên Telegram để ghi sổ." : ""}`,
    });
  } catch {
    // Gemini hỏng: giữ nguyên câu nói thành nháp, không mất.
    await createFallbackDraft(userId, text);
    return NextResponse.json({
      success: true,
      message: "⚠️ Chưa đọc được nội dung, nhưng đã giữ nguyên văn thành bản nháp trong hàng chờ duyệt.",
    });
  }
}
