"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Receipt, Target, Wallet, BarChart3, LayoutGrid } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { useAccounts } from "@/lib/useAccounts";
import { formatVND } from "@/lib/formatMoney";
import { groupIcon, rankGroups, OTHER_KEY } from "@/lib/groupViz";
import { dec, dm, wordMoney } from "@/lib/vizMoney";
import { moneyBig } from "@/components/SceneSummary";
import GlassIcon from "@/components/GlassIcon";
import PageIntro from "@/components/PageIntro";
import { CardHead, GlassCard, Segmented } from "@/components/charts/GlassCard";
import PillBars, { type PillBar } from "@/components/charts/PillBars";
import SegRing from "@/components/charts/SegRing";
import PetalChart, { type Petal } from "@/components/charts/PetalChart";
import ProgressRing, { type RingTone } from "@/components/charts/ProgressRing";
import { en } from "@/lib/plural";
import NetWorthCard from "@/components/finance/NetWorthCard";

/**
 * Phần đầu của Tài chính › Tổng quan theo demo `demo/clean/demo.html`:
 * đầu trang (ngày + câu kết luận) · Chi tiêu tháng · cột 6 tháng · Chi theo nhóm
 * (Tuần/Tháng/Năm) · So với ngân sách (cánh hoa) · hoá đơn chờ duyệt · sổ giao
 * dịch gần đây.
 *
 * Mọi số đến từ API sẵn có: `dashboard` (truyền vào qua `data`), `compare`
 * (cùng kỳ tháng trước, tuần/năm), `transaction/drafts`, `history`. Không số
 * nào được bịa; thiếu nguồn thì thẻ ở trạng thái rỗng và nói việc cần làm.
 */

export interface OverviewDash {
  month: string;
  monthlyIncome: number;
  monthlyExpense: number;
  transactionCount: number;
  elapsedDays: number;
  daysInMonth: number;
  ytdSeries: { name: string; income: number; expense: number }[];
  categoryBreakdown: { group: string; amount: number }[];
  budgetVsActual: { group: string; budget: number; actual: number; remaining: number }[];
  totalBudget: number;
}

interface Bucket {
  from: string;
  to: string;
  expense: number;
  byCategory: { group: string; amount: number }[];
}
interface Compare {
  anchor: string;
  current: Bucket;
  previous: Bucket;
}
interface Draft {
  id: string;
  date: string | null;
  supplier: string | null;
  categoryGroup: string | null;
  totalAmount: number | null;
  createdAt: string;
}
interface Tx {
  id: string;
  date: string;
  type: string;
  supplier: string;
  amount: number;
  category: string;
  subGroup: string;
  accountId: string | null;
}

type Period = "week" | "month" | "year";

const BUDGET_PALETTE = [1, 2, 3, 4, 6, 5];
const MAX_PETALS = 8;

export default function FinanceOverview({
  data,
  month,
  isCurrentMonth,
  focusDate,
  refreshKey,
  monthPicker,
  onNavigate,
  onReview,
}: {
  data: OverviewDash;
  month: string;
  isCurrentMonth: boolean;
  focusDate: string | null;
  refreshKey: number;
  monthPicker: ReactNode;
  onNavigate?: (tab: string) => void;
  onReview: () => void;
}) {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const { label } = useCategories();
  const accounts = useAccounts();
  const catLabel = (name: string) => (name === OTHER_KEY ? t("Other", "Khác") : label(name));

  const [yearStr, monthStr] = month.split("-");
  const mNo = Number(monthStr);
  const prevNo = mNo === 1 ? 12 : mNo - 1;
  const el = data.elapsedDays;
  const dim = data.daysInMonth || 30;
  const partial = isCurrentMonth && el < dim;
  const pace = partial ? el / dim : null;
  const range = `1/${mNo} – ${partial ? `${el}/${mNo}` : `${dim}/${mNo}`}`;

  // ---- Nguồn phụ: so sánh cùng kỳ, danh sách nháp, sổ gần đây -----------------
  const [cmp, setCmp] = useState<Record<string, Compare | "err">>({});
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [period, setPeriod] = useState<Period>("month");

  const anchor = focusDate ?? `${month}-${String(dim).padStart(2, "0")}`;
  // Kết quả lưu theo khoá (kỳ · ngày soi · lần tải) — đổi tháng hay ghi sổ xong
  // thì khoá đổi, số cũ tự bị bỏ mà không cần effect xoá state.
  const keyOf = (kind: Period) => `${kind}|${anchor}|${refreshKey}`;

  // Cùng kỳ tháng trước luôn cần cho câu kết luận + thẻ Chi tiêu; tuần/năm tải
  // khi người dùng chọn công tắc.
  useEffect(() => {
    const c = new AbortController();
    const kinds: Period[] = period === "month" ? ["month"] : ["month", period];
    for (const kind of kinds) {
      const k = `${kind}|${anchor}|${refreshKey}`;
      fetch(`/api/finance/compare?period=${kind}&date=${anchor}`, { signal: c.signal })
        .then((r) => r.json())
        .then((j) => setCmp((prev) => ({ ...prev, [k]: j?.success ? (j.data as Compare) : "err" })))
        .catch(() => { if (!c.signal.aborted) setCmp((prev) => ({ ...prev, [k]: "err" })); });
    }
    return () => c.abort();
  }, [period, anchor, refreshKey]);
  const cmpOf = (kind: Period) => {
    const v = cmp[keyOf(kind)];
    return v && v !== "err" ? v : null;
  };
  const loadingPeriod = cmp[keyOf(period)] === undefined;

  useEffect(() => {
    const c = new AbortController();
    fetch("/api/finance/transaction/drafts", { signal: c.signal })
      .then((r) => r.json())
      .then((j) => { if (j?.success) setDrafts(j.drafts ?? []); })
      .catch(() => {});
    return () => c.abort();
  }, [refreshKey]);

  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/finance/history?month=${month}`, { signal: c.signal })
      .then((r) => r.json())
      .then((j) => { if (j?.success) setTxs((j.data ?? []).slice(0, 6)); else setTxs([]); })
      .catch(() => {});
    return () => c.abort();
  }, [month, refreshKey]);

  // ---- Chi tiêu tháng: so với cùng kỳ tháng trước ----------------------------
  const prevSame = cmpOf("month")?.previous.expense ?? null;
  const pct =
    prevSame !== null && prevSame > 0
      ? Math.round(((data.monthlyExpense - prevSame) / prevSame) * 100)
      : null;
  const few = data.transactionCount < 5;

  const budgetRows = data.budgetVsActual.filter((b) => b.budget > 0);
  const hasBudget = budgetRows.length > 0 && data.totalBudget > 0;
  const budgetSpent = budgetRows.reduce((s, b) => s + b.actual, 0);
  const budgetTotal = budgetRows.reduce((s, b) => s + b.budget, 0);
  const usedPct = hasBudget ? Math.round((budgetSpent / budgetTotal) * 100) : null;

  // ---- Đầu trang -------------------------------------------------------------
  const catTotal = data.categoryBreakdown.reduce((s, c) => s + c.amount, 0);
  const topCat = [...data.categoryBreakdown].sort((a, b) => b.amount - a.amount)[0];
  const topShare = topCat && catTotal > 0 ? Math.round((topCat.amount / catTotal) * 100) : 0;

  const cmpText =
    pct === null
      ? null
      : Math.abs(pct) < 3
        ? t("about the same as the same period last month", "ngang cùng kỳ tháng trước")
        : t(
            `${pct > 0 ? "more" : "less"} than the same period last month by about ${Math.abs(pct)}%`,
            `${pct > 0 ? "nhiều" : "ít"} hơn cùng kỳ tháng trước khoảng ${Math.abs(pct)}%`
          );
  const lede = few ? (
    t(
      `Only ${en(data.transactionCount, "entry", "entries")} recorded in month ${mNo} — not enough to compare or forecast yet.`,
      `Mới ghi ${data.transactionCount} khoản trong tháng ${mNo} — chưa đủ để so sánh hay dự báo.`
    )
  ) : (
    <>
      {t("Spent ", "Chi ")}
      <b>{wordMoney(data.monthlyExpense, vi)}</b>{" "}
      {isCurrentMonth ? t(`in the first ${en(el, "day")}`, `trong ${el} ngày đầu tháng`) : t(`in month ${mNo}`, `trong tháng ${mNo}`)}
      {cmpText ? `, ${cmpText}` : ""}.
      {topCat && topShare >= 20 && data.categoryBreakdown.length > 1 && (
        <> {t(`${catLabel(topCat.group)} is ${topShare}% of it.`, `${catLabel(topCat.group)} chiếm ${topShare}%.`)}</>
      )}
    </>
  );
  const kicker = t(
    `Month ${mNo}/${yearStr}${partial ? ` · up to ${el}/${mNo}` : ""}`,
    `Tháng ${mNo}/${yearStr}${partial ? ` · tính tới ${el}/${mNo}` : ""}`
  );

  // ---- Cột 6 tháng -----------------------------------------------------------
  const six = data.ytdSeries.slice(-6);
  const bars = (() => {
    const items = six.map((m, i) => {
      const mm = Number(m.name.slice(5, 7));
      const isLast = i === six.length - 1;
      const empty = m.expense === 0 && m.income === 0;
      return { key: m.name, mm, v: empty ? null : m.expense, partial: isLast && partial };
    });
    const complete = items.filter((x) => x.v !== null && !x.partial) as { key: string; mm: number; v: number; partial: boolean }[];
    const enough = complete.length >= 2;
    const peak = enough ? complete.reduce((a, b) => (b.v > a.v ? b : a)) : null;
    const avg = enough ? complete.reduce((s, x) => s + x.v, 0) / complete.length : null;
    const maxV = Math.max(1, ...items.map((x) => x.v ?? 0));
    const maxM = maxV / 1e6;
    const nice = Math.max(4, Math.ceil((maxM * 1.05) / 4) * 4);
    return { items, complete, enough, peak, avg, nice };
  })();

  const tr = (n: number) => dec(n / 1e6, vi, n < 1e6 ? 2 : 1);
  const pillData: PillBar[] = bars.items.map((x) => ({
    key: x.key,
    x: `${t("M", "T")}${x.mm}`,
    sx: x.partial ? t(`to ${dm(anchor)}`, `tới ${dm(anchor)}`) : undefined,
    v: x.v,
    lab: x.v === null ? "–" : tr(x.v),
    accent: !!bars.peak && x.key === bars.peak.key,
    partial: x.partial,
  }));
  const sixTitle = bars.peak
    ? t(
        `Month ${bars.peak.mm} was the biggest of the last ${six.length}: ${wordMoney(bars.peak.v, vi)}`,
        `Tháng ${bars.peak.mm} chi nhiều nhất ${six.length} tháng: ${wordMoney(bars.peak.v, vi)}`
      )
    : t(
        `${bars.complete.length} finished month${bars.complete.length === 1 ? "" : "s"} so far — not enough to compare`,
        `Mới có ${bars.complete.length} tháng đã trọn — chưa đủ để so sánh`
      );
  const sixSub =
    bars.peak && bars.avg !== null
      ? t(
          `${bars.peak.v >= bars.avg ? "Above" : "Below"} the ${bars.complete.length}-month average (${tr(bars.avg)}m) by about ${wordMoney(Math.abs(bars.peak.v - bars.avg), vi)}`,
          `${bars.peak.v >= bars.avg ? "Cao" : "Thấp"} hơn trung bình ${bars.complete.length} tháng đủ (${tr(bars.avg)} tr) khoảng ${wordMoney(Math.abs(bars.peak.v - bars.avg), vi)}`
        )
      : partial
        ? t("The dashed column is the month still running", "Cột viền đứt là tháng đang chạy, chưa trọn")
        : t("Spending per month", "Chi tiêu theo tháng");

  // ---- Chi theo nhóm ---------------------------------------------------------
  const groupSource: { name: string; value: number }[] | null =
    period === "month"
      ? data.categoryBreakdown.map((c) => ({ name: c.group, value: c.amount }))
      : cmpOf(period)
        ? cmpOf(period)!.current.byCategory.map((c) => ({ name: c.group, value: c.amount }))
        : null;
  const ranked = groupSource ? rankGroups(groupSource, 5) : [];
  const ringTotal = ranked.reduce((s, g) => s + g.value, 0);
  const periodWord =
    period === "week"
      ? t("this week", "tuần này")
      : period === "year"
        ? t(`${yearStr}`, `năm ${yearStr}`)
        : t(`month ${mNo}`, `tháng ${mNo}`);
  const periodSub =
    period === "month"
      ? range
      : cmpOf(period)
        ? `${dm(cmpOf(period)!.current.from)} – ${dm(anchor)}`
        : "";
  const ringBig = moneyBig(ringTotal, vi);
  const ringUnit = ringBig ? (ringBig.unit === "tr" || ringBig.unit === "m" ? `${ringBig.unit} ₫` : ringBig.unit) : undefined;
  const top1 = ranked.find((g) => g.key !== OTHER_KEY) ?? ranked[0];
  const groupTitle =
    ringTotal > 0 && top1
      ? t(
          `${catLabel(top1.name)} is ${Math.round((top1.value / ringTotal) * 100)}% of spending ${periodWord}`,
          `${catLabel(top1.name)} chiếm ${Math.round((top1.value / ringTotal) * 100)}% chi ${periodWord}`
        )
      : t(`Spending by group, ${periodWord}`, `Chi theo nhóm, ${periodWord}`);

  // ---- So với ngân sách ------------------------------------------------------
  // Màu cánh theo thứ hạng chi của tháng — cùng nhóm thì cùng màu với vòng cung
  // "Chi theo nhóm" ở trên; nhóm chưa chi lấy màu còn lại trong bảng sáu màu.
  const monthRank = rankGroups(data.categoryBreakdown.map((c) => ({ name: c.group, value: c.amount })), 5);
  const petalColor = (group: string, i: number) =>
    monthRank.find((g) => g.name === group)?.color ?? BUDGET_PALETTE[(i + 3) % BUDGET_PALETTE.length];
  const petals: Petal[] = (() => {
    const sorted = [...budgetRows].sort((a, b) => b.budget - a.budget);
    const head = sorted.slice(0, sorted.length > MAX_PETALS ? MAX_PETALS - 1 : MAX_PETALS);
    const tail = sorted.slice(head.length);
    const out: Petal[] = head.map((b, i) => ({
      key: b.group, name: b.group, spent: b.actual, budget: b.budget, color: petalColor(b.group, i),
    }));
    if (tail.length > 0) {
      out.push({
        key: OTHER_KEY, name: OTHER_KEY,
        spent: tail.reduce((s, b) => s + b.actual, 0), budget: tail.reduce((s, b) => s + b.budget, 0), color: 5,
      });
    }
    return out;
  })();

  // Chưa có ngân sách: cánh mờ từ các nhóm đã chi trong tháng, KHÔNG kèm số.
  const ghost: Petal[] = rankGroups(data.categoryBreakdown.map((c) => ({ name: c.group, value: c.amount })), 5)
    .slice(0, 6)
    .map((g) => ({ key: g.key, name: g.name, spent: 0, budget: 0, color: g.color }));
  const frac = (p: Petal) => (p.budget > 0 ? p.spent / p.budget : 0);
  const overs = petals.filter((p) => frac(p) > 1).sort((a, b) => frac(b) - frac(a));
  const quick = pace === null ? [] : petals.filter((p) => frac(p) <= 1 && frac(p) > pace);
  const budgetTitle = !hasBudget
    ? t(`No budget set for month ${mNo}`, `Tháng ${mNo} chưa có ngân sách`)
    : overs.length > 0
      ? t(
          `Against budget: ${catLabel(overs[0].name)} is ${Math.round((frac(overs[0]) - 1) * 100)}% over${quick.length ? `, ${quick.length} more ahead of pace` : ""}`,
          `So với ngân sách: ${catLabel(overs[0].name)} vượt ${Math.round((frac(overs[0]) - 1) * 100)}%${quick.length ? `, ${quick.length} nhóm khác quá nhịp` : ""}`
        )
      : quick.length > 0
        ? t(`${quick.length} group${quick.length > 1 ? "s are" : " is"} ahead of budget pace`, `${quick.length} nhóm đang quá nhịp ngân sách`)
        : t(`All ${petals.length} budgeted groups are within limits`, `Cả ${petals.length} nhóm có ngân sách đều trong hạn mức`);
  const budgetSub = hasBudget
    ? t(
        `Spent / budget, month ${mNo} · ${tr(budgetSpent)} / ${tr(budgetTotal)}m`,
        `Đã chi / ngân sách tháng ${mNo} · ${tr(budgetSpent)} / ${tr(budgetTotal)} triệu ₫`
      )
    : t("Budget per group will show here", "Ngân sách theo nhóm sẽ hiện ở đây");
  const short = (n: number) => (n >= 1e6 ? `${dec(n / 1e6, vi, 1).replace(/[.,]0$/, "")}${vi ? "tr" : "m"}` : `${Math.round(n / 1e3)}k`);

  const statusOf = (p: Petal): { tone: RingTone; cls: string; text: string } => {
    const f = frac(p);
    if (f > 1) return { tone: "over", cls: "x", text: t(`Over ${Math.round((f - 1) * 100)}%`, `Vượt ${Math.round((f - 1) * 100)}%`) };
    if (pace !== null && f > pace) return { tone: "warn", cls: "w", text: t("Ahead of pace", "Quá nhịp") };
    return { tone: "ok", cls: "", text: pace !== null ? t("On pace", "Trong nhịp") : t("Within budget", "Trong hạn mức") };
  };

  // ---- Hoá đơn chờ duyệt -----------------------------------------------------
  const pendingTop = [...drafts].reverse().slice(0, 3);
  const acctName = (id: string | null) => (id ? accounts.find((a) => a.id === id)?.name ?? "—" : "—");

  const sub = (tx: Tx) => [catLabel(tx.category), tx.subGroup ? label(tx.subGroup) : ""].filter(Boolean).join(" · ");
  const amt = (tx: Tx) => {
    if (tx.type === "Income") return { text: `+${formatVND(tx.amount)}`, cls: "pos" };
    if (tx.type === "Expense") return { text: `−${formatVND(tx.amount)}`, cls: "" };
    if (tx.type === "Refund") return { text: `+${formatVND(tx.amount)}`, cls: "pos" };
    return { text: formatVND(tx.amount), cls: "" };
  };

  const usedBarPct = usedPct === null ? 0 : Math.min(100, usedPct);
  const remaining = hasBudget ? budgetTotal - budgetSpent : null;

  return (
    <>
      <PageIntro title={t("Finance", "Tài chính")} kicker={kicker} lede={lede} aside={monthPicker} />

      <div className="c-g12">
        {/* Chi tiêu tháng */}
        <GlassCard className="c-s5" onOpen={onNavigate ? () => onNavigate("expense") : undefined}>
          <CardHead
            icon={Wallet}
            tone="spend"
            title={t(`Spending, month ${mNo}`, `Chi tiêu tháng ${mNo}`)}
            subtitle={range}
            onOpen={onNavigate ? () => onNavigate("expense") : undefined}
          />
          <div className="c-big2">{data.monthlyExpense.toLocaleString(vi ? "vi-VN" : "en-US")}<small>₫</small></div>
          <div className="c-chg" style={{ marginTop: 12 }}>
            {pct === null || prevSame === null ? (
              few
                ? t("Too few entries to compare with last month", "Chưa đủ giao dịch để so với tháng trước")
                : t("No same-period figure for last month", "Tháng trước chưa có số cùng kỳ để so")
            ) : Math.abs(pct) < 3 ? (
              <>{t("About the same as", "Ngang với")} {t(`the same period in month ${prevNo}`, `cùng kỳ tháng ${prevNo}`)} ({formatVND(prevSame)})</>
            ) : (
              <>
                <b className={pct > 0 ? "bad" : "good"}>{pct > 0 ? "▲ +" : "▼ −"}{Math.abs(pct)}%</b>{" "}
                {t(`vs the same period in month ${prevNo}`, `so với cùng kỳ tháng ${prevNo}`)} ({formatVND(prevSame)})
              </>
            )}
          </div>
          <div className="c-mini">
            <div>
              <div className="l">{t("Income", "Thu nhập")}</div>
              <div className="v num">{data.monthlyIncome > 0 ? <>{data.monthlyIncome.toLocaleString(vi ? "vi-VN" : "en-US")}<small>₫</small></> : <span style={{ color: "var(--muted)", fontSize: 16, fontWeight: 400 }}>{t("Not recorded", "Chưa ghi")}</span>}</div>
            </div>
            <div>
              <div className="l">{t("Left in budget", "Còn lại ngân sách")}</div>
              <div className="v num">
                {remaining === null ? (
                  <span style={{ color: "var(--muted)", fontSize: 16, fontWeight: 400 }}>{t("Not set", "Chưa đặt")}</span>
                ) : (
                  <>{remaining < 0 ? "−" : ""}{Math.abs(remaining).toLocaleString(vi ? "vi-VN" : "en-US")}<small>₫</small></>
                )}
              </div>
            </div>
          </div>
          {hasBudget && usedPct !== null ? (
            <>
              <div className="c-pace" role="img" aria-label={t(`${usedPct}% of the ${short(budgetTotal)} budget used`, `Đã dùng ${usedPct}% ngân sách ${short(budgetTotal)}`)}>
                <div className={`c-pace-fill ${usedPct > 100 ? "over" : ""}`} style={{ width: `${usedBarPct}%` }} />
                {pace !== null && <div className="c-pace-tick" style={{ left: `${pace * 100}%` }} />}
              </div>
              <div className="c-pace-cap">
                <span>{t("Used ", "Đã dùng ")}<b>{usedPct}%</b> {t("of", "của")} {short(budgetTotal)}</span>
                {pace !== null && <span>{t(`Today: day ${el}/${dim}`, `Hôm nay: ngày ${el}/${dim}`)}</span>}
              </div>
            </>
          ) : (
            <p className="c-pace-cap" style={{ marginTop: 24 }}>
              {t("No budget set for this month, so there is no pace bar.", "Tháng này chưa đặt ngân sách nên chưa có vạch nhịp.")}
            </p>
          )}
        </GlassCard>

        {/* Cột 6 tháng */}
        <GlassCard className="c-s7" onOpen={onNavigate ? () => onNavigate("expense") : undefined}>
          <CardHead
            icon={BarChart3}
            tone="spend"
            title={sixTitle}
            subtitle={sixSub}
            sum={
              bars.avg !== null ? (
                <>
                  {tr(bars.avg)}
                  <small>{t(`m ₫ (avg of ${bars.complete.length})`, `tr ₫ (TB ${bars.complete.length} tháng)`)}</small>
                </>
              ) : undefined
            }
            wrap
          />
          <PillBars
            data={pillData}
            max={bars.nice * 1e6}
            refLine={bars.avg !== null ? { value: bars.avg, label: `${t("Avg", "TB")} ${tr(bars.avg)} ${t("m", "tr")}` } : undefined}
            unit={t("m", "tr")}
            height={230}
            yTicks={[bars.nice / 4, bars.nice / 2, bars.nice].map((v) => ({ value: v * 1e6, label: String(Math.round(v)) }))}
            ariaLabel={t("Spending per month, millions of dong: ", "Chi tiêu từng tháng, đơn vị triệu đồng: ") + pillData.map((d) => `${d.x} ${d.lab}`).join(", ")}
          />
        </GlassCard>

        {/* Chi theo nhóm */}
        <GlassCard className="c-s12">
          <CardHead
            icon={LayoutGrid}
            tone="spend"
            title={groupTitle}
            subtitle={periodSub ? `${periodSub}${ringTotal > 0 ? ` · ${t("total", "tổng")} ${wordMoney(ringTotal, vi)}` : ""}` : undefined}
            wrap
            actions={
              <Segmented<Period>
                value={period}
                onChange={setPeriod}
                label={t("Period", "Kỳ xem")}
                options={[
                  ...(isCurrentMonth ? [{ value: "week" as Period, label: t("Week", "Tuần") }] : []),
                  { value: "month", label: t("Month", "Tháng") },
                  { value: "year", label: t("Year", "Năm") },
                ]}
              />
            }
          />
          {groupSource === null ? (
            <p className="c-pace-cap" style={{ margin: "24px 0" }}>
              {loadingPeriod ? t("Loading…", "Đang tải…") : t("Could not load this period.", "Chưa đọc được kỳ này.")}
            </p>
          ) : ringTotal <= 0 ? (
            <div className="c-empty-box" style={{ padding: "16px 0" }}>
              <div className="eh">{t("No spending in this period yet", "Kỳ này chưa có khoản chi nào")}</div>
              <div className="ed">{t("Add an expense or scan a receipt and the groups appear here.", "Ghi một khoản chi hoặc quét hoá đơn, các nhóm sẽ hiện ở đây.")}</div>
            </div>
          ) : (
            <div className="c-split">
              <SegRing
                small
                groups={ranked.map((g) => ({ key: g.key, name: g.name, value: g.value, color: g.color, icon: g.key === OTHER_KEY ? LayoutGrid : groupIcon(g.name) }))}
                total={ringTotal}
                centerNum={ringBig?.value ?? "0"}
                centerUnit={ringUnit}
                caption={t(`total spent, ${periodWord}`, `tổng chi ${periodWord}`)}
                ariaLabel={
                  t(`Spent ${wordMoney(ringTotal, vi)} ${periodWord}: `, `Tổng chi ${periodWord} ${wordMoney(ringTotal, vi)}: `) +
                  ranked.map((g) => `${catLabel(g.name)} ${Math.round((g.value / ringTotal) * 100)}%`).join(", ")
                }
              />
              <div className="c-glist">
                {ranked.map((g) => (
                  <div key={g.key} className="gr" style={{ ["--rg-c" as string]: `var(--rg-${g.color})` }}>
                    <i />
                    <span>{catLabel(g.name)}</span>
                    <span className="a">{formatVND(g.value)}</span>
                    <span className="pc">{Math.round((g.value / ringTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        {/* So với ngân sách */}
        <GlassCard className="c-s12">
          <CardHead icon={Target} tone="spend" title={budgetTitle} subtitle={budgetSub} wrap />
          {hasBudget ? (
            <div className="c-psplit">
              <PetalChart
                rows={petals}
                ariaLabel={
                  t("Spent against budget by group: ", "Đã chi so với ngân sách theo nhóm: ") +
                  petals.map((p) => `${catLabel(p.name)} ${Math.round(frac(p) * 100)}%`).join(", ")
                }
                label={(p) => catLabel(p.name)}
                money={short}
              />
              <div>
                {petals.map((p) => {
                  const st = statusOf(p);
                  const pc = Math.round(frac(p) * 100);
                  const Icon = p.key === OTHER_KEY ? LayoutGrid : groupIcon(p.name);
                  return (
                    <div key={p.key} className="c-bud-row">
                      <GlassIcon icon={Icon} tone="spend" />
                      <div>
                        <div className="c-bud-nm">{catLabel(p.name)}</div>
                        <div className="c-bud-am">{tr(p.spent)} / {tr(p.budget)} {t("m ₫", "tr ₫")}</div>
                      </div>
                      <div className="c-rg">
                        <ProgressRing
                          fraction={frac(p)}
                          pace={pace}
                          tone={st.tone}
                          ariaLabel={t(`${catLabel(p.name)}: ${pc}% of budget`, `${catLabel(p.name)}: ${pc}% ngân sách`)}
                        />
                        <div>
                          <span className="pc">{pc}%</span>
                          <span className={`st ${st.cls}`}><i />{st.text}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="c-pace-cap" style={{ marginTop: 4 }}>
                  {pace !== null && t(`The black tick on each ring is the day pace (${el}/${dim}). `, `Vạch đen trên vòng là nhịp ngày ${el}/${dim}. `)}
                  {t("Petal area of the solid layer follows the %, the pale layer is 100%.", "Cánh hoa: diện tích lớp đậm tỷ lệ với %, lớp mờ là 100%.")}
                </p>
              </div>
            </div>
          ) : (
            <div className="c-psplit">
              {ghost.length > 1 ? (
                <PetalChart
                  rows={ghost}
                  empty
                  ariaLabel={t("No budget yet. Groups this month: ", "Chưa có ngân sách. Các nhóm tháng này: ") + ghost.map((p) => catLabel(p.name)).join(", ")}
                  label={(p) => catLabel(p.name)}
                  money={short}
                />
              ) : (
                <div />
              )}
              <div className="c-empty-box">
                <div className="eh">{t(`No budget for month ${mNo} yet`, `Tháng ${mNo} chưa có ngân sách`)}</div>
                <div className="ed">
                  {t(
                    "Once a month has a budget per group, each petal fills in as you spend. The petals shown here are only this month's spending groups, without numbers.",
                    "Khi tháng có ngân sách theo từng nhóm, mỗi cánh hoa sẽ đậm dần theo phần đã chi. Các cánh ở đây chỉ là những nhóm bạn đã chi trong tháng, chưa mang số nào."
                  )}
                </div>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Tài sản ròng 12 tháng (đọc api/finance/networth) */}
        <NetWorthCard className="c-s12" refreshKey={refreshKey} />

        {/* Hoá đơn chờ duyệt */}
        {drafts.length > 0 && (
          <GlassCard className="c-s12">
            <div className="c-pend">
              <div className="c-rstack" aria-hidden>
                {pendingTop.map((d, i) => (
                  <div key={d.id} className={`c-rcp r${i + 1}`}>
                    <b className="num">{dm(d.date ?? d.createdAt)}</b>
                    <span>{d.supplier || t("Unknown", "Chưa rõ")}</span>
                  </div>
                ))}
              </div>
              <div className="c-hd-grow">
                <div style={{ font: "500 20px/28px var(--font-sans)", letterSpacing: "-.02em" }}>
                  {t(`${en(drafts.length, "receipt")} waiting for review`, `${drafts.length} hoá đơn đang chờ duyệt`)}
                </div>
                <div className="c-hd-s" style={{ fontFamily: "var(--font-sans)" }}>
                  {t("Scanned and saved as drafts, not in the ledger yet", "Đã quét và lưu nháp, chưa vào sổ")}
                </div>
              </div>
              <button type="button" className="c-btn c-btn-primary" onClick={onReview}>
                {t(`Review ${en(drafts.length, "receipt")}`, `Duyệt ${drafts.length} hoá đơn`)}
              </button>
            </div>
            <div>
              {drafts.slice(0, 4).map((d) => (
                <button key={d.id} type="button" className="c-li" onClick={onReview}>
                  <GlassIcon icon={d.categoryGroup ? groupIcon(d.categoryGroup) : Receipt} tone="spend" />
                  <div className="c-li-grow">
                    <div className="c-li-p">{d.supplier || t("Unknown merchant", "Chưa rõ nơi chi")}</div>
                    <div className="c-li-s">
                      {dm(d.date ?? d.createdAt)}
                      {d.categoryGroup ? ` · ${t("suggested group", "gợi ý nhóm")} ${catLabel(d.categoryGroup)}` : ""}
                    </div>
                  </div>
                  <div className="c-li-r">{d.totalAmount ? formatVND(d.totalAmount) : t("No amount read", "Chưa đọc được số tiền")}</div>
                </button>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Sổ giao dịch gần đây */}
        <GlassCard className="c-s12">
          <CardHead
            title={t("Recent transactions", "Giao dịch gần đây")}
            subtitle={t(`Latest entries in month ${mNo}`, `Khoản mới nhất của tháng ${mNo}`)}
            actions={
              onNavigate && (
                <button type="button" className="c-btn c-btn-secondary c-btn-sm" onClick={() => onNavigate("history")}>
                  {t("Whole ledger", "Toàn bộ sổ")}
                </button>
              )
            }
          />
          {txs.length === 0 ? (
            <p className="c-pace-cap">{t("Nothing to show yet.", "Chưa có khoản nào để hiện.")}</p>
          ) : (
            <div className="c-tbl-scroll">
              <table className="c-tbl">
                <thead>
                  <tr>
                    <th>{t("Merchant / source", "Nơi chi / nguồn")}</th>
                    <th className="c-hide-m">{t("Group · sub-group", "Nhóm · nhóm phụ")}</th>
                    <th className="c-hide-m">{t("Account", "Tài khoản")}</th>
                    <th>{t("Date", "Ngày")}</th>
                    <th className="r">{t("Amount", "Số tiền")}</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((tx) => {
                    const a = amt(tx);
                    const Icon = tx.type === "Transfer" ? Wallet : groupIcon(tx.category);
                    return (
                      <tr key={tx.id}>
                        <td>
                          <div className="c-who">
                            <GlassIcon icon={Icon} tone={tx.type === "Income" ? "fin" : "spend"} />
                            <span className="p">{tx.supplier === "Unknown" ? t("Unknown", "Chưa rõ") : tx.supplier}</span>
                          </div>
                        </td>
                        <td className="c-hide-m"><div className="s" style={{ color: "var(--ink)" }}>{sub(tx)}</div></td>
                        <td className="c-hide-m">{acctName(tx.accountId)}</td>
                        <td className="num">{dm(tx.date)}</td>
                        <td className={`r ${a.cls === "pos" ? "text-[var(--good-t)]" : ""}`}>{a.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}
