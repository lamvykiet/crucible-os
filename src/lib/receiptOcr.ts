import { SchemaType, type Schema } from "@google/generative-ai";
import { GEMINI_VISION_MODEL, GEMINI_VISION_CHAIN, modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry } from "@/lib/aiRetry";
import { OCR_SCHEMA, OCR_PROMPT } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { classify, RULE_ORDER, type ClassificationResult } from "@/lib/classify";

/**
 * Đọc hoá đơn bằng Gemini rồi áp quy tắc phân loại — dùng chung cho nút Quét
 * trong app (`api/ocr`), Shortcut iPhone (`api/receipt/upload`) và ảnh gửi vào
 * bot Telegram. Ba nơi cùng một bộ thời gian chờ: chỉnh một chỗ là đủ.
 */

/**
 * Thời gian cho MỘT lượt gọi Gemini, và cho cả chuỗi thử lại.
 *
 * Bản cũ là 20 s / 45 s — ngắn hơn thời gian đọc bình thường: nhật ký OCR ghi
 * lượt thành công mất 11–30 s, và đo 10/10 thì hai model dự phòng mất 23 s cho
 * một hoá đơn 13 món. Mọi lượt hỏng 07/10 và 10/10 đều dừng ở đúng ~20 s.
 * 40 s đủ cho model chậm nhất đọc xong, mà lượt hỏng vẫn còn chỗ nhảy sang
 * model nhanh (2.5-flash-lite, ~9 s).
 */
export const OCR_ATTEMPT_MS = 40_000;
export const OCR_BUDGET_MS = 95_000;

export interface ReceiptImage {
  data: Buffer;
  mimeType: string;
}

export interface OcrItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  suggestedCategoryGroup?: string | null;
  confidence?: number | null;
}

export interface OcrData {
  supplier: string | null;
  date: string | null;
  subtotal: number | null;
  tax: number | null;
  serviceCharge: number | null;
  discount: number | null;
  totalAmount: number | null;
  paymentMethod: string | null;
  language: string | null;
  notes: string | null;
  items: OcrItem[];
}

/**
 * Cây danh mục chi tiêu của người dùng, để Gemini đề xuất nhóm cho CẢ hoá đơn.
 *
 * Trước 18/10 chỉ có gợi ý nhóm cho từng dòng hàng, mà model nhanh hay bỏ trống
 * hoặc trả tên không có trong danh mục ("Food" thay cho "Food & Dining") — hoá
 * đơn AEON đầu tiên qua bot vì thế ra "chưa có nhóm".
 */
async function expenseTree(userId: string) {
  const cats = await prisma.category.findMany({
    where: { userId, active: true, kind: "expense_group" },
    select: { id: true, name: true, nameVi: true, parentId: true },
    orderBy: { name: "asc" },
  });
  const tree = new Map<string, Set<string>>();
  for (const g of cats.filter((c) => !c.parentId)) {
    tree.set(g.name, new Set(cats.filter((c) => c.parentId === g.id).map((c) => c.name)));
  }
  const text = cats
    .filter((c) => !c.parentId)
    .map((g) => {
      const subs = cats.filter((c) => c.parentId === g.id).map((c) => (c.nameVi ? `${c.name} (${c.nameVi})` : c.name));
      return `- ${g.name}${g.nameVi ? ` (${g.nameVi})` : ""}${subs.length ? `: ${subs.join(", ")}` : ""}`;
    })
    .join("\n");
  return { tree, text };
}

export async function readReceipt(
  userId: string,
  images: ReceiptImage[]
): Promise<{ data: OcrData; suggestion: ClassificationResult; usedModel: string }> {
  // Đi qua CHUỖI model chứ không gọi thẳng một model: quá tải là chuyện của
  // riêng từng model (03/10: `gemini-3.6-flash` trả 503 trong khi model khác
  // vẫn chạy). Chuỗi của OCR xếp model NHANH lên trước — `GEMINI_VISION_CHAIN`.
  const { tree, text: treeText } = await expenseTree(userId);
  const schema: Schema = {
    ...OCR_SCHEMA,
    properties: {
      ...(OCR_SCHEMA as { properties: Record<string, Schema> }).properties,
      categoryGroup: { type: SchemaType.STRING, nullable: true, description: "Expense group for the WHOLE receipt, from the list" },
      subGroup: { type: SchemaType.STRING, nullable: true, description: "Sub-group inside that group, from the list" },
    },
  } as Schema;
  const prompt = treeText
    ? `${OCR_PROMPT}\n- Also choose categoryGroup and subGroup for the whole receipt from the user's categories below, using the English names exactly; null when nothing fits. A resort or hotel restaurant away from home is "Travel".\n\nCategories (group: sub-groups):\n${treeText}`
    : OCR_PROMPT;
  const models = modelsWithFallback(
    { generationConfig: { responseMimeType: "application/json", responseSchema: schema } },
    GEMINI_VISION_MODEL,
    GEMINI_VISION_CHAIN
  );
  const parts = images.map((img) => ({
    inlineData: { data: img.data.toString("base64"), mimeType: img.mimeType },
  }));
  const result = await generateWithRetry(models, [prompt, ...parts], {
    timeoutMs: OCR_ATTEMPT_MS,
    totalBudgetMs: OCR_BUDGET_MS,
  });
  const raw = JSON.parse(result.response.text()) as OcrData & { categoryGroup?: string | null; subGroup?: string | null };
  const { categoryGroup: aiGroup, subGroup: aiSub, ...data } = raw;
  data.items = Array.isArray(data.items) ? data.items : [];

  // Quy tắc trước, Gemini sau: nếu người dùng đã dạy hệ thống nhà cung cấp này
  // thuộc nhóm nào thì dùng luôn, gợi ý của mô hình chỉ là phương án dự phòng.
  const rules = await prisma.classificationRule.findMany({
    where: { userId, active: true },
    orderBy: RULE_ORDER,
  });
  const ruled = classify(rules, data);
  if (ruled.categoryGroup) return { data, suggestion: ruled, usedModel: result.usedModel };

  // Không quy tắc nào khớp: dùng đề xuất của Gemini, nhưng chỉ khi nó trỏ tới
  // danh mục có thật.
  const group = aiGroup && tree.has(aiGroup) ? aiGroup : undefined;
  const sub = group && aiSub && tree.get(group)!.has(aiSub) ? aiSub : undefined;
  return { data, suggestion: { ...ruled, categoryGroup: group, subGroup: sub }, usedModel: result.usedModel };
}
