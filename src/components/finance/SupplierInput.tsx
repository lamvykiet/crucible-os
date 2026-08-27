"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { normalizeSupplier } from "@/lib/invoice";
import { useSuppliers, type SupplierSuggestion } from "@/lib/useSuppliers";

interface SupplierInputProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Gọi khi người dùng CHỌN một gợi ý (không gọi khi họ tự gõ). Dùng để điền
   * sẵn nhóm chi tiêu quen thuộc của nơi đó — xem `defaultsByType`.
   */
  onSelect?: (supplier: SupplierSuggestion) => void;
  placeholder?: string;
  /** Class của ô nhập — truyền vào để mỗi modal giữ nguyên kiểu dáng của mình. */
  className?: string;
  name?: string;
}

/** Danh sách dài hơn thì phải cuộn mới thấy hết, mà cuộn thì gõ tiếp nhanh hơn. */
const MAX_VISIBLE = 8;

/**
 * Chuẩn hoá thêm một bước nữa, chỉ để so khớp (không đụng tới tên được lưu).
 *
 * `normalizeSupplier` bỏ dấu là đủ cho việc gộp trùng, nhưng chưa đủ cho việc
 * gõ tìm: "ph" và "f" đọc như nhau nên người dùng gõ "caf" để tìm "Cà phê", gõ
 * "fo" để tìm "Phở". Gấp "ph" thành "f" ở CẢ hai vế nên phép so khớp vẫn đối
 * xứng: gõ "pho" hay "fo" đều ra "Phở".
 */
const foldForSearch = (text: string) => normalizeSupplier(text).replace(/ph/g, "f");

/**
 * Ô "Nơi chi / Nguồn thu" có gợi ý từ những nơi đã từng nhập.
 *
 * Trước đây đây là ô chữ trắng: mỗi lần vào lại quán cũ là gõ lại từ đầu, và
 * chỉ cần sai một dấu ("Cafe Cốc Q1" vs "Cafe Coc Q1") là báo cáo theo nơi chi
 * tách làm hai dòng. Gợi ý vừa đỡ gõ vừa kéo mọi lần nhập về đúng một cách viết.
 *
 * So khớp bỏ dấu, bỏ khoảng trắng và coi "ph" như "f" (xem `foldForSearch`),
 * nên gõ "caf" là ra "Cà phê Cốc Q1" — gõ liền, không dấu, đúng kiểu gõ vội
 * lúc đang đứng trả tiền.
 *
 * Ba mức ưu tiên: khớp từ đầu tên, khớp từ đầu một chữ trong tên, rồi mới tới
 * khớp ở giữa. Trong cùng một mức thì nơi hay dùng nhất đứng trước (API đã sắp
 * sẵn theo số lần dùng).
 *
 * Đây là gợi ý chứ không phải danh sách đóng: tên chưa có trong danh sách vẫn
 * gõ và lưu bình thường, lần sau nó tự nằm trong gợi ý.
 */
export default function SupplierInput({
  value,
  onChange,
  onSelect,
  placeholder,
  className = "",
  name = "supplier",
}: SupplierInputProps) {
  const suppliers = useSuppliers();
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const query = foldForSearch(value);
  const tightQuery = query.replace(/ /g, "");

  const matches = useMemo(() => {
    if (!tightQuery) return suppliers.slice(0, MAX_VISIBLE);

    const fromStart: SupplierSuggestion[] = [];
    const fromWord: SupplierSuggestion[] = [];
    const inside: SupplierSuggestion[] = [];
    for (const supplier of suppliers) {
      const key = foldForSearch(supplier.name);
      const tightKey = key.replace(/ /g, "");
      if (tightKey.startsWith(tightQuery)) fromStart.push(supplier);
      else if (key.includes(` ${query}`)) fromWord.push(supplier);
      else if (tightKey.includes(tightQuery)) inside.push(supplier);
    }
    return [...fromStart, ...fromWord, ...inside].slice(0, MAX_VISIBLE);
  }, [suppliers, query, tightQuery]);

  // Gõ đúng y hệt một gợi ý rồi thì bảng gợi ý chỉ còn che mất phần dưới form.
  const onlyExactMatch = matches.length === 1 && foldForSearch(matches[0].name) === query;

  const showList = isOpen && matches.length > 0 && !onlyExactMatch;

  // Đóng khi bấm ra ngoài. Dùng pointerdown ở document thay vì onBlur của ô
  // nhập: trên điện thoại, blur xảy ra trước click nên bảng gợi ý biến mất
  // ngay trước khi ngón tay chạm vào dòng vừa chọn.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const select = (supplier: SupplierSuggestion) => {
    onChange(supplier.name);
    onSelect?.(supplier);
    setIsOpen(false);
    setHighlight(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (matches.length === 0) return;
      event.preventDefault();
      if (!showList) {
        setIsOpen(true);
        setHighlight(event.key === "ArrowDown" ? 0 : matches.length - 1);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => (current + step + matches.length) % matches.length);
    } else if (event.key === "Enter" && showList && matches[highlight]) {
      event.preventDefault();
      select(matches[highlight]);
    } else if (event.key === "Escape" && isOpen) {
      // Chặn lại để Escape đóng bảng gợi ý trước, chưa đóng luôn cả modal.
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        name={name}
        type="text"
        value={value}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && matches[highlight] ? `${listId}-${highlight}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          // Gõ thêm ký tự là danh sách đổi, dòng đang tô sáng không còn ý nghĩa.
          setHighlight(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-lg)]"
        >
          {matches.map((supplier, idx) => (
            <li key={supplier.name} id={`${listId}-${idx}`} role="option" aria-selected={idx === highlight}>
              <button
                type="button"
                onClick={() => select(supplier)}
                onMouseEnter={() => setHighlight(idx)}
                className={`flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2 text-left text-base md:text-sm text-[var(--color-text)] ${
                  idx === highlight ? "bg-[var(--color-surface-2)]" : ""
                }`}
              >
                <span className="truncate">{supplier.name}</span>
                {supplier.count > 0 && (
                  <span className="flex-none text-xs tabular-nums text-[var(--color-text-faint)]">
                    {supplier.count}×
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
