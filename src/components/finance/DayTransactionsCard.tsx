"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { PAYMENT_METHOD_LABELS } from "@/lib/invoice";

// Chi tiết giao dịch của MỘT ngày.
//
// Dashboard trước đây chỉ có "Chi tiêu ngày: 40.000 ₫" — một con số tổng, không
// cho biết đó là những khoản nào, nên không có cách nào tự kiểm hôm nay đã ghi
// đủ chưa. Thẻ này liệt kê từng khoản, và đánh dấu chỗ còn trống.
//
// Dùng ở hai nơi: thẻ "Hôm nay" trên Dashboard, và khi bấm vào một cột trong
// biểu đồ "Xu hướng chi theo ngày" ở tab Chi tiêu.

interface DayTransaction {
  id: string;
  supplier: string;
  type: string;
  categoryGroup: string;
  subGroup: string;
  totalAmount: number;
  paymentMethod: string;
  source: string;
  notes: string;
  itemCount: number;
  missing: { subGroup: boolean; paymentMethod: boolean; items: boolean };
}

interface DayData {
  date: string;
  transactions: DayTransaction[];
  count: number;
  income: number;
  expense: number;
  incompleteCount: number;
}

const formatVND = (amount: number) =>
  new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

interface Props {
  /** YYYY-MM-DD */
  date: string;
  /** Đổi giá trị này để buộc tải lại sau khi thêm/sửa giao dịch. */
  refreshKey?: number;
  onAddTransaction?: () => void;
  /** Tiêu đề thay thế; mặc định là "Hôm nay". */
  title?: string;
}

export default function DayTransactionsCard({
  date,
  refreshKey = 0,
  onAddTransaction,
  title,
}: Props) {
  const { t } = useLanguage();
  const [data, setData] = useState<DayData | null>(null);
  // Lưu MÃ lỗi thay vì câu chữ: hàm t() được tạo mới ở mỗi lần render nên không
  // đưa vào deps của effect được, mà dịch lúc render thì luôn đúng ngôn ngữ.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // Nút "tải lại" chỉ tăng biến đếm này; effect bên dưới lo phần fetch. Gọi
  // thẳng một hàm có setState từ trong effect sẽ vi phạm
  // react-hooks/set-state-in-effect, kể cả khi setState nằm sau await.
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const res = await fetch(`/api/finance/day?date=${date}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          // Gắn lại ĐÚNG ngày đã yêu cầu. `isLoading` so sánh `data.date` với
          // prop `date`; nếu tin vào ngày trong payload mà nó lệch một chút thì
          // thẻ kẹt ở "Đang tải..." vĩnh viễn, không báo lỗi gì.
          setData({ ...json.data, date });
          setErrorCode(null);
        } else {
          setErrorCode(json.error || "load");
        }
      } catch (e) {
        if (!ignore && (e as Error).name !== "AbortError") {
          setErrorCode("load");
        }
      } finally {
        if (!ignore) setIsSpinning(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [date, refreshKey, reloadTick]);

  // Dữ liệu đang hiện thuộc về ngày khác thì coi như chưa có — tránh chớp số
  // liệu của ngày cũ khi người dùng bấm sang ngày mới.
  const isLoading = !errorCode && (!data || data.date !== date);

  const heading =
    title ??
    new Date(`${date}T00:00:00Z`).toLocaleDateString("vi-VN", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "numeric",
    });

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-5 border-b border-[var(--color-border)]">
        <div className="min-w-0">
          <h3 className="c-h5 text-[var(--color-text)] truncate">{heading}</h3>
          {data && !isLoading && (
            <p className="text-xs text-[var(--color-text-faint)] mt-1">
              {data.count === 0
                ? t("nothing recorded", "chưa ghi khoản nào")
                : `${data.count} ${t("records", "khoản")} · ${formatVND(data.expense)}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setIsSpinning(true); setReloadTick((n) => n + 1); }}
            aria-label={t("Reload", "Tải lại")}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <RefreshCw size={16} className={isSpinning || isLoading ? "animate-spin" : ""} />
          </button>
          {onAddTransaction && (
            <button
              onClick={onAddTransaction}
              aria-label={t("Add transaction", "Thêm giao dịch")}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>

      {errorCode && (
        <div className="p-5 text-sm text-[var(--color-error)]">
          {errorCode === "load" ? t("Could not load", "Không tải được") : errorCode}
        </div>
      )}

      {!errorCode && isLoading && (
        <div className="p-5 text-sm text-[var(--color-text-faint)]">
          {t("Loading...", "Đang tải...")}
        </div>
      )}

      {!errorCode && !isLoading && data && data.count === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t(
              "No transactions recorded for this day.",
              "Ngày này chưa ghi giao dịch nào."
            )}
          </p>
          {onAddTransaction && (
            <button
              onClick={onAddTransaction}
              className="mt-4 c-btn c-btn-primary c-btn-pill"
            >
              <Plus size={16} />
              {t("Add transaction", "Thêm giao dịch")}
            </button>
          )}
        </div>
      )}

      {!errorCode && !isLoading && data && data.count > 0 && (
        <ul className="divide-y divide-[var(--color-border)]">
          {data.transactions.map((tx) => {
            const isIncome = tx.type?.trim().toLowerCase() === "income";
            const gaps = [
              tx.missing.subGroup && t("no sub-category", "thiếu danh mục con"),
              tx.missing.paymentMethod && t("no payment method", "thiếu cách trả"),
              tx.missing.items && t("no line items", "chưa có dòng hàng"),
            ].filter(Boolean) as string[];

            return (
              <li key={tx.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--color-text)] truncate">
                      {tx.supplier || t("(no name)", "(chưa đặt tên)")}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {tx.categoryGroup || t("no group", "chưa có nhóm")}
                      {tx.subGroup ? ` · ${tx.subGroup}` : ""}
                      {" · "}
                      {PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      isIncome
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-text)]"
                    }`}
                  >
                    {isIncome ? "+" : ""}
                    {formatVND(tx.totalAmount)}
                  </span>
                </div>
                {gaps.length > 0 && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-warning)]">
                    <AlertCircle size={13} className="shrink-0" />
                    {gaps.join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
