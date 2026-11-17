"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { dec, shortMoney, wordMoney } from "@/lib/vizMoney";
import { CardHead, GlassCard } from "@/components/charts/GlassCard";
import AreaLine from "@/components/charts/AreaLine";

/**
 * Thẻ nhỏ "Tài sản ròng 12 tháng" của Tổng quan Tài chính. Đọc
 * `api/finance/networth` — mỗi lần gọi, API chụp lại tháng đang chạy.
 *
 * Số các tháng quá khứ do nút "Dựng lại từ dữ liệu" tạo ra và là ƯỚC TÍNH
 * (cách tính và giới hạn: `src/lib/netWorth.ts`); thẻ nói điều đó ngay dưới
 * biểu đồ. Chưa có bản chụp nào thì hiện trạng thái rỗng, không vẽ số bịa.
 */
interface Snap {
  month: string;
  assets: number;
  debts: number;
  cash: number;
  netWorth: number;
  source: string;
}

export default function NetWorthCard({ className = "", refreshKey = 0 }: { className?: string; refreshKey?: number }) {
  const { t, language } = useLanguage();
  const vi = language === "vi";
  const [version, setVersion] = useState(0);
  const key = `${refreshKey}|${version}`;
  const [res, setRes] = useState<Record<string, Snap[] | "err">>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    fetch("/api/finance/networth?months=12", { signal: c.signal })
      .then((r) => r.json())
      .then((j) => setRes((p) => ({ ...p, [key]: j?.success ? (j.data.snapshots as Snap[]) : "err" })))
      .catch(() => { if (!c.signal.aborted) setRes((p) => ({ ...p, [key]: "err" })); });
    return () => c.abort();
  }, [key]);

  const cur = res[key];
  const snaps = cur && cur !== "err" ? cur : null;
  const failed = cur === "err";

  async function rebuild() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/finance/networth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || "Error");
      const n = (j.data.created ?? 0) + (j.data.updated ?? 0);
      setMsg(t(`Rebuilt ${n} month(s) from your data`, `Đã dựng lại ${n} tháng từ dữ liệu của bạn`));
      setVersion((v) => v + 1);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("Could not rebuild", "Chưa dựng lại được"));
    } finally {
      setBusy(false);
    }
  }

  const label = (m: string) => (vi ? `T${Number(m.slice(5, 7))}` : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m.slice(5, 7)) - 1]);

  const last = snaps && snaps.length > 0 ? snaps[snaps.length - 1] : null;
  const first = snaps && snaps.length > 1 ? snaps[0] : null;
  const delta = last && first ? last.netWorth - first.netWorth : null;
  const lastMonthNo = last ? Number(last.month.slice(5, 7)) : 0;

  const title = !last
    ? t("Net worth, last 12 months", "Tài sản ròng 12 tháng")
    : t(`Net worth ${wordMoney(last.netWorth, false)} at the end of month ${lastMonthNo}`, `Tài sản ròng ${wordMoney(last.netWorth, true)} tới tháng ${lastMonthNo}`);
  const subtitle = last
    ? delta === null
      ? t("Only one month saved so far", "Mới lưu được một tháng")
      : t(
          `${delta >= 0 ? "Up" : "Down"} ${wordMoney(Math.abs(delta), false)} since ${label(first!.month)}`,
          `${delta >= 0 ? "Tăng" : "Giảm"} ${wordMoney(Math.abs(delta), true)} so với ${label(first!.month)}`
        )
    : t("Assets minus debts, month by month", "Tài sản trừ nợ, từng tháng");

  const rebuildBtn = (primary: boolean) => (
    <button type="button" className={`c-btn ${primary ? "c-btn-primary" : "c-btn-secondary c-btn-sm"}`} onClick={rebuild} disabled={busy}>
      {busy ? t("Rebuilding…", "Đang dựng lại…") : t("Rebuild from data", "Dựng lại từ dữ liệu")}
    </button>
  );

  return (
    <GlassCard className={className}>
      <CardHead icon={Scale} tone="fin" title={title} subtitle={subtitle} wrap actions={last ? rebuildBtn(false) : undefined} />

      {failed && (
        <p className="c-pace-cap" style={{ margin: "16px 0", color: "var(--bad-t)" }}>
          {t("Could not load net worth. Try again in a moment.", "Chưa đọc được tài sản ròng. Thử lại sau ít phút.")}
        </p>
      )}
      {!snaps && !failed && <p className="c-pace-cap" style={{ margin: "16px 0" }}>{t("Loading…", "Đang tải…")}</p>}

      {snaps && snaps.length === 0 && (
        <div className="c-empty-box" style={{ padding: "16px 0" }}>
          <div className="eh">{t("No net worth saved yet", "Chưa có bản chụp tài sản ròng nào")}</div>
          <div className="ed">
            {t(
              "Each month's total assets, debts and cash are saved as one row. Past months can be rebuilt from your transactions, asset values and loan schedules.",
              "Mỗi tháng lưu một dòng: tổng tài sản, nợ và tiền. Các tháng đã qua dựng lại được từ giao dịch, giá trị tài sản và lịch trả nợ."
            )}
          </div>
          {rebuildBtn(true)}
        </div>
      )}

      {last && snaps && (
        <>
          <div className="c-mini">
            <div>
              <div className="l">{t("Assets", "Tài sản")}</div>
              <div className="v num">{dec(last.assets / 1e6, vi, 1)}<small>{t("m ₫", "tr ₫")}</small></div>
            </div>
            <div>
              <div className="l">{t("Debts", "Nợ")}</div>
              <div className="v num">{dec(last.debts / 1e6, vi, 1)}<small>{t("m ₫", "tr ₫")}</small></div>
            </div>
            <div>
              <div className="l">{t("Cash in accounts", "Tiền ở tài khoản")}</div>
              <div className="v num">{dec(last.cash / 1e6, vi, 1)}<small>{t("m ₫", "tr ₫")}</small></div>
            </div>
          </div>
          {snaps.length > 1 ? (
            <AreaLine
              points={snaps.map((s) => ({ x: label(s.month), v: s.netWorth }))}
              endLabel={shortMoney(last.netWorth, vi)}
              endSub={`${label(last.month)}`}
              ariaLabel={
                t("Net worth per month: ", "Tài sản ròng từng tháng: ") +
                snaps.map((s) => `${label(s.month)} ${wordMoney(s.netWorth, vi)}`).join(", ")
              }
            />
          ) : (
            <p className="c-pace-cap" style={{ marginTop: 16 }}>
              {t("Rebuild from data to fill in the months before this one.", "Bấm Dựng lại từ dữ liệu để có các tháng trước đó.")}
            </p>
          )}
          <p className="c-pace-cap" style={{ marginTop: 12 }}>
            {t(
              "Past months are estimates rebuilt from transactions, asset values and loan schedules. Cash counts only accounts you added, and only transactions linked to them.",
              "Các tháng đã qua là ước tính dựng lại từ giao dịch, giá trị tài sản và lịch trả nợ. Tiền chỉ tính ở tài khoản bạn đã thêm, và chỉ các giao dịch đã gắn tài khoản đó."
            )}
          </p>
        </>
      )}
      {msg && <p className="c-pace-cap" role="status" style={{ marginTop: 8 }}>{msg}</p>}
    </GlassCard>
  );
}
