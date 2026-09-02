"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { todayLocalIso } from "@/lib/localDate";

// Lịch tháng cho tab Lịch sử.
//
// Danh sách phẳng trả lời "có những giao dịch nào", còn lịch trả lời câu khác:
// tiền rơi vào những ngày nào, ngày nào trống, ngày nào dồn cục. Nhìn 30 dòng
// xếp dọc không thấy được nhịp đó.
//
// Không gọi API riêng: tab Lịch sử vốn đã tải toàn bộ giao dịch của tháng đang
// xem, lịch chỉ xếp lại đúng mảng ấy theo ngày.

interface Tx {
  id: string;
  date: string; // YYYY-MM-DD
  type: string;
  supplier: string;
  amount: number;
}

interface Props {
  /** YYYY-MM */
  month: string;
  transactions: Tx[];
  /** Ngày đang lọc, YYYY-MM-DD. Rỗng nghĩa là xem cả tháng. */
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Rút gọn số tiền cho vừa ô lịch. Ô rộng chừng 100px trên desktop và 45px trên
 * điện thoại, không có chỗ cho "1.234.567 ₫".
 */
function short(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(".0", "") + " tỷ";
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "tr";
  if (a >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}

const isIncome = (t: Tx) => t.type?.trim().toLowerCase() === "income";

export default function TransactionCalendar({
  month,
  transactions,
  selectedDay,
  onSelectDay,
}: Props) {
  const { t } = useLanguage();
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return null;

  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Lịch bắt đầu từ Chủ nhật, giống lịch giấy và giống bảng người dùng đang dùng.
  const leading = first.getUTCDay();
  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<string, Tx[]>();
  for (const tx of transactions) {
    const list = byDay.get(tx.date) ?? [];
    list.push(tx);
    byDay.set(tx.date, list);
  }

  const today = todayLocalIso();
  const weekdays = [
    t("Sun", "CN"), t("Mon", "T2"), t("Tue", "T3"), t("Wed", "T4"),
    t("Thu", "T5"), t("Fri", "T6"), t("Sat", "T7"),
  ];

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
        <h3 className="c-h5 text-[var(--color-text)]">
          {t("Month view", "Xem theo tháng")}
        </h3>
        {selectedDay && (
          <button
            onClick={() => onSelectDay(null)}
            className="text-xs min-h-11 md:min-h-0 px-3 md:py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
          >
            {t("Show whole month", "Xem cả tháng")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
        {weekdays.map((w) => (
          <div
            key={w}
            className="px-1 py-2 text-center text-[10px] md:text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div
                key={`x${i}`}
                className="min-h-16 md:min-h-28 border-b border-r border-[var(--color-border)] bg-[var(--color-surface-2)]/40"
              />
            );
          }
          const iso = `${y}-${pad(m)}-${pad(day)}`;
          const list = byDay.get(iso) ?? [];
          const spend = list.filter((x) => !isIncome(x)).reduce((s, x) => s + x.amount, 0);
          const earn = list.filter(isIncome).reduce((s, x) => s + x.amount, 0);
          const active = selectedDay === iso;

          return (
            <button
              key={iso}
              onClick={() => onSelectDay(active ? null : iso)}
              className={`min-h-16 md:min-h-28 border-b border-r border-[var(--color-border)] p-1 md:p-2 text-left align-top transition-colors ${
                active
                  ? "bg-[var(--color-accent-tint)]"
                  : "hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center min-w-6 h-6 rounded-full text-xs font-bold tabular-nums ${
                  iso === today
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] px-1.5"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {day}
              </span>

              {list.length > 0 && (
                <>
                  {/* Điện thoại: ô quá hẹp cho tên nơi chi, chỉ hiện tổng. */}
                  <div className="md:hidden mt-0.5 space-y-0.5">
                    {spend > 0 && (
                      <div className="text-[10px] font-bold text-[var(--color-warning)] tabular-nums">
                        {short(spend)}
                      </div>
                    )}
                    {earn > 0 && (
                      <div className="text-[10px] font-bold text-[var(--color-success)] tabular-nums">
                        +{short(earn)}
                      </div>
                    )}
                  </div>

                  <div className="hidden md:block mt-1 space-y-1">
                    {list.slice(0, 3).map((tx) => (
                      <div
                        key={tx.id}
                        title={`${tx.supplier} · ${tx.amount.toLocaleString("vi-VN")} ₫`}
                        className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                          isIncome(tx)
                            ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                            : "bg-[var(--color-warning-tint)] text-[var(--color-warning)]"
                        }`}
                      >
                        {short(tx.amount)} · {tx.supplier}
                      </div>
                    ))}
                    {list.length > 3 && (
                      <div className="px-1 text-[10px] text-[var(--color-text-faint)]">
                        +{list.length - 3} {t("more", "nữa")}
                      </div>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="px-5 py-3 text-xs text-[var(--color-text-faint)]">
        {t("Tap a day to filter the list below.", "Chạm vào một ngày để lọc danh sách bên dưới.")}
      </p>
    </div>
  );
}
