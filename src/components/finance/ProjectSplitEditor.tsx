"use client";

import { ChevronDown, Plus, X, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND } from "@/lib/formatMoney";
import type { ProjectOption } from "@/lib/useProjects";
import {
  COST_CATEGORIES,
  REVENUE,
  costCategoryOf,
  projectSide,
  splitAmounts,
  type Split,
} from "@/lib/projectCost";

// Ô phân bổ dự án, dùng chung cho ba hộp thoại ghi giao dịch: nhập tay, quét
// hoá đơn, và duyệt hoá đơn. Thêm ở một chỗ mà quên hai chỗ kia là hoá đơn quét
// vào sổ không thuộc dự án nào, và giá vốn dự án đếm thiếu mà không báo gì —
// đúng cái bẫy đã gặp với ô chọn tài khoản.
//
// Mặc định chỉ một dòng (dự án + nhóm chi phí, 100%) vì đa số hoá đơn thuộc
// trọn một dự án. Chia nhiều dự án mới hiện ô %. Tổng dưới 100% là hợp lệ:
// phần còn lại là chi tiêu cá nhân.

interface Props {
  projects: ProjectOption[];
  value: Split[];
  onChange: (splits: Split[]) => void;
  /** Expense | Income | Refund — chỉ ba loại này có nghĩa với dự án. */
  type?: string;
  /** Tổng tiền giao dịch, để hiện mỗi phần bao nhiêu đồng. */
  totalAmount?: number | string;
  /** Nhóm danh mục của giao dịch — để nhắc khi khoản chi kinh doanh chưa gắn dự án. */
  categoryGroup?: string;
  selectClassName: string;
  labelClassName: string;
}

/** Nhóm danh mục mà khoản chi gần như luôn thuộc một dự án. */
const PROJECT_GROUPS = ["Business"];

export default function ProjectSplitEditor({
  projects,
  value,
  onChange,
  type = "Expense",
  totalAmount,
  categoryGroup,
  selectClassName,
  labelClassName,
}: Props) {
  const { t } = useLanguage();
  const side = projectSide(type);
  if (!side) return null;

  // Dự án không còn chạy không hiện để chọn MỚI — trừ khi giao dịch đang sửa
  // vốn đã phân bổ cho nó, nếu không mở ra sửa là phần đó tự rơi mất.
  const chosen = new Set(value.map((s) => s.projectId));
  const options = projects.filter((p) => p.status === "active" || chosen.has(p.id));
  if (options.length === 0) return null;

  const total = Math.abs(Number(totalAmount) || 0);
  const amounts = splitAmounts(total, value);
  const pctSum = Math.round(value.reduce((s, x) => s + (Number(x.percentage) || 0), 0) * 100) / 100;
  const multi = value.length > 1;
  const defaultCategory = side === "revenue" ? REVENUE : "RAW_MATERIAL";

  const update = (i: number, patch: Partial<Split>) =>
    onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const remove = (i: number) => {
    const next = value.filter((_, j) => j !== i);
    // Còn một dòng thì nó gánh trọn 100% như mặc định.
    onChange(next.length === 1 ? [{ ...next[0], percentage: 100 }] : next);
  };

  const addRow = () => {
    const rest = Math.round((100 - pctSum) * 100) / 100;
    let next = value;
    let pct = rest;
    if (rest <= 0) {
      // Đã đủ 100%: chia đôi dòng cuối cho dòng mới.
      const last = value[value.length - 1];
      const half = Math.round((last.percentage / 2) * 100) / 100;
      next = value.map((s, j) => (j === value.length - 1 ? { ...s, percentage: last.percentage - half } : s));
      pct = half;
    }
    // Dòng mới phải là một cặp (dự án × nhóm) CHƯA có, nếu không lưu sẽ bị
    // chặn vì trùng. Ưu tiên dự án chưa chọn; chỉ có một dự án (thường gặp)
    // thì giữ dự án đó và lấy nhóm chi phí đầu tiên chưa dùng — chia một hoá
    // đơn ra vật tư + kiểm thử.
    const taken = new Set(value.map((s) => `${s.projectId}|${s.costCategory}`));
    const otherProject = options.find((p) => !value.some((s) => s.projectId === p.id));
    let pick: { projectId: string; costCategory: string } | undefined = otherProject
      ? { projectId: otherProject.id, costCategory: defaultCategory }
      : undefined;
    if (!pick && side === "cost") {
      for (const p of options) {
        const c = COST_CATEGORIES.find((cat) => !taken.has(`${p.id}|${cat.code}`));
        if (c) {
          pick = { projectId: p.id, costCategory: c.code };
          break;
        }
      }
    }
    if (!pick) return;
    onChange([...next, { ...pick, percentage: pct }]);
  };

  const projectLabel = (p: ProjectOption) =>
    `${p.name}${p.status === "paused" ? ` (${t("paused", "tạm dừng")})` : p.status === "closed" ? ` (${t("closed", "đã đóng")})` : ""}`;

  const label =
    side === "revenue"
      ? t("Revenue of project", "Doanh thu của dự án")
      : type === "Refund"
        ? t("Refund for project", "Hoàn tiền cho dự án")
        : t("Spent on project", "Chi cho dự án");

  const projectSelect = (s: Split | null, i: number) => (
    <div className="relative">
      <select
        value={s?.projectId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          if (!s) {
            if (id) onChange([{ projectId: id, costCategory: defaultCategory, percentage: 100 }]);
            return;
          }
          if (!id) remove(i);
          else update(i, { projectId: id });
        }}
        aria-label={t("Project", "Dự án")}
        className={`${selectClassName} appearance-none pr-10`}
      >
        {!multi && <option value="">{t("— Not a project —", "— Không thuộc dự án —")}</option>}
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {projectLabel(p)}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
      />
    </div>
  );

  const categorySelect = (s: Split, i: number) =>
    side === "revenue" ? null : (
      <div className="relative">
        <select
          value={s.costCategory}
          onChange={(e) => update(i, { costCategory: e.target.value })}
          aria-label={t("Cost category", "Nhóm chi phí")}
          className={`${selectClassName} appearance-none pr-10`}
        >
          {COST_CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {t(c.en, c.vi)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
        />
      </div>
    );

  const missingForBusiness =
    side === "cost" && value.length === 0 && !!categoryGroup && PROJECT_GROUPS.includes(categoryGroup);

  return (
    <div className="space-y-2">
      <label className={labelClassName}>{label}</label>

      {!multi ? (
        <>
          {projectSelect(value[0] ?? null, 0)}
          {value[0] && side === "cost" && (
            <>
              {categorySelect(value[0], 0)}
              <p className="text-[11px] text-[var(--color-text-faint)]">
                {(() => {
                  const c = costCategoryOf(value[0].costCategory);
                  return c ? t(c.hintEn, c.hintVi) : "";
                })()}
              </p>
            </>
          )}
        </>
      ) : (
        <ul className="space-y-2">
          {value.map((s, i) => (
            <li
              key={i}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">{projectSelect(s, i)}</div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={t("Remove this part", "Bỏ phần này")}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className={`grid gap-2 ${side === "cost" ? "grid-cols-[1fr_6.5rem]" : "grid-cols-[6.5rem_1fr]"}`}>
                {categorySelect(s, i)}
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="any"
                    value={s.percentage}
                    onChange={(e) => update(i, { percentage: Number(e.target.value) })}
                    aria-label={t("Share (%)", "Tỷ lệ (%)")}
                    className={`${selectClassName} pr-8 tabular-nums`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-faint)] pointer-events-none">
                    %
                  </span>
                </div>
                {side === "revenue" && (
                  <span className="self-center text-sm tabular-nums text-[var(--color-text-muted)]">
                    = {formatVND(amounts[i] ?? 0)}
                  </span>
                )}
              </div>
              {side === "cost" && (
                <p className="text-xs tabular-nums text-[var(--color-text-muted)]">= {formatVND(amounts[i] ?? 0)}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Doanh thu không có nhóm chi phí, nên chỉ chia được khi còn dự án khác. */}
      {value.length > 0 && (side === "cost" || options.some((p) => !chosen.has(p.id))) && (
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 min-h-9 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <Plus size={14} />
          {side === "cost"
            ? t("Split across projects or cost groups", "Chia cho nhiều dự án / nhóm chi phí")
            : t("Split across projects", "Chia cho nhiều dự án")}
        </button>
      )}

      {multi && (
        <p
          className={`text-xs flex items-start gap-1.5 ${
            pctSum > 100 ? "text-[var(--color-error)]" : "text-[var(--color-text-faint)]"
          }`}
        >
          {pctSum > 100 && <AlertCircle size={13} className="shrink-0 mt-0.5" />}
          {pctSum > 100
            ? t(`Total is ${pctSum}% — it cannot exceed 100%.`, `Tổng là ${pctSum}% — không được quá 100%.`)
            : pctSum < 100
              ? t(
                  `Total ${pctSum}% · the other ${Math.round((100 - pctSum) * 100) / 100}% stays personal spending`,
                  `Tổng ${pctSum}% · ${Math.round((100 - pctSum) * 100) / 100}% còn lại tính là chi tiêu cá nhân`
                )
              : t("Total 100%", "Tổng 100%")}
        </p>
      )}

      {missingForBusiness && (
        <p className="text-xs text-[var(--color-warning)] flex items-start gap-1.5">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {t(
            "Business spending — pick a project so it counts toward that project's cost.",
            "Khoản chi kinh doanh — chọn dự án để nó được tính vào giá vốn của dự án."
          )}
        </p>
      )}
    </div>
  );
}
