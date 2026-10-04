"use client";

import { Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import AmountInput from "@/components/ui/AmountInput";

// Danh sách món hàng của một hoá đơn, mỗi món HAI dòng: dòng trên để nguyên bề
// ngang cho tên, dòng dưới gom số lượng - đơn giá - thành tiền.
//
// Bản cũ là bảng năm cột. Tên sản phẩm trên hoá đơn Việt rất dài ("SỮA TƯƠI
// TIỆT TRÙNG…") trong khi ba cột số bên phải chiếm chỗ cố định, nên cột tên bị
// bóp còn khoảng 60px và hiện đúng bốn chữ cái. Mà tên lại chính là thứ duy
// nhất cần ĐỌC để kiểm tra OCR quét có đúng chưa — ba cột số kia chỉ cần liếc.
//
// Nút xoá nằm ở dòng trên cạnh tên, không ở dòng dưới: ở khổ 375px, trừ đi nút
// 44px thì hai ô tiền còn chưa tới 95px mỗi ô, mà "1.095.000" ở cỡ chữ 16px
// (sàn bắt buộc trên mobile, xem globals.css) đã chiếm gần hết chỗ đó.
//
// Dùng chung cho cả ba hộp thoại ghi giao dịch. Bảng cũ từng được chép ba lần
// với ba bộ class hơi khác nhau, nên cùng một hoá đơn trông khác nhau tuỳ theo
// vào bằng đường nào.

export interface EditableLineItem {
  productName: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
}

export type LineItemField = "productName" | "quantity" | "unitPrice" | "totalPrice";

interface Props {
  items: EditableLineItem[];
  onChange: (index: number, field: LineItemField, value: string) => void;
  onRemove: (index: number) => void;
  /** Gợi ý cho ô tên khi hàng mới còn trống. */
  namePlaceholder?: string;
}

// `text-base md:text-sm`: dưới 768px iOS Safari phóng to cả trang khi chạm vào
// ô nhập có cỡ chữ dưới 16px. globals.css đã đặt sàn trong @layer base, nhưng
// một utility `text-sm` viết ở đây sẽ ghi đè đúng cái sàn đó.
const fieldClass =
  "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-2 " +
  "text-base md:text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]";

const labelClass =
  "block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1";

export default function LineItemsEditor({
  items,
  onChange,
  onRemove,
  namePlaceholder,
}: Props) {
  const { t } = useLanguage();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] py-6 text-center text-sm text-[var(--color-text-faint)]">
        {t("No line items", "Không có dữ liệu mặt hàng")}
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item, idx) => (
        <li
          key={idx}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
        >
          {/* Dòng 1 — tên, chiếm trọn bề ngang còn lại. Số thứ tự nằm trong
              nhãn chứ không thành một cột riêng: hoá đơn 16 dòng thì cần biết
              đang xem dòng mấy, nhưng một cột riêng ăn mất 24px của đúng cái ô
              đang thiếu chỗ. */}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className={labelClass}>
                <span className="tabular-nums text-[var(--color-text-faint)]">{idx + 1}</span>
                {" · "}
                {t("Item", "Mặt hàng")}
              </label>
              <input
                type="text"
                value={item.productName}
                onChange={(e) => onChange(idx, "productName", e.target.value)}
                placeholder={namePlaceholder}
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              aria-label={t("Remove line", "Xoá dòng")}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-tint)] transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Dòng 2 — ba con số. Nhãn nhỏ trên từng ô: bỏ hàng tiêu đề của bảng
              đi thì "58.000" cạnh "58.000" không còn gì phân biệt đơn giá với
              thành tiền. */}
          {/* Chặn bề ngang: ở hộp thoại nhập tay (rộng cả màn hình) ba ô số
              kéo dài ra thành ba hộp rỗng mênh mông, trong khi "18.900" chỉ cần
              chừng này. Cột món hàng của hai hộp thoại OCR hẹp hơn mức chặn nên
              không bị ảnh hưởng. */}
          <div className="mt-2.5 grid grid-cols-[3.25rem_1fr_1fr] gap-2 max-w-xl">
            <div>
              <label className={labelClass}>{t("Qty", "SL")}</label>
              <input
                type="number"
                inputMode="decimal"
                value={item.quantity}
                onChange={(e) => onChange(idx, "quantity", e.target.value)}
                className={`${fieldClass} text-center px-1`}
              />
            </div>
            <div>
              <label className={labelClass}>{t("Price", "Đơn giá")}</label>
              <AmountInput
                value={item.unitPrice}
                onValueChange={(v) => onChange(idx, "unitPrice", v)}
                className={`${fieldClass} text-right`}
              />
            </div>
            <div>
              <label className={labelClass}>{t("Amount", "Thành tiền")}</label>
              <AmountInput
                value={item.totalPrice}
                onValueChange={(v) => onChange(idx, "totalPrice", v)}
                className={`${fieldClass} text-right font-bold`}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
