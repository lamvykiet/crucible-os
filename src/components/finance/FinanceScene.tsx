"use client";

import { useEffect, useState } from "react";
import { CreditCard, Droplet, TrendingUp, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { thisMonthLocalIso } from "@/lib/localDate";
import { compactMoney } from "@/lib/formatMoney";
import SceneSummary, { moneyBig } from "@/components/SceneSummary";

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
  const monthNo = now.getMonth() + 1;
  const prevNo = monthNo === 1 ? 12 : monthNo - 1;
  const short = (n: number) => compactMoney(n, vi).replace("-", "−");

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

  const prevText = (n: number) => (prev ? ` · ${t(`month ${prevNo}`, `tháng ${prevNo}`)}: ${short(n)}` : "");

  return (
    <SceneSummary
      title={title}
      main={{
        title: t("Net worth", "Tài sản ròng"),
        subtitle: worth
          ? t(`${worth.assetCount} assets · ${worth.debtCount} loans`, `${worth.assetCount} tài sản · ${worth.debtCount} khoản nợ`)
          : t("Assets minus outstanding debt", "Tài sản trừ dư nợ"),
        minis: [
          { label: t("Assets", "Tài sản"), value: worth ? short(worth.assets) : "—", icon: Wallet },
          { label: t("Outstanding debt", "Dư nợ"), value: worth ? short(worth.debt) : "—", icon: CreditCard },
          { label: t("Debt payment / month", "Trả nợ tháng"), value: worth ? short(worth.monthlyPayment) : "—", icon: TrendingUp },
          { label: t("Saved this month", "Để dành tháng này"), value: dash ? short(dash.netCashFlow) : "—", icon: Droplet },
        ],
        big: worth ? moneyBig(worth.assets - worth.debt, vi) : null,
      }}
      rows={[
        {
          title: t("Income", "Thu nhập"),
          subtitle: t(`Month ${monthNo}`, `Tháng ${monthNo}`) + (prev ? prevText(prev.income) : ""),
          big: dash ? moneyBig(dash.monthlyIncome, vi) : null,
        },
        {
          title: t("Spending", "Chi tiêu"),
          subtitle:
            (dash
              ? t(`${dash.elapsedDays}/${dash.daysInMonth} days`, `${dash.elapsedDays}/${dash.daysInMonth} ngày`)
              : t(`Month ${monthNo}`, `Tháng ${monthNo}`)) + (prev ? prevText(prev.expense) : ""),
          pill:
            pct !== null && Math.abs(pct) >= 3
              ? { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% ${t("forecast", "dự kiến")}`, tone: pct > 0 ? "bad" : "good" }
              : null,
          big: dash ? moneyBig(dash.monthlyExpense, vi) : null,
        },
      ]}
    />
  );
}
