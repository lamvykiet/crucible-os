"use client";

import { useEffect, useState } from "react";

export interface SupplierDefaults {
  categoryGroup: string;
  subGroup: string | null;
}

export interface SupplierSuggestion {
  /** Tên hiển thị, theo cách viết người dùng dùng nhiều nhất. */
  name: string;
  /** Số giao dịch đã dùng tên này — dùng để xếp hạng gợi ý. */
  count: number;
  lastUsedAt: string | null;
  /**
   * Nhóm/danh mục con hay dùng nhất của nơi này, tra theo loại giao dịch
   * ("Expense" | "Income" | ...). Tách theo loại vì cùng một cái tên có thể
   * vừa là nơi chi vừa là nguồn thu.
   */
  defaultsByType: Record<string, SupplierDefaults | undefined>;
}

// Cùng cách làm với useCategories: cache ở cấp module để mở lại modal không gọi
// API lần nữa. Khác một điểm — danh sách nơi chi dài thêm mỗi lần lưu giao
// dịch, nên cache phải có hạn dùng, nếu không một phiên làm việc dài sẽ mãi
// gợi ý theo ảnh chụp lúc mới mở app.
const TTL_MS = 5 * 60 * 1000;

let cache: SupplierSuggestion[] | null = null;
let cachedAt = 0;
let inFlight: Promise<SupplierSuggestion[]> | null = null;

/** Gọi ngay sau khi lưu giao dịch, để nơi chi vừa gõ xuất hiện ở lần mở sau. */
export function invalidateSuppliers() {
  cache = null;
}

async function load(): Promise<SupplierSuggestion[]> {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  if (!inFlight) {
    inFlight = fetch("/api/finance/suppliers")
      .then((res) => res.json())
      .then((json) => {
        cache = json?.success ? (json.data as SupplierSuggestion[]) : [];
        cachedAt = Date.now();
        return cache;
      })
      // Gợi ý là tiện ích, không phải điều kiện để nhập liệu: hỏng mạng thì ô
      // nhập vẫn là ô nhập chữ bình thường.
      .catch(() => [] as SupplierSuggestion[])
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Danh sách nơi chi / nguồn thu đã từng dùng, cho ô nhập gợi ý. */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<SupplierSuggestion[]>(cache ?? []);

  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive) setSuppliers(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return suppliers;
}
