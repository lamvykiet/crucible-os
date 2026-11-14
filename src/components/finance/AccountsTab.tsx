"use client";

import { useEffect, useState } from "react";
import {
  Plus, Wallet, CreditCard, Landmark, Banknote, AlertCircle, Pencil, Archive,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND } from "@/lib/formatMoney";
import { VIZ } from "@/lib/viz";
import { todayLocalIso } from "@/lib/localDate";
import AccountModal, { emptyAccount, type AccountDraft } from "./AccountModal";
import MetricCard from "@/components/charts/MetricCard";
import SectionHeader from "@/components/charts/SectionHeader";

// Báo cáo số dư từng tài khoản tính tới HÔM NAY.
//
// App không nối với ngân hàng, nên số dư ở đây là: số dư đầu kỳ người dùng nhập
// cộng dồn các giao dịch đã gắn vào tài khoản đó. Hệ quả phải nói thẳng ra:
// giao dịch nào chưa gắn tài khoản thì số dư này còn lệch với số dư thật —
// thanh cảnh báo trên cùng làm việc đó.

interface AccountBalance {
  id: string;
  name: string;
  kind: string;
  bank: string | null;
  last4: string | null;
  status: string;
  notes: string | null;
  openingBalance: number;
  openingDate: string | null;
  balance: number;
  creditLimit: number | null;
  available: number | null;
  utilization: number | null;
  statementDay: number | null;
  dueDay: number | null;
  txCount: number;
  lastTxDate: string | null;
}

interface Totals {
  cash: number;
  cardDebt: number;
  net: number;
  creditLimit: number;
  creditAvailable: number;
}

const KIND_ICON: Record<string, typeof Wallet> = {
  bank: Landmark,
  credit_card: CreditCard,
  ewallet: Wallet,
  cash: Banknote,
};

export default function AccountsTab() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [unlinked, setUnlinked] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalDraft, setModalDraft] = useState<AccountDraft | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const res = await fetch("/api/finance/accounts", { signal: controller.signal });
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setAccounts(json.data.accounts);
          setTotals(json.data.totals);
          setUnlinked(json.data.unlinked || 0);
          setErrorText("");
        } else {
          setErrorText(json.error || "load");
        }
      } catch (e) {
        if (!ignore && (e as Error).name !== "AbortError") setErrorText("load");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [refreshKey]);

  const openNew = () => setModalDraft({ ...emptyAccount(), id: undefined });
  const openEdit = (a: AccountBalance) =>
    setModalDraft({
      id: a.id,
      name: a.name,
      kind: a.kind,
      bank: a.bank || "",
      last4: a.last4 || "",
      openingBalance: a.openingBalance,
      openingDate: a.openingDate || "",
      creditLimit: a.creditLimit,
      statementDay: a.statementDay,
      dueDay: a.dueDay,
      notes: a.notes || "",
    });

  const closeAccount = async (a: AccountBalance) => {
    if (
      !confirm(
        t(
          `Close "${a.name}"? Its history stays, but it leaves the balance report.`,
          `Đóng "${a.name}"? Lịch sử vẫn giữ nguyên, chỉ không còn tính vào báo cáo số dư.`
        )
      )
    )
      return;
    await fetch(`/api/finance/accounts?id=${a.id}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
  };

  const open = accounts.filter((a) => a.status !== "closed");
  const closed = accounts.filter((a) => a.status === "closed");
  const cards = open.filter((a) => a.kind === "credit_card");
  const others = open.filter((a) => a.kind !== "credit_card");

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="c-h2 c-page-title text-[var(--color-text)]">
            {t("Accounts", "Tài khoản")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("Balances as of", "Số dư tính tới")} {todayLocalIso()}
          </p>
        </div>
        <button
          onClick={openNew}
          aria-label={t("Add account", "Thêm tài khoản")}
          title={t("Add account", "Thêm tài khoản")}
          className="c-btn c-btn-primary w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
        >
          <Plus size={16} />
          <span className="hidden md:inline">{t("Add account", "Thêm tài khoản")}</span>
        </button>
      </div>

      {errorText && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] rounded-xl p-4">
          {t("Could not load accounts.", "Không tải được danh sách tài khoản.")}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
      ) : errorText ? null : accounts.length === 0 ? ( // Tải hỏng thì KHÔNG nói "chưa có tài khoản nào":
        // đó là một khẳng định mà lúc này không ai biết đúng hay sai.
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 md:p-8 flex flex-col items-center gap-2 text-center">
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("No accounts yet", "Chưa có tài khoản nào")}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-xl">
            {t(
              "Add each bank account, card and wallet, enter the balance you see in the bank app today, and every transaction you record afterwards keeps it up to date.",
              "Thêm từng tài khoản ngân hàng, thẻ và ví, nhập số dư đang thấy trong app ngân hàng hôm nay — từ đó mỗi giao dịch bạn ghi sẽ tự cập nhật số dư."
            )}
          </p>
          <button onClick={openNew} className="mt-3 c-btn c-btn-primary">
            <Plus size={16} /> {t("Add account", "Thêm tài khoản")}
          </button>
        </div>
      ) : (
        <>
          {/* Số dư ở đây chỉ đúng với phần đã gắn tài khoản. Nói ra, đừng để
              người dùng tự phát hiện bằng cách đối chiếu với app ngân hàng. */}
          {unlinked > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--color-warning-tint)] p-4">
              <AlertCircle size={18} className="flex-none text-[var(--color-warning)]" aria-hidden />
              <p className="min-w-0 flex-1 basis-56 text-sm text-[var(--color-text)]">
                {t(
                  `${unlinked} transactions are not linked to any account yet, so they are not counted in the balances below.`,
                  `Còn ${unlinked} giao dịch chưa gắn tài khoản nên chưa được tính vào số dư bên dưới.`
                )}
              </p>
            </div>
          )}

          {totals && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Số MỨC màu mực. Chỉ "Thực có" âm mới là tin xấu tự thân. */}
              <MetricCard
                size="sm"
                icon={<Landmark size={16} />}
                label={t("Cash and bank", "Tiền mặt & ngân hàng")}
                value={formatVND(totals.cash)}
              />
              <MetricCard
                size="sm"
                icon={<CreditCard size={16} />}
                label={t("Card debt", "Dư nợ thẻ")}
                value={formatVND(totals.cardDebt)}
              />
              <MetricCard
                size="sm"
                icon={<Wallet size={16} />}
                label={t("Actually yours", "Thực có")}
                value={formatVND(totals.net)}
                tone={totals.net < 0 ? "bad" : "neutral"}
                note={t("cash − card debt", "tiền có − dư nợ thẻ")}
              />
              <MetricCard
                size="sm"
                icon={<Banknote size={16} />}
                label={t("Credit still available", "Hạn mức còn lại")}
                value={formatVND(totals.creditAvailable)}
                note={`${t("of", "trên")} ${formatVND(totals.creditLimit)}`}
              />
            </div>
          )}

          {others.length > 0 && (
            <div className="flex flex-col gap-5">
              <SectionHeader
                icon={<Landmark size={20} />}
                title={t("Bank, wallet and cash", "Ngân hàng, ví và tiền mặt")}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {others.map((a) => {
                  const Icon = KIND_ICON[a.kind] || Wallet;
                  return (
                    <div
                      key={a.id}
                      className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] flex flex-col min-w-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center flex-none">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--color-text)] truncate" title={a.name}>{a.name}</p>
                            <p className="text-xs text-[var(--color-text-faint)] truncate">
                              {[a.bank, a.last4 && `•••• ${a.last4}`].filter(Boolean).join(" · ") ||
                                t("no bank set", "chưa ghi ngân hàng")}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-none -mr-2 -mt-2">
                          <button
                            onClick={() => openEdit(a)}
                            aria-label={t("Edit", "Sửa")}
                            className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => closeAccount(a)}
                            aria-label={t("Close account", "Đóng tài khoản")}
                            title={t("Close account", "Đóng tài khoản")}
                            className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                          >
                            <Archive size={15} />
                          </button>
                        </div>
                      </div>

                      <div
                        className={`mt-4 c-metric-value-sm whitespace-nowrap ${
                          a.balance < 0 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"
                        }`}
                      >
                        {formatVND(a.balance)}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {a.txCount > 0
                          ? t(
                              `${a.txCount} transactions · last ${a.lastTxDate}`,
                              `${a.txCount} giao dịch · gần nhất ${a.lastTxDate}`
                            )
                          : a.openingDate
                            ? t(
                                `opening balance as of ${a.openingDate}, nothing recorded since`,
                                `số dư đầu kỳ ngày ${a.openingDate}, chưa ghi giao dịch nào sau đó`
                              )
                            : t("no transactions recorded yet", "chưa ghi giao dịch nào")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {cards.length > 0 && (
            <div className="flex flex-col gap-5">
              <SectionHeader icon={<CreditCard size={20} />} title={t("Credit cards", "Thẻ tín dụng")} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {cards.map((a) => (
                  <div
                    key={a.id}
                    className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] flex flex-col min-w-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center flex-none">
                          <CreditCard size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--color-text)] truncate" title={a.name}>{a.name}</p>
                          <p className="text-xs text-[var(--color-text-faint)] truncate">
                            {[a.bank, a.last4 && `•••• ${a.last4}`].filter(Boolean).join(" · ") ||
                              t("no bank set", "chưa ghi ngân hàng")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-none -mr-2 -mt-2">
                        <button
                          onClick={() => openEdit(a)}
                          aria-label={t("Edit", "Sửa")}
                          className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => closeAccount(a)}
                          aria-label={t("Close account", "Đóng tài khoản")}
                            title={t("Close account", "Đóng tài khoản")}
                          className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                      <div>
                        <p className="c-overline text-[var(--color-text-muted)]">
                          {t("Owed", "Dư nợ")}
                        </p>
                        <p className="mt-1 c-metric-value-sm whitespace-nowrap text-[var(--color-text)]">
                          {formatVND(a.balance)}
                        </p>
                      </div>
                      {a.available !== null && (
                        <div className="text-right">
                          <p className="c-overline text-[var(--color-text-muted)]">
                            {t("Available", "Khả dụng")}
                          </p>
                          <p className="mt-1 text-base font-semibold tabular-nums whitespace-nowrap text-[var(--color-text-muted)]">
                            {formatVND(a.available)}
                          </p>
                        </div>
                      )}
                    </div>

                    {a.creditLimit ? (
                      <>
                        {/* Trên 30% hạn mức là mốc các bên chấm điểm tín dụng
                            bắt đầu để ý, nên đổi màu ở đó chứ không đợi chạm
                            trần. Dưới mốc thì thanh xám — "bình thường" không
                            cần màu. Trên mốc mới mang màu trạng thái, và luôn
                            có chữ nói ra (màu không đứng một mình). Vạch mảnh
                            đánh dấu chính mốc 30%. */}
                        <div className="relative mt-3">
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: VIZ.ghost }} aria-hidden>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, a.utilization || 0))}%`,
                                minWidth: (a.utilization || 0) > 0 ? 4 : 0,
                                background:
                                  (a.utilization || 0) > 80 ? VIZ.bad : (a.utilization || 0) > 30 ? "var(--color-warning)" : VIZ.muted,
                              }}
                            />
                          </div>
                          <div
                            className="absolute -top-1 -bottom-1 w-0.5 rounded-full"
                            style={{ left: "calc(30% - 1px)", background: VIZ.ink }}
                            aria-hidden
                          />
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                          {t("used", "đã dùng")} {a.utilization}% {t("of", "trên")}{" "}
                          {formatVND(a.creditLimit)}
                          {(a.utilization || 0) > 80 ? (
                            <strong className="text-[var(--color-error)]"> · {t("very high", "rất cao")}</strong>
                          ) : (a.utilization || 0) > 30 ? (
                            <strong className="text-[var(--color-warning)]"> · {t("above the 30% mark", "vượt mốc 30%")}</strong>
                          ) : (
                            <span className="text-[var(--color-text-faint)]"> · {t("under the 30% mark", "dưới mốc 30%")}</span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--color-text-faint)] mt-3">
                        {t("no credit limit set", "chưa đặt hạn mức")}
                      </p>
                    )}

                    {(a.statementDay || a.dueDay) && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-2">
                        {a.statementDay &&
                          t(`statement on day ${a.statementDay}`, `chốt sao kê ngày ${a.statementDay}`)}
                        {a.statementDay && a.dueDay ? " · " : ""}
                        {a.dueDay && t(`due on day ${a.dueDay}`, `đến hạn ngày ${a.dueDay}`)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {closed.length > 0 && (
            <div className="flex flex-col gap-5">
              <SectionHeader icon={<Archive size={20} />} title={t("Closed", "Đã đóng")} />
              <ul className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-text-muted)] divide-y divide-[var(--color-border)]">
                {closed.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="truncate">{a.name}</span>
                    <span className="tabular-nums flex-none">{formatVND(a.balance)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {modalDraft && (
        <AccountModal
          isOpen
          draft={modalDraft}
          onClose={() => setModalDraft(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
