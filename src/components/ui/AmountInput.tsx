"use client";

import React, { useLayoutEffect, useRef } from "react";

/**
 * Ô nhập tiền hiện dấu chấm ngăn hàng nghìn: 1.250.000 — đúng cách viết tiền ở
 * mọi chỗ khác trong app.
 *
 * `type="number"` của trình duyệt không cho chèn dấu ngăn (và còn đẻ ra cặp mũi
 * tên tăng/giảm vô dụng với số tiền), nên ô này là `type="text"`. Chỉ phần
 * **hiển thị** có dấu chấm; thứ trả ra qua `onValueChange` vẫn là chuỗi số thô
 * — "1250000" — đúng giá trị form vẫn giữ trong state và gửi lên API từ trước,
 * nên không chỗ nào phải đổi cách parse hay đổi payload.
 *
 * Dấu phẩy là dấu thập phân (kiểu Việt), giữ lại cho những số lẻ hiếm hoi từ
 * OCR; dấu chấm người dùng gõ vào bị bỏ qua vì nó là dấu ngăn.
 */

/** "1250000" → "1.250.000". Nhận cả chuỗi lẫn số. */
export function formatAmount(raw: string): string {
  if (raw === "") return "";
  const [int, dec] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec === undefined ? grouped : `${grouped},${dec}`;
}

/** Chiều ngược lại: gỡ dấu ngăn, trả về chuỗi mà `Number()` đọc được. */
export function parseAmount(text: string): string {
  // Một dấu phẩy là dấu thập phân; nhiều dấu phẩy nghĩa là chuỗi dán vào đang
  // viết kiểu Anh ("1,250,000") — lúc đó phẩy cũng chỉ là dấu ngăn.
  const decimalComma = (text.match(/,/g) || []).length === 1;
  let int = "";
  let dec = "";
  let hasComma = false;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      if (hasComma) dec += ch;
      else int += ch;
    } else if (ch === "," && decimalComma) {
      hasComma = true;
    }
  }
  int = int.replace(/^0+(?=\d)/, "");
  return hasComma ? `${int}.${dec}` : int;
}

/**
 * Đặt con trỏ sau đúng `want` ký tự có nghĩa (chữ số và dấu phẩy). Đếm theo ký
 * tự có nghĩa chứ không theo vị trí, vì việc chèn/bỏ dấu chấm làm chuỗi dài
 * ngắn khác nhau — gõ giữa số mà con trỏ nhảy về cuối là lỗi hay gặp nhất của
 * kiểu ô này.
 */
function placeCaret(el: HTMLInputElement, want: number) {
  let pos = 0;
  let seen = 0;
  while (pos < el.value.length && seen < want) {
    if (/[\d,]/.test(el.value[pos])) seen++;
    pos++;
  }
  el.setSelectionRange(pos, pos);
}

type AmountInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: string | number | null | undefined;
  /** Nhận chuỗi số thô, không dấu ngăn. Chuỗi rỗng nghĩa là ô trống. */
  onValueChange: (raw: string) => void;
};

export default function AmountInput({
  value,
  onValueChange,
  inputMode = "numeric",
  ...rest
}: AmountInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Lượt render nào cũng kiểm: nếu vừa gõ thì trả con trỏ về đúng chỗ.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current === null) return;
    placeCaret(el, caret.current);
    caret.current = null;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const text = el.value;
    const want = (text.slice(0, el.selectionStart ?? text.length).match(/[\d,]/g) || []).length;
    const raw = parseAmount(text);
    const next = formatAmount(raw);

    // Gõ một ký tự lạ thì `raw` không đổi ⇒ state không đổi ⇒ React không render
    // lại ⇒ ký tự đó nằm lại trong ô. Nên sửa thẳng DOM ở đây, rồi mới báo lên.
    if (next !== text) {
      el.value = next;
      placeCaret(el, want);
    } else {
      caret.current = want;
    }
    onValueChange(raw);
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={inputMode}
      value={formatAmount(value === null || value === undefined ? "" : String(value))}
      onChange={handleChange}
    />
  );
}
