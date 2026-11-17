"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Target, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { thisMonthLocalIso } from "@/lib/localDate";
import { formatVND } from "@/lib/formatMoney";
import { dec, shortMoney, wordMoney } from "@/lib/vizMoney";
import { groupIcon } from "@/lib/groupViz";
import PageIntro from "@/components/PageIntro";
import GlassIcon from "@/components/GlassIcon";
import AmountInput from "@/components/ui/AmountInput";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import { CardHead, GlassCard, Segmented } from "@/components/charts/GlassCard";
import ProgressRing, { type RingTone } from "@/components/charts/ProgressRing";

/**
 * Tab Ngân sách: đặt ngân sách chi / mục tiêu thu cho từng nhóm của TỪNG THÁNG,
 * xem đã dùng bao nhiêu, và đánh giá cả năm (lưới 12 tháng × nhóm).
 *
 * Mỗi (tháng, nhóm) là một dòng riêng ở DB nên sửa tháng này không đụng tháng
 * khác — lịch sử đặt ngân sách được giữ lại. Công thức thực tế/ngân sách nằm ở
 * `src/lib/budgets.ts`; tab này chỉ vẽ và gửi số. Tên nhóm gửi đi luôn là tên
 * CHUẨN tiếng Anh, `label()` chỉ để hiển thị.
 */

type Kind = "expense" | "income";
type Level = "none" | "ok" | "near" | "over" | "hit";

interface Row {
  id: string | null;
  group: string;
  budget: number;
  actual: number;
  remaining: number;
  pct: number | null;
  level: Level;
  unbudgeted: boolean;
  inactive: boolean;
}
interface MonthData {
  kind: Kind;
  period: string;
  rows: Row[];
  totals: { budget: number; actual: number; unbudgetedActual: number; remaining: number; pct: number | null; level: Level };
  overGroups: string[];
  previous: { period: string; count: number };
}
interface Cell { month: string; budget: number; actual: number; pct: number | null; level: Level; future: boolean }
interface YearGroup {
  group: string; cells: Cell[]; totalBudget: number; totalActual: number; pct: number | null; level: Level;
  monthsOver: number; monthsHit: number;
}
interface YearData {
  kind: Kind;
  year: string;
  currentMonth: string;
  evaluation: {
    months: Cell[]; groups: YearGroup[]; totalBudget: number; totalActual: number; totalBudgetToDate: number;
    pct: number | null; pctToDate: number | null; level: Level;
    monthsOver: number; monthsHit: number; monthsEvaluated: number; monthsWithBudget: number;
  };
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const RING_TONE: Record<Level, RingTone> = { none: "ok", ok: "ok", near: "warn", over: "over", hit: "good" };

/** Nền ô của lưới năm: tint nhạt của màu mức — chữ vẫn là mực. */
const CELL_BG: Record<Level, string> = {
  none: "transparent",
  ok: "color-mix(in srgb, var(--acc) 14%, transparent)",
  near: "color-mix(in srgb, var(--warn) 24%, transparent)",
  over: "color-mix(in srgb, var(--bad) 26%, transparent)",
  hit: "color-mix(in srgb, var(--good) 24%, transparent)",
};

export default function BudgetTab() {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const { label } = useCategories();
  const catLabel = (name: string) => label(name);

  const [month, setMonth] = useState(thisMonthLocalIso());
  const [kind, setKind] = useState<Kind>("expense");
  const [year, setYear] = useState(() => Number(thisMonthLocalIso().slice(0, 4)));
  const [version, setVersion] = useState(0);
  // Số nhập dở, khoá theo (loại · tháng · nhóm) để đổi tháng không làm lẫn ô.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Kết quả khoá theo tham số + phiên bản: đổi tháng/loại hoặc lưu xong thì khoá
  // đổi, số cũ tự bị bỏ mà không cần effect xoá state.
  const [monthRes, setMonthRes] = useState<Record<string, MonthData | "err">>({});
  const [yearRes, setYearRes] = useState<Record<string, YearData | "err">>({});
  const mKey = `${kind}|${month}|${version}`;
  const yKey = `${kind}|${year}|${version}`;

  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/finance/budgets?period=${month}&kind=${kind}`, { signal: c.signal })
      .then((r) => r.json())
      .then((j) => setMonthRes((p) => ({ ...p, [mKey]: j?.success ? (j.data as MonthData) : "err" })))
      .catch(() => { if (!c.signal.aborted) setMonthRes((p) => ({ ...p, [mKey]: "err" })); });
    return () => c.abort();
  }, [month, kind, mKey]);

  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/finance/budgets?year=${year}&kind=${kind}`, { signal: c.signal })
      .then((r) => r.json())
      .then((j) => setYearRes((p) => ({ ...p, [yKey]: j?.success ? (j.data as YearData) : "err" })))
      .catch(() => { if (!c.signal.aborted) setYearRes((p) => ({ ...p, [yKey]: "err" })); });
    return () => c.abort();
  }, [year, kind, yKey]);

  const data = monthRes[mKey] && monthRes[mKey] !== "err" ? (monthRes[mKey] as MonthData) : null;
  const monthFailed = monthRes[mKey] === "err";
  const yearData = yearRes[yKey] && yearRes[yKey] !== "err" ? (yearRes[yKey] as YearData) : null;
  const yearFailed = yearRes[yKey] === "err";

  const [yStr, mStr] = month.split("-");
  const mNo = Number(mStr);
  const isCurrent = month === thisMonthLocalIso();
  const dim = new Date(Number(yStr), mNo, 0).getDate();
  const pace = isCurrent ? new Date().getDate() / dim : null;
  const income = kind === "income";

  const dkey = (group: string) => `${kind}|${month}|${group}`;
  const rows = data?.rows ?? [];
  const dirtyRows = rows.filter((r) => {
    const d = drafts[dkey(r.group)];
    return d !== undefined && d !== "" && (r.unbudgeted || Number(d) !== r.budget);
  });

  const bump = () => setVersion((v) => v + 1);

  async function save(list: Row[]) {
    if (list.length === 0) return;
    setBusy("save");
    setNotice(null);
    try {
      const res = await fetch("/api/finance/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: month,
          kind,
          items: list.map((r) => ({ group: r.group, amount: Number(drafts[dkey(r.group)]) })),
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Error");
      setDrafts((p) => {
        const n = { ...p };
        for (const r of list) delete n[dkey(r.group)];
        return n;
      });
      setNotice({ tone: "ok", text: t(`Saved ${j.data.saved} group(s) for month ${mNo}`, `Đã lưu ${j.data.saved} nhóm cho tháng ${mNo}`) });
      bump();
    } catch (e) {
      setNotice({ tone: "err", text: e instanceof Error ? e.message : t("Could not save", "Chưa lưu được") });
    } finally {
      setBusy(null);
    }
  }

  async function remove(r: Row) {
    if (!r.id) return;
    if (!confirm(t(`Delete the ${month} budget of "${catLabel(r.group)}"? Other months are not touched.`, `Xoá ngân sách tháng ${month} của "${catLabel(r.group)}"? Các tháng khác giữ nguyên.`))) return;
    setBusy(r.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/finance/budgets?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Error");
      bump();
    } catch (e) {
      setNotice({ tone: "err", text: e instanceof Error ? e.message : t("Could not delete", "Chưa xoá được") });
    } finally {
      setBusy(null);
    }
  }

  async function copyFromPrevious() {
    if (!data) return;
    setBusy("copy");
    setNotice(null);
    try {
      const res = await fetch("/api/finance/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy", from: data.previous.period, to: month, kind }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Error");
      const { created, kept } = j.data as { created: number; kept: number };
      setNotice({
        tone: "ok",
        text: created > 0
          ? t(`Copied ${created} group(s) from ${data.previous.period}${kept ? `, kept ${kept} already set` : ""}`, `Đã chép ${created} nhóm từ ${data.previous.period}${kept ? `, giữ nguyên ${kept} nhóm đã đặt` : ""}`)
          : t("Nothing to copy — every group already has a budget this month", "Không có gì để chép — mọi nhóm đã có ngân sách tháng này"),
      });
      bump();
    } catch (e) {
      setNotice({ tone: "err", text: e instanceof Error ? e.message : t("Could not copy", "Chưa chép được") });
    } finally {
      setBusy(null);
    }
  }

  // ---- Câu kết luận ----------------------------------------------------------
  const tot = data?.totals;
  const hasBudget = !!tot && tot.budget > 0;
  const overN = data?.overGroups.length ?? 0;
  const lede = !data
    ? ""
    : !hasBudget
      ? income
        ? t(`No income target for month ${mNo} yet. Set one per group below.`, `Tháng ${mNo} chưa có mục tiêu thu. Đặt cho từng nhóm ở bên dưới.`)
        : t(`No budget for month ${mNo} yet. Set one per group below, or copy last month's.`, `Tháng ${mNo} chưa có ngân sách. Đặt cho từng nhóm ở bên dưới, hoặc chép từ tháng trước.`)
      : income
        ? t(`Income reached ${tot.pct}% of the ${wordMoney(tot.budget, false)} target for month ${mNo}.`, `Thu đạt ${tot.pct}% mục tiêu ${wordMoney(tot.budget, true)} của tháng ${mNo}.`)
        : t(
            `Used ${tot.pct}% of the ${wordMoney(tot.budget, false)} budget for month ${mNo}${overN ? `, ${overN} group${overN > 1 ? "s" : ""} over` : ", all groups within limits"}.`,
            `Đã dùng ${tot.pct}% ngân sách ${wordMoney(tot.budget, true)} của tháng ${mNo}${overN ? `, ${overN} nhóm vượt` : ", mọi nhóm trong hạn mức"}.`
          );

  const statusOf = (r: Row): { cls: string; text: string } => {
    if (r.level === "none") return { cls: "", text: r.actual > 0 ? t("No budget set", "Chưa đặt") : t("Not set", "Chưa đặt") };
    if (income) return r.level === "hit" ? { cls: "g", text: t("Target met", "Đạt mục tiêu") } : { cls: "", text: t("Below target", "Chưa đạt") };
    if (r.level === "over") return { cls: "x", text: t(`Over ${(r.pct ?? 100) - 100}%`, `Vượt ${(r.pct ?? 100) - 100}%`) };
    if (r.level === "near") return { cls: "w", text: t("Near the limit", "Sắp chạm hạn mức") };
    return { cls: "", text: t("Within budget", "Trong hạn mức") };
  };

  const monthPicker = <CustomMonthPicker value={month} onChange={setMonth} />;
  const kindSwitch = (
    <Segmented<Kind>
      value={kind}
      onChange={setKind}
      label={t("Budget type", "Loại ngân sách")}
      options={[
        { value: "expense", label: t("Expenses", "Chi phí") },
        { value: "income", label: t("Revenue", "Doanh thu") },
      ]}
    />
  );

  return (
    <div className="space-y-8 animate-in fade-in">
      <PageIntro
        title={t("Budget", "Ngân sách")}
        kicker={t(`Month ${mNo}/${yStr}`, `Tháng ${mNo}/${yStr}`)}
        lede={lede || undefined}
        aside={<div className="flex flex-wrap items-center gap-3">{monthPicker}{kindSwitch}</div>}
      />

      <div className="c-g12">
        {/* ---- Ngân sách của tháng ---- */}
        <GlassCard className="c-s12">
          <CardHead
            icon={Target}
            tone="spend"
            title={income ? t(`Income targets, month ${mNo}`, `Mục tiêu thu tháng ${mNo}`) : t(`Budget, month ${mNo}`, `Ngân sách tháng ${mNo}`)}
            subtitle={t(
              "Each month keeps its own numbers — changing this month never touches the others.",
              "Mỗi tháng giữ số riêng — sửa tháng này không đụng các tháng khác."
            )}
            wrap
            actions={
              <>
                <button
                  type="button"
                  className="c-btn c-btn-secondary c-btn-sm"
                  disabled={!data || data.previous.count === 0 || busy !== null}
                  onClick={copyFromPrevious}
                  title={data && data.previous.count === 0 ? t(`${data.previous.period} has no budget to copy`, `${data.previous.period} chưa có ngân sách để chép`) : undefined}
                >
                  <Copy size={14} /> {t("Copy from last month", "Chép từ tháng trước")}
                </button>
                <button
                  type="button"
                  className="c-btn c-btn-primary c-btn-sm"
                  disabled={dirtyRows.length === 0 || busy !== null}
                  onClick={() => save(dirtyRows)}
                >
                  {dirtyRows.length > 0 ? t(`Save all (${dirtyRows.length})`, `Lưu tất cả (${dirtyRows.length})`) : t("Save all", "Lưu tất cả")}
                </button>
              </>
            }
          />

          {notice && (
            <p className="c-pace-cap" role="status" style={{ color: notice.tone === "err" ? "var(--bad-t)" : undefined, marginBottom: 12 }}>
              {notice.text}
            </p>
          )}

          {!data && !monthFailed && <p className="c-pace-cap" style={{ margin: "24px 0" }}>{t("Loading…", "Đang tải…")}</p>}
          {monthFailed && (
            <p className="c-pace-cap" style={{ margin: "24px 0", color: "var(--bad-t)" }}>
              {t("Could not load the budget. Try again in a moment.", "Chưa đọc được ngân sách. Thử lại sau ít phút.")}
            </p>
          )}

          {data && tot && (
            <>
              <div className="c-mini" style={{ marginTop: 0, marginBottom: 8 }}>
                <div>
                  <div className="l">{income ? t("Target", "Mục tiêu") : t("Budget", "Ngân sách")}</div>
                  <div className="v num">{tot.budget.toLocaleString(vi ? "vi-VN" : "en-US")}<small>₫</small></div>
                </div>
                <div>
                  <div className="l">{income ? t("Received", "Đã thu") : t("Spent", "Đã chi")}</div>
                  <div className="v num">{tot.actual.toLocaleString(vi ? "vi-VN" : "en-US")}<small>₫</small></div>
                </div>
                <div>
                  <div className="l">{income ? t("Still to go", "Còn thiếu") : t("Left", "Còn lại")}</div>
                  <div className="v num">
                    {hasBudget ? <>{tot.remaining < 0 ? "−" : ""}{Math.abs(tot.remaining).toLocaleString(vi ? "vi-VN" : "en-US")}<small>₫</small></> : <span style={{ color: "var(--muted)", fontSize: 16, fontWeight: 400 }}>{t("Not set", "Chưa đặt")}</span>}
                  </div>
                </div>
              </div>
              {tot.unbudgetedActual !== 0 && (
                <p className="c-pace-cap" style={{ marginTop: 0, marginBottom: 8 }}>
                  {income
                    ? t(`${formatVND(tot.unbudgetedActual)} came from groups with no target.`, `${formatVND(tot.unbudgetedActual)} thu từ các nhóm chưa đặt mục tiêu.`)
                    : t(`${formatVND(tot.unbudgetedActual)} was spent in groups with no budget.`, `${formatVND(tot.unbudgetedActual)} chi ở các nhóm chưa đặt ngân sách.`)}
                </p>
              )}

              {rows.length === 0 ? (
                <div className="c-empty-box" style={{ padding: "16px 0" }}>
                  <div className="eh">{t("No groups to budget yet", "Chưa có nhóm nào để đặt ngân sách")}</div>
                  <div className="ed">{t("Create groups in Settings › Finance, then set their amounts here.", "Tạo nhóm ở Cài đặt › Tài chính, rồi đặt số tiền ở đây.")}</div>
                </div>
              ) : (
                <div className="mt-2">
                  {rows.map((r) => {
                    const dk = dkey(r.group);
                    const draft = drafts[dk];
                    const dirty = dirtyRows.includes(r);
                    const st = statusOf(r);
                    const Icon = groupIcon(r.group);
                    const frac = r.budget > 0 ? r.actual / r.budget : r.actual > 0 ? 1 : 0;
                    return (
                      <div
                        key={r.group}
                        className="grid items-center gap-x-3 gap-y-2 py-3 border-b border-[var(--line)] first:pt-0 grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,260px)]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <GlassIcon icon={Icon} tone="spend" />
                          <div className="min-w-0">
                            <div className="c-bud-nm truncate">{catLabel(r.group)}{r.inactive ? ` · ${t("hidden", "đã ẩn")}` : ""}</div>
                            <div className="c-bud-am">
                              {r.budget > 0
                                ? `${r.actual.toLocaleString(vi ? "vi-VN" : "en-US")} / ${r.budget.toLocaleString(vi ? "vi-VN" : "en-US")} ₫`
                                : r.actual > 0
                                  ? income
                                    ? t(`Received ${r.actual.toLocaleString("en-US")} ₫ · no target set`, `Đã thu ${r.actual.toLocaleString("vi-VN")} ₫ · chưa đặt mục tiêu`)
                                    : t(`Spent ${r.actual.toLocaleString("en-US")} ₫ · no budget set`, `Đã chi ${r.actual.toLocaleString("vi-VN")} ₫ · chưa đặt ngân sách`)
                                  : t("Not set", "Chưa đặt")}
                            </div>
                          </div>
                        </div>
                        {r.budget > 0 ? (
                          <div className="c-rg">
                            <ProgressRing
                              fraction={frac}
                              pace={pace}
                              tone={RING_TONE[r.level]}
                              ariaLabel={t(`${catLabel(r.group)}: ${r.pct ?? 0}% of ${income ? "target" : "budget"}`, `${catLabel(r.group)}: ${r.pct ?? 0}% ${income ? "mục tiêu" : "ngân sách"}`)}
                            />
                            <div>
                              <span className="pc">{r.pct === null ? "—" : `${r.pct}%`}</span>
                              <span className={`st ${st.cls}`}><i />{st.text}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="hidden md:block" aria-hidden />
                        )}
                        <div className="col-span-2 md:col-span-1 flex items-center gap-2">
                          <AmountInput
                            className="c-input w-full text-right num"
                            aria-label={t(`${income ? "Target" : "Budget"} for ${catLabel(r.group)}, month ${mNo}`, `${income ? "Mục tiêu" : "Ngân sách"} ${catLabel(r.group)}, tháng ${mNo}`)}
                            placeholder={t("Amount", "Số tiền")}
                            value={draft ?? (r.budget > 0 || !r.unbudgeted ? String(r.budget) : "")}
                            onValueChange={(raw) => setDrafts((p) => ({ ...p, [dk]: raw }))}
                            onKeyDown={(e) => { if (e.key === "Enter" && dirty) save([r]); }}
                          />
                          <button
                            type="button"
                            className="c-btn c-btn-secondary c-btn-sm flex-none"
                            disabled={!dirty || busy !== null}
                            onClick={() => save([r])}
                          >
                            {t("Save", "Lưu")}
                          </button>
                          <button
                            type="button"
                            className="c-btn c-btn-tertiary c-btn-icon c-btn-sm flex-none"
                            disabled={!r.id || busy !== null}
                            onClick={() => remove(r)}
                            aria-label={t(`Delete this month's budget of ${catLabel(r.group)}`, `Xoá ngân sách tháng này của ${catLabel(r.group)}`)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <p className="c-pace-cap" style={{ marginTop: 12 }}>
                    {pace !== null && t(`The black tick on each ring is today's pace (day ${new Date().getDate()}/${dim}). `, `Vạch đen trên vòng là nhịp hôm nay (ngày ${new Date().getDate()}/${dim}). `)}
                    {income
                      ? t("Revenue = Income entries only; refunds are not counted as revenue.", "Doanh thu = các khoản Thu nhập; tiền hoàn không tính vào doanh thu.")
                      : t("Spent = expenses minus refunds, plus loan principal paid for the debt group.", "Đã chi = chi tiêu trừ tiền hoàn, cộng phần trả gốc nợ ở nhóm nợ.")}
                  </p>
                </div>
              )}
            </>
          )}
        </GlassCard>

        {/* ---- Đánh giá năm ---- */}
        <GlassCard className="c-s12">
          <CardHead
            icon={Target}
            tone="spend"
            title={yearTitle(yearData, t, income, year)}
            subtitle={income
              ? t("Share of each month's target reached, per group", "Phần mục tiêu đạt được của từng tháng, theo nhóm")
              : t("Share of each month's budget used, per group", "Phần ngân sách đã dùng của từng tháng, theo nhóm")}
            wrap
            actions={
              <div className="flex items-center gap-1">
                <button type="button" className="c-btn c-btn-secondary c-btn-icon c-btn-sm" onClick={() => setYear((y) => y - 1)} aria-label={t("Previous year", "Năm trước")}>
                  <ChevronLeft size={16} />
                </button>
                <span className="num px-3 font-medium" aria-live="polite">{year}</span>
                <button type="button" className="c-btn c-btn-secondary c-btn-icon c-btn-sm" onClick={() => setYear((y) => y + 1)} aria-label={t("Next year", "Năm sau")}>
                  <ChevronRight size={16} />
                </button>
              </div>
            }
          />
          {!yearData && !yearFailed && <p className="c-pace-cap" style={{ margin: "24px 0" }}>{t("Loading…", "Đang tải…")}</p>}
          {yearFailed && (
            <p className="c-pace-cap" style={{ margin: "24px 0", color: "var(--bad-t)" }}>
              {t("Could not load the year review.", "Chưa đọc được đánh giá năm.")}
            </p>
          )}
          {yearData && <YearGrid data={yearData} income={income} catLabel={catLabel} />}
        </GlassCard>
      </div>
    </div>
  );

  function yearTitle(d: YearData | null, tr: (en: string, vi: string) => string, inc: boolean, y: number) {
    if (!d || d.evaluation.monthsWithBudget === 0) {
      return inc ? tr(`No income targets for ${y}`, `Năm ${y} chưa có mục tiêu thu`) : tr(`No budget for ${y}`, `Năm ${y} chưa có ngân sách`);
    }
    const e = d.evaluation;
    if (e.monthsEvaluated === 0) return tr(`${y} has not started yet`, `Năm ${y} chưa bắt đầu`);
    return inc
      ? tr(`${y}: target met in ${e.monthsHit} of ${e.monthsEvaluated} months`, `Năm ${y}: đạt mục tiêu ${e.monthsHit}/${e.monthsEvaluated} tháng`)
      : tr(`${y}: over budget in ${e.monthsOver} of ${e.monthsEvaluated} months`, `Năm ${y}: vượt ngân sách ${e.monthsOver}/${e.monthsEvaluated} tháng`);
  }
}

/** Lưới 12 tháng × nhóm. Cuộn ngang ở khổ hẹp, cột tên nhóm dính bên trái. */
function YearGrid({ data, income, catLabel }: { data: YearData; income: boolean; catLabel: (n: string) => string }) {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const e = data.evaluation;
  if (e.groups.length === 0) {
    return (
      <div className="c-empty-box" style={{ padding: "16px 0" }}>
        <div className="eh">{t("Nothing to review yet", "Chưa có gì để đánh giá")}</div>
        <div className="ed">{t("Set a budget for some months and the grid fills in as you spend.", "Đặt ngân sách cho vài tháng, lưới sẽ đầy dần theo phần đã chi.")}</div>
      </div>
    );
  }

  const monthName = (i: number) => (vi ? `T${i + 1}` : MONTHS_EN[i]);
  const cellText = (c: Cell): string => {
    if (c.future) return "·";
    if (c.budget === 0) return c.actual !== 0 ? shortMoney(c.actual, vi) : "·";
    const p = c.pct ?? 0;
    return !income && c.level === "over" ? `▲${p}` : `${p}`;
  };
  const cellTitle = (name: string, c: Cell): string => {
    if (c.future) return `${name} · ${monthName(Number(c.month.slice(5, 7)) - 1)}: ${t("not yet", "chưa tới")}`;
    return `${name} · ${monthName(Number(c.month.slice(5, 7)) - 1)}: ${formatVND(c.actual)} / ${c.budget > 0 ? formatVND(c.budget) : t("no budget", "chưa đặt")}`;
  };
  const cellCls = "num text-center text-[13px] leading-none py-2.5 px-1 min-w-[48px] border-l border-[var(--line)]";

  return (
    <>
      <div className="c-mini" style={{ marginTop: 0, marginBottom: 16 }}>
        <div>
          <div className="l">{income ? t("Year target", "Mục tiêu cả năm") : t("Year budget", "Ngân sách cả năm")}</div>
          <div className="v num">{dec(e.totalBudget / 1e6, vi, 1)}<small>{t("m ₫", "tr ₫")}</small></div>
        </div>
        <div>
          <div className="l">{income ? t("Received so far", "Đã thu tới nay") : t("Spent so far", "Đã chi tới nay")}</div>
          <div className="v num">{dec(e.totalActual / 1e6, vi, 1)}<small>{t("m ₫", "tr ₫")}</small></div>
        </div>
        <div>
          <div className="l">{income ? t("Months on target", "Tháng đạt mục tiêu") : t("Months over", "Tháng vượt")}</div>
          <div className="v num">
            {income ? e.monthsHit : e.monthsOver}<small>/ {e.monthsEvaluated}</small>
          </div>
        </div>
        <div>
          <div className="l">{t("Used to date", "Đã dùng tới nay")}</div>
          <div className="v num">{e.pctToDate === null ? "—" : `${e.pctToDate}%`}</div>
        </div>
      </div>

      <div className="overflow-x-auto" role="region" aria-label={t("Year review grid", "Lưới đánh giá năm")} tabIndex={0}>
        <table className="border-collapse w-full" style={{ minWidth: 12 * 52 + 150 + 64 }}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] bg-[var(--glass-solid)] text-left text-[13px] font-medium text-[var(--muted)] py-2 pr-3 min-w-[130px]">
                {t("Group", "Nhóm")}
              </th>
              {Array.from({ length: 12 }, (_, i) => (
                <th key={i} scope="col" className="text-center text-[13px] font-medium text-[var(--muted)] py-2 px-1 min-w-[48px]">
                  {monthName(i)}
                </th>
              ))}
              <th scope="col" className="text-center text-[13px] font-medium text-[var(--muted)] py-2 px-2 min-w-[64px]">{t("Year", "Năm")}</th>
            </tr>
          </thead>
          <tbody>
            {e.groups.map((g) => (
              <tr key={g.group} className="border-t border-[var(--line)]">
                <th scope="row" className="sticky left-0 z-[1] bg-[var(--glass-solid)] text-left text-[13px] font-medium py-2 pr-3 max-w-[150px] truncate">
                  {catLabel(g.group)}
                </th>
                {g.cells.map((c) => (
                  <td key={c.month} className={cellCls} style={{ background: CELL_BG[c.level] }} title={cellTitle(catLabel(g.group), c)}>
                    {cellText(c)}
                  </td>
                ))}
                <td className={`${cellCls} font-medium`} style={{ background: CELL_BG[g.level] }} title={`${formatVND(g.totalActual)} / ${formatVND(g.totalBudget)}`}>
                  {g.pct === null ? "·" : `${!income && g.level === "over" ? "▲" : ""}${g.pct}`}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--line)]">
              <th scope="row" className="sticky left-0 z-[1] bg-[var(--glass-solid)] text-left text-[13px] font-medium py-2 pr-3">{t("Total", "Tổng")}</th>
              {e.months.map((c) => (
                <td key={c.month} className={`${cellCls} font-medium`} style={{ background: CELL_BG[c.level] }} title={cellTitle(t("Total", "Tổng"), c)}>
                  {c.future || c.budget === 0 ? "·" : `${!income && c.level === "over" ? "▲" : ""}${c.pct}`}
                </td>
              ))}
              <td className={`${cellCls} font-medium`} style={{ background: CELL_BG[e.level] }} title={`${formatVND(e.totalActual)} / ${formatVND(e.totalBudget)}`}>
                {e.pctToDate === null ? "·" : `${!income && e.level === "over" ? "▲" : ""}${e.pctToDate}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-[13px] text-[var(--muted)]">
        {(income
          ? ([["ok", t("Below target", "Chưa đạt")], ["hit", t("Target met", "Đạt mục tiêu")]] as [Level, string][])
          : ([["ok", t("On track (under 85%)", "Trong nhịp (dưới 85%)")], ["near", t("Near the limit (85–100%)", "Sắp chạm (85–100%)")], ["over", t("▲ Over (above 100%)", "▲ Vượt (trên 100%)")]] as [Level, string][])
        ).map(([lv, text]) => (
          <span key={lv} className="inline-flex items-center gap-2">
            <i className="inline-block w-4 h-4 rounded-[4px] border border-[var(--line)]" style={{ background: CELL_BG[lv] }} aria-hidden />
            {text}
          </span>
        ))}
        <span>{t("· = no budget or month not reached", "· = chưa đặt ngân sách hoặc chưa tới tháng")}</span>
      </div>
    </>
  );
}
