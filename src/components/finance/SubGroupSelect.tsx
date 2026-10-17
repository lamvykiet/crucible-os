"use client";

import { useState, type ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { reloadCategories, useCategories } from "@/lib/useCategories";

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
//
// Giao dịch không khớp nhóm phụ nào thì tạo luôn tại chỗ ("+ Tạo nhóm phụ mới…"),
// khỏi phải bỏ dở hoá đơn để sang Cài đặt. Tạo xong thì mọi hộp thoại đang mở
// đều thấy nhóm mới (`reloadCategories`).

/** Giá trị giả của lựa chọn "tạo mới" — không bao giờ được ghi vào formData. */
const CREATE = "__create_sub_group__";

interface Props {
  value: string;
  /** Tên chuẩn của nhóm cha đang chọn (`formData.categoryGroup`). */
  group: string;
  /** Loại giao dịch — Income dùng nhóm thu nhập, còn lại dùng nhóm chi tiêu. */
  type?: string;
  onChange: (value: string) => void;
  className: string;
  name?: string;
  /** Vẽ đè lên ô <select> (vd. mũi tên tự vẽ khi `appearance-none`). */
  trailing?: ReactNode;
}

export default function SubGroupSelect({ value, group, type, onChange, className, name = "subGroup", trailing }: Props) {
  const { t } = useLanguage();
  const { subGroupsOf, groupOf, label } = useCategories(type);
  const options = subGroupsOf(group);
  const parent = groupOf(group);

  const [creating, setCreating] = useState(false);
  const [en, setEn] = useState("");
  const [vi, setVi] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Giá trị AI gợi ý (hoặc dữ liệu cũ) không có trong danh mục: vẫn hiện ra
  // thành một lựa chọn riêng. <select> thiếu option khớp sẽ HIỆN "— Không chọn —"
  // trong khi state vẫn giữ giá trị cũ — người dùng tưởng đã trống mà lưu xuống
  // lại là giá trị kia.
  const orphan = value && !options.includes(value) ? value : null;

  const open = () => {
    // AI gợi ý một tên chưa có trong danh mục: điền sẵn nó làm tên chuẩn.
    setEn(orphan ?? "");
    setVi("");
    setError(null);
    setCreating(true);
  };

  const save = async () => {
    // Điền một ô cũng được: chỉ có nhãn Việt thì nó làm luôn tên chuẩn.
    const nameEn = en.trim() || vi.trim();
    if (!nameEn || !parent || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: type === "Income" ? "income_group" : "expense_group",
          name: nameEn,
          nameVi: vi.trim() || null,
          parentId: parent.id,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.success) throw new Error(json?.error || t("Could not create", "Không tạo được"));
      // Tải lại TRƯỚC khi chọn, nếu không ô chọn kịp hiện "(chưa có trong danh mục)".
      await reloadCategories();
      onChange(json.category.name);
      setCreating(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (creating) {
    const field = `${className} !pr-4`;
    return (
      <div className="space-y-2">
        <input
          autoFocus
          value={en}
          onChange={(e) => setEn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") setCreating(false);
          }}
          placeholder={t("Name (English)", "Tên (tiếng Anh)")}
          aria-label={t("New sub-group name (English)", "Tên nhóm phụ mới (tiếng Anh)")}
          className={field}
        />
        <input
          value={vi}
          onChange={(e) => setVi(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") setCreating(false);
          }}
          placeholder={t("Vietnamese label", "Nhãn tiếng Việt")}
          aria-label={t("Vietnamese label", "Nhãn tiếng Việt")}
          className={field}
        />
        {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || !(en.trim() || vi.trim())}
            className="c-btn c-btn-primary c-btn-sm flex-1 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {t("Create", "Tạo")}
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            disabled={busy}
            aria-label={t("Cancel", "Huỷ")}
            className="c-btn c-btn-sm c-btn-icon"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-[var(--color-text-faint)]">
          {t(
            `Added under “${label(group)}”. Rename or turn off in Settings.`,
            `Thêm vào nhóm “${label(group)}”. Sửa hay tắt được ở Cài đặt.`
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={(e) => (e.target.value === CREATE ? open() : onChange(e.target.value))}
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
        {/* Chưa chọn nhóm cha thì không có chỗ để gắn nhóm phụ mới vào. */}
        {parent && <option value={CREATE}>{t("+ New sub-group…", "+ Tạo nhóm phụ mới…")}</option>}
      </select>
      {trailing}
    </div>
  );
}
