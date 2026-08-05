import { normalizeSupplier } from "@/lib/invoice";

export const MATCH_TYPES = ["vendor", "product_keyword", "note_keyword"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const MATCH_TYPE_LABELS: Record<string, string> = {
  vendor: "Nhà cung cấp",
  product_keyword: "Từ khoá mặt hàng",
  note_keyword: "Từ khoá ghi chú",
};

/** Ưu tiên của quy tắc học được từ một lần sửa tay: luôn thắng quy tắc gõ tay chung chung. */
export const LEARNED_RULE_PRIORITY = 50;
export const MANUAL_RULE_PRIORITY = 100;

interface RuleLike {
  id: string;
  matchType: string;
  matchValue: string;
  transactionType: string | null;
  categoryGroup: string;
  subGroup: string | null;
  priority: number;
  active: boolean;
}

interface ReceiptLike {
  supplier?: string | null;
  notes?: string | null;
  items?: Array<{ productName?: string | null }> | null;
}

export interface ClassificationResult {
  type?: string;
  categoryGroup?: string;
  subGroup?: string;
  matchedRuleId?: string;
  matchedBy?: MatchType;
}

/**
 * Áp quy tắc phân loại lên một hoá đơn vừa OCR xong.
 *
 * Thứ tự do hệ "Sổ Chi Tiêu" đặt ra và giữ nguyên ở đây: **quy tắc trước, Gemini
 * sau**. Gợi ý của Gemini chỉ được dùng khi không quy tắc nào khớp — người dùng
 * đã tự tay dạy hệ thống "Satrafoods là Groceries" thì không có lý do gì để một
 * mô hình đoán lại mỗi lần.
 *
 * Quy tắc `priority` nhỏ hơn được xét trước; cùng priority thì cái tạo sau thắng
 * (nơi gọi sắp xếp sẵn theo thứ tự đó).
 */
export function classify(rules: RuleLike[], receipt: ReceiptLike): ClassificationResult {
  const supplier = normalizeSupplier(receipt.supplier);
  const notes = normalizeSupplier(receipt.notes);
  const products = (receipt.items ?? []).map((i) => normalizeSupplier(i?.productName));

  for (const rule of rules) {
    if (!rule.active || !rule.matchValue) continue;

    const needle = rule.matchValue;
    let hit = false;

    switch (rule.matchType) {
      case "vendor":
        hit = supplier.length > 0 && supplier.includes(needle);
        break;
      case "product_keyword":
        hit = products.some((p) => p.includes(needle));
        break;
      case "note_keyword":
        hit = notes.length > 0 && notes.includes(needle);
        break;
    }

    if (hit) {
      return {
        type: rule.transactionType ?? undefined,
        categoryGroup: rule.categoryGroup,
        subGroup: rule.subGroup ?? undefined,
        matchedRuleId: rule.id,
        matchedBy: rule.matchType as MatchType,
      };
    }
  }

  return {};
}

/** Thứ tự xét quy tắc: priority tăng dần, rồi mới tới quy tắc tạo gần đây nhất. */
export const RULE_ORDER = [{ priority: "asc" as const }, { createdAt: "desc" as const }];
