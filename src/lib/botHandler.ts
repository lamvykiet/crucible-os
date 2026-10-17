import { prisma } from "@/lib/prisma";
import { aiErrorMessage } from "@/lib/aiRetry";
import { ProjectSplitError } from "@/lib/projectLedger";
import {
  answerCallback,
  botUserId,
  downloadFile,
  editMessage,
  esc,
  ownerChatId,
  sendMessage,
  type TgCallbackQuery,
  type TgMessage,
  type TgUpdate,
} from "@/lib/telegram";
import { applyCorrection, loadBotContext, parseMessage, type BotContext, type BotInput } from "@/lib/botParse";
import {
  DRAFT_CODE_RE,
  confirmDraft,
  createDraftFromParsed,
  createFallbackDraft,
  draftAsCurrent,
  fillDraftFromImages,
  findDraftByCode,
  groupAt,
  rejectDraft,
  subAt,
  renderDraft,
  saveReceiptImages,
  shortId,
  updateDraftFromParsed,
  type DraftWithItems,
} from "@/lib/botDraft";

/**
 * Xử lý một update từ Telegram. Chạy trong `after()` của webhook: Telegram nhận
 * 200 ngay, còn Gemini/Drive/Prisma làm sau — nếu bắt Telegram chờ OCR 30 giây,
 * nó coi là quá giờ và gửi lại cùng update, sinh bản nháp đôi.
 */

const HELP = `👋 <b>Bot ghi chi tiêu Crucible</b>

Gửi cho mình một trong ba thứ:
• <b>Tin nhắn</b>: <i>"cafe Highlands 45k thẻ"</i>, <i>"hôm qua đổ xăng 500k, gửi xe 5k"</i>
• <b>Tin thoại</b>: nói y như trên
• <b>Ảnh hoá đơn</b>: chụp thẳng trong Telegram (thêm chú thích nếu muốn, vd. <i>"thẻ VIB"</i>)

Mình gửi lại bản nháp kèm nút <b>✅ Ghi sổ · ✏️ Sửa · ❌ Huỷ</b>. Chưa bấm ✅ thì chưa có gì vào sổ — nháp vẫn nằm trong hàng chờ "Duyệt hoá đơn" của app.

Muốn sửa: <b>trả lời (reply)</b> vào bản nháp, vd. <i>"số tiền 450k, nhóm ăn uống"</i>.

/cho — các bản nháp đang chờ duyệt`;

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function handleUpdate(update: TgUpdate, appUrl: string) {
  const owner = ownerChatId();
  const userId = botUserId();

  if (update.callback_query) {
    const cq = update.callback_query;
    if (!owner || cq.from.id !== owner || !userId) return answerCallback(cq.id, "Không có quyền");
    return handleCallback(cq, userId, appUrl);
  }

  const msg = update.message;
  if (!msg) return;

  // Chưa đặt TELEGRAM_CHAT_ID: cho người dùng biết chat id của chính họ để
  // dán vào Vercel. Đặt rồi thì người lạ nhắn vào bị lờ đi, không trả lời gì.
  if (!owner) {
    return sendMessage(
      msg.chat.id,
      `Chat ID của bạn là <code>${msg.chat.id}</code>.\nĐặt <code>TELEGRAM_CHAT_ID=${msg.chat.id}</code> trên Vercel rồi deploy lại để bot bắt đầu ghi chi tiêu.`
    );
  }
  if (msg.chat.id !== owner) return;
  if (!userId) return sendMessage(owner, "⚠️ Máy chủ chưa đặt <code>BOT_USER_ID</code>.");

  try {
    await handleMessage(msg, owner, userId, appUrl);
  } catch (error) {
    console.error("Bot message error:", error);
    await sendMessage(owner, `⚠️ Lỗi: ${esc(aiErrorMessage(error))}`, undefined, msg.message_id).catch(() => undefined);
  }
}

async function handleMessage(msg: TgMessage, chat: number, userId: string, appUrl: string) {
  const text = (msg.text ?? "").trim();

  if (text === "/start" || text === "/help") return sendMessage(chat, HELP);
  if (text === "/cho") return listPending(chat, userId, appUrl);

  const ctx = await loadBotContext(userId);

  // Trả lời vào một bản nháp = sửa bản nháp đó.
  const code = msg.reply_to_message && DRAFT_CODE_RE.exec(msg.reply_to_message.text ?? "")?.[1];
  if (code && (text || msg.voice || msg.audio)) {
    const draft = await findDraftByCode(userId, code);
    if (!draft) return sendMessage(chat, "Không tìm thấy bản nháp này nữa.", undefined, msg.message_id);
    if (draft.status !== "Pending") {
      return sendMessage(chat, "Bản nháp này đã được ghi sổ hoặc huỷ rồi — sửa trong app nhé.", undefined, msg.message_id);
    }
    return correctDraft(chat, msg, draft, await inputOf(msg), ctx, appUrl);
  }

  // Ảnh: chụp thẳng (photo) hoặc gửi dạng tệp (document) để giữ nguyên độ nét.
  const photo = msg.photo?.at(-1);
  const doc = msg.document && IMAGE_MIME.includes(msg.document.mime_type ?? "") ? msg.document : null;
  if (photo || doc) return handleImage(msg, chat, userId, ctx, appUrl, photo?.file_id ?? doc!.file_id, doc?.mime_type ?? "image/jpeg", doc?.file_name);

  if (msg.document) return sendMessage(chat, "Mình chỉ đọc được ảnh (JPG, PNG, HEIC) hoặc PDF.", undefined, msg.message_id);
  if (!text && !msg.voice && !msg.audio) return;
  if (text.startsWith("/")) return sendMessage(chat, HELP);

  const input = await inputOf(msg);
  const working = await sendMessage(chat, msg.voice || msg.audio ? "🎙 Đang nghe…" : "⏳ Đang đọc…", undefined, msg.message_id);

  let parsed;
  try {
    parsed = await parseMessage(ctx, input);
  } catch (error) {
    // Gemini hỏng: tin chữ vẫn được giữ lại thành nháp trống tiền, không mất.
    if (text) {
      const draft = await createFallbackDraft(userId, text);
      const view = renderDraft(draft, ctx, appUrl, `⚠️ Chưa đọc được (${esc(aiErrorMessage(error))}). Mình đã giữ nguyên văn tin nhắn thành bản nháp.`);
      return editMessage(chat, working.message_id, view.html, view.keyboard);
    }
    return editMessage(chat, working.message_id, `⚠️ Chưa nghe được tin thoại: ${esc(aiErrorMessage(error))}\nGửi lại sau ít phút, hoặc nhắn bằng chữ.`);
  }

  if (parsed.transactions.length === 0) {
    return editMessage(chat, working.message_id, esc(parsed.reply || "Mình chưa thấy khoản thu chi nào trong tin này.") + "\n\n/help để xem cách dùng");
  }

  // Một tin có thể ghi nhiều khoản — mỗi khoản một bản nháp, một bộ nút.
  const heardNote = parsed.heard ? `🎙 Nghe được: “${esc(parsed.heard)}”` : undefined;
  for (const [i, tx] of parsed.transactions.entries()) {
    const draft = await createDraftFromParsed(userId, tx);
    const view = renderDraft(draft, ctx, appUrl, i === 0 ? heardNote : undefined);
    if (i === 0) await editMessage(chat, working.message_id, view.html, view.keyboard);
    else await sendMessage(chat, view.html, view.keyboard);
  }
}

async function inputOf(msg: TgMessage): Promise<BotInput> {
  const media = msg.voice ?? msg.audio;
  if (!media) return { text: (msg.text ?? "").trim() };
  const { data } = await downloadFile(media.file_id);
  // Tin thoại Telegram là OGG/Opus; Gemini đọc thẳng được, không cần đổi định dạng.
  return { audio: { data, mimeType: media.mime_type || "audio/ogg" }, text: msg.caption?.trim() || undefined };
}

async function handleImage(
  msg: TgMessage,
  chat: number,
  userId: string,
  ctx: BotContext,
  appUrl: string,
  fileId: string,
  mimeType: string,
  fileName?: string
) {
  const working = await sendMessage(chat, "⏳ Đang lưu ảnh…", undefined, msg.message_id);
  const { data, path } = await downloadFile(fileId);
  const ext = path.split(".").pop() || "jpg";
  const name = fileName || `telegram-${new Date(msg.date * 1000).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;

  // Lưu TRƯỚC, đọc SAU. Chỉ báo "đã lưu" khi ảnh thật sự đã nằm trên Drive.
  let draft: DraftWithItems;
  try {
    draft = await saveReceiptImages(userId, [{ data, mimeType, name }]);
  } catch (error) {
    return editMessage(
      chat,
      working.message_id,
      `⚠️ <b>Chưa lưu được ảnh lên Drive</b> (${esc(error instanceof Error ? error.message : String(error))}).\nẢnh vẫn còn trong đoạn chat này — đừng vứt hoá đơn, gửi lại sau ít phút.`
    );
  }
  await editMessage(chat, working.message_id, "📥 <b>Đã lưu ảnh lên Drive</b> — đang đọc hoá đơn…");

  const filled = await fillDraftFromImages(userId, draft, [{ data, mimeType }], ctx);
  draft = filled.draft;

  // Chú thích kèm ảnh ("thẻ VIB", "du lịch Đà Lạt") áp như một lần sửa.
  const caption = msg.caption?.trim();
  if (!filled.error && caption) {
    try {
      draft = await updateDraftFromParsed(draft, (await applyCorrection(ctx, draftAsCurrent(draft), { text: caption })).tx);
    } catch (error) {
      console.error("Bot: không áp được chú thích ảnh:", error);
    }
  }

  const note = filled.error
    ? `📥 Ảnh đã lưu trên Drive. ⚠️ Chưa đọc được hoá đơn: ${esc(filled.error)}\nTrả lời tin này để điền tay, hoặc quét lại trong app.`
    : "📥 Ảnh đã lưu trên Drive — giờ vứt hoá đơn giấy được rồi.";
  const view = renderDraft(draft, ctx, appUrl, note);
  return editMessage(chat, working.message_id, view.html, view.keyboard);
}

async function correctDraft(
  chat: number,
  msg: TgMessage,
  draft: DraftWithItems,
  input: BotInput,
  ctx: BotContext,
  appUrl: string
) {
  const working = await sendMessage(chat, "✏️ Đang sửa…", undefined, msg.message_id);
  try {
    const corrected = await applyCorrection(ctx, draftAsCurrent(draft), input);
    const updated = await updateDraftFromParsed(draft, corrected.tx);
    const lines = [];
    if (corrected.heard) lines.push(`🎙 Nghe được: “${esc(corrected.heard)}”`);
    lines.push(
      corrected.changed.length
        ? `✏️ Đã đổi: <b>${corrected.changed.join(", ")}</b>`
        : "✏️ Không có gì thay đổi — có thể tên nhóm/thẻ bạn nói không có trong danh mục. Bấm 🏷 để chọn nhóm."
    );
    const view = renderDraft(updated, ctx, appUrl, lines.join("\n"));
    return editMessage(chat, working.message_id, view.html, view.keyboard);
  } catch (error) {
    return editMessage(chat, working.message_id, `⚠️ Chưa sửa được: ${esc(aiErrorMessage(error))}`);
  }
}

async function listPending(chat: number, userId: string, appUrl: string) {
  const [count, drafts, ctx] = await Promise.all([
    prisma.draftReceipt.count({ where: { userId, status: "Pending" } }),
    prisma.draftReceipt.findMany({
      where: { userId, status: "Pending" },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    loadBotContext(userId),
  ]);
  if (count === 0) return sendMessage(chat, "✨ Không còn bản nháp nào chờ duyệt.");
  await sendMessage(chat, `Có <b>${count}</b> bản nháp đang chờ duyệt${count > 5 ? " — đây là 5 bản mới nhất" : ""}:`);
  for (const d of drafts) {
    const view = renderDraft(d, ctx, appUrl);
    await sendMessage(chat, view.html, view.keyboard);
  }
}

async function handleCallback(cq: TgCallbackQuery, userId: string, appUrl: string) {
  const [action, draftId, index] = (cq.data ?? "").split(":");
  const msg = cq.message;
  if (!draftId || !msg) return answerCallback(cq.id);
  const chat = msg.chat.id;

  // Chọn nhóm / nhóm phụ bằng nút: sửa thẳng bản nháp rồi vẽ lại tin nhắn.
  if (["g", "gs", "ss", "back"].includes(action)) {
    const draft = await prisma.draftReceipt.findUnique({ where: { id: draftId }, include: { items: true } });
    if (!draft || draft.userId !== userId || draft.status !== "Pending") {
      return answerCallback(cq.id, "Bản nháp đã được xử lý rồi");
    }
    const ctx = await loadBotContext(userId);
    let current: DraftWithItems = draft;
    let picker: Parameters<typeof renderDraft>[4];

    if (action === "g") picker = { kind: "group" };
    if (action === "gs") {
      const group = groupAt(ctx, draft.type, Number(index));
      if (!group) return answerCallback(cq.id, "Danh mục vừa đổi — bấm 🏷 lần nữa");
      current = await prisma.draftReceipt.update({
        where: { id: draftId },
        data: { categoryGroup: group, subGroup: null },
        include: { items: true },
      });
      const tree = draft.type === "Income" ? ctx.income : ctx.expense;
      if (tree.get(group)?.subs.size) picker = { kind: "sub", group };
    }
    if (action === "ss" && draft.categoryGroup) {
      const sub = subAt(ctx, draft.type, draft.categoryGroup, Number(index));
      if (!sub) return answerCallback(cq.id, "Danh mục vừa đổi — bấm 🏷 lần nữa");
      current = await prisma.draftReceipt.update({ where: { id: draftId }, data: { subGroup: sub }, include: { items: true } });
    }

    await answerCallback(cq.id);
    const view = renderDraft(current, ctx, appUrl, undefined, picker);
    return editMessage(chat, msg.message_id, view.html, view.keyboard);
  }

  if (action === "edit") {
    await answerCallback(cq.id);
    return sendMessage(
      chat,
      `Nhắn nội dung cần sửa (chữ hoặc tin thoại), vd. <i>"số tiền 450k, thẻ VIB, hôm qua"</i>.\n<code>Mã nháp: ${shortId(draftId)}</code>`,
      { force_reply: true, input_field_placeholder: "Sửa gì?" },
      msg.message_id
    );
  }

  if (action === "no") {
    const rejected = await rejectDraft(userId, draftId);
    await answerCallback(cq.id, rejected ? "Đã huỷ" : "Bản nháp đã được xử lý trước đó");
    return editMessage(
      chat,
      msg.message_id,
      `${esc(msg.text ?? "")}\n\n❌ <b>Đã huỷ</b>${rejected?.driveFileIds ? " — ảnh vào Trash_Invoices, vẫn khôi phục được" : ""}`
    );
  }

  if (action === "ok" || action === "force") {
    await answerCallback(cq.id, "Đang ghi sổ…");
    let result;
    try {
      result = await confirmDraft(userId, draftId, action === "force");
    } catch (error) {
      const reason = error instanceof ProjectSplitError ? error.message : aiErrorMessage(error);
      return sendMessage(chat, `⚠️ Chưa ghi được: ${esc(reason)}`, undefined, msg.message_id);
    }

    if (result.ok) {
      const t = result.transaction;
      return editMessage(
        chat,
        msg.message_id,
        `${esc(msg.text ?? "")}\n\n✅ <b>Đã ghi sổ</b> · <code>${t.id}</code>${result.filesMoved ? "" : "\n(ảnh chưa dời được sang Approved_Invoices — dữ liệu vẫn đúng)"}`
      );
    }
    if ("duplicate" in result) {
      const d = result.duplicate;
      const iso = d.date.toISOString().slice(0, 10);
      return editMessage(
        chat,
        msg.message_id,
        `${esc(msg.text ?? "")}\n\n⚠️ <b>Có vẻ trùng</b> với giao dịch đã có: ${esc(d.supplier)} · ${d.totalAmount.toLocaleString("vi-VN")} đ · ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} (<code>${d.id}</code>).`,
        {
          inline_keyboard: [
            [
              { text: "Vẫn ghi — là hai khoản khác nhau", callback_data: `force:${draftId}` },
              { text: "❌ Huỷ nháp", callback_data: `no:${draftId}` },
            ],
          ],
        }
      );
    }
    // Đã xử lý (vd. duyệt trong app rồi) hoặc thiếu trường: báo, giữ nguyên tin.
    return sendMessage(chat, `⚠️ ${esc(result.error)}`, undefined, msg.message_id);
  }

  return answerCallback(cq.id);
}

/** Dùng cho Shortcut: gửi bản nháp vừa đọc xong tới Telegram của chủ bot. */
export async function notifyDraft(userId: string, draft: DraftWithItems, appUrl: string, note: string) {
  const chat = ownerChatId();
  if (!chat) return;
  const ctx = await loadBotContext(userId);
  const view = renderDraft(draft, ctx, appUrl, note);
  await sendMessage(chat, view.html, view.keyboard);
}
