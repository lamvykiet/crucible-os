"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Search, Check, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND } from "@/lib/formatMoney";
import { COST_CATEGORIES } from "@/lib/projectCost";

// Gắn giao dịch ĐÃ GHI từ trước vào dự án.
//
// Dự án hay được khai báo sau khi đã tiêu cho nó một thời gian — máy in mua
// tháng trước, cuộn nhựa đầu tiên mua tuần trước. Thiếu hộp thoại này thì mấy
// khoản đó phải xoá đi ghi lại mới vào được dự án, và vốn dự án đếm thiếu.
// Gắn ở đây là phân bổ 100%; muốn chia % cho nhiều dự án thì mở giao dịch ra
// sửa ở ô phân bổ.

interface Candidate {
  id: string;
  date: string;
  type: string;
  supplier: string;
  categoryGroup: string;
  subGroup: string | null;
  totalAmount: number;
  notes: string | null;
  items: { productName: string }[];
}

interface Props {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onAttached: () => void;
}

export default function AttachTransactionsModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onAttached,
}: Props) {
  const { t } = useLanguage();
  const { label } = useCategories();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | "Expense" | "Income">("");
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [costCategory, setCostCategory] = useState("RAW_MATERIAL");
  const [error, setError] = useState("");

  // Gõ tới đâu lọc tới đó, nhưng chờ người dùng ngừng gõ 300ms mới hỏi máy chủ.
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, type });
        const res = await fetch(
          `/api/finance/projects/${encodeURIComponent(projectId)}/transactions?${params}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (json.success) setRows(json.data);
        else setError(json.error || "");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(t("Could not load", "Không tải được"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, projectId, query, type, t]);

  if (!isOpen) return null;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedTotal = rows
    .filter((r) => selected.has(r.id))
    .reduce((s, r) => s + (r.type === "Income" ? r.totalAmount : -r.totalAmount), 0);

  const close = () => {
    setSelected(new Set());
    setQuery("");
    setError("");
    onClose();
  };

  const handleAttach = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/finance/projects/${encodeURIComponent(projectId)}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: [...selected], attach: true, costCategory }),
      });
      const json = await res.json();
      if (json.success) {
        onAttached();
        close();
      } else {
        setError(json.error || t("Save failed", "Lưu không thành công"));
      }
    } catch {
      setError(t("Save failed", "Lưu không thành công"));
    } finally {
      setSaving(false);
    }
  };

  const TYPE_FILTERS: { id: "" | "Expense" | "Income"; label: string }[] = [
    { id: "", label: t("All", "Tất cả") },
    { id: "Expense", label: t("Spending", "Khoản chi") },
    { id: "Income", label: t("Income", "Khoản thu") },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-[var(--color-surface)] rounded-t-3xl md:rounded-3xl w-full max-w-2xl max-h-[90dvh] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="shrink-0 p-5 border-b border-[var(--color-border)] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="c-h4 text-[var(--color-text)]">
              {t("Add earlier transactions", "Gắn giao dịch đã ghi")}
            </h2>
            <p className="text-xs text-[var(--color-text-faint)] mt-1 truncate">
              {t("into", "vào")} <strong className="text-[var(--color-text-muted)]">{projectName}</strong>{" "}
              · {t("only transactions not in any project", "chỉ hiện giao dịch chưa thuộc dự án nào")}
            </p>
          </div>
          <button
            onClick={close}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="shrink-0 px-5 pt-4 pb-3 space-y-3 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search shop, note, item… e.g. PLA, filament", "Tìm nơi chi, ghi chú, tên món… VD: nhựa, PLA, máy in")}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full pl-11 pr-4 py-2.5 min-h-11 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
            />
          </div>
          <div className="flex gap-2">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setType(f.id)}
                className={`px-4 min-h-9 rounded-full text-xs font-bold transition-colors ${
                  type === f.id
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && (
            <p className="m-5 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] rounded-xl p-3">
              {error}
            </p>
          )}
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[var(--color-text-faint)]">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-faint)] text-center py-12 px-5">
              {t("No matching transactions", "Không có giao dịch nào khớp")}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {rows.map((r) => {
                const on = selected.has(r.id);
                const items = r.items.map((i) => i.productName).filter(Boolean).join(", ");
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => toggle(r.id)}
                      aria-pressed={on}
                      className={`w-full text-left px-5 py-3 flex items-start gap-3 transition-colors ${
                        on ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-2)]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${
                          on
                            ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-on-primary)]"
                            : "border-[var(--color-border-strong)]"
                        }`}
                        aria-hidden
                      >
                        {on && <Check size={14} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-bold text-[var(--color-text)] truncate">
                            {r.supplier}
                          </span>
                          <span
                            className={`text-sm font-bold tabular-nums shrink-0 ${
                              r.type === "Income" ? "text-[var(--color-success)]" : "text-[var(--color-text)]"
                            }`}
                          >
                            {r.type === "Income" ? "+" : "−"}
                            {formatVND(r.totalAmount)}
                          </span>
                        </span>
                        <span className="block text-xs text-[var(--color-text-faint)] mt-0.5 truncate">
                          {r.date.split("-").reverse().join("/")} · {label(r.subGroup || r.categoryGroup)}
                          {items ? ` · ${items}` : r.notes ? ` · ${r.notes}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 p-5 border-t border-[var(--color-border)] flex flex-wrap items-center gap-3">
          {/* Khoản chi được gắn vào nhóm chi phí nào. Khoản thu tự thành doanh
              thu nên không cần chọn. Gắn xong vẫn sửa từng khoản được. */}
          {rows.some((r) => selected.has(r.id) && r.type !== "Income") && (
            <div className="relative w-full">
              <select
                value={costCategory}
                onChange={(e) => setCostCategory(e.target.value)}
                aria-label={t("Cost group for the spending", "Nhóm chi phí cho các khoản chi")}
                className="w-full appearance-none bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full pl-4 pr-10 py-2.5 min-h-11 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
              >
                {COST_CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {t(`Cost group: ${c.en}`, `Nhóm chi phí: ${c.vi}`)}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
            </div>
          )}
          <button
            onClick={handleAttach}
            disabled={saving || selected.size === 0}
            className="c-btn c-btn-primary c-btn-pill flex-1 md:flex-none disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {selected.size > 0
              ? t(`Add ${selected.size}`, `Gắn ${selected.size} giao dịch`)
              : t("Pick transactions", "Chọn giao dịch để gắn")}
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-[var(--color-text-faint)] tabular-nums">
              {t("net", "ròng")} {selectedTotal >= 0 ? "+" : "−"}
              {formatVND(Math.abs(selectedTotal))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
