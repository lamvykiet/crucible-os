import type { DraftItem, DraftReceipt } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDriveClient,
  getOrCreateFolderIds,
  moveFilesTo,
  uploadToDrive,
  INVOICE_ROOT_FOLDER_ID,
} from "@/lib/drive";
import { readReceipt, type ReceiptImage } from "@/lib/receiptOcr";
import { pickSuggestedGroup } from "@/lib/classify";
import { approveDraft, type ApproveResult } from "@/lib/approveDraft";
import { aiErrorMessage } from "@/lib/aiRetry";
import { logOcr } from "@/lib/ocrLog";
import { PAYMENT_METHOD_LABELS } from "@/lib/invoice";
import { esc, type InlineButton } from "@/lib/telegram";
import { loadBotContext, weekdayVi, type BotContext, type ParsedTx, type CurrentDraft } from "@/lib/botParse";

/**
 * Bản nháp của bot — cùng bảng `DraftReceipt` với hoá đơn quét trong app.
 *
 * Bot không bao giờ ghi thẳng `Transaction`: mọi thứ thành NHÁP trước, người
 * dùng bấm ✅ mới ghi sổ, qua đúng `approveDraft` của hộp thoại duyệt. Không
 * bấm thì nháp vẫn nằm trong hàng chờ "Duyệt hoá đơn" của app — không mất.
 */

export type DraftWithItems = DraftReceipt & { items: DraftItem[] };

/** 8 ký tự đầu của id — hiện trong tin nhắn để trả lời (reply) vào đúng bản nháp. */
export const shortId = (id: string) => id.slice(0, 8);
export const DRAFT_CODE_RE = /Mã nháp:\s*([0-9a-f]{8})/i;

export async function findDraftByCode(userId: string, code: string) {
  return prisma.draftReceipt.findFirst({
    where: { userId, id: { startsWith: code.toLowerCase() } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

function txFields(tx: ParsedTx) {
  return {
    date: tx.date ? new Date(`${tx.date}T00:00:00.000Z`) : null,
    supplier: tx.supplier,
    type: tx.type,
    categoryGroup: tx.categoryGroup,
    subGroup: tx.subGroup,
    totalAmount: tx.totalAmount,
    subtotal: tx.totalAmount,
    paymentMethod: tx.paymentMethod,
    accountId: tx.accountId,
    notes: tx.notes,
  };
}

/** Tin nhắn chữ / thoại → một bản nháp không có ảnh. */
export async function createDraftFromParsed(userId: string, tx: ParsedTx): Promise<DraftWithItems> {
  return prisma.draftReceipt.create({
    data: {
      status: "Pending",
      ...txFields(tx),
      driveFileIds: "",
      userId,
      items: tx.items.length ? { create: tx.items } : undefined,
    },
    include: { items: true },
  });
}

/**
 * Gemini đọc hỏng: vẫn giữ nguyên văn tin nhắn thành một bản nháp trống tiền,
 * để không mất — người dùng trả lời bổ sung, hoặc mở app điền tay.
 */
export async function createFallbackDraft(userId: string, rawText: string): Promise<DraftWithItems> {
  return prisma.draftReceipt.create({
    data: { status: "Pending", type: "Expense", notes: rawText.slice(0, 1000), driveFileIds: "", userId },
    include: { items: true },
  });
}

export async function updateDraftFromParsed(prev: DraftWithItems, tx: ParsedTx): Promise<DraftWithItems> {
  // Sửa thẻ, nhóm hay ngày thì giữ nguyên phần đọc từ hoá đơn (thuế, phí, các
  // món). Chỉ khi ĐỔI SỐ TIỀN thì thuế/phí cũ không còn khớp tổng mới — bỏ đi
  // để `subtotal = totalAmount`, không để lệch.
  const sameAmount = tx.totalAmount === prev.totalAmount;
  const keepItems = sameAmount && tx.items.length === 0 && prev.items.length > 0;
  return prisma.$transaction(async (db) => {
    if (!keepItems) await db.draftItem.deleteMany({ where: { draftId: prev.id } });
    return db.draftReceipt.update({
      where: { id: prev.id },
      data: {
        ...txFields(tx),
        ...(sameAmount
          ? { subtotal: prev.subtotal, tax: prev.tax, serviceCharge: prev.serviceCharge, discount: prev.discount }
          : { tax: null, serviceCharge: null, discount: null }),
        items: !keepItems && tx.items.length ? { create: tx.items } : undefined,
      },
      include: { items: true },
    });
  });
}

export function draftAsCurrent(d: DraftWithItems): CurrentDraft {
  return {
    type: d.type,
    date: d.date ? d.date.toISOString().slice(0, 10) : null,
    supplier: d.supplier,
    totalAmount: d.totalAmount,
    categoryGroup: d.categoryGroup,
    subGroup: d.subGroup,
    paymentMethod: d.paymentMethod || "unknown",
    accountId: d.accountId,
    notes: d.notes,
    items: d.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
    })),
  };
}

// --- Ảnh hoá đơn -------------------------------------------------------------

export interface IncomingImage extends ReceiptImage {
  name: string;
}

/**
 * Bước 1, phải XONG trước mọi thứ khác: ảnh lên Drive /Incoming và có một bản
 * nháp trỏ tới nó. Từ lúc hàm này trả về, ảnh đã an toàn — OCR hỏng, Gemini hết
 * hạn mức hay hàm bị cắt giữa chừng thì hoá đơn vẫn nằm trong hàng chờ duyệt.
 */
export async function saveReceiptImages(userId: string, images: IncomingImage[]): Promise<DraftWithItems> {
  const drive = getDriveClient();
  const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
  const ids: string[] = [];
  for (const img of images) {
    const id = await uploadToDrive(drive, img.data, img.mimeType, img.name, folderIds.INCOMING);
    if (!id) throw new Error(`Drive không nhận ảnh ${img.name}`);
    ids.push(id);
  }
  return prisma.draftReceipt.create({
    data: {
      status: "Pending",
      type: "Expense",
      driveFileIds: ids.join(","),
      driveFileName: images.map((i) => i.name).join(", "),
      userId,
    },
    include: { items: true },
  });
}

/** Bước 2: đọc ảnh và điền vào bản nháp. Hỏng thì bản nháp vẫn còn, chỉ trống. */
export async function fillDraftFromImages(
  userId: string,
  draft: DraftWithItems,
  images: ReceiptImage[],
  ctx: BotContext
): Promise<{ draft: DraftWithItems; error: string | null }> {
  const startedAt = Date.now();
  try {
    const { data, suggestion, usedModel } = await readReceipt(userId, images);
    const type = suggestion.type || "Expense";
    const groups = [...(type === "Income" ? ctx.income : ctx.expense).keys()];
    const categoryGroup = suggestion.categoryGroup || pickSuggestedGroup(data.items, groups) || null;
    const subGroup =
      suggestion.subGroup && categoryGroup
        ? (type === "Income" ? ctx.income : ctx.expense).get(categoryGroup)?.subs.has(suggestion.subGroup)
          ? suggestion.subGroup
          : null
        : null;
    const n = (v: number | null) => (v === null || v === undefined ? null : Math.round(Number(v)));

    const updated = await prisma.$transaction(async (db) => {
      // Người dùng đã bấm Huỷ trong lúc OCR còn chạy: đừng hồi sinh nó.
      const fresh = await db.draftReceipt.findUnique({ where: { id: draft.id } });
      if (!fresh || fresh.status !== "Pending") return null;
      await db.draftItem.deleteMany({ where: { draftId: draft.id } });
      return db.draftReceipt.update({
        where: { id: draft.id },
        data: {
          date: data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? new Date(`${data.date}T00:00:00.000Z`) : null,
          supplier: data.supplier,
          type,
          categoryGroup,
          subGroup,
          subtotal: n(data.subtotal),
          tax: n(data.tax),
          serviceCharge: n(data.serviceCharge),
          discount: n(data.discount),
          totalAmount: n(data.totalAmount),
          paymentMethod: data.paymentMethod || "unknown",
          language: data.language,
          notes: data.notes,
          items: data.items.length
            ? {
                create: data.items.map((i) => ({
                  productName: i.productName || "",
                  quantity: Number(i.quantity) || 0,
                  unitPrice: n(i.unitPrice) ?? 0,
                  totalPrice: n(i.totalPrice) ?? 0,
                  suggestedCategoryGroup: i.suggestedCategoryGroup || null,
                  confidence: i.confidence ?? null,
                })),
              }
            : undefined,
        },
        include: { items: true },
      });
    });

    await logOcr({
      userId,
      status: "OK",
      message: `Bot: quét ${images.length} ảnh (${usedModel}): ${data.supplier ?? "không đọc được tên"} — ${
        data.totalAmount ?? "không đọc được tổng"
      }`,
      fileId: draft.driveFileIds,
      fileName: draft.driveFileName,
      durationMs: Date.now() - startedAt,
    });
    return { draft: updated ?? draft, error: null };
  } catch (error) {
    console.error("Bot OCR error:", error);
    await logOcr({
      userId,
      status: "ERROR",
      message: `Bot: ${error instanceof Error ? error.message : String(error)}`,
      fileId: draft.driveFileIds,
      fileName: draft.driveFileName,
      durationMs: Date.now() - startedAt,
    });
    return { draft, error: aiErrorMessage(error) };
  }
}

// --- Tóm tắt gửi lên Telegram -------------------------------------------------

const vnd = (n: number) => `${n.toLocaleString("vi-VN")} đ`;
const TYPE_LABEL: Record<string, string> = { Expense: "Chi", Income: "Thu", Refund: "Hoàn tiền" };

/** Thiếu gì thì chưa cho ghi sổ — ghi xuống mà thiếu ngày hay số tiền là số liệu sai. */
export function missingFields(d: DraftReceipt): string[] {
  const miss: string[] = [];
  if (!d.totalAmount) miss.push("số tiền");
  if (!d.date) miss.push("ngày");
  if (!d.categoryGroup) miss.push("nhóm");
  return miss;
}

export function renderDraft(
  d: DraftWithItems,
  ctx: BotContext,
  appUrl: string | null,
  note?: string
): { html: string; keyboard: { inline_keyboard: InlineButton[][] } } {
  const tree = d.type === "Income" ? ctx.income : ctx.expense;
  const group = d.categoryGroup ? tree.get(d.categoryGroup) : undefined;
  const groupLabel = d.categoryGroup
    ? `${group?.vi || d.categoryGroup}${d.subGroup ? ` → ${group?.subs.get(d.subGroup) || d.subGroup}` : ""}`
    : "— chưa có nhóm —";
  const account = ctx.accounts.find((a) => a.id === d.accountId);
  const method = PAYMENT_METHOD_LABELS[d.paymentMethod || "unknown"] ?? d.paymentMethod;
  const iso = d.date ? d.date.toISOString().slice(0, 10) : null;

  const lines = [
    note ? `${note}\n` : "",
    `🧾 <b>${esc(d.supplier || "Chưa rõ nơi mua")}</b>`,
    `💰 <b>${d.totalAmount ? vnd(d.totalAmount) : "— chưa có số tiền —"}</b> · ${TYPE_LABEL[d.type] ?? d.type}`,
    `📅 ${iso ? `${weekdayVi(iso)}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "— chưa có ngày —"}`,
    `🏷 ${esc(groupLabel)}`,
    `💳 ${esc(method)}${
      account ? ` · ${esc(account.name)}${account.last4 ? ` ••${account.last4}` : ""}` : d.paymentMethod === "card" ? " · <i>chưa chọn thẻ nào</i>" : ""
    }`,
  ];
  if (d.notes) lines.push(`📝 ${esc(d.notes.length > 160 ? `${d.notes.slice(0, 160)}…` : d.notes)}`);
  if (d.items.length) {
    const shown = d.items.slice(0, 8).map((i) => `  • ${esc(i.productName)} — ${vnd(i.totalPrice)}`);
    if (d.items.length > 8) shown.push(`  … và ${d.items.length - 8} dòng nữa`);
    lines.push(shown.join("\n"));
  }
  if (d.driveFileIds) lines.push("📎 Ảnh đã lưu trên Drive");

  const miss = missingFields(d);
  if (miss.length) lines.push(`\n⚠️ Thiếu <b>${miss.join(", ")}</b> — trả lời (reply) tin này để bổ sung.`);
  lines.push(`\n<code>Mã nháp: ${shortId(d.id)}</code>`);

  const row1: InlineButton[] = [];
  if (!miss.length) row1.push({ text: "✅ Ghi sổ", callback_data: `ok:${d.id}` });
  row1.push({ text: "✏️ Sửa", callback_data: `edit:${d.id}` }, { text: "❌ Huỷ", callback_data: `no:${d.id}` });
  const keyboard: InlineButton[][] = [row1];
  if (appUrl) keyboard.push([{ text: "Mở hàng chờ duyệt trong app", url: `${appUrl}/finance` }]);

  return { html: lines.filter(Boolean).join("\n"), keyboard: { inline_keyboard: keyboard } };
}

// --- Ghi sổ / huỷ --------------------------------------------------------------

export async function confirmDraft(userId: string, draftId: string, force: boolean): Promise<ApproveResult> {
  const draft = await prisma.draftReceipt.findUnique({ where: { id: draftId }, include: { items: true } });
  if (!draft || draft.userId !== userId) return { ok: false, error: "Không tìm thấy bản nháp", status: 404 };
  const miss = missingFields(draft);
  if (miss.length) return { ok: false, error: `Còn thiếu ${miss.join(", ")}`, status: 400 };

  return approveDraft({
    userId,
    draft,
    formData: {
      date: draft.date!.toISOString().slice(0, 10),
      type: draft.type,
      supplier: draft.supplier,
      categoryGroup: draft.categoryGroup,
      subGroup: draft.subGroup,
      subtotal: draft.subtotal,
      tax: draft.tax,
      serviceCharge: draft.serviceCharge,
      discount: draft.discount,
      totalAmount: draft.totalAmount,
      paymentMethod: draft.paymentMethod,
      accountId: draft.accountId,
      notes: draft.notes,
      projectSplits: draft.projectSplits ?? [],
    },
    items: draft.items.map((i) => ({ ...i })),
    force,
    source: draft.driveFileIds ? "ocr" : "manual",
  });
}

/** Huỷ = Trash_Invoices + đánh dấu Rejected, như nút "bỏ vào thùng rác" của app. Không xoá vĩnh viễn gì. */
export async function rejectDraft(userId: string, draftId: string): Promise<DraftReceipt | null> {
  const draft = await prisma.draftReceipt.findUnique({ where: { id: draftId } });
  if (!draft || draft.userId !== userId || draft.status !== "Pending") return null;
  const fileIds = draft.driveFileIds.split(",").filter(Boolean);
  if (fileIds.length) {
    try {
      const drive = getDriveClient();
      const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
      await moveFilesTo(drive, fileIds, folderIds.TRASH);
    } catch (error) {
      console.error("Bot: huỷ nháp nhưng không dời được ảnh:", error);
    }
  }
  const updated = await prisma.draftReceipt.update({
    where: { id: draft.id },
    data: { status: "Rejected", reviewedAt: new Date() },
  });
  await logOcr({
    userId,
    status: "INFO",
    message: `Bot: huỷ nháp ${draft.supplier ?? "không tên"}${fileIds.length ? " — ảnh vào Trash_Invoices" : ""}`,
    fileId: draft.driveFileIds,
    fileName: draft.driveFileName,
  });
  return updated;
}

export { loadBotContext };
