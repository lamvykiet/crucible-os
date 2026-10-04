"use client";

import { useEffect, useState } from "react";

// Danh sách tài khoản thanh toán để điền vào ô chọn.
//
// Ba hộp thoại cùng cần nó (nhập tay, quét hoá đơn, duyệt hoá đơn). Viết lại ba
// lần là ba cơ hội để một chỗ quên lọc tài khoản đã đóng, rồi người dùng ghi
// một khoản chi vào cái thẻ đã cắt mà không có gì cản.

export interface AccountOption {
  id: string;
  name: string;
  /** bank | credit_card | cash | ewallet */
  kind: string;
  last4: string | null;
}

/** "VPBank S Rewards Mastercard ···5901" */
export function accountLabel(a: AccountOption) {
  return a.last4 ? `${a.name} ···${a.last4}` : a.name;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/finance/accounts", { signal: controller.signal });
        const json = await res.json();
        if (ignore || !json.success) return;
        setAccounts(
          (json.data.accounts as (AccountOption & { status: string })[])
            .filter((a) => a.status !== "closed")
            .map(({ id, name, kind, last4 }) => ({ id, name, kind, last4 }))
        );
      } catch {
        // Không có tài khoản nào thì ô chọn ẩn đi — giao dịch vẫn ghi được,
        // chỉ là chưa trỏ vào tài khoản nào. Đừng chặn cả form vì chuyện này.
      }
    })();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  return accounts;
}
