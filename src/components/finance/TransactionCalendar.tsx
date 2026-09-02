"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { todayLocalIso } from "@/lib/localDate";

// Lịch tháng cho tab Lịch sử.
//
// Trả lời đúng hai câu mà danh sách phẳng không trả lời được:
//
//   1. NGÀY NÀY BAO NHIÊU TIỀN — mỗi ô hiện tổng chi (và tổng thu) của ngày.
//   2. CÓ SÓT NGÀY NÀO KHÔNG — ngày đã qua mà chưa ghi khoản nào thì tô nền
//      cảnh báo, nhìn lướt là thấy ngay chỗ thủng.
//
// Ngày CHƯA TỚI không bị tô: chưa tới thì không thể sót. Tháng đã đóng thì mọi
// ngày đều tính là đã qua.
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
  // Ngày đã qua = nhỏ hơn hoặc bằng hôm nay. So chuỗi ISO là đủ và đúng vì
  // định dạng YYYY-MM-DD xếp theo thứ tự từ điển trùng với thứ tự thời gian.
  const isPast = (iso: string) => iso <= today;

  const daysPast = Array.from({ length: daysInMonth }, (_, i) =>
    `${y}-${pad(m)}-${pad(i + 1)}`
  ).filter(isPast);
  const missing = daysPast.filter((d) => !byDay.has(d));
  const weekdays = [
    t("Sun", "CN"), t("Mon", "T2"), t("Tue", "T3"), t("Wed", "T4"),
    t("Thu", "T5"), t("Fri", "T6"), t("Sat", "T7"),
  ];

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("Month view", "Xem theo tháng")}
          </h3>
          {daysPast.length > 0 && (
            <p className="text-xs text-[var(--color-text-faint)] mt-1">
              {t("recorded", "đã ghi")}{" "}
              <b className="text-[var(--color-text)]">
                {daysPast.length - missing.length}/{daysPast.length}
              </b>{" "}
              {t("days", "ngày")}
              {missing.length > 0 && (
                <>
                  {" · "}
                  <b className="text-[var(--color-warning)]">
                    {missing.length} {t("days not recorded", "ngày chưa ghi")}
                  </b>
                </>
              )}
            </p>
          )}
        </div>
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
          // Ngày đã qua mà không có khoản nào — chỗ thủng cần nhìn thấy ngay.
          const gap = list.length === 0 && isPast(iso);

          return (
            <button
              key={iso}
              onClick={() => onSelectDay(active ? null : iso)}
              className={`min-h-16 md:min-h-28 border-b border-r border-[var(--color-border)] p-1 md:p-2 text-left align-top transition-colors ${
                active
                  ? "bg-[var(--color-accent-tint)]"
                  : gap
                    ? "bg-[var(--color-warning-tint)]/40 hover:bg-[var(--color-warning-tint)]"
                    : "hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className={`inline-flex items-center justify-center min-w-6 h-6 rounded-full text-xs font-bold tabular-nums ${
                    iso === today
                      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] px-1.5"
                      : gap
                        ? "text-[var(--color-warning)]"
                        : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {day}
                </span>
                {/* Tổng chi của ngày, để trả lời "ngày này bao nhiêu" mà không
                    phải cộng nhẩm các dòng bên dưới. */}
                {spend > 0 && (
                  <span className="hidden md:inline text-[11px] font-bold text-[var(--color-text)] tabular-nums">
                    {short(spend)}
                  </span>
                )}
              </div>

              {gap && (
                <div className="mt-0.5 text-[10px] leading-tight text-[var(--color-warning)]">
                  <span className="md:hidden">—</span>
                  <span className="hidden md:inline">
                    {t("not recorded", "chưa ghi")}
                  </span>
                </div>
              )}

              {list.length > 0 && (
                <>
                  {/* Điện thoại: ô quá hẹp cho tên nơi chi, chỉ hiện tổng. */}
                  <div className="md:hidden mt-0.5 space-y-0.5">
                    {spend > 0 && (
                      <div className="text-[10px] font-bold text-[var(--color-text)] tabular-nums">
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
                    {earn > 0 && (
                      <div className="text-[10px] font-bold text-[var(--color-success)] tabular-nums px-1">
                        +{short(earn)} {t("in", "thu")}
                      </div>
                    )}
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

      <div className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-faint)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-[var(--color-border)] bg-[var(--color-warning-tint)]" />
          {t("day with nothing recorded", "ngày chưa ghi khoản nào")}
        </span>
        <span>{t("Tap a day to filter the list below.", "Chạm vào một ngày để lọc danh sách bên dưới.")}</span>
      </div>
    </div>
  );
}
