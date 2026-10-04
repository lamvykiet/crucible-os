"use client";

import { useLanguage } from "@/lib/LanguageContext";

// Trục thời gian gọn: tháng nằm ngang ở hàng trên, năm gom thành một dải riêng
// ở hàng dưới.
//
// Nhãn "2026-01" viết đủ thì không đủ chỗ, nên trước đây phải xoay -45°. Xoay
// kéo theo hai cái giá: chiều cao trục ăn 50–56px, và vì chữ chéo vẫn chạm
// nhau nên phải đặt `interval={1}`/`interval={2}` — biểu đồ 24 tháng chỉ hiện
// được 12 nhãn, đúng thứ người đọc cần đếm thì lại thiếu.
//
// Năm chỉ đổi mỗi 12 cột, nên lặp nó ở từng nhãn là thừa. Tách xuống một hàng
// gom theo nhóm: mỗi cột chỉ còn phải chứa ba chữ cái, nhãn nằm ngang, trục
// cao 38px, và mọi tháng đều có tên.

const MONTHS_EN = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

interface TickProps {
  x?: number;
  y?: number;
  /** `index` ở đây là vị trí trong MẢNG DỮ LIỆU; `index` ngoài cùng chỉ là vị
   *  trí trong danh sách tick đã lọc, hai cái lệch nhau khi recharts bỏ bớt. */
  payload?: { value?: string | number; index?: number };
  index?: number;
  visibleTicksCount?: number;
  /** Bề ngang vùng vẽ, recharts truyền vào — dùng để suy ra bề rộng một cột. */
  width?: number;
  /** Mọi giá trị trên trục, dạng YYYY-MM. Cần để biết một năm trải từ cột nào tới cột nào. */
  months?: string[];
  /** Bỏ hàng tháng, chỉ còn dải năm. Dùng cho trục dài vài chục tháng. */
  yearsOnly?: boolean;
}

export default function MonthAxisTick({
  x = 0,
  y = 0,
  payload,
  index: tickIndex = 0,
  visibleTicksCount = 1,
  width = 0,
  months = [],
  yearsOnly = false,
}: TickProps) {
  const { t } = useLanguage();

  const index = payload?.index ?? tickIndex;
  const value = String(payload?.value ?? "");
  const monthIdx = Number(value.slice(5, 7)) - 1;
  const year = value.slice(0, 4);

  // Trục không phải YYYY-MM thì trả về nhãn thường, đừng vẽ hàng năm rỗng.
  if (value.length < 7 || !Number.isFinite(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return (
      <text x={x} y={y} dy={11} textAnchor="middle" fontSize={10} fill="var(--color-text-faint)">
        {value}
      </text>
    );
  }

  const step = visibleTicksCount > 0 && width > 0 ? width / visibleTicksCount : 0;
  // Dưới 24px một cột thì ba chữ cái chạm nhau, rút về số tháng. Thà "11" hơi
  // trần trụi còn hơn mất nhãn — đây chính là chỗ bản xoay chữ thua.
  const tight = step > 0 && step < 24;
  const label = tight
    ? String(monthIdx + 1)
    : t(MONTHS_EN[monthIdx], `th${monthIdx + 1}`);

  // Năm viết một lần, căn giữa dải tháng của nó.
  let first = index;
  let last = index;
  while (first > 0 && months[first - 1]?.slice(0, 4) === year) first--;
  while (last < months.length - 1 && months[last + 1]?.slice(0, 4) === year) last++;
  const opensGroup = index === first;
  const centre = x + ((first + last) / 2 - index) * step;

  return (
    <g>
      {!yearsOnly && (
        <text x={x} y={y} dy={11} textAnchor="middle" fontSize={10} fill="var(--color-text-faint)">
          {label}
        </text>
      )}
      {opensGroup && (
        <>
          {first > 0 && step > 0 && (
            <line
              x1={x - step / 2}
              x2={x - step / 2}
              y1={y}
              y2={y + (yearsOnly ? 14 : 28)}
              stroke="var(--color-border)"
            />
          )}
          <text
            x={centre}
            y={y}
            dy={yearsOnly ? 13 : 27}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--color-text-muted)"
          >
            {year}
          </text>
        </>
      )}
    </g>
  );
}

/**
 * Props cho một `<XAxis dataKey="name">` chạy theo tháng (YYYY-MM).
 * Dùng: `<XAxis dataKey="name" {...monthAxis(series.map((d) => d.name))} />`
 */
export function monthAxis(months: string[]) {
  return {
    axisLine: false,
    tickLine: false,
    // Mỗi tháng một nhãn. Để recharts tự bỏ bớt là mất đúng thứ cần đếm.
    interval: 0 as const,
    height: 38,
    tick: <MonthAxisTick months={months} />,
  };
}

/**
 * Như `monthAxis` nhưng chỉ còn dải năm. Dùng khi trục dài vài chục tháng:
 * 81 cột thì tên tháng nào cũng chồng lên nhau, mà cái cần đọc ở quy mô đó là
 * năm chứ không phải tháng.
 */
export function careerMonthAxis(months: string[]) {
  return {
    axisLine: false,
    tickLine: false,
    interval: 0 as const,
    height: 24,
    tick: <MonthAxisTick months={months} yearsOnly />,
  };
}
