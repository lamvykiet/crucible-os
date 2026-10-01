"use client";

import { useEffect, useState } from "react";
import {
  Plus, Wallet, CreditCard, Landmark, Banknote, AlertCircle, Pencil, Archive,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { formatVND } from "@/lib/formatMoney";
import { todayLocalIso } from "@/lib/localDate";
import AccountModal, { emptyAccount, type AccountDraft } from "./AccountModal";

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
          className="c-btn c-btn-primary c-btn-pill shadow-sm w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
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
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 text-center">
          <p className="text-[var(--color-text)] font-bold">
            {t("No accounts yet", "Chưa có tài khoản nào")}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {t(
              "Add each bank account, card and wallet, enter the balance you see in the bank app today, and every transaction you record afterwards keeps it up to date.",
              "Thêm từng tài khoản ngân hàng, thẻ và ví, nhập số dư đang thấy trong app ngân hàng hôm nay — từ đó mỗi giao dịch bạn ghi sẽ tự cập nhật số dư."
            )}
          </p>
          <button onClick={openNew} className="mt-5 c-btn c-btn-primary c-btn-pill">
            <Plus size={16} /> {t("Add account", "Thêm tài khoản")}
          </button>
        </div>
      ) : (
        <>
          {/* Số dư ở đây chỉ đúng với phần đã gắn tài khoản. Nói ra, đừng để
              người dùng tự phát hiện bằng cách đối chiếu với app ngân hàng. */}
          {unlinked > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning-tint)] p-4">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
              <p className="text-sm text-[var(--color-text)]">
                {t(
                  `${unlinked} transactions are not linked to any account yet, so they are not counted in the balances below.`,
                  `Còn ${unlinked} giao dịch chưa gắn tài khoản nên chưa được tính vào số dư bên dưới.`
                )}
              </p>
            </div>
          )}

          {totals && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  {t("Cash and bank", "Tiền mặt & ngân hàng")}
                </div>
                <div className="text-2xl font-bold text-[var(--color-success)]">
                  {formatVND(totals.cash)}
                </div>
              </div>

              <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  {t("Card debt", "Dư nợ thẻ")}
                </div>
                <div className="text-2xl font-bold text-[var(--color-error)]">
                  {formatVND(totals.cardDebt)}
                </div>
              </div>

              <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  {t("Actually yours", "Thực có")}
                </div>
                <div
                  className={`text-2xl font-bold ${
                    totals.net < 0 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"
                  }`}
                >
                  {formatVND(totals.net)}
                </div>
                <div className="text-xs text-[var(--color-text-faint)] mt-1">
                  {t("cash − card debt", "tiền có − dư nợ thẻ")}
                </div>
              </div>

              <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm">
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  {t("Credit still available", "Hạn mức còn lại")}
                </div>
                <div className="text-2xl font-bold text-[var(--color-text)]">
                  {formatVND(totals.creditAvailable)}
                </div>
                <div className="text-xs text-[var(--color-text-faint)] mt-1">
                  {t("of", "trên")} {formatVND(totals.creditLimit)}
                </div>
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h3 className="c-h5 text-[var(--color-text)] mb-4">
                {t("Bank, wallet and cash", "Ngân hàng, ví và tiền mặt")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {others.map((a) => {
                  const Icon = KIND_ICON[a.kind] || Wallet;
                  return (
                    <div
                      key={a.id}
                      className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center flex-none">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[var(--color-text)] truncate">{a.name}</p>
                            <p className="text-xs text-[var(--color-text-faint)] truncate">
                              {[a.bank, a.last4 && `•••• ${a.last4}`].filter(Boolean).join(" · ") ||
                                t("no bank set", "chưa ghi ngân hàng")}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-none">
                          <button
                            onClick={() => openEdit(a)}
                            aria-label={t("Edit", "Sửa")}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => closeAccount(a)}
                            aria-label={t("Close account", "Đóng tài khoản")}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-warning)] hover:bg-[var(--color-surface-2)]"
                          >
                            <Archive size={15} />
                          </button>
                        </div>
                      </div>

                      <div
                        className={`mt-4 text-2xl font-bold tabular-nums ${
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
            <div>
              <h3 className="c-h5 text-[var(--color-text)] mb-4">
                {t("Credit cards", "Thẻ tín dụng")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {cards.map((a) => (
                  <div
                    key={a.id}
                    className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-error-tint)] text-[var(--color-error)] flex items-center justify-center flex-none">
                          <CreditCard size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--color-text)] truncate">{a.name}</p>
                          <p className="text-xs text-[var(--color-text-faint)] truncate">
                            {[a.bank, a.last4 && `•••• ${a.last4}`].filter(Boolean).join(" · ") ||
                              t("no bank set", "chưa ghi ngân hàng")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-none">
                        <button
                          onClick={() => openEdit(a)}
                          aria-label={t("Edit", "Sửa")}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => closeAccount(a)}
                          aria-label={t("Close account", "Đóng tài khoản")}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-warning)] hover:bg-[var(--color-surface-2)]"
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                          {t("Owed", "Dư nợ")}
                        </p>
                        <p className="text-2xl font-bold tabular-nums text-[var(--color-error)]">
                          {formatVND(a.balance)}
                        </p>
                      </div>
                      {a.available !== null && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            {t("Available", "Khả dụng")}
                          </p>
                          <p className="text-lg font-bold tabular-nums text-[var(--color-text)]">
                            {formatVND(a.available)}
                          </p>
                        </div>
                      )}
                    </div>

                    {a.creditLimit ? (
                      <>
                        {/* Trên 30% hạn mức là mốc các bên chấm điểm tín dụng
                            bắt đầu để ý, nên đổi màu ở đó chứ không đợi chạm trần. */}
                        <div className="mt-3 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (a.utilization || 0) > 80
                                ? "bg-[var(--color-error)]"
                                : (a.utilization || 0) > 30
                                  ? "bg-[var(--color-warning)]"
                                  : "bg-[var(--color-success)]"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(2, a.utilization || 0))}%` }}
                          />
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                          {t("used", "đã dùng")} {a.utilization}% {t("of", "trên")}{" "}
                          {formatVND(a.creditLimit)}
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
            <div>
              <h3 className="c-h5 text-[var(--color-text-muted)] mb-3">
                {t("Closed", "Đã đóng")}
              </h3>
              <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
                {closed.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
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
