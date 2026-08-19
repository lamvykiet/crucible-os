"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomMonthPickerProps {
  value: string; // YYYY-MM
  onChange: (val: string) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function CustomMonthPicker({ value, onChange }: CustomMonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse initial value
  const [year, monthStr] = value.split('-');
  const [currentYear, setCurrentYear] = useState(parseInt(year, 10));
  const selectedMonthIdx = parseInt(monthStr, 10) - 1;

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
        onClick={() => setIsOpen(!isOpen)}
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

          {/* Panel trước đây là `absolute right-0` rộng cố định 320px. Nút bấm
              nằm sát mép trái màn hình nên mép phải của nó chỉ ở ~125px, đẩy
              panel bắt đầu từ khoảng -195px: hai cột tháng đầu (Jan/Feb,
              May/Jun, Sep/Oct) nằm ngoài màn hình và không tài nào bấm được.
              Dưới 768px panel căn giữa theo viewport nên luôn vừa; từ 768px trở
              lên vẫn là dropdown neo dưới nút như cũ. */}
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(320px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl animate-in fade-in zoom-in-95 duration-200 md:absolute md:left-0 md:top-full md:mt-3 md:w-[320px] md:translate-x-0 md:translate-y-0">
          <div className="flex justify-between items-center mb-6">
            <h4 className="c-h4 text-[var(--color-text)] ml-2">{currentYear}</h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCurrentYear(y => y - 1); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCurrentYear(y => y + 1); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

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
          </div>
        </>
      )}
    </div>
  );
}
