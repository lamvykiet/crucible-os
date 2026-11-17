"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Wallet, Target, TrendingUp, SquareCheck, Layers, CreditCard, Landmark,
  Plus, ScanLine, Receipt, LayoutGrid,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { useQuickActions } from "@/components/QuickActions";
import { thisMonthLocalIso, todayLocalIso } from "@/lib/localDate";
import { formatVND } from "@/lib/formatMoney";
import { groupIcon, rankGroups, OTHER_KEY } from "@/lib/groupViz";
import { dec, dm, shortMoney, wordMoney } from "@/lib/vizMoney";
import { moneyBig } from "@/components/SceneSummary";
import GlassIcon from "@/components/GlassIcon";
import PageIntro from "@/components/PageIntro";
import { CardHead, GlassCard } from "@/components/charts/GlassCard";
import SegRing from "@/components/charts/SegRing";
import AreaLine from "@/components/charts/AreaLine";
import { en } from "@/lib/plural";

/**
 * Tổng quan — theo demo `demo/clean/demo.html` (hệ Kính, 17/11/2026).
 *
 * Mọi số là số thật từ API sẵn có; nguồn nào hỏng thì thẻ đó nói "chưa đọc được"
 * chứ không bịa. Bản cũ in "+1.250.000 ₫" viết cứng ngay trong JSX — đừng quay lại.
 *
 *   dashboard      dòng tiền, ngân sách theo nhóm, chuỗi 12 tháng, kỳ trả nợ sắp tới
 *   habits         việc hôm nay
 *   learning       thẻ ôn đến hạn
 *   history        giao dịch gần đây
 *   accounts       hạn thẻ tín dụng (dueDay + dư nợ)
 *   drive/pending-count, knowledge/summary   việc cần chú ý
 *
 * "Tài sản ròng 12 tháng" của demo CHƯA có nguồn: app chỉ biết tài sản ròng hôm
 * nay, không lưu chuỗi theo tháng. Thẻ đó thay bằng tiền giữ lại luỹ kế 12 tháng
 * (thu − tiền ra) tính từ `ytdSeries`.
 */

interface Dash {
  monthlyIncome: number;
  monthlyExpense: number;
  cashOut: number;
  netCashFlow: number;
  transactionCount: number;
  elapsedDays: number;
  daysInMonth: number;
  hasData: boolean;
  categoryBreakdown: { group: string; amount: number }[];
  budgetVsActual: { group: string; budget: number; actual: number }[];
  ytdSeries: { name: string; income: number; cashOut: number }[];
  upcoming: { items: { name: string; dueDate: string; payment: number }[] }[];
}
interface Habits {
  doneCount: number;
  dueCount: number;
  left: string[];
}
interface Learn {
  dueCount: number;
  cardCount: number;
  reviewedToday: number;
  domainsDue: number;
}
interface Tx {
  id: string;
  date: string;
  type: string;
  supplier: string;
  amount: number;
  category: string;
  subGroup: string;
}
interface Due {
  key: string;
  icon: typeof CreditCard;
  title: string;
  sub: string;
  date: string;
  days: number;
}
interface Attention {
  pending: number;
  staleDocs: number;
}

const DAY = 86400000;
const dayDiff = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = todayLocalIso().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY);
};

export default function Home() {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const router = useRouter();
  const { open } = useQuickActions();
  const { label } = useCategories();
  const catLabel = (n: string) => (n === OTHER_KEY ? t("Other", "Khác") : label(n));

  const [dash, setDash] = useState<Dash | null>(null);
  const [habits, setHabits] = useState<Habits | null>(null);
  const [learn, setLearn] = useState<Learn | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [cards, setCards] = useState<Due[]>([]);
  const [attn, setAttn] = useState<Attention>({ pending: 0, staleDocs: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const month = thisMonthLocalIso();
    const get = (url: string) =>
      fetch(url, { signal: controller.signal }).then((r) => r.json()).catch(() => null);

    // Mỗi nguồn hỏng độc lập: một API lỗi thì thẻ của nó nói "chưa đọc được", các thẻ khác vẫn hiện.
    Promise.all([
      get(`/api/finance/dashboard?month=${month}`),
      get("/api/habits"),
      get("/api/learning/overview"),
      get(`/api/finance/history?month=${month}`),
      get("/api/finance/accounts"),
      get("/api/drive/pending-count"),
      get("/api/knowledge/summary"),
    ]).then(([d, h, l, hist, acc, pend, kn]) => {
      if (controller.signal.aborted) return;
      if (d?.success) setDash(d.data);
      if (h?.habits) {
        setHabits({
          doneCount: h.doneCount ?? 0,
          dueCount: h.dueCount ?? 0,
          left: (h.habits as { name: string; done: boolean; scheduled: boolean; skipped: boolean }[])
            .filter((x) => x.scheduled && !x.done && !x.skipped)
            .map((x) => x.name),
        });
      }
      if (l?.success) {
        setLearn({
          dueCount: l.totals?.dueCount ?? 0,
          cardCount: l.totals?.cardCount ?? 0,
          reviewedToday: l.totals?.reviewedToday ?? 0,
          domainsDue: (l.domains ?? []).filter((x: { dueCount: number }) => x.dueCount > 0).length,
        });
      }
      if (hist?.success) setTxs((hist.data ?? []).slice(0, 5));
      // Hạn thẻ tín dụng: ngày hạn kế tiếp suy từ `dueDay`, chỉ hiện khi đang có dư nợ.
      const now = new Date();
      const list: Due[] = [];
      for (const a of (acc?.data?.accounts ?? []) as {
        name: string; kind: string; status: string; dueDay: number | null; balance: number;
      }[]) {
        if (a.kind !== "credit_card" || a.status === "closed" || !a.dueDay || !(a.balance > 0)) continue;
        let y = now.getFullYear(), m = now.getMonth();
        if (a.dueDay < now.getDate()) m += 1;
        const dt = new Date(y, m, a.dueDay);
        y = dt.getFullYear(); m = dt.getMonth();
        const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        list.push({ key: `card-${a.name}`, icon: CreditCard, title: a.name, sub: String(a.balance), date: iso, days: dayDiff(iso) });
      }
      setCards(list);
      setAttn({ pending: pend?.count ?? 0, staleDocs: kn?.data?.staleDocuments ?? 0 });
      setLoaded(true);
    });
    return () => controller.abort();
  }, []);

  // ---- Ngày & câu kết luận ---------------------------------------------------
  const now = new Date();
  const mNo = now.getMonth() + 1;
  const WD_VI = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dateTitle = vi
    ? `${WD_VI[now.getDay()]}, ${now.getDate()} tháng ${mNo}`
    : now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const el = dash?.elapsedDays ?? now.getDate();
  const dim = dash?.daysInMonth ?? 30;
  const pace = el / dim;
  const budgetRows = (dash?.budgetVsActual ?? []).filter((b) => b.budget > 0);
  const hasBudget = budgetRows.length > 0;
  const budgetTotal = budgetRows.reduce((s, b) => s + b.budget, 0);
  const budgetSpent = budgetRows.reduce((s, b) => s + b.actual, 0);
  const usedPct = hasBudget ? Math.round((budgetSpent / budgetTotal) * 100) : null;
  const pacePct = Math.round(pace * 100);

  const monthSentence = !dash
    ? null
    : dash.transactionCount < 5
      ? t(
          `Only ${en(dash.transactionCount, "entry", "entries")} recorded in month ${mNo} — not enough to judge the month yet. `,
          `Mới ghi ${dash.transactionCount} khoản trong tháng ${mNo} — chưa đủ để nhận xét cả tháng. `
        )
      : usedPct !== null
        ? (
            <>
              {t(`Month ${mNo} has used `, `Tháng ${mNo} đã tiêu `)}
              <b>{t(`${usedPct}% of the budget`, `${usedPct}% ngân sách`)}</b>
              {t(` with ${pacePct}% of the month gone`, ` khi tháng mới đi được ${pacePct}%`)}
              {usedPct - pacePct > 5
                ? t(", a little ahead of pace. ", ", nhanh hơn nhịp một chút. ")
                : usedPct - pacePct < -5
                  ? t(", slower than pace. ", ", chậm hơn nhịp. ")
                  : t(", right on pace. ", ", đúng nhịp. ")}
            </>
          )
        : t(
            `Month ${mNo}: spent ${wordMoney(dash.monthlyExpense, vi)}, income ${wordMoney(dash.monthlyIncome, vi)} (no budget set). `,
            `Tháng ${mNo}: chi ${wordMoney(dash.monthlyExpense, vi)}, thu ${wordMoney(dash.monthlyIncome, vi)} (chưa đặt ngân sách). `
          );

  const habitsLeft = habits ? habits.dueCount - habits.doneCount : 0;
  const todaySentence = !loaded
    ? null
    : habitsLeft > 0 || (learn?.dueCount ?? 0) > 0 ? (
        <>
          {t("Today ", "Hôm nay còn ")}
          {habitsLeft > 0 && <b>{t(en(habitsLeft, "task"), `${habitsLeft} việc`)}</b>}
          {habitsLeft > 0 && (learn?.dueCount ?? 0) > 0 && t(" and ", " và ")}
          {(learn?.dueCount ?? 0) > 0 && <b>{t(en(learn?.dueCount ?? 0, "card"), `${learn?.dueCount} thẻ`)}</b>}
          {t(" left to do.", " cần làm.")}
        </>
      ) : (
        t("Nothing is left for today.", "Hôm nay không còn việc gì.")
      );

  // ---- Tiền giữ lại luỹ kế 12 tháng -----------------------------------------
  const series = dash?.ytdSeries ?? [];
  const hasSeries = series.some((m) => m.income !== 0 || m.cashOut !== 0);
  const cum = series.map((m, i) => ({
    x: `${t("M", "T")}${Number(m.name.slice(5, 7))}`,
    v: series.slice(0, i + 1).reduce((s2, k) => s2 + k.income - k.cashOut, 0),
  }));
  const monthNet = series.length ? series[series.length - 1].income - series[series.length - 1].cashOut : 0;
  const cumLast = cum.length ? cum[cum.length - 1].v : 0;
  const minV = Math.min(0, ...cum.map((p) => p.v));
  const maxV = Math.max(0, ...cum.map((p) => p.v));
  const tick = (f: number) => minV + (maxV - minV) * f;
  const cumTitle = !hasSeries
    ? t("Net retained, last 12 months", "Tiền giữ lại 12 tháng")
    : cumLast >= 0
      ? t(`Income stayed ahead of cash out by ${wordMoney(cumLast, vi)} over 12 months`, `12 tháng qua thu hơn tiền ra ${wordMoney(cumLast, vi)}`)
      : t(`Cash out ran ${wordMoney(-cumLast, vi)} ahead of income over 12 months`, `12 tháng qua tiền ra hơn thu ${wordMoney(-cumLast, vi)}`);

  // ---- Ngân sách tháng (vòng cung rời) ----------------------------------------
  const ringSource = hasBudget
    ? budgetRows.map((b) => ({ name: b.group, value: b.actual }))
    : (dash?.categoryBreakdown ?? []).map((c) => ({ name: c.group, value: c.amount }));
  const ranked = rankGroups(ringSource, 5);
  const ringSum = ranked.reduce((s, g) => s + g.value, 0);
  const ringTotal = hasBudget ? budgetTotal : ringSum;
  const ringBig = moneyBig(ringSum, vi);
  const ringUnit = ringBig ? (ringBig.unit === "tr" || ringBig.unit === "m" ? `${ringBig.unit} ₫` : ringBig.unit) : undefined;

  // ---- Sắp đến hạn -----------------------------------------------------------
  const debtDue: Due[] = (dash?.upcoming ?? [])
    .flatMap((u) => u.items)
    .map((it, i) => ({
      key: `debt-${i}-${it.name}`, icon: Landmark, title: it.name, sub: String(it.payment), date: it.dueDate, days: dayDiff(it.dueDate),
    }));
  const dueList = [...cards, ...debtDue].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  const txAmt = (tx: Tx) =>
    tx.type === "Income" || tx.type === "Refund"
      ? { text: `+${formatVND(tx.amount)}`, pos: true }
      : tx.type === "Expense"
        ? { text: `−${formatVND(tx.amount)}`, pos: false }
        : { text: formatVND(tx.amount), pos: false };

  const go = (href: string) => () => router.push(href);
  const nodata = <span className="c-st-n">{t("Could not load", "Chưa đọc được")}</span>;

  const attention: { key: string; icon: typeof Receipt; tone: "spend" | "learn"; title: string; sub: string; href: string }[] = [];
  if (attn.pending > 0)
    attention.push({
      key: "pending", icon: Receipt, tone: "spend",
      title: t(`${en(attn.pending, "receipt")} waiting for review`, `${attn.pending} hoá đơn chờ duyệt`),
      sub: t("Scanned and saved as drafts, not in the ledger yet", "Đã quét và lưu nháp, chưa vào sổ"), href: "/finance",
    });
  if (attn.staleDocs > 0)
    attention.push({
      key: "stale", icon: BookOpen, tone: "learn",
      title: t(`${attn.staleDocs} documents untouched for 30+ days`, `${attn.staleDocs} tài liệu bỏ quên trên 30 ngày`),
      sub: t("Open the knowledge hub to review them", "Mở kho tri thức để xem lại"), href: "/knowledge",
    });

  return (
    <>
      <PageIntro
        title={dateTitle}
        lede={
          loaded ? (
            <>
              {monthSentence}
              {todaySentence}
            </>
          ) : undefined
        }
      />

      <div className="c-g12">
        {/* Ba thẻ số */}
        <GlassCard className="c-s4" variant="solid" onOpen={go("/finance")}>
          <GlassIcon icon={Wallet} tone="fin" size={44} className="c-stat-icon" />
          <div className="c-st-l">{t(`Cash flow, month ${mNo}`, `Dòng tiền tháng ${mNo}`)}</div>
          {dash && dash.transactionCount === 0 ? (
            <>
              <div className="c-st-v" style={{ fontSize: 20 }}>{t("No entries yet", "Chưa có giao dịch")}</div>
              <div className="c-st-n">{t("Add one to see this month's cash flow.", "Ghi một khoản để thấy dòng tiền tháng này.")}</div>
            </>
          ) : dash ? (
            <>
              <div className="c-st-v">
                {dash.netCashFlow > 0 ? "+" : dash.netCashFlow < 0 ? "−" : ""}
                {Math.abs(dash.netCashFlow).toLocaleString(vi ? "vi-VN" : "en-US")}<small>₫</small>
              </div>
              <div className="c-st-n">
                {t("Income", "Thu")} {shortMoney(dash.monthlyIncome, vi)} − {t("cash out", "tiền ra")} {shortMoney(dash.cashOut, vi)}
              </div>
            </>
          ) : (
            loaded && nodata
          )}
        </GlassCard>

        <GlassCard className="c-s4" onOpen={go("/habits")}>
          <GlassIcon icon={SquareCheck} tone="habit" size={44} className="c-stat-icon" />
          <div className="c-st-l">{t("Tasks today", "Việc hôm nay")}</div>
          {habits ? (
            habits.dueCount > 0 ? (
              <>
                <div className="c-st-v">
                  {habits.doneCount}
                  <small>/ {habits.dueCount} {t("tasks", "việc")}</small>
                </div>
                <div className="c-st-n">
                  {habits.left.length > 0
                    ? t(`Left: ${habits.left.slice(0, 3).join(", ")}${habits.left.length > 3 ? "…" : ""}`, `Còn: ${habits.left.slice(0, 3).join(", ")}${habits.left.length > 3 ? "…" : ""}`)
                    : t("All done for today", "Đã xong hết hôm nay")}
                </div>
              </>
            ) : (
              <>
                <div className="c-st-v" style={{ fontSize: 20 }}>{t("Nothing scheduled", "Không có việc tới lịch")}</div>
                <div className="c-st-n">{t("Add a habit and it shows up here.", "Thêm một thói quen, nó sẽ hiện ở đây.")}</div>
              </>
            )
          ) : (
            loaded && nodata
          )}
        </GlassCard>

        <GlassCard className="c-s4" onOpen={go("/learning/flashcards")}>
          <GlassIcon icon={Layers} tone="learn" size={44} className="c-stat-icon" />
          <div className="c-st-l">{t("Cards due", "Thẻ ôn đến hạn")}</div>
          {learn ? (
            learn.cardCount === 0 ? (
              <>
                <div className="c-st-v" style={{ fontSize: 20 }}>{t("No cards yet", "Chưa có thẻ nào")}</div>
                <div className="c-st-n">{t("Create cards in the learning hub.", "Tạo thẻ trong mục Học tập.")}</div>
              </>
            ) : (
              <>
                <div className="c-st-v">
                  {learn.dueCount}
                  <small>{t("cards", "thẻ")}</small>
                </div>
                <div className="c-st-n">
                  {learn.reviewedToday > 0 ? t(`${learn.reviewedToday} reviewed today`, `Hôm nay đã ôn ${learn.reviewedToday}`) : t("None reviewed yet today", "Hôm nay chưa ôn thẻ nào")}
                  {learn.domainsDue > 0 && ` · ${learn.domainsDue} ${t("areas", "lĩnh vực")}`}
                </div>
              </>
            )
          ) : (
            loaded && nodata
          )}
        </GlassCard>

        {/* Tiền giữ lại luỹ kế 12 tháng */}
        <GlassCard className="c-s8" onOpen={go("/finance")}>
          <CardHead
            icon={TrendingUp}
            tone="fin"
            title={cumTitle}
            subtitle={t(
              "Income minus cash out, running total. Net worth by month is not stored yet.",
              "Thu trừ tiền ra, cộng dồn. Tài sản ròng theo tháng chưa được lưu."
            )}
            onOpen={go("/finance")}
          />
          {hasSeries ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
                <div className="c-big2">
                  {(() => {
                    const b = moneyBig(cumLast, vi);
                    return b ? <>{b.value}<small>{b.unit === "tr" || b.unit === "m" ? `${b.unit} ₫` : b.unit}</small></> : "—";
                  })()}
                </div>
                <span className="c-chg">
                  <b className={monthNet >= 0 ? "good" : "bad"}>{monthNet >= 0 ? "▲ +" : "▼ −"}{wordMoney(Math.abs(monthNet), vi)}</b>{" "}
                  {t(`in month ${mNo} so far`, `riêng tháng ${mNo}`)}
                </span>
              </div>
              <AreaLine
                points={cum}
                baseline={minV < 0 && maxV > 0 ? { value: 0, label: t("Zero line", "Mốc 0") } : undefined}
                yTicks={[tick(1 / 3), tick(2 / 3)].map((v) => ({ value: v, label: shortMoney(v, vi) }))}
                endLabel={wordMoney(cumLast, vi)}
                endSub={t("This month", "Tháng này")}
                ariaLabel={t("Running net retained over 12 months: ", "Tiền giữ lại cộng dồn 12 tháng: ") + cum.map((p) => `${p.x} ${shortMoney(p.v, vi)}`).join(", ")}
              />
            </>
          ) : (
            <div className="c-empty-box" style={{ padding: "16px 0" }}>
              <div className="eh">{t("No income or spending recorded in the last 12 months", "12 tháng qua chưa ghi thu hay chi nào")}</div>
              <div className="ed">{t("Add an entry and the line is drawn here.", "Ghi một khoản, đường này sẽ được vẽ ở đây.")}</div>
            </div>
          )}
        </GlassCard>

        {/* Ngân sách tháng */}
        <GlassCard className="c-s4">
          <CardHead
            icon={Target}
            tone="spend"
            title={hasBudget ? t(`Budget, month ${mNo}`, `Ngân sách tháng ${mNo}`) : t(`Spending, month ${mNo}`, `Chi tiêu tháng ${mNo}`)}
            subtitle={hasBudget ? t("Spent per group", "Phần đã chi của từng nhóm") : t("No budget set — showing spending by group", "Chưa đặt ngân sách — hiện chi theo nhóm")}
            onOpen={go("/finance")}
          />
          {ranked.length > 0 ? (
            <>
              <SegRing
                groups={ranked.map((g) => ({ key: g.key, name: g.name, value: g.value, color: g.color, icon: g.key === OTHER_KEY ? LayoutGrid : groupIcon(g.name) }))}
                total={hasBudget ? budgetTotal : ringSum}
                centerNum={hasBudget && usedPct !== null ? String(usedPct) : (ringBig?.value ?? "0")}
                centerUnit={hasBudget ? "%" : ringUnit}
                caption={hasBudget ? t("of budget used", "ngân sách đã dùng") : t(`spent in month ${mNo}`, `đã chi tháng ${mNo}`)}
                pace={hasBudget ? pace : null}
                ariaLabel={
                  (hasBudget
                    ? t(`Used ${usedPct}% of the ${wordMoney(budgetTotal, vi)} budget: `, `Đã dùng ${usedPct}% ngân sách ${wordMoney(budgetTotal, vi)}: `)
                    : t(`Spent ${wordMoney(ringSum, vi)}: `, `Đã chi ${wordMoney(ringSum, vi)}: `)) +
                  ranked.map((g) => `${catLabel(g.name)} ${wordMoney(g.value, vi)}`).join(", ")
                }
              />
              <div className="c-ringnote">
                <b className="num">{dec(ringSum / 1e6, vi, 1)}</b>
                {hasBudget ? ` / ${dec(ringTotal / 1e6, vi, 0)} ${t("m ₫", "triệu ₫")} · ${t(`black tick = day ${el}/${dim}`, `vạch đen = ngày ${el}/${dim}`)}` : ` ${t("m ₫", "triệu ₫")}`}
              </div>
              <div className="c-ringact">
                <button type="button" className="c-btn c-btn-primary" onClick={go("/finance")}>{t("See details", "Xem chi tiết")}</button>
                <button type="button" className="c-rb" aria-label={t("Add expense", "Thêm khoản chi")} title={t("Add expense", "Thêm khoản chi")} onClick={() => open("expense")}><Plus /></button>
                <button type="button" className="c-rb" aria-label={t("Scan a receipt", "Quét hoá đơn")} title={t("Scan a receipt", "Quét hoá đơn")} onClick={() => open("scan")}><ScanLine /></button>
              </div>
            </>
          ) : (
            <div className="c-empty-box">
              <div className="eh">{t("Nothing spent this month yet", "Tháng này chưa có khoản chi nào")}</div>
              <div className="ed">{t("Add an expense or scan a receipt to start the month.", "Ghi một khoản chi hoặc quét hoá đơn để bắt đầu tháng.")}</div>
              <div className="c-ringact" style={{ justifyContent: "flex-start" }}>
                <button type="button" className="c-btn c-btn-primary" onClick={() => open("expense")}>{t("Add expense", "Thêm khoản chi")}</button>
                <button type="button" className="c-rb" aria-label={t("Scan a receipt", "Quét hoá đơn")} onClick={() => open("scan")}><ScanLine /></button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Giao dịch gần đây */}
        <GlassCard className="c-s7" onOpen={go("/finance?tab=history")}>
          <CardHead
            title={t("Recent transactions", "Giao dịch gần đây")}
            subtitle={t("Latest entries this month", "Khoản mới nhất tháng này")}
            onOpen={go("/finance?tab=history")}
          />
          {txs === null ? (
            loaded && <p className="c-st-n">{t("Could not load", "Chưa đọc được")}</p>
          ) : txs.length === 0 ? (
            <div className="c-empty-box">
              <div className="eh" style={{ fontSize: 16, lineHeight: "24px" }}>{t("No transactions this month", "Tháng này chưa có giao dịch")}</div>
              <div className="ed">{t("They appear here as soon as you add one.", "Ghi một khoản, nó sẽ hiện ở đây.")}</div>
            </div>
          ) : (
            <div className="c-tbl-scroll">
              <table className="c-tbl">
                <thead>
                  <tr>
                    <th>{t("Merchant / source", "Nơi chi / nguồn")}</th>
                    <th className="c-hide-m">{t("Group", "Nhóm")}</th>
                    <th>{t("Date", "Ngày")}</th>
                    <th className="r">{t("Amount", "Số tiền")}</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((tx) => {
                    const a = txAmt(tx);
                    return (
                      <tr key={tx.id}>
                        <td>
                          <div className="c-who">
                            <GlassIcon icon={groupIcon(tx.category)} tone={tx.type === "Income" ? "fin" : "spend"} />
                            <span className="p">{tx.supplier === "Unknown" ? t("Unknown", "Chưa rõ") : tx.supplier}</span>
                          </div>
                        </td>
                        <td className="c-hide-m">{catLabel(tx.category)}</td>
                        <td className="num">{dm(tx.date)}</td>
                        <td className={`r ${a.pos ? "text-[var(--good-t)]" : ""}`}>{a.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Sắp đến hạn */}
        <GlassCard className="c-s5" onOpen={go("/finance?tab=debts")}>
          <CardHead
            title={t("Coming due", "Sắp đến hạn")}
            subtitle={t("Debt instalments and credit card due dates", "Kỳ trả nợ và hạn thẻ tín dụng")}
            onOpen={go("/finance?tab=debts")}
          />
          {dueList.length === 0 ? (
            <div className="c-empty-box">
              <div className="eh" style={{ fontSize: 16, lineHeight: "24px" }}>{t("Nothing due soon", "Chưa có khoản nào sắp đến hạn")}</div>
              <div className="ed">{t("Debt schedules and cards with a balance show up here.", "Lịch trả nợ và thẻ đang có dư nợ sẽ hiện ở đây.")}</div>
            </div>
          ) : (
            <div>
              {dueList.map((d) => (
                <div key={d.key} className="c-li">
                  <GlassIcon icon={d.icon} tone="fin" />
                  <div className="c-li-grow">
                    <div className="c-li-p">{d.icon === CreditCard ? `${t("Card due", "Hạn thẻ")} ${d.title}` : d.title}</div>
                    <div className="c-li-s">{dm(d.date)} · {formatVND(Number(d.sub))}{d.icon === CreditCard ? ` · ${t("balance owed", "dư nợ")}` : ""}</div>
                  </div>
                  <span className={`c-stx ${d.days < 0 ? "late" : ""}`}>
                    <i />
                    {d.days < 0
                      ? t(`${en(-d.days, "day")} overdue`, `Quá hạn ${-d.days} ngày`)
                      : d.days === 0
                        ? t("Due today", "Hôm nay")
                        : t(`${en(d.days, "day")} left`, `Còn ${d.days} ngày`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Việc cần chú ý: hoá đơn chờ duyệt, tài liệu bỏ quên */}
        {attention.length > 0 && (
          <GlassCard className="c-s12">
            <CardHead title={t("Worth a look", "Cần chú ý")} />
            <div>
              {attention.map((a) => (
                <button key={a.key} type="button" className="c-li" onClick={go(a.href)}>
                  <GlassIcon icon={a.icon} tone={a.tone} />
                  <div className="c-li-grow">
                    <div className="c-li-p">{a.title}</div>
                    <div className="c-li-s">{a.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </>
  );
}
