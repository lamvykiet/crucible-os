"use client";

import { useLanguage } from "@/lib/LanguageContext";

// Ô chọn nhóm phụ, dùng chung cho ba hộp thoại ghi giao dịch: nhập tay, quét
// hoá đơn, và duyệt hoá đơn.
//
// Phải là <select> thật, không phải <input list> + <datalist>: Safari trên
// iPhone không hiện gợi ý của datalist, nên ở bước quét và bước duyệt người
// dùng chỉ thấy một ô trống phải tự gõ đúng tên chuẩn (lỗi 12/10/2026). Hộp
// nhập tay vốn dùng <select> nên không bị.
//
// `value` luôn là tên CHUẨN tiếng Anh (thứ được ghi xuống DB); chỉ phần chữ hiển
// thị mới đi qua `label()` — xem `useCategories`.

interface Props {
  value: string;
  /** Tên chuẩn các nhóm phụ của nhóm đang chọn (`subGroupsOf(group)`). */
  options: string[];
  label: (name: string) => string;
  onChange: (value: string) => void;
  className: string;
  name?: string;
}

export default function SubGroupSelect({ value, options, label, onChange, className, name = "subGroup" }: Props) {
  const { t } = useLanguage();
  // Giá trị AI gợi ý (hoặc dữ liệu cũ) không có trong danh mục: vẫn hiện ra
  // thành một lựa chọn riêng. <select> thiếu option khớp sẽ HIỆN "— Không chọn —"
  // trong khi state vẫn giữ giá trị cũ — người dùng tưởng đã trống mà lưu xuống
  // lại là giá trị kia.
  const orphan = value && !options.includes(value) ? value : null;

  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("Sub-group", "Nhóm phụ")}
      className={className}
    >
      <option value="">{t("— None —", "— Không chọn —")}</option>
      {orphan && (
        <option value={orphan}>
          {label(orphan)} {t("(not in categories)", "(chưa có trong danh mục)")}
        </option>
      )}
      {options.map((sub) => (
        <option key={sub} value={sub}>
          {label(sub)}
        </option>
      ))}
    </select>
  );
}
