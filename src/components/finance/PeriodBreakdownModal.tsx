"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { DEBT_CATEGORY_GROUP } from "@/lib/debtTransactions";

// Những giao dịch làm nên MỘT ô số trong bảng so sánh kỳ.
//
// Bảng so sánh chỉ đưa ra con số tổng. Khi con số trông lạ — "Còn lại" âm, hay
// "Trả nợ" gấp đôi tháng trước — không có đường nào đi tiếp để xem nó từ đâu
// ra; phải sang tab Lịch sử rồi tự dựng lại bộ lọc. Bấm vào dòng là mở đúng
// danh sách đã cộng nên số đó.
//
// Dữ liệu lấy từ /api/finance/history theo khoảng ngày của chính kỳ đang xem,
// rồi lọc lại đúng cách mà /api/finance/compare cộng. Hai bên phải cùng một
// định nghĩa, nếu không thì bảng nói một đằng, chi tiết nói một nẻo.

interface Tx {
  id: string;
  date: string;
  type: string;
  supplier: string;
  amount: number;
  category: string;
  subGroup: string;
  source: string;
  note: string;
}

export type BreakdownMetric =
  | "income" | "expense" | "cashOut" | "debtService" | "debtPrincipal" | "net" | "count";

const formatVND = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

const kindOf = (tx: Tx) => tx.type?.trim().toLowerCase();
/** Trả gốc do lịch trả nợ sinh ra: `classify()` bên compare xếp là "không tính". */
const isPrincipal = (tx: Tx) => tx.source === "debt" && kindOf(tx) !== "expense" && kindOf(tx) !== "income";
const isInterest = (tx: Tx) => kindOf(tx) === "expense" && tx.category === DEBT_CATEGORY_GROUP;

/** Dòng nào thuộc về chỉ số nào, và nó CỘNG hay TRỪ vào con số đó. */
function contribution(metric: BreakdownMetric, tx: Tx): number | null {
  const kind = kindOf(tx);
  switch (metric) {
    case "income":
      return kind === "income" ? tx.amount : null;
    case "expense":
      if (kind === "expense") return tx.amount;
      if (kind === "refund") return -tx.amount;
      return null;
    case "cashOut":
      if (kind === "expense") return tx.amount;
      if (kind === "refund") return -tx.amount;
      return isPrincipal(tx) ? tx.amount : null;
    case "debtPrincipal":
      return isPrincipal(tx) ? tx.amount : null;
    case "debtService":
      if (isInterest(tx)) return tx.amount;
      return isPrincipal(tx) ? tx.amount : null;
    case "net":
      if (kind === "income") return tx.amount;
      if (kind === "expense") return -tx.amount;
      if (kind === "refund") return tx.amount;
      return isPrincipal(tx) ? -tx.amount : null;
    case "count":
      return tx.amount;
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  metric: BreakdownMetric;
  metricLabel: string;
  /** Nhãn kỳ, ví dụ "2026-09". */
  periodLabel: string;
  /** YYYY-MM-DD, hai đầu đều tính. */
  from: string;
  to: string;
  /** Con số bảng đang hiện — để đối chiếu với tổng của danh sách. */
  expected: number;
  isCount?: boolean;
}

export default function PeriodBreakdownModal({
  isOpen, onClose, metric, metricLabel, periodLabel, from, to, expected, isCount,
}: Props) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Tx[] | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/finance/history?from=${from}&to=${to}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setRows(json.data);
          setErrorCode(null);
        } else {
          setErrorCode(json.error || "load");
        }
      } catch (e) {
        if (!ignore && (e as Error).name !== "AbortError") setErrorCode("load");
      }
    })();
    return () => { ignore = true; controller.abort(); };
  }, [isOpen, from, to]);

  if (!isOpen) return null;

  const contributing = (rows ?? [])
    .map((tx) => ({ tx, amount: contribution(metric, tx) }))
    .filter((r): r is { tx: Tx; amount: number } => r.amount !== null)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const total = isCount
    ? contributing.length
    : contributing.reduce((s, r) => s + r.amount, 0);
  // Lệch thì nói ra, đừng im lặng: hai bên tính khác nhau là một lỗi thật.
  const mismatch = rows !== null && Math.abs(total - expected) > 1;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-[var(--color-surface)] rounded-t-3xl md:rounded-3xl w-full max-w-2xl max-h-[85dvh] md:max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="shrink-0 p-5 border-b border-[var(--color-border)] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="c-h4 text-[var(--color-text)] truncate">{metricLabel}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {periodLabel} · {from} → {to}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="shrink-0 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-baseline justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            {contributing.length} {t("transactions", "giao dịch")}
          </span>
          <span className="font-bold tabular-nums text-[var(--color-text)]">
            {isCount ? total : formatVND(total)}
          </span>
        </div>

        {mismatch && (
          <p className="shrink-0 px-5 py-2 text-xs text-[var(--color-warning)] border-b border-[var(--color-border)]">
            {t("This list totals", "Danh sách này cộng ra")} {formatVND(total)},{" "}
            {t("but the table shows", "còn bảng hiện")} {formatVND(expected)}.
          </p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          {errorCode && (
            <p className="p-5 text-sm text-[var(--color-error)]">
              {t("Could not load", "Không tải được")}
            </p>
          )}
          {!errorCode && rows === null && (
            <p className="p-5 text-sm text-[var(--color-text-faint)]">
              {t("Loading...", "Đang tải...")}
            </p>
          )}
          {!errorCode && rows !== null && contributing.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">
              {t("Nothing recorded for this metric in this period.", "Kỳ này chưa có giao dịch nào thuộc chỉ số này.")}
            </p>
          )}
          {!errorCode && contributing.length > 0 && (
            <ul className="divide-y divide-[var(--color-border)]">
              {contributing.map(({ tx, amount }) => (
                <li key={tx.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--color-text)] truncate" title={tx.supplier}>
                      {tx.supplier || t("(no name)", "(chưa đặt tên)")}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {tx.date} · {tx.category || t("no group", "chưa có nhóm")}
                      {tx.subGroup ? ` · ${tx.subGroup}` : ""}
                      {tx.source === "debt" ? ` · ${t("loan schedule", "lịch trả nợ")}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      amount < 0 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"
                    }`}
                  >
                    {amount < 0 ? "−" : ""}{formatVND(Math.abs(amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
