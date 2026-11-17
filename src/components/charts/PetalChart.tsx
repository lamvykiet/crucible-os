"use client";

import { useLanguage } from "@/lib/LanguageContext";

/**
 * Cánh hoa ngân sách (docs/bieu-do.md mục 8). Mỗi nhóm một cánh quạt góc bằng
 * nhau; lớp ngoài mờ = 100% ngân sách/mục tiêu; lớp trong đậm mọc từ tâm với
 * bán kính r = r0 + (R − r0)·√f nên DIỆN TÍCH tỷ lệ với %, không phải bán kính.
 *
 * Ba trạng thái: rỗng (`empty`: chỉ lớp mờ + số ngân sách), có số (đậm dần theo
 * f), vượt (f > 1): `--bad` với chi phí, `--good` với doanh thu (`mode="revenue"`).
 * Chữ luôn `--ink` (đạt ≥ 4.5:1 trên cả lớp mờ lẫn đậm); riêng cánh vượt dùng
 * `--on-bad` / `--on-good`. Nhãn là div phủ lên SVG nên không bị co theo viewBox.
 */
export interface Petal {
  key: string;
  name: string;
  spent: number;
  budget: number;
  color: number;
}

const VB = 340, CX = 170, R = 158, R0 = 22, CR = 12, GAP = 6, PAD = 4;
const f2 = (n: number) => n.toFixed(2);

// Một cánh quạt bo góc: dựng hình quạt THU VÀO `cr` rồi tô + vẽ viền dày 2·cr
// (linejoin round) ⇒ mọi góc bo bán kính cr, khe giữa hai cánh luôn rộng `gap`.
function wedge(th: number, rOut: number, gap: number, cr: number) {
  const d = gap / 2 + cr, ri = R0 + cr, ro = Math.max(rOut - cr, ri + 1);
  const c = Math.cos(th), s = Math.sin(th);
  const p = (rho: number, sg: number) => {
    const t = Math.sqrt(Math.max(rho * rho - d * d, 0));
    return [d * s + t * c, sg * (-d * c + t * s)];
  };
  const [a, b] = p(ri, -1), [e, f] = p(ro, -1), [g, h] = p(ro, 1), [i, j] = p(ri, 1);
  return `M${f2(a)} ${f2(b)}L${f2(e)} ${f2(f)}A${f2(ro)} ${f2(ro)} 0 0 1 ${f2(g)} ${f2(h)}L${f2(i)} ${f2(j)}A${f2(ri)} ${f2(ri)} 0 0 0 ${f2(a)} ${f2(b)}Z`;
}

// Tên cánh: lấy vế đầu trước "&" ("Food & Dining" → "Food", "Ăn uống & Nhà hàng" →
// "Ăn uống") vì cánh hẹp (ngân sách thật có tới 8 nhóm). Tên đầy đủ nằm ở `title`.
const shortName = (full: string) => {
  const head = full.split(/\s*[&/]\s*/)[0].trim();
  return head || full;
};

export default function PetalChart({
  rows,
  mode = "cost",
  empty = false,
  ariaLabel,
  label,
  money,
}: {
  rows: Petal[];
  mode?: "cost" | "revenue";
  empty?: boolean;
  ariaLabel: string;
  /** Tên nhóm hiển thị (đã dịch). */
  label: (p: Petal) => string;
  /** Số tiền rút gọn cho trạng thái rỗng: "5tr". */
  money: (n: number) => string;
}) {
  const { t } = useLanguage();
  const N = rows.length;
  const th = Math.PI / Math.max(N, 2);
  const good = mode === "revenue";

  return (
    <div className={`c-petal ${empty ? "empty" : ""}`} role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${VB} ${VB}`} aria-hidden>
        {rows.map((r, idx) => {
          const f = empty || r.budget <= 0 ? 0 : r.spent / r.budget;
          const rot = -90 + ((idx + 0.5) * 360) / N;
          const tf = `translate(${CX} ${CX}) rotate(${f2(rot)})`;
          const over = f > 1;
          const rr = f <= 1 ? R0 + (R - R0) * Math.sqrt(f) : R + Math.min(6, (f - 1) * 40);
          const op = over ? 1 : 0.6 + 0.4 * Math.min(f, 1);
          return (
            <g key={r.key} style={{ ["--rg-c" as string]: `var(--rg-${r.color})` }}>
              <path className="pt" transform={tf} d={wedge(th, R, GAP, CR)} strokeWidth={2 * CR} strokeLinejoin="round" />
              {f >= 0.005 && (
                <path
                  className={`pd ${over ? `over${good ? " good" : ""}` : ""}`}
                  transform={tf}
                  d={wedge(th, rr, GAP + PAD * 2, CR)}
                  strokeWidth={2 * CR}
                  strokeLinejoin="round"
                  opacity={f2(op)}
                />
              )}
            </g>
          );
        })}
      </svg>
      {rows.map((r, idx) => {
        const f = empty || r.budget <= 0 ? 0 : r.spent / r.budget;
        const a = ((-90 + ((idx + 0.5) * 360) / N) * Math.PI) / 180;
        const rho = empty ? 112 : N >= 7 ? 108 : 102;
        // Bề ngang nhãn theo cung của cánh tại bán kính đặt nhãn.
        const wPct = Math.min(30, ((2 * Math.PI * rho) / N) * 0.9 / VB * 100);
        const full = label(r);
        const nm = shortName(full);
        const x = ((CX + rho * Math.cos(a)) / VB) * 100;
        const y = ((CX + rho * Math.sin(a)) / VB) * 100;
        const pc = Math.round(f * 100);
        const over = f > 1;
        return (
          <div
            key={r.key}
            className={`pl ${over ? `over${good ? " good" : ""}` : ""}`}
            style={{ left: `${f2(x)}%`, top: `${f2(y)}%`, maxWidth: `${f2(wPct)}%` }}
            aria-hidden
          >
            {empty ? (
              <>
                {r.budget > 0 && <span className="n" style={{ fontSize: 18, lineHeight: "22px" }}>{money(r.budget)}</span>}
                <span className={`g ${nm.length > 10 ? "sm" : ""} ${nm.includes(" ") ? "" : "one"}`} title={full}>{nm}</span>
              </>
            ) : (
              <>
                <span className="n">{pc}<small>%</small></span>
                <span className={`g ${nm.length > 10 ? "sm" : ""} ${nm.includes(" ") ? "" : "one"}`} title={full}>{nm}</span>
                {over && <span className="o">{good ? `▲ +${pc - 100}%` : `▲ ${t("Over", "Vượt")} ${pc - 100}%`}</span>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
