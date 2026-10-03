"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomMonthPickerProps {
  value: string; // YYYY-MM
  onChange: (val: string) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PANEL_WIDTH = 320;
const VIEWPORT_MARGIN = 16;

export default function CustomMonthPicker({ value, onChange }: CustomMonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Từ 768px trở lên panel neo dưới nút. Neo cứng một bên là hỏng một nửa số
  // chỗ đặt: `right-0` thì nút sát mép trái đẩy panel ra ngoài bên trái,
  // `left-0` thì nút sát mép phải đẩy panel ra ngoài bên phải — chính là lỗi
  // trên trang Lịch sử, nơi nút "Aug 2026" nằm sát mép phải và sáu tháng
  // Mar/Apr/Jul/Aug/Nov/Dec bị cắt mất, không tài nào bấm được.
  // Nên phải ĐO lúc mở rồi chọn bên còn chỗ.
  const [alignRight, setAlignRight] = useState(false);
  // Bấm vào số năm để mở lưới năm. Trước đây năm là một thẻ <h4> chết, muốn về
  // 2024 phải bấm mũi tên hai mươi mấy lần.
  const [showYears, setShowYears] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse initial value
  const [year, monthStr] = value.split('-');
  const [currentYear, setCurrentYear] = useState(parseInt(year, 10));
  const selectedMonthIdx = parseInt(monthStr, 10) - 1;
  // Khối 12 năm bao quanh năm đang xem, để năm hiện tại không rơi vào mép.
  const yearBlockStart = currentYear - ((currentYear % 12) + 12) % 12;
  const yearBlock = Array.from({ length: 12 }, (_, i) => yearBlockStart + i);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Đo trong handler chứ không trong effect: setState đồng bộ trong effect gây
  // render dây chuyền (react-hooks/set-state-in-effect).
  const measureAndToggle = () => {
    if (!isOpen) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const fitsLeftAnchored =
          rect.left + PANEL_WIDTH + VIEWPORT_MARGIN <= window.innerWidth;
        // Nếu neo trái mà tràn phải thì neo phải — trừ khi neo phải lại tràn
        // trái, lúc đó giữ neo trái vì tràn phải còn cuộn tới được.
        const fitsRightAnchored = rect.right - PANEL_WIDTH >= VIEWPORT_MARGIN;
        setAlignRight(!fitsLeftAnchored && fitsRightAnchored);
      }
    }
    if (!isOpen) setShowYears(false);
    setIsOpen((open) => !open);
  };

  const handleSelectMonth = (idx: number) => {
    const mm = (idx + 1).toString().padStart(2, '0');
    onChange(`${currentYear}-${mm}`);
    setIsOpen(false);
  };

  return (
    <div className="relative group" ref={containerRef}>
      {/* Trước là <div onClick> nên không focus và không bấm được bằng bàn phím. */}
      <button
        type="button"
        onClick={measureAndToggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="c-btn c-btn-secondary min-h-[44px] rounded-xl select-none"
      >
        <Calendar size={18} className="text-[var(--color-text-muted)]" />
        <span>{MONTHS[selectedMonthIdx]} {currentYear}</span>
      </button>

      {isOpen && (
        <>
          {/* Nền mờ chỉ có trên mobile. Cần onClick riêng vì panel vẫn nằm trong
              containerRef về mặt cây DOM, nên handler mousedown ở trên coi mọi
              cú bấm là "bấm bên trong" và không đóng. */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dưới 768px panel căn giữa viewport nên luôn vừa. Từ 768px trở lên
              là dropdown neo dưới nút, bên nào còn chỗ thì neo bên đó. */}
          <div
            className={`fixed left-1/2 top-1/2 z-50 w-[min(320px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl animate-in fade-in zoom-in-95 duration-200 md:absolute md:top-full md:mt-3 md:w-[320px] md:translate-x-0 md:translate-y-0 ${
              alignRight ? "md:right-0 md:left-auto" : "md:left-0 md:right-auto"
            }`}
          >
          <div className="flex justify-between items-center mb-6">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowYears((v) => !v); }}
              aria-label={showYears ? "Về lưới tháng" : "Chọn năm"}
              aria-expanded={showYears}
              className="c-h4 text-[var(--color-text)] min-h-11 px-2 -ml-1 rounded-lg tabular-nums hover:bg-[var(--color-surface-2)] transition-colors"
            >
              {showYears ? `${yearBlock[0]} – ${yearBlock[11]}` : currentYear}
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCurrentYear(y => y - (showYears ? 12 : 1)); }}
                aria-label="Lùi lại"
                className="w-11 h-11 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCurrentYear(y => y + (showYears ? 12 : 1)); }}
                aria-label="Tiến tới"
                className="w-11 h-11 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {showYears && (
            <div className="grid grid-cols-4 gap-2">
              {yearBlock.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => { setCurrentYear(y); setShowYears(false); }}
                  aria-pressed={y === currentYear}
                  className={`min-h-[44px] rounded-full text-sm font-medium tabular-nums transition-all ${
                    y === currentYear
                      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-md"
                      : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {!showYears && (
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((m, idx) => {
              const isSelected = selectedMonthIdx === idx && parseInt(year, 10) === currentYear;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  aria-pressed={isSelected}
                  className={`min-h-[44px] rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-md'
                      : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}
