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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectMonth = (idx: number) => {
    const mm = (idx + 1).toString().padStart(2, '0');
    onChange(`${currentYear}-${mm}`);
    setIsOpen(false);
  };

  return (
    <div className="relative group" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl px-4 py-2 flex items-center gap-3 text-sm font-semibold shadow-sm transition-colors cursor-pointer border border-[var(--color-border)] select-none"
      >
        <Calendar size={18} className="text-[var(--color-info)]" />
        <span>{MONTHS[selectedMonthIdx]} {currentYear}</span>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 md:left-0 mt-3 p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl z-50 w-[320px] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl bg-opacity-95">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-bold text-[var(--color-text)] ml-2">{currentYear}</h4>
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentYear(y => y - 1); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
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
                  onClick={() => handleSelectMonth(idx)}
                  className={`py-3 rounded-full text-sm font-medium transition-all ${
                    isSelected 
                      ? 'bg-[var(--color-info)] text-white shadow-md' 
                      : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
