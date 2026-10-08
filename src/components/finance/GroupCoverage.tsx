"use client";

import { useEffect, useState } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND } from "@/lib/formatMoney";
import { thisMonthLocalIso } from "@/lib/localDate";

// Theo dõi kỳ thiếu: chọn một nhóm giao dịch, xem 12 tháng gần nhất tháng nào
// chưa ghi khoản nào.
//
// Danh sách phẳng không bao giờ cho thấy chỗ THIẾU — nó chỉ hiện những gì đã
// nhập. Tiền nhà, điện nước, lương: những khoản đều đặn mà quên một kỳ thì mọi
// con số trung bình đều sai, và không có gì trên màn hình gợn lên.
//
// Bấm vào một tháng là nhảy thẳng sang tháng đó để nhập bù.

interface SeriesPoint { name: string; amount: number; count: number }

interface Props {
  /** Nhảy sang tháng được chọn, dạng YYYY-MM. */
  onPickMonth: (month: string) => void;
}

export default function GroupCoverage({ onPickMonth }: Props) {
  const { t } = useLanguage();
  const expense = useCategories("Expense");
  const income = useCategories("Income");

  const [selected, setSelected] = useState("");
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  // Giá trị của ô select mang theo cả loại nhóm: "expense|Housing". Thiếu vế
  // loại thì nhóm thu nhập bị cộng theo luật chi tiêu và ra toàn số 0 — trông
  // như chưa nhập kỳ nào trong khi đã nhập đủ.
  const [lastOptions, setLastOptions] = useState("");
  const optionsKey = `${expense.groupNames.join(",")}|${income.groupNames.join(",")}`;
  if (optionsKey !== lastOptions && expense.groupNames.length > 0) {
    setLastOptions(optionsKey);
    if (!selected) setSelected(`expense|${expense.groupNames[0]}`);
  }

  useEffect(() => {
    if (!selected) return;
    const [kind, group] = selected.split("|");
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/finance/expense/group?group=${encodeURIComponent(group)}&kind=${kind}&month=${thisMonthLocalIso()}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setSeries(json.data.monthlySeries.slice(-12));
          setMissing(json.data.missingMonths);
          setFailed(false);
        } else {
          setFailed(true);
        }
      } catch (e) {
        if (!ignore && (e as Error).name !== "AbortError") setFailed(true);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [selected]);

  const thisMonth = thisMonthLocalIso();

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("Any period missing?", "Có kỳ nào chưa nhập không?")}
          </h3>
          <p className="text-xs text-[var(--color-text-faint)] mt-1">
            {t(
              "12 months back, by group — tap a month to jump there",
              "12 tháng gần nhất theo nhóm — bấm vào tháng để nhảy sang nhập bù"
            )}
          </p>
        </div>
        <div className="relative">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label={t("Transaction group", "Nhóm giao dịch")}
            className="w-full md:w-auto bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl pl-4 pr-10 py-2.5 min-h-11 text-base md:text-sm font-bold text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] appearance-none"
          >
            <optgroup label={t("Spending", "Chi tiêu")}>
              {expense.groupNames.map((g) => (
                <option key={`e-${g}`} value={`expense|${g}`}>
                  {expense.label(g)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("Income", "Thu nhập")}>
              {income.groupNames.map((g) => (
                <option key={`i-${g}`} value={`income|${g}`}>
                  {income.label(g)}
                </option>
              ))}
            </optgroup>
          </select>
          <ChevronDown
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
          />
        </div>
      </div>

      {failed && (
        <p className="text-sm text-[var(--color-error)]">
          {t("Could not load.", "Không tải được.")}
        </p>
      )}

      {!failed && !series && (
        <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
      )}

      {!failed && series && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {series.map((m) => {
              const empty = m.amount === 0;
              const running = m.name === thisMonth;
              return (
                <button
                  key={m.name}
                  onClick={() => onPickMonth(m.name)}
                  title={t(
                    `Jump to ${m.name}`,
                    `Nhảy sang tháng ${m.name}`
                  )}
                  className={`min-h-16 rounded-xl border px-2 py-2 text-left transition-colors ${
                    // Tháng đang chạy chưa kết thúc nên trống là chuyện bình
                    // thường — không tô cảnh báo, nếu không màn hình lúc nào
                    // cũng có một ô đỏ vô nghĩa.
                    empty && !running
                      ? "border-[var(--color-warning)] bg-[var(--color-warning-tint)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="text-[10px] font-bold tabular-nums text-[var(--color-text-muted)]">
                    {m.name}
                  </div>
                  <div
                    className={`text-xs font-bold tabular-nums mt-0.5 ${
                      empty ? "text-[var(--color-warning)]" : "text-[var(--color-text)]"
                    }`}
                  >
                    {empty
                      ? running
                        ? t("running", "đang chạy")
                        : t("nothing", "chưa có")
                      : formatVND(m.amount)}
                  </div>
                  {!empty && (
                    <div className="text-[10px] text-[var(--color-text-faint)]">
                      {m.count} {t("records", "khoản")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-sm flex items-start gap-2">
            {missing.length === 0 ? (
              <span className="text-[var(--color-success)]">
                {t(
                  "Every one of the last 12 months has at least one record.",
                  "Cả 12 tháng gần nhất đều có ít nhất một khoản."
                )}
              </span>
            ) : (
              <>
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
                <span className="text-[var(--color-text)]">
                  {t(
                    `${missing.length} months with nothing: `,
                    `${missing.length} tháng chưa có khoản nào: `
                  )}
                  <b>{missing.join(", ")}</b>
                </span>
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
