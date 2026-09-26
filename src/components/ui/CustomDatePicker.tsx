"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { todayLocalIso } from "@/lib/localDate";

// Chọn NGÀY, thay cho <input type="date">.
//
// Lịch mặc định của trình duyệt không nhận bảng màu của app: nó là hộp trắng,
// chữ xanh hệ thống, bo góc vuông — đặt giữa nền giấy kem thì lạc hẳn, và ở
// chế độ tối thì chói. Nó cũng không dịch được và mỗi trình duyệt một kiểu.
//
// Ô này giữ nguyên hợp đồng của thẻ input cũ: `value` và `onChange` đều là
// chuỗi YYYY-MM-DD, nên chỗ gọi không phải đổi cách lưu hay cách gửi lên API.
//
// Tuần bắt đầu từ THỨ HAI. Lịch tháng bên tab Lịch sử (TransactionCalendar)
// bắt đầu từ Chủ nhật vì nó là lịch giấy để soát cả tháng; ô chọn ngày này đi
// theo lối lịch của điện thoại.

const pad = (n: number) => String(n).padStart(2, "0");

const PANEL_WIDTH = 300;
const VIEWPORT_MARGIN = 16;

/** "2026-09-26" → "26/09/2026". Rỗng thì trả về rỗng. */
function displayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  /** YYYY-MM-DD; rỗng nghĩa là chưa chọn. */
  value: string;
  onChange: (value: string) => void;
  /** Lớp cho nút bấm, để dùng lại đúng dáng ô nhập của từng modal. */
  className?: string;
  /** Chữ mờ khi chưa chọn ngày. */
  placeholder?: string;
  /** Cho phép xoá về rỗng — dùng ở bộ lọc, không dùng ở form bắt buộc ngày. */
  allowClear?: boolean;
  name?: string;
  "aria-label"?: string;
}

export default function CustomDatePicker({
  value,
  onChange,
  className,
  placeholder,
  allowClear = false,
  name,
  "aria-label": ariaLabel,
}: Props) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  // Neo panel về bên còn chỗ. Neo cứng một bên là hỏng một nửa số chỗ đặt —
  // cùng bài học đã ghi trong CustomMonthPicker.
  const [alignRight, setAlignRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayLocalIso();
  const [viewYear, setViewYear] = useState(() => Number(anchor.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(anchor.slice(5, 7))); // 1-12

  // Giá trị đổi từ bên ngoài (mở modal sửa một giao dịch cũ) thì lịch phải
  // nhảy tới tháng đó. Đồng bộ ngay trong lúc render thay vì trong effect:
  // setState đồng bộ trong effect vi phạm react-hooks/set-state-in-effect.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setViewYear(Number(anchor.slice(0, 4)));
    setViewMonth(Number(anchor.slice(5, 7)));
  }

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const measureAndToggle = () => {
    if (!isOpen) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const fitsLeft = rect.left + PANEL_WIDTH + VIEWPORT_MARGIN <= window.innerWidth;
        const fitsRight = rect.right - PANEL_WIDTH >= VIEWPORT_MARGIN;
        setAlignRight(!fitsLeft && fitsRight);
      }
    }
    setIsOpen((open) => !open);
  };

  const shiftMonth = (delta: number) => {
    const next = viewMonth + delta;
    if (next < 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else if (next > 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth(next);
    }
  };

  const pick = (iso: string) => {
    onChange(iso);
    setIsOpen(false);
  };

  // Lưới 6 hàng × 7 cột, có cả ngày của tháng trước/sau (mờ) để không bị lỗ
  // trống ở hai đầu — bấm vào chúng thì nhảy sang tháng tương ứng.
  const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
  const leading = (firstOfMonth.getUTCDay() + 6) % 7; // 0 = thứ Hai
  const gridStart = new Date(firstOfMonth.getTime() - leading * 86_400_000);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getTime() + i * 86_400_000);
    const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return { iso, day: d.getUTCDate(), inMonth: d.getUTCMonth() + 1 === viewMonth };
  });

  const weekdays = [
    t("Mo", "T2"), t("Tu", "T3"), t("We", "T4"), t("Th", "T5"),
    t("Fr", "T6"), t("Sa", "T7"), t("Su", "CN"),
  ];
  const monthLabel = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toLocaleDateString(
    t("en-GB", "vi-VN"),
    { timeZone: "UTC", month: "long", year: "numeric" }
  );
  const today = todayLocalIso();

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={measureAndToggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        data-name={name}
        className={
          className ??
          "w-full flex items-center justify-between gap-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 min-h-11 text-base md:text-sm text-left text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
        }
      >
        <span className={value ? "" : "text-[var(--color-text-faint)]"}>
          {displayDate(value) || placeholder || t("Pick a date", "Chọn ngày")}
        </span>
        <Calendar size={16} className="shrink-0 text-[var(--color-text-muted)]" />
      </button>

      {isOpen && (
        <>
          {/* Nền mờ chỉ trên mobile. Panel nằm trong containerRef nên handler
              mousedown ở trên coi mọi cú bấm là "bấm bên trong" — cần onClick
              riêng ở đây mới đóng được. */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            className={`fixed left-1/2 top-1/2 z-50 w-[min(340px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl animate-in fade-in zoom-in-95 duration-200 md:absolute md:top-full md:mt-2 md:w-[300px] md:translate-x-0 md:translate-y-0 ${
              alignRight ? "md:right-0 md:left-auto" : "md:left-0 md:right-auto"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-[var(--color-text)] capitalize">{monthLabel}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label={t("Previous month", "Tháng trước")}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label={t("Next month", "Tháng sau")}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {weekdays.map((w) => (
                <div
                  key={w}
                  className="h-7 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-faint)]"
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                const isSelected = cell.iso === value;
                const isToday = cell.iso === today;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => pick(cell.iso)}
                    aria-pressed={isSelected}
                    aria-label={displayDate(cell.iso)}
                    className={`h-11 md:h-9 rounded-full text-sm tabular-nums transition-colors ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold"
                        : cell.inMonth
                          ? "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                          : "text-[var(--color-text-faint)] hover:bg-[var(--color-surface-2)]"
                    } ${
                      // Hôm nay: viền mảnh, không tô nền — tô nền thì nhìn như
                      // đã chọn, mà nó chưa được chọn.
                      isToday && !isSelected ? "border border-[var(--color-accent)]" : ""
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => pick(today)}
                className="min-h-9 px-3 rounded-lg text-sm font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent-tint)] transition-colors"
              >
                {t("Today", "Hôm nay")}
              </button>
              {allowClear && value && (
                <button
                  type="button"
                  onClick={() => pick("")}
                  className="min-h-9 px-3 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  {t("Clear", "Xoá")}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
