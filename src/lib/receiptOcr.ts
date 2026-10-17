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

export async function readReceipt(
  userId: string,
  images: ReceiptImage[]
): Promise<{ data: OcrData; suggestion: ClassificationResult; usedModel: string }> {
  // Đi qua CHUỖI model chứ không gọi thẳng một model: quá tải là chuyện của
  // riêng từng model (03/10: `gemini-3.6-flash` trả 503 trong khi model khác
  // vẫn chạy). Chuỗi của OCR xếp model NHANH lên trước — `GEMINI_VISION_CHAIN`.
  const models = modelsWithFallback(
    { generationConfig: { responseMimeType: "application/json", responseSchema: OCR_SCHEMA } },
    GEMINI_VISION_MODEL,
    GEMINI_VISION_CHAIN
  );
  const parts = images.map((img) => ({
    inlineData: { data: img.data.toString("base64"), mimeType: img.mimeType },
  }));
  const result = await generateWithRetry(models, [OCR_PROMPT, ...parts], {
    timeoutMs: OCR_ATTEMPT_MS,
    totalBudgetMs: OCR_BUDGET_MS,
  });
  const data = JSON.parse(result.response.text()) as OcrData;
  data.items = Array.isArray(data.items) ? data.items : [];

  // Quy tắc trước, Gemini sau: nếu người dùng đã dạy hệ thống nhà cung cấp này
  // thuộc nhóm nào thì dùng luôn, gợi ý của mô hình chỉ là phương án dự phòng.
  const rules = await prisma.classificationRule.findMany({
    where: { userId, active: true },
    orderBy: RULE_ORDER,
  });
  return { data, suggestion: classify(rules, data), usedModel: result.usedModel };
}
