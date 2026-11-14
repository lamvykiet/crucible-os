"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Lock, Pencil, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND } from "@/lib/formatMoney";

// Lịch trả nợ từng kỳ.
//
// Hai loại kỳ được phân biệt rõ ràng ở mọi chỗ hiển thị:
//   ĐÃ CHỐT  — ngân hàng đã thu, số liệu là lịch sử.
//   TẠM TÍNH — dựng theo giả định lãi suất hiện hành giữ tới hết kỳ hạn. Với
//              khoản vay thả nổi thì giả định đó gần như chắc chắn sai, nên
//              không bao giờ được trình bày như số thật.
//
// Kỳ quá khứ vẫn sửa được: khi thương lượng được khoản hoàn thì cấn ngược vào
// kỳ cũ, dư nợ mới lan xuống các kỳ sau, phần lãi tạm tính giảm theo.

interface Period {
  id: string;
  period: number;
  dueDate: string;
  interestDays: number;
  openingBalance: number;
  principal: number;
  interest: number;
  payment: number;
  closingBalance: number;
  interestRate: number;
  status: string;
  note: string;
}

interface Summary {
  total: number;
  paidCount: number;
  projectedCount: number;
  interestPaid: number;
  interestRemaining: number;
  nextPeriod: { period: number; dueDate: string; payment: number; interestRate: number } | null;
}

interface Props {
  debtId: string | null;
  debtName?: string;
  /** Bộ lọc mở sẵn. "projected" đưa kỳ chưa trả kế tiếp lên đầu. */
  initialFilter?: Filter;
  onClose: () => void;
  onChanged?: () => void;
}

type Filter = "all" | "paid" | "projected";

// Ô nhập của màn này nằm trên nền tint (`--color-surface-2`) nên lấy nền
// `--color-surface`; đệm ngang 12px thay cho 16px vì lưới sửa kỳ chia hai cột ở
// khổ 375px. Còn lại cùng khuôn với các hộp thoại khác.
const fieldBase =
  "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 min-h-11 text-base md:text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]";
const labelClass = "c-overline block";

// Thông báo lỗi được đặt trong effect, nơi không gọi `t()` được (hàm `t` đổi
// mỗi lượt render). Dịch lúc hiển thị.
const ERROR_EN: Record<string, string> = {
  "Không tải được lịch trả nợ": "Could not load the repayment schedule",
  "Không đổi được lãi suất": "Could not change the rate",
  "Lưu không thành công": "Save failed",
};

export default function DebtScheduleModal({
  debtId, debtName, initialFilter = "all", onClose, onChanged,
}: Props) {
  const { t } = useLanguage();
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorText, setErrorText] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [editing, setEditing] = useState<Period | null>(null);
  const [draft, setDraft] = useState<Partial<Period>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [bulkRate, setBulkRate] = useState("");
  const [isApplyingRate, setIsApplyingRate] = useState(false);

  useEffect(() => {
    if (!debtId) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/finance/debt-schedule?debtId=${debtId}`);
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setPeriods(json.data.periods);
          setSummary(json.data.summary);
          setErrorText("");
        } else {
          setErrorText(json.error || "Không tải được lịch trả nợ");
        }
      } catch {
        if (!ignore) setErrorText("Không tải được lịch trả nợ");
      }
    })();
    return () => { ignore = true; };
  }, [debtId, reloadTick]);

  // Mở lại bằng nút khác thì đổi bộ lọc theo nút đó.
  const [lastInitial, setLastInitial] = useState(initialFilter);
  if (initialFilter !== lastInitial) {
    setLastInitial(initialFilter);
    setFilter(initialFilter);
  }

  if (!debtId) return null;

  const shown = (periods ?? []).filter((p) =>
    filter === "all" ? true : p.status === filter
  );

  const openEditor = (p: Period) => {
    setEditing(p);
    setDraft({
      dueDate: p.dueDate,
      interestDays: p.interestDays,
      principal: p.principal,
      interest: p.interest,
      interestRate: p.interestRate,
      status: p.status,
      note: p.note,
    });
  };

  // Mốc đếm ngày của kỳ đang sửa: ngày đến hạn kỳ liền trước.
  const prevDue = (() => {
    if (!editing || !periods) return null;
    const i = periods.findIndex((x) => x.id === editing.id);
    return i > 0 ? periods[i - 1].dueDate : null;
  })();

  const draftDue = String(draft.dueDate ?? editing?.dueDate ?? "");
  const derivedDays =
    prevDue && draftDue
      ? Math.round(
          (Date.parse(`${draftDue}T00:00:00Z`) - Date.parse(`${prevDue}T00:00:00Z`)) / 86_400_000
        )
      : Number(draft.interestDays ?? 0);

  const opening = editing?.openingBalance ?? 0;
  const isSettled = String(draft.status ?? "") === "paid";
  const derivedRate =
    opening > 0 && derivedDays > 0
      ? Math.round(((Number(draft.interest ?? 0) * 365 * 100) / (opening * derivedDays)) * 100) / 100
      : 0;
  const derivedInterest = Math.round(
    (opening * (Number(draft.interestRate ?? 0) / 100) * derivedDays) / 365
  );

  // Vay thả nổi thì ngân hàng đổi lãi suất vài lần mỗi năm. Sửa tay 164 kỳ là
  // việc không ai làm, nên bảng cứ sai âm thầm — lần gần nhất 8,14% lên 9,42%
  // làm tổng lãi còn phải trả tăng 84 triệu.
  const handleApplyRate = async () => {
    const rate = Number(bulkRate);
    if (!Number.isFinite(rate) || rate <= 0) return;
    setIsApplyingRate(true);
    setErrorText("");
    try {
      const res = await fetch("/api/finance/debt-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debtId, rateForProjected: rate }),
      });
      const json = await res.json();
      if (json.success) {
        setBulkRate("");
        setReloadTick((n) => n + 1);
        onChanged?.();
      } else {
        setErrorText(json.error || "Không đổi được lãi suất");
      }
    } catch {
      setErrorText("Không đổi được lãi suất");
    } finally {
      setIsApplyingRate(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setIsSaving(true);
    setErrorText("");
    try {
      const res = await fetch("/api/finance/debt-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...draft }),
      });
      const json = await res.json();
      if (json.success) {
        setEditing(null);
        setReloadTick((n) => n + 1);
        onChanged?.();
      } else {
        setErrorText(json.error || "Lưu không thành công");
      }
    } catch {
      setErrorText("Lưu không thành công");
    } finally {
      setIsSaving(false);
    }
  };

  // Ô SUY RA, không nhập tay. Số ngày là hiệu hai ngày đến hạn; còn lãi suất
  // (kỳ đã chốt) hay tiền lãi (kỳ tạm tính) là hai chiều của cùng công thức.
  // Cho gõ vào những ô này thì bảng tự mâu thuẫn với chính ngày của nó.
  const derived = (label: string, value: string, hint: string) => (
    <div className="space-y-2">
      <label className={labelClass}>
        {label} · {t("auto", "tự tính")}
      </label>
      <div
        title={hint}
        className="w-full flex items-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 min-h-11 text-base md:text-sm text-[var(--color-text-muted)] tabular-nums"
      >
        {value}
      </div>
      <p className="text-xs text-[var(--color-text-faint)]">{hint}</p>
    </div>
  );

  const field = (
    label: string,
    key: keyof Period,
    type: "text" | "number" | "date" = "number",
    step?: string
  ) => (
    <div className="space-y-2">
      <label className={labelClass}>
        {label}
      </label>
      <input
        type={type}
        step={step}
        value={String(draft[key] ?? "")}
        onChange={(e) =>
          setDraft((d) => ({
            ...d,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          }))
        }
        className={`w-full ${fieldBase}`}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-4 animate-in fade-in">
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 p-5 md:p-6 border-b border-[var(--color-border)] flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 className="c-h3 text-[var(--color-text)] truncate">
              {t("Repayment schedule", "Lịch trả nợ")}
              {debtName ? ` — ${debtName}` : ""}
            </h2>
            {summary && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {summary.paidCount} {t("settled", "kỳ đã chốt")} · {summary.projectedCount}{" "}
                {t("projected", "kỳ tạm tính")} · {t("interest paid", "lãi đã trả")}{" "}
                {formatVND(summary.interestPaid)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Đang sửa một kỳ thì ở khổ điện thoại ba dải dưới đây và danh sách
            nhường chỗ cho form: cả bốn đều `shrink-0`, cộng với form là cao
            hơn màn hình và nút Lưu rớt khỏi tấm modal. */}
        {summary?.nextPeriod && (
          <div className={`shrink-0 px-5 md:px-6 py-3 bg-[var(--color-surface-2)] border-b border-[var(--color-border)] text-sm ${editing ? "hidden md:block" : ""}`}>
            <span className="text-[var(--color-text-muted)]">
              {t("Next instalment", "Kỳ kế tiếp")}:{" "}
            </span>
            <strong className="text-[var(--color-text)]">
              {t("period", "kỳ")} {summary.nextPeriod.period} · {summary.nextPeriod.dueDate} ·{" "}
              {formatVND(summary.nextPeriod.payment)}
            </strong>
            <span className="text-[var(--color-text-faint)]">
              {" "}
              ({t("at", "theo lãi")} {summary.nextPeriod.interestRate}%)
            </span>
          </div>
        )}

        <div className={`shrink-0 px-5 md:px-6 py-3 flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] ${editing ? "hidden md:flex" : "flex"}`}>
          <span className="text-xs text-[var(--color-text-muted)]">
            {t("Rate for all projected periods", "Lãi suất cho mọi kỳ tạm tính")}
            {summary ? ` (${summary.projectedCount})` : ""}:
          </span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={bulkRate}
            onChange={(e) => setBulkRate(e.target.value)}
            placeholder={periods?.find((x) => x.status === "projected")?.interestRate?.toString() ?? "9.42"}
            className={`w-24 tabular-nums ${fieldBase}`}
          />
          <button
            onClick={handleApplyRate}
            disabled={isApplyingRate || !bulkRate}
            className="c-btn c-btn-secondary c-btn-sm min-h-11"
          >
            {isApplyingRate && <Loader2 size={14} className="animate-spin" />}
            {t("Apply", "Áp dụng")}
          </button>
          <span className="text-xs text-[var(--color-text-faint)]">
            {t("settled periods keep their actual rate", "kỳ đã chốt giữ nguyên lãi suất thực tế")}
          </span>
        </div>

        <div className={`shrink-0 px-5 md:px-6 py-3 flex-wrap gap-2 border-b border-[var(--color-border)] ${editing ? "hidden md:flex" : "flex"}`}>
          {([
            ["all", t("All", "Tất cả"), summary?.total],
            ["paid", t("Settled", "Đã chốt"), summary?.paidCount],
            ["projected", t("Projected", "Tạm tính"), summary?.projectedCount],
          ] as [Filter, string, number | undefined][]).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`min-h-11 md:min-h-0 px-4 md:py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                filter === key
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]"
              }`}
            >
              {label}
              {count !== undefined ? ` (${count})` : ""}
            </button>
          ))}
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto p-5 md:p-6 ${editing ? "hidden md:block" : ""}`}>
          {errorText && (
            <div role="alert" className="mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
              {t(ERROR_EN[errorText] ?? errorText, errorText)}
            </div>
          )}

          {periods === null && !errorText && (
            <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
          )}

          {periods !== null && (
            <ul className="space-y-2">
              {shown.map((p) => {
                const isPaid = p.status === "paid";
                return (
                  <li
                    key={p.id}
                    className={`rounded-xl border p-3 ${
                      isPaid
                        ? "border-[var(--color-border)] bg-[var(--color-surface-2)]"
                        : "border-dashed border-[var(--color-border)] bg-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[var(--color-text)] tabular-nums">
                            {t("Period", "Kỳ")} {p.period}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                            {p.dueDate}
                          </span>
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--color-success-tint)] text-[var(--color-success)]">
                              <Lock size={10} /> {t("settled", "đã chốt")}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--color-warning-tint)] text-[var(--color-warning)]">
                              {t("projected", "tạm tính")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 tabular-nums">
                          {t("principal", "gốc")} {formatVND(p.principal)} + {t("interest", "lãi")}{" "}
                          {formatVND(p.interest)} · {p.interestDays} {t("days", "ngày")} ·{" "}
                          {p.interestRate}%
                        </p>
                        <p className="text-xs text-[var(--color-text-faint)] mt-0.5 tabular-nums">
                          {t("balance after", "dư nợ sau kỳ")} {formatVND(p.closingBalance)}
                        </p>
                        {p.note && (
                          <p className="text-xs text-[var(--color-accent)] mt-1">{p.note}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold text-[var(--color-text)] tabular-nums">
                          {formatVND(p.payment)}
                        </div>
                        <button
                          onClick={() => openEditor(p)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-h-11 md:min-h-0 px-1"
                        >
                          <Pencil size={12} /> {t("edit", "sửa")}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {editing && (
          <div className="flex-1 min-h-0 md:flex-none md:max-h-[60dvh] flex flex-col md:border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
            {/* Ở khổ điện thoại danh sách (và hộp lỗi của nó) đang ẩn. */}
            {errorText && (
              <div role="alert" className="md:hidden mb-4 text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
                {t(ERROR_EN[errorText] ?? errorText, errorText)}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="c-h5 text-[var(--color-text)]">
                {t("Edit period", "Sửa kỳ")} {editing.period} — {editing.dueDate}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="c-btn c-btn-tertiary c-btn-sm min-h-11 md:min-h-0"
              >
                {t("Cancel", "Huỷ")}
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              {t(
                "Saving re-links the balance chain for every later period. Interest is recomputed only for projected periods — settled ones keep what the bank actually charged.",
                "Lưu xong, chuỗi dư nợ của mọi kỳ sau được nối lại. Tiền lãi chỉ tính lại cho kỳ tạm tính — kỳ đã chốt giữ nguyên số ngân hàng đã thu."
              )}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {field(t("Due date", "Ngày đến hạn"), "dueDate", "date")}
              {derived(
                t("Interest days", "Số ngày tính lãi"),
                derivedDays > 0 ? String(derivedDays) : "—",
                prevDue
                  ? t(`from ${prevDue}`, `tính từ ${prevDue}`)
                  : t("from the disbursement date", "tính từ ngày giải ngân")
              )}
              {isSettled
                ? derived(
                    t("Rate %", "Lãi suất %"),
                    derivedRate ? `${derivedRate}%` : "—",
                    t(
                      "actual rate the bank charged, back-derived from the interest",
                      "lãi suất thực tế, suy ngược từ tiền lãi đã thu"
                    )
                  )
                : field(t("Rate %", "Lãi suất %"), "interestRate", "number", "0.0001")}
              {field(t("Principal", "Gốc"), "principal")}
              {isSettled
                ? field(t("Interest", "Lãi"), "interest")
                : derived(
                    t("Interest", "Lãi"),
                    formatVND(derivedInterest),
                    t("balance × rate × days / 365", "dư nợ × lãi suất × ngày / 365")
                  )}
              <div className="space-y-2">
                <label className={labelClass}>
                  {t("Status", "Trạng thái")}
                </label>
                <div className="relative">
                  <select
                    value={String(draft.status ?? "")}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                    className={`w-full appearance-none pr-9 ${fieldBase}`}
                  >
                    <option value="paid">{t("settled", "đã chốt")}</option>
                    <option value="projected">{t("projected", "tạm tính")}</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
                </div>
              </div>
              <div className="col-span-2 md:col-span-3">
                {field(t("Note (e.g. rebate applied)", "Ghi chú (ví dụ: đã cấn khoản hoàn)"), "note", "text")}
              </div>
            </div>

            </div>

            <div className="shrink-0 px-5 md:px-6 py-4 border-t border-[var(--color-border)] flex flex-wrap items-center justify-end gap-3">
              <span className="flex-1 min-w-[9rem] text-xs text-[var(--color-text-faint)]">
                {t("Summary card updates automatically.", "Thẻ tóm tắt tự cập nhật theo.")}
              </span>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="c-btn c-btn-primary"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                {t("Save", "Lưu")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
