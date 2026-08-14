"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

export interface CategoryNode {
  name: string;
  nameVi: string | null;
}

export interface CategoryGroup extends CategoryNode {
  id: string;
  children: CategoryNode[];
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

/** Gọi sau khi sửa danh mục ở màn hình Cài đặt, để các modal thấy thay đổi. */
export function invalidateCategories() {
  cache = null;
}

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
 *
 * `groupNames` và `subGroupsOf` trả về tên CHUẨN (tiếng Anh) — đó là thứ được
 * ghi vào Transaction.categoryGroup/subGroup. Muốn hiện chữ cho người đọc thì
 * bọc qua `label()`. Đừng đảo ngược: lưu nhãn tiếng Việt xuống DB sẽ làm dữ
 * liệu tách đôi giữa hai ngôn ngữ.
 */
export function useCategories(type?: string) {
  const { language } = useLanguage();
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

  // Tra nhãn theo tên chuẩn. Gộp cả hai hệ nhóm để nhãn vẫn đúng khi màn hình
  // đang xem chi tiêu nhưng hiển thị một bản ghi thu nhập.
  const labels = new Map<string, string | null>();
  for (const g of [...data.expenseGroups, ...data.incomeGroups]) {
    labels.set(g.name, g.nameVi);
    for (const c of g.children) labels.set(c.name, c.nameVi);
  }

  /** Nhãn hiển thị. Chưa có bản dịch thì lùi về tên chuẩn thay vì để trống. */
  const label = (name: string) =>
    language === "vi" ? labels.get(name) || name : name;

  return {
    isLoading,
    groups,
    label,
    groupNames: groups.map((g) => g.name),
    subGroupsOf: (groupName: string) =>
      groups.find((g) => g.name === groupName)?.children.map((c) => c.name) ?? [],
  };
}
