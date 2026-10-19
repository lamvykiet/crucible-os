"use client";

import type { LucideIcon } from "lucide-react";
import { SceneHero } from "@/components/Scene";

/**
 * Phần tóm tắt đầu trang trên phông cảnh (hệ v3), dùng chung cho mọi
 * function: nhãn ngày, tiêu đề là CÂU KẾT LUẬN tính từ số liệu, một widget
 * kính chính (4 chỉ số nhỏ + số lớn) và tối đa hai widget phụ.
 *
 * Component này chỉ VẼ — số do trang tự tính từ nguồn dữ liệu của nó. Số nào
 * chưa có thì truyền `null`, widget hiện "—"; không bao giờ bịa số.
 */

export interface SceneBig {
  value: string;
  /** Đơn vị viết nhỏ (`sup`) sau số: "tr", "kg", "%", "thẻ"… */
  unit?: string;
}

export interface SceneMini {
  label: string;
  value: string;
  icon: LucideIcon;
}

export interface ScenePill {
  /** Nội dung đã kèm ▲/▼ hoặc +/−. */
  text: string;
  tone: "good" | "bad" | "flat";
}

export interface SceneRow {
  title: string;
  subtitle?: string;
  pill?: ScenePill | null;
  big: SceneBig | null;
}

export interface SceneSummaryProps {
  title: string;
  /** Mặc định là ngày hôm nay "19 · 10 · 2026". */
  kicker?: string;
  main: {
    title: string;
    subtitle?: string;
    pill?: ScenePill | null;
    minis: SceneMini[];
    big: SceneBig | null;
  };
  rows?: SceneRow[];
}

/** Số tiền lớn: phần số + đơn vị rút gọn. */
export function moneyBig(n: number | null | undefined, vi: boolean): SceneBig | null {
  if (n === null || n === undefined) return null;
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const f = (v: number, d: number) =>
    v.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: d });
  if (a >= 1e9) return { value: sign + f(a / 1e9, 2), unit: vi ? "tỷ ₫" : "bn ₫" };
  if (a >= 1e6) return { value: sign + f(a / 1e6, 1), unit: vi ? "tr" : "m" };
  if (a >= 1e3) return { value: sign + f(a / 1e3, 0), unit: "k" };
  return { value: sign + f(a, 0), unit: "₫" };
}

/** Số thường theo kiểu chữ của ngôn ngữ đang chọn (dấu phẩy thập phân ở vi). */
export function num(n: number, vi: boolean, digits = 0): string {
  return n.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function todayKicker(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${d.getFullYear()}`;
}

function Big({ big, className }: { big: SceneBig | null; className: string }) {
  if (!big) return <div className={className}>—</div>;
  return (
    <div className={className}>
      {big.value}
      {big.unit && <sup>{big.unit}</sup>}
    </div>
  );
}

function Pill({ pill }: { pill?: ScenePill | null }) {
  if (!pill) return null;
  return <span className={`c-pill ${pill.tone === "flat" ? "" : pill.tone}`}>{pill.text}</span>;
}

export default function SceneSummary({ title, kicker, main, rows = [] }: SceneSummaryProps) {
  return (
    <SceneHero>
      <div className={`c-hero ${rows.length === 0 ? "c-hero-solo" : ""}`}>
        <div className="c-hello">
          <p className="c-kicker">{kicker ?? todayKicker()}</p>
          <h1 className="c-display">{title}</h1>
        </div>

        <section className="c-glass c-w-main" aria-label={main.title}>
          <div>
            <p className="c-w-t">{main.title}</p>
            {main.subtitle && <p className="c-w-s">{main.subtitle}</p>}
            <Pill pill={main.pill} />
          </div>
          <span className="c-coin" aria-hidden />
          {main.minis.length > 0 && (
            <dl className="c-minis">
              {main.minis.map(({ label, value, icon: Icon }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd><Icon size={15} />{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <Big big={main.big} className="c-big" />
        </section>

        {rows.length > 0 && (
          <div className="c-stack">
            {rows.map((row) => (
              <section key={row.title} className="c-glass alt c-w-row">
                <div className="min-w-0">
                  <p className="c-w-t">{row.title}</p>
                  {row.subtitle && <p className="c-w-s">{row.subtitle}</p>}
                  <Pill pill={row.pill} />
                </div>
                <Big big={row.big} className="c-w-v" />
              </section>
            ))}
          </div>
        )}
      </div>
    </SceneHero>
  );
}
