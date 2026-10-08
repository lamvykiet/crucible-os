"use client";

import { useState } from "react";
import { X, Loader2, ArrowRightLeft, ChevronDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND } from "@/lib/formatMoney";
import { todayLocalIso } from "@/lib/localDate";
import AmountInput from "@/components/ui/AmountInput";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import { CLASSIFICATIONS, COST_CATEGORIES, costCategoryOf } from "@/lib/projectCost";

// Ba khối "kế toán giá thành" của tab Dự án: bảng giá thành (5 nhóm chi phí,
// WIP / giá vốn, so ngân sách), sổ cái chỉ-ghi-thêm, và hộp thoại kết chuyển
// WIP sang giá vốn.

export interface CogsData {
  wip: Record<string, number>;
  cogs: Record<string, number>;
  revenue: number;
  totalWip: number;
  totalCogs: number;
  totalCost: number;
  grossProfit: number;
  budget: number | null;
  variance: number | null;
  status: "UNDER_BUDGET" | "OVER_BUDGET" | "ON_BUDGET" | "NO_BUDGET";
  reconciled: boolean;
}

export interface LedgerView {
  id: string;
  transactionId: string | null;
  costCategory: string;
  bucket: string;
  entryType: string;
  amount: number;
  kind: string;
  postingDate: string;
  createdAt: string;
  note: string | null;
  runningTotalCost: number;
}

/** Màu cho năm nhóm, theo thang ấm của hệ (--chart-1…5). */
const colourOf = (code: string) => {
  const i = COST_CATEGORIES.findIndex((c) => c.code === code);
  return i >= 0 ? `var(--chart-${i + 1})` : "var(--color-border-strong)";
};

const dayLabel = (iso: string) => iso.split("-").reverse().join("/");

// ==========================================================================

export function CostPanel({
  cogs,
  money,
  onTransfer,
  onEditBudget,
}: {
  cogs: CogsData;
  money: (n: number) => string;
  onTransfer: () => void;
  onEditBudget: () => void;
}) {
  const { t } = useLanguage();
  const totalOf = (code: string) => (cogs.wip[code] ?? 0) + (cogs.cogs[code] ?? 0);
  const rows = COST_CATEGORIES.map((c) => ({ ...c, total: totalOf(c.code) }));
  const base = Math.max(1, rows.reduce((s, r) => s + Math.max(0, r.total), 0));
  const margin = cogs.revenue > 0 ? Math.round((cogs.grossProfit / cogs.revenue) * 1000) / 10 : null;

  const stats = [
    { label: t("Total cost", "Tổng chi phí"), value: formatVND(cogs.totalCost), tone: "" },
    { label: t("Work in progress", "Dở dang (WIP)"), value: formatVND(cogs.totalWip), tone: "" },
    { label: t("Cost of goods sold", "Giá vốn (COGS)"), value: formatVND(cogs.totalCogs), tone: "" },
    {
      label: t("Gross profit", "Lợi nhuận gộp"),
      value: `${cogs.grossProfit < 0 ? "−" : ""}${formatVND(Math.abs(cogs.grossProfit))}`,
      note: margin !== null ? t(`margin ${margin}%`, `biên ${margin}%`) : t("no revenue yet", "chưa có doanh thu"),
      tone: cogs.grossProfit > 0 ? "text-[var(--color-success)]" : cogs.grossProfit < 0 ? "text-[var(--color-error)]" : "",
    },
  ];

  const budgetPct = cogs.budget ? Math.round((cogs.totalCost / cogs.budget) * 1000) / 10 : null;

  return (
    // `flex gap` chứ không `space-y-6`: globals.css gán nhịp KHỐI LỚN của trang
    // (`--block-gap`) cho mọi `.space-y-6` trong `.c-main`, kể cả khi nó nằm
    // trong một thẻ — các mục trong thẻ cách nhau cả gang tay.
    <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="c-h5 text-[var(--color-text)]">{t("Cost & COGS", "Giá thành & giá vốn")}</h4>
          <p className="text-xs text-[var(--color-text-faint)] mt-1 max-w-xl">
            {t(
              "Costs build up as work in progress; move them to cost of goods sold when you deliver.",
              "Chi phí dồn vào dở dang (WIP) trong lúc làm; khi giao hàng thì kết chuyển phần tương ứng sang giá vốn."
            )}
          </p>
        </div>
        <button
          onClick={onTransfer}
          disabled={cogs.totalWip <= 0 && cogs.totalCogs <= 0}
          className="c-btn c-btn-sm min-h-11 md:min-h-0 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50"
        >
          <ArrowRightLeft size={15} /> {t("Move to COGS", "Kết chuyển giá vốn")}
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-[var(--color-surface-2)] p-4">
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{s.label}</div>
            <div className={`text-base md:text-lg font-bold tabular-nums mt-1 ${s.tone || "text-[var(--color-text)]"}`}>
              {s.value}
            </div>
            {"note" in s && s.note && <div className="text-[11px] text-[var(--color-text-faint)] mt-0.5">{s.note}</div>}
          </div>
        ))}
      </div>

      {/* --- Năm nhóm chi phí --- */}
      <div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]" aria-hidden>
          {rows
            .filter((r) => r.total > 0)
            .map((r) => (
              <div key={r.code} style={{ width: `${(r.total / base) * 100}%`, background: colourOf(r.code) }} />
            ))}
        </div>
        <ul className="mt-4 divide-y divide-[var(--color-border)]">
          {rows.map((r) => (
            <li key={r.code} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colourOf(r.code) }} aria-hidden />
                  <span className={`text-sm truncate ${r.total ? "text-[var(--color-text)]" : "text-[var(--color-text-faint)]"}`}>
                    {t(r.en, r.vi)}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums font-bold text-[var(--color-text)]">
                  {formatVND(r.total)}
                  <span className="ml-1.5 font-normal text-[var(--color-text-faint)]">
                    {cogs.totalCost > 0 ? Math.round((r.total / cogs.totalCost) * 100) : 0}%
                  </span>
                </span>
              </div>
              {r.total !== 0 && (
                <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5 pl-[18px] tabular-nums">
                  WIP {money(cogs.wip[r.code] ?? 0)} · {t("COGS", "giá vốn")} {money(cogs.cogs[r.code] ?? 0)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* --- Trực tiếp / gián tiếp / máy móc --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(CLASSIFICATIONS).map(([key, c]) => {
          const sum = c.codes.reduce((s, code) => s + totalOf(code), 0);
          return (
            <div key={key} className="rounded-2xl border border-[var(--color-border)] p-4">
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t(c.en, c.vi)}</div>
              <div className="text-base font-bold tabular-nums text-[var(--color-text)] mt-1">{formatVND(sum)}</div>
              <div className="text-[11px] text-[var(--color-text-faint)] mt-0.5">
                {c.codes.map((code) => {
                  const cat = costCategoryOf(code);
                  return cat ? t(cat.en, cat.vi) : code;
                }).join(" + ")}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Ngân sách so với thực tế --- */}
      {cogs.budget && budgetPct !== null && cogs.variance !== null ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-[var(--color-text)]">{t("Budget vs actual", "Ngân sách so với thực tế")}</span>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                cogs.status === "OVER_BUDGET"
                  ? "bg-[var(--color-error-tint)] text-[var(--color-error)]"
                  : "bg-[var(--color-success-tint)] text-[var(--color-success)]"
              }`}
            >
              {cogs.status === "OVER_BUDGET"
                ? t("Over budget", "Vượt ngân sách")
                : cogs.status === "ON_BUDGET"
                  ? t("On budget", "Đúng ngân sách")
                  : t("Under budget", "Dưới ngân sách")}
            </span>
          </div>
          <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-2 rounded-full ${cogs.status === "OVER_BUDGET" ? "bg-[var(--color-error)]" : "bg-[var(--color-warning)]"}`}
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-faint)] mt-1.5 tabular-nums">
            {t(
              `actual ${money(cogs.totalCost)} of ${money(cogs.budget)} (${budgetPct}%) · ${cogs.variance >= 0 ? `${money(cogs.variance)} left` : `${money(-cogs.variance)} over`}`,
              `thực tế ${money(cogs.totalCost)} / ngân sách ${money(cogs.budget)} (${budgetPct}%) · ${cogs.variance >= 0 ? `còn ${money(cogs.variance)}` : `vượt ${money(-cogs.variance)}`}`
            )}
          </p>
        </div>
      ) : (
        <button
          onClick={onEditBudget}
          className="text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-h-9"
        >
          {t("Set a budget to compare against →", "Đặt ngân sách dự toán để so với thực tế →")}
        </button>
      )}

      {/* Sổ cái phải khớp phân bổ. Lệch là có đường ghi giao dịch nào đó quên
          ghi sổ — nói ra thay vì để hai con số khác nhau nằm im trên màn hình. */}
      <p
        className={`text-[11px] flex items-center gap-1.5 ${
          cogs.reconciled ? "text-[var(--color-text-faint)]" : "text-[var(--color-warning)]"
        }`}
      >
        {cogs.reconciled ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
        {cogs.reconciled
          ? t("Ledger matches the allocations", "Sổ cái khớp với phân bổ")
          : t("Ledger does not match the allocations — tell Claude", "Sổ cái lệch với phân bổ — cần kiểm tra lại")}
      </p>
    </div>
  );
}

// ==========================================================================

export function LedgerPanel({ ledger, count }: { ledger: LedgerView[]; count: number }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  const KIND: Record<string, string> = {
    POSTING: t("Posted", "Ghi nhận"),
    REVERSAL: t("Reversal", "Bút toán đảo"),
    COGS_TRANSFER: t("To COGS", "Kết chuyển"),
  };
  const BUCKET: Record<string, string> = { WIP: "WIP", COGS: t("COGS", "Giá vốn"), REVENUE: t("Revenue", "Doanh thu") };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block c-h5 text-[var(--color-text)]">{t("Project ledger", "Sổ cái dự án")}</span>
          <span className="block text-xs text-[var(--color-text-faint)] mt-1">
            {t(
              `${count} ${count === 1 ? "entry" : "entries"} · append-only: edits and deletions add reversing entries, nothing is erased`,
              `${count} bút toán · chỉ ghi thêm: sửa hay xoá giao dịch sinh bút toán đảo, không dòng nào bị xoá`
            )}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 mt-1 text-[var(--color-text-faint)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {ledger.map((e) => {
              const cat = costCategoryOf(e.costCategory);
              const credit = e.entryType === "CREDIT";
              return (
                <li key={e.id} className="py-3 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${
                          e.kind === "REVERSAL"
                            ? "bg-[var(--color-warning-tint)] text-[var(--color-warning)]"
                            : e.kind === "COGS_TRANSFER"
                              ? "bg-[var(--color-info-tint)] text-[var(--color-info)]"
                              : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        {KIND[e.kind] ?? e.kind}
                      </span>
                      <span className="text-sm text-[var(--color-text)] truncate">
                        {cat ? t(cat.en, cat.vi) : t("Revenue", "Doanh thu")}
                        <span className="text-[var(--color-text-faint)]"> · {BUCKET[e.bucket] ?? e.bucket}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--color-text)]">
                      <span className="text-[10px] font-bold text-[var(--color-text-faint)] mr-1">
                        {credit ? t("Cr", "Có") : t("Dr", "Nợ")}
                      </span>
                      {formatVND(e.amount)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 mt-0.5">
                    <span className="text-[11px] text-[var(--color-text-faint)] truncate">
                      {dayLabel(e.postingDate)}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-text-faint)]">
                      {t("running", "luỹ kế")} {formatVND(e.runningTotalCost)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {count > ledger.length && (
            <p className="text-[11px] text-[var(--color-text-faint)] mt-3">
              {t(`showing the latest ${ledger.length} of ${count}`, `đang hiện ${ledger.length} bút toán gần nhất trên ${count}`)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ==========================================================================

export function CogsTransferModal({
  isOpen,
  projectId,
  wip,
  cogs,
  onClose,
  onDone,
}: {
  isOpen: boolean;
  projectId: string;
  wip: number;
  cogs: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"pct" | "amount">("pct");
  const [pct, setPct] = useState("100");
  const [amount, setAmount] = useState<number | "">("");
  const [reverse, setReverse] = useState(false);
  const [date, setDate] = useState(todayLocalIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const source = reverse ? cogs : wip;
  const preview =
    mode === "pct"
      ? Math.round((source * Math.min(100, Math.max(0, Number(pct) || 0))) / 100)
      : Math.min(Number(amount) || 0, source);

  const submit = async () => {
    setError("");
    if (preview <= 0) {
      setError(t("Nothing to move", "Chưa có gì để kết chuyển"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/projects/${encodeURIComponent(projectId)}/cogs-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: reverse ? -preview : preview, date, note }),
      });
      const json = await res.json();
      if (json.success) {
        onDone();
        onClose();
      } else {
        setError(json.error || t("Save failed", "Lưu không thành công"));
      }
    } catch {
      setError(t("Save failed", "Lưu không thành công"));
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider";
  const inputClass =
    "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 min-h-11 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]";
  const seg = (on: boolean) =>
    `flex-1 min-h-10 rounded-full text-xs font-bold transition-colors ${
      on ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
    }`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-[var(--color-surface)] rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[90dvh] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="shrink-0 p-5 border-b border-[var(--color-border)] flex items-start justify-between gap-3">
          <div>
            <h2 className="c-h4 text-[var(--color-text)]">{t("Move to cost of goods sold", "Kết chuyển giá vốn")}</h2>
            <p className="text-xs text-[var(--color-text-faint)] mt-1">
              {t(
                "e.g. delivered 20 of 100 pieces → move 20% of WIP",
                "VD: đã giao 20 trên 100 sản phẩm → kết chuyển 20% WIP"
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {error && (
            <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] rounded-xl p-3">{error}</p>
          )}

          <div className="flex gap-1 p-1 rounded-full bg-[var(--color-surface-2)]">
            <button onClick={() => setReverse(false)} className={seg(!reverse)}>
              WIP → {t("COGS", "giá vốn")}
            </button>
            <button onClick={() => setReverse(true)} className={seg(reverse)}>
              {t("Undo: COGS → WIP", "Sửa nhầm: giá vốn → WIP")}
            </button>
          </div>

          <p className="text-sm text-[var(--color-text-muted)]">
            {reverse ? t("Currently in COGS", "Đang ở giá vốn") : t("Currently in WIP", "Đang dở dang")}:{" "}
            <strong className="text-[var(--color-text)] tabular-nums">{formatVND(source)}</strong>
          </p>

          <div className="flex gap-1 p-1 rounded-full bg-[var(--color-surface-2)]">
            <button onClick={() => setMode("pct")} className={seg(mode === "pct")}>
              {t("By %", "Theo %")}
            </button>
            <button onClick={() => setMode("amount")} className={seg(mode === "amount")}>
              {t("By amount", "Theo số tiền")}
            </button>
          </div>

          {mode === "pct" ? (
            <div className="space-y-1.5">
              <label className={labelClass}>{t("Share to move (%)", "Tỷ lệ kết chuyển (%)")}</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                className={inputClass}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className={labelClass}>{t("Amount to move", "Số tiền kết chuyển")}</label>
              <AmountInput
                value={amount}
                onValueChange={(v) => setAmount(v === "" ? "" : Number(v) || 0)}
                aria-label={t("Amount to move", "Số tiền kết chuyển")}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>{t("Date", "Ngày kết chuyển")}</label>
            <CustomDatePicker value={date} onChange={setDate} aria-label={t("Date", "Ngày kết chuyển")} />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>{t("Note", "Ghi chú")}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("e.g. delivered batch 1", "VD: giao lô 1 cho khách A")}
              className={inputClass}
            />
          </div>

          <p className="text-sm text-[var(--color-text)]">
            {t("Will move", "Sẽ kết chuyển")}{" "}
            <strong className="tabular-nums">{formatVND(preview)}</strong>
            <span className="text-[var(--color-text-faint)]">
              {" "}
              · {t("split across cost groups by their WIP share", "chia cho các nhóm chi phí theo tỷ trọng")}
            </span>
          </p>
        </div>

        <div className="shrink-0 p-5 border-t border-[var(--color-border)] flex items-center gap-3">
          <button onClick={submit} disabled={saving || preview <= 0} className="c-btn c-btn-primary c-btn-pill flex-1 md:flex-none disabled:opacity-50">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {t("Post to ledger", "Ghi vào sổ cái")}
          </button>
          <button onClick={onClose} className="c-btn c-btn-tertiary">
            {t("Cancel", "Hủy")}
          </button>
        </div>
      </div>
    </div>
  );
}
