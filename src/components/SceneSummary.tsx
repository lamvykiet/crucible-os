"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { SceneHero } from "@/components/Scene";
import { useLanguage } from "@/lib/LanguageContext";
import { moduleFor } from "@/lib/modules";

/**
 * Phần tóm tắt đầu trang trên phông cảnh, dùng chung cho mọi function: TÊN
 * FUNCTION, nhãn ngày, CÂU KẾT LUẬN tính từ số liệu, một widget kính chính
 * (tối đa 4 chỉ số nhỏ + số lớn) và tối đa hai widget phụ. Tên function lấy
 * từ `src/lib/modules.tsx` theo đường dẫn.
 *
 * Hệ v4 "Sương sớm" (skill `suong-som-design` mục 5–6, P1 17/11/2026):
 *   - Phông gọn — tên function và câu kết luận không còn chiếm 1/3 màn đầu;
 *     ở 1280×800 thẻ đầu tiên của tấm nền phải lọt màn đầu.
 *   - Đơn vị viết CÙNG DÒNG với số, nhỏ hơn một bậc (`530,8 tr ₫`) — không
 *     còn kiểu chỉ số trên (`530.8ᵐ`), serif nhỏ trên kính khó đọc.
 *   - Không phần tử trang trí không mang nghĩa (quả cầu vàng cũ đã gỡ).
 *   - Số chưa có thì KHÔNG vẽ "—": `big: null` để trống chỗ số lớn, chỉ số
 *     nhỏ có `value: null` (hoặc "—" của bản cũ) thì ẩn hẳn. Câu chữ của
 *     widget (tiêu đề, dòng phụ) là thứ nói chuyện khi chưa có số.
 *
 * Component này chỉ VẼ — số do trang tự tính từ nguồn dữ liệu của nó. Không
 * bao giờ bịa số.
 */

export interface SceneBig {
  value: string;
  /** Đơn vị viết cùng dòng, nhỏ hơn số một bậc: "tr ₫", "kg", "%", "thẻ"… */
  unit?: string;
}

export interface SceneMini {
  label: string;
  /** `null` = chưa có số → chỉ số này ẩn đi, không vẽ "—". */
  value: string | null;
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
  main?: {
    title: string;
    subtitle?: string;
    pill?: ScenePill | null;
    minis: SceneMini[];
    big: SceneBig | null;
  };
  rows?: SceneRow[];
  /** Widget kính tự vẽ thay cho `main` (vd. mặt đồng hồ `FocusDial`). */
  children?: ReactNode;
}

/**
 * Số tiền lớn theo vi-VN: `15.000 ₫`, `530,8 tr ₫`, `1,6 tỷ ₫` (skill mục 5).
 * Dưới một triệu viết đủ số — "15k" là tiếng lóng của trục biểu đồ, không
 * phải cách đọc một số tiền. Bản tiếng Anh: `15,000 ₫`, `530.8M ₫`, `1.6bn ₫`.
 * Dấu âm là "−" (U+2212).
 */
export function moneyBig(n: number | null | undefined, vi: boolean): SceneBig | null {
  if (n === null || n === undefined) return null;
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const f = (v: number, d: number) =>
    v.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: d });
  if (a >= 1e9) return { value: sign + f(a / 1e9, 2), unit: vi ? "tỷ ₫" : "bn ₫" };
  if (a >= 1e6) return { value: sign + f(a / 1e6, 1), unit: vi ? "tr ₫" : "M ₫" };
  return { value: sign + f(a, 0), unit: "₫" };
}

/** Số thường theo kiểu chữ của ngôn ngữ đang chọn (dấu phẩy thập phân ở vi). */
export function num(n: number, vi: boolean, digits = 0): string {
  return n.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** "18/10" — tự ghép, vì `toLocaleDateString` của Chrome cho "18-10" ở vi-VN. */
export function ddmm(iso: string | Date): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayKicker(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${d.getFullYear()}`;
}

/** Chưa có số: giữ chỗ trống (để số hiện ra không xô bố cục), không vẽ "—". */
function Big({ big, className }: { big: SceneBig | null; className: string }) {
  if (!big) return <div className={`${className} is-empty`} aria-hidden />;
  return (
    <div className={className}>
      {big.value}
      {big.unit && <span className="c-unit">{big.unit}</span>}
    </div>
  );
}

function Pill({ pill }: { pill?: ScenePill | null }) {
  if (!pill) return null;
  return <span className={`c-pill ${pill.tone === "flat" ? "" : pill.tone}`}>{pill.text}</span>;
}

export default function SceneSummary({ title, kicker, main, rows = [], children }: SceneSummaryProps) {
  const { t } = useLanguage();
  const mod = moduleFor(usePathname());
  // "—" là cách các trang bản cũ báo "chưa có số" — coi như null.
  const minis = (main?.minis ?? []).filter((m) => m.value !== null && m.value !== "—" && m.value !== "");
  return (
    <SceneHero>
      <div className={`c-hero ${rows.length === 0 ? "c-hero-solo" : ""}`}>
        <div className="c-hello">
          {mod && <h1 className="c-display">{t(mod.en, mod.vi)}</h1>}
          <p className="c-kicker">{kicker ?? todayKicker()}</p>
          <h2 className="c-hello-title">{title}</h2>
        </div>

        {children}
        {main && (
        <section className="c-glass c-w-main" aria-label={main.title}>
          <div className="c-w-head">
            <p className="c-w-t">{main.title}</p>
            {main.subtitle && <p className="c-w-s">{main.subtitle}</p>}
            <Pill pill={main.pill} />
          </div>
          {minis.length > 0 && (
            <dl className="c-minis">
              {minis.map(({ label, value, icon: Icon }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd><Icon size={15} aria-hidden />{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <Big big={main.big} className="c-big" />
        </section>
        )}

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
