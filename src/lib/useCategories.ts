"use client";

import { useEffect, useState } from "react";

export interface CategoryGroup {
  id: string;
  name: string;
  children: string[];
}

interface CategoryData {
  expenseGroups: CategoryGroup[];
  incomeGroups: CategoryGroup[];
  transactionTypes: string[];
}

const EMPTY: CategoryData = { expenseGroups: [], incomeGroups: [], transactionTypes: [] };

// Danh mục gần như không đổi trong một phiên làm việc nhưng cả ba modal đều
// cần, nên cache ở cấp module: mở modal lần thứ hai không gọi lại API.
let cache: CategoryData | null = null;
let inFlight: Promise<CategoryData> | null = null;

async function load(): Promise<CategoryData> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetch("/api/finance/categories")
      .then((res) => res.json())
      .then((json) => {
        cache = json?.success ? (json.data as CategoryData) : EMPTY;
        return cache;
      })
      .catch(() => EMPTY)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Danh mục thu/chi lấy từ bảng `Category`, thay cho các mảng viết cứng trước đây.
 *
 * Quy ước kế thừa từ hệ "Sổ Chi Tiêu": bản ghi Income dùng nhóm thu nhập, mọi
 * loại còn lại (Expense/Transfer/Refund/Adjustment) dùng nhóm chi tiêu.
 */
export function useCategories(type?: string) {
  const [data, setData] = useState<CategoryData>(cache ?? EMPTY);
  const [isLoading, setIsLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    load().then((d) => {
      if (!alive) return;
      setData(d);
      setIsLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const groups = type === "Income" ? data.incomeGroups : data.expenseGroups;

  return {
    isLoading,
    groups,
    groupNames: groups.map((g) => g.name),
    subGroupsOf: (groupName: string) => groups.find((g) => g.name === groupName)?.children ?? [],
  };
}
