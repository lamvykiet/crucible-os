"use client";

import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { ProjectOption } from "@/lib/useProjects";

// Ô chọn "giao dịch này thuộc dự án nào", dùng chung cho ba hộp thoại ghi giao
// dịch: nhập tay, quét hoá đơn, và duyệt hoá đơn. Thêm ở một chỗ mà quên hai
// chỗ kia là hoá đơn quét vào sổ không gắn dự án, và vốn dự án đếm thiếu mà
// không báo gì — đúng cái bẫy đã gặp với ô chọn tài khoản.

interface Props {
  projects: ProjectOption[];
  value: string;
  onChange: (projectId: string) => void;
  /** Expense | Income | Refund — chỉ ba loại này có nghĩa với dự án. */
  type?: string;
  selectClassName: string;
  labelClassName: string;
}

export default function ProjectSelect({
  projects,
  value,
  onChange,
  type = "Expense",
  selectClassName,
  labelClassName,
}: Props) {
  const { t } = useLanguage();

  // Chuyển khoản/điều chỉnh không phải tiền vào hay ra khỏi dự án.
  if (!["Expense", "Income", "Refund"].includes(type)) return null;

  // Dự án đã đóng không hiện để chọn mới — trừ khi giao dịch đang sửa vốn
  // thuộc dự án đó, nếu không mở ra sửa là ô chọn tự rơi về "không thuộc dự án".
  const options = projects.filter((p) => p.status !== "closed" || p.id === value);
  if (options.length === 0) return null;

  return (
    <div>
      <label className={labelClassName}>
        {type === "Income"
          ? t("Revenue of project", "Doanh thu của dự án")
          : type === "Refund"
            ? t("Refund for project", "Hoàn tiền cho dự án")
            : t("Spent on project", "Chi cho dự án")}
      </label>
      <div className="relative">
        <select
          name="projectId"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${selectClassName} appearance-none pr-10`}
        >
          <option value="">{t("— Not a project —", "— Không thuộc dự án —")}</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.status === "paused" ? ` (${t("paused", "tạm dừng")})` : ""}
              {p.status === "closed" ? ` (${t("closed", "đã đóng")})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
        />
      </div>
    </div>
  );
}
