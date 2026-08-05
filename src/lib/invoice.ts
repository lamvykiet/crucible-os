import { SchemaType, type Schema } from "@google/generative-ai";

/**
 * Hợp đồng JSON cho Gemini khi đọc hoá đơn.
 *
 * Đây là bản chuyển thể của contract đã chạy ổn định trong dự án "Sổ Chi Tiêu"
 * (Apps Script + Google Sheets). Bản trước của Crucible chỉ lấy 8 trường nên
 * `serviceCharge`, `paymentMethod`, `notes` và ngôn ngữ hoá đơn bị mất trắng.
 *
 * Mọi trường đều `nullable`: nguyên tắc bất di bất dịch của luồng cũ là "đọc
 * không ra thì trả null, tuyệt đối không đoán" — một con số bịa ra còn tệ hơn ô
 * trống, vì ô trống thì người dùng nhìn thấy và tự điền.
 */
export const OCR_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    supplier: { type: SchemaType.STRING, nullable: true, description: "Store or supplier name exactly as printed" },
    date: { type: SchemaType.STRING, nullable: true, description: "Receipt date, strictly YYYY-MM-DD" },
    subtotal: { type: SchemaType.NUMBER, nullable: true, description: "Amount before tax/service/discount" },
    tax: { type: SchemaType.NUMBER, nullable: true, description: "Tax (VAT) amount" },
    serviceCharge: { type: SchemaType.NUMBER, nullable: true, description: "Service charge amount" },
    discount: { type: SchemaType.NUMBER, nullable: true, description: "Discount amount as a positive number" },
    totalAmount: { type: SchemaType.NUMBER, nullable: true, description: "Final amount actually paid" },
    paymentMethod: {
      type: SchemaType.STRING,
      nullable: true,
      format: "enum",
      enum: ["cash", "card", "bank_transfer", "e-wallet", "unknown"],
      description: "Payment method printed on the receipt; 'unknown' when not stated",
    },
    language: {
      type: SchemaType.STRING,
      nullable: true,
      format: "enum",
      enum: ["vi", "en", "mixed"],
      description: "Dominant language of the receipt text",
    },
    notes: {
      type: SchemaType.STRING,
      nullable: true,
      description: "Anything noteworthy: invoice number, cashier, loyalty card",
    },
    items: {
      type: SchemaType.ARRAY,
      description: "One entry per purchased line item",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          productName: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unitPrice: { type: SchemaType.NUMBER },
          totalPrice: { type: SchemaType.NUMBER },
          suggestedCategoryGroup: {
            type: SchemaType.STRING,
            nullable: true,
            description: "Best-guess expense group for this line",
          },
          confidence: { type: SchemaType.NUMBER, nullable: true, description: "0..1 confidence for the suggestion" },
        },
        required: ["productName", "quantity", "unitPrice", "totalPrice"],
      },
    },
  },
  required: ["supplier", "date", "totalAmount", "items"],
};

export const OCR_PROMPT = `You are reading Vietnamese retail receipts (supermarket, convenience store, restaurant). The images may be several photos of ONE long receipt — merge them into a single result and do not repeat line items that appear in the overlap.

Rules:
- Currency is Vietnamese Dong (VND). Every monetary value must be an INTEGER with no decimals.
- Dots and commas inside amounts are thousands separators, never decimal points: "139.900" and "139,900" both mean the integer 139900. A trailing ",00" or ".00" is decoration — drop it, never read it as cents.
- Date must be strictly YYYY-MM-DD. Vietnamese receipts print DD/MM/YYYY, so "05/04/2026" means 2026-04-05.
- discount is a POSITIVE number.
- If a value is not printed on the receipt, return null. Never infer it, never compute it from the other fields, never guess a plausible number.
- Read line items from the printed item table only. Do not invent items to make the totals add up.`;

/**
 * Chuẩn hoá tên nhà cung cấp để so khớp trùng lặp.
 *
 * OCR đọc cùng một cửa hàng ra "Satrafoods", "SATRAFOODS " hay "Satrafoods Tân
 * Hoà Đông" tuỳ độ nét của ảnh. So sánh chuỗi thô sẽ bỏ lọt gần hết các ca
 * trùng, nên bỏ dấu tiếng Việt, hạ chữ thường và gộp khoảng trắng trước khi so.
 */
export function normalizeSupplier(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Khoảng thời gian của một ngày hoá đơn, tính bằng UTC.
 *
 * `new Date("2026-04-05")` cho ra nửa đêm UTC, nhưng `setHours(0,0,0,0)` lại
 * đặt theo giờ máy chủ — hai cách hiểu lệch nhau đúng bằng offset timezone, nên
 * cùng một hoá đơn sẽ lọt hoặc không lọt khoảng tìm kiếm tuỳ nơi deploy (máy VN
 * hay Vercel UTC). Module dashboard đã gặp và sửa đúng lỗi này; ở đây dùng cùng
 * một cách tiếp cận: mọi mốc đều là UTC tường minh.
 */
export function utcDayRange(date: string | Date): { start: Date; end: Date } {
  const d = typeof date === "string" ? new Date(date) : date;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

/** Ép về số nguyên VND; trả null cho chuỗi rỗng hoặc giá trị không phải số. */
export function toVnd(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "e-wallet", "unknown"] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  card: "Thẻ",
  bank_transfer: "Chuyển khoản",
  "e-wallet": "Ví điện tử",
  unknown: "Không rõ",
};
