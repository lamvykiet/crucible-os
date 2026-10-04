"use client";

import { ChevronDown, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { accountLabel, type AccountOption } from "@/lib/useAccounts";

// Ô chọn "tiền ra/vào tài khoản nào", dùng chung cho cả ba hộp thoại ghi giao
// dịch: nhập tay, quét hoá đơn, và duyệt hoá đơn.
//
// `paymentMethod` chỉ nói "trả bằng thẻ". Có ba thẻ tín dụng thì câu đó không
// đủ để biết dư nợ thẻ nào tăng lên — mà dư nợ từng thẻ mới là thứ màn hình Tài
// khoản hiển thị. Nên chọn "Thẻ" mà bỏ trống ô này là giao dịch rơi vào khoảng
// không: nó vào sổ chi tiêu nhưng không đụng tới số dư nào cả.

const KIND_ORDER = ["credit_card", "bank", "ewallet", "cash"] as const;

const KIND_LABELS: Record<string, [string, string]> = {
  credit_card: ["Credit cards", "Thẻ tín dụng"],
  bank: ["Bank accounts", "Tài khoản ngân hàng"],
  ewallet: ["E-wallets", "Ví điện tử"],
  cash: ["Cash", "Tiền mặt"],
};

interface Props {
  accounts: AccountOption[];
  value: string;
  onChange: (accountId: string) => void;
  /** Expense | Income | Transfer — chỉ để đổi nhãn cho đúng chiều tiền. */
  type?: string;
  /** Dùng để cảnh báo khi đã chọn "Thẻ" mà chưa chỉ ra thẻ nào. */
  paymentMethod?: string;
  selectClassName: string;
  labelClassName: string;
  name?: string;
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  type = "Expense",
  paymentMethod,
  selectClassName,
  labelClassName,
  name = "accountId",
}: Props) {
  const { t } = useLanguage();

  // Chưa khai báo tài khoản nào thì không có gì để chọn — ẩn hẳn thay vì hiện
  // một ô rỗng không bấm được.
  if (accounts.length === 0) return null;

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: accounts.filter((a) => a.kind === kind),
  })).filter((g) => g.items.length > 0);
  const ungrouped = accounts.filter(
    (a) => !KIND_ORDER.includes(a.kind as (typeof KIND_ORDER)[number])
  );

  const missingCard = paymentMethod === "card" && !value;

  return (
    <div>
      <label className={labelClassName}>
        {type === "Income"
          ? t("Money into", "Tiền vào tài khoản")
          : type === "Transfer"
            ? t("Paid from", "Chuyển từ tài khoản")
            : t("Paid from", "Trả từ tài khoản")}
      </label>
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${selectClassName} appearance-none pr-10 ${
            missingCard ? "border-[var(--color-warning)]" : ""
          }`}
        >
          <option value="">{t("— Not set —", "— Chưa chọn —")}</option>
          {groups.map((g) => (
            <optgroup key={g.kind} label={t(KIND_LABELS[g.kind][0], KIND_LABELS[g.kind][1])}>
              {g.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </optgroup>
          ))}
          {ungrouped.map((a) => (
            <option key={a.id} value={a.id}>
              {accountLabel(a)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
        />
      </div>

      {missingCard && (
        <p className="mt-1 text-xs text-[var(--color-warning)] flex items-start gap-1.5">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {t(
            "Paid by card — pick which one, or the card balance will not move.",
            "Đã chọn trả bằng thẻ — chọn thẻ nào, nếu không dư nợ thẻ sẽ không đổi."
          )}
        </p>
      )}
    </div>
  );
}
