"use client";

import { useEffect, useState } from "react";
import { CreditCard, Droplet, TrendingUp, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { thisMonthLocalIso } from "@/lib/localDate";
import { compactMoney } from "@/lib/formatMoney";
import { SceneHero } from "@/components/Scene";

/**
 * Phần đầu trang Tài chính trên phông cảnh (hệ v3): nhãn ngày, tiêu đề là
 * CÂU KẾT LUẬN tính từ số liệu, và ba widget kính — tài sản ròng, thu, chi
 * của tháng đang chạy.
 *
 * Lấy số từ đúng ba endpoint mà tab Dashboard / Tài sản / Nợ đang dùng, để
 * không có bản tính thứ hai cho cùng một con số. Endpoint nào hỏng thì widget
 * đó hiện "—", không bịa số.
 */

interface MonthPoint { name: string; income: number; expense: number }
interface Dash {
  monthlyIncome: number;
  monthlyExpense: number;
  netCashFlow: number;
  eomForecast: number;
  elapsedDays: number;
  daysInMonth: number;
  hasData: boolean;
  ytdSeries: MonthPoint[];
}
interface Worth { assets: number; assetCount: number; debt: number; debtCount: number; monthlyPayment: number }

/** Số lớn trên widget: phần số + đơn vị viết nhỏ (`sup`). */
function bigParts(n: number, vi: boolean): [string, string] {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const f = (v: number, d: number) =>
    v.toLocaleString(vi ? "vi-VN" : "en-US", { maximumFractionDigits: d });
  if (a >= 1e9) return [sign + f(a / 1e9, 2), vi ? "tỷ ₫" : "bn ₫"];
  if (a >= 1e6) return [sign + f(a / 1e6, 1), vi ? "tr" : "m"];
  if (a >= 1e3) return [sign + f(a / 1e3, 0), "k"];
  return [sign + f(a, 0), "₫"];
}

function Big({ value, vi, className }: { value: number | null; vi: boolean; className: string }) {
  if (value === null) return <div className={className}>—</div>;
  const [v, unit] = bigParts(value, vi);
  return (
    <div className={className}>
      {v}
      <sup>{unit}</sup>
    </div>
  );
}

export default function FinanceScene() {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const [dash, setDash] = useState<Dash | null>(null);
  const [worth, setWorth] = useState<Worth | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const month = thisMonthLocalIso();
    const get = (url: string) =>
      fetch(url, { signal: controller.signal }).then((r) => r.json()).catch(() => null);

    Promise.all([
      get(`/api/finance/dashboard?month=${month}`),
      get("/api/finance/assets"),
      get(`/api/finance/debts?month=${month}`),
    ]).then(([d, a, debts]) => {
      if (controller.signal.aborted) return;
      if (d?.success) setDash(d.data);
      if (a?.success && debts?.success) {
        setWorth({
          assets: a.data?.totals?.worth || 0,
          assetCount: a.data?.totals?.count || 0,
          debt: debts.data?.totalOutstanding || 0,
          debtCount: debts.data?.active || 0,
          monthlyPayment: debts.data?.monthlyPayment || 0,
        });
      }
    });
    return () => controller.abort();
  }, []);

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthNo = now.getMonth() + 1;
  const prevNo = monthNo === 1 ? 12 : monthNo - 1;

  // Tháng trước đã trọn; tháng này mới chạy được vài ngày — so thẳng hai con
  // số là luôn "ít hơn". So DỰ BÁO cuối tháng (chi trung bình/ngày × số ngày)
  // với tháng trước, và nói rõ là dự kiến.
  const prev = dash?.ytdSeries?.[dash.ytdSeries.length - 2];
  const pct =
    dash?.hasData && prev && prev.expense > 0
      ? Math.round(((dash.eomForecast - prev.expense) / prev.expense) * 100)
      : null;

  let title = t("Finance", "Sổ chi tiêu");
  if (pct !== null) {
    if (Math.abs(pct) < 3) title = t("Spending on par with last month", "Chi ngang tháng trước");
    else if (pct < 0) title = t(`On track to spend ${-pct}% less`, `Dự kiến chi ít hơn ${-pct}%`);
    else title = t(`On track to spend ${pct}% more`, `Dự kiến chi nhiều hơn ${pct}%`);
  }

  const net = worth ? worth.assets - worth.debt : null;

  return (
    <SceneHero>
      <div className="c-hero">
        <div className="c-hello">
          <p className="c-kicker">{dd} · {mm} · {now.getFullYear()}</p>
          <h1 className="c-display">{title}</h1>
        </div>

        <section className="c-glass c-w-main" aria-label={t("Net worth", "Tài sản ròng")}>
          <div>
            <p className="c-w-t">{t("Net worth", "Tài sản ròng")}</p>
            <p className="c-w-s">
              {worth
                ? t(`${worth.assetCount} assets · ${worth.debtCount} loans`, `${worth.assetCount} tài sản · ${worth.debtCount} khoản nợ`)
                : t("Assets minus outstanding debt", "Tài sản trừ dư nợ")}
            </p>
          </div>
          <span className="c-coin" aria-hidden />
          <dl className="c-minis">
            <div>
              <dt>{t("Assets", "Tài sản")}</dt>
              <dd><Wallet size={15} />{worth ? compactMoney(worth.assets, vi) : "—"}</dd>
            </div>
            <div>
              <dt>{t("Outstanding debt", "Dư nợ")}</dt>
              <dd><CreditCard size={15} />{worth ? compactMoney(worth.debt, vi) : "—"}</dd>
            </div>
            <div>
              <dt>{t("Debt payment / month", "Trả nợ tháng")}</dt>
              <dd><TrendingUp size={15} />{worth ? compactMoney(worth.monthlyPayment, vi) : "—"}</dd>
            </div>
            <div>
              <dt>{t("Saved this month", "Để dành tháng này")}</dt>
              <dd><Droplet size={15} />{dash ? compactMoney(dash.netCashFlow, vi) : "—"}</dd>
            </div>
          </dl>
          <Big value={net} vi={vi} className="c-big" />
        </section>

        <div className="c-stack">
          <section className="c-glass alt c-w-row">
            <div>
              <p className="c-w-t">{t("Income", "Thu nhập")}</p>
              <p className="c-w-s">
                {t(`Month ${monthNo}`, `Tháng ${monthNo}`)}
                {prev ? ` · ${t(`month ${prevNo}`, `tháng ${prevNo}`)}: ${compactMoney(prev.income, vi)}` : ""}
              </p>
            </div>
            <Big value={dash ? dash.monthlyIncome : null} vi={vi} className="c-w-v" />
          </section>

          <section className="c-glass alt c-w-row">
            <div>
              <p className="c-w-t">{t("Spending", "Chi tiêu")}</p>
              <p className="c-w-s">
                {dash
                  ? t(`${dash.elapsedDays}/${dash.daysInMonth} days`, `${dash.elapsedDays}/${dash.daysInMonth} ngày`)
                  : t(`Month ${monthNo}`, `Tháng ${monthNo}`)}
                {prev ? ` · ${t(`month ${prevNo}`, `tháng ${prevNo}`)}: ${compactMoney(prev.expense, vi)}` : ""}
              </p>
              {pct !== null && Math.abs(pct) >= 3 && (
                <span className={`c-pill ${pct > 0 ? "bad" : "good"}`}>
                  {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}% {t("forecast", "dự kiến")}
                </span>
              )}
            </div>
            <Big value={dash ? dash.monthlyExpense : null} vi={vi} className="c-w-v" />
          </section>
        </div>
      </div>
    </SceneHero>
  );
}
