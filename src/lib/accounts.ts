// Số dư tài khoản tính tới hôm nay.
//
// Chỉ có MỘT bản công thức, đặt ở đây. Tính lại ở component là hai công thức
// và sớm muộn ra hai con số khác nhau trên cùng một màn hình — bài học đã ghi
// trong AGENTS.md ở phần chuỗi ngày của Thói quen.
//
// Quy ước dấu, chỗ dễ nhầm nhất:
//
//   • Tài khoản ngân hàng / ví / tiền mặt: `balance` là SỐ DƯ. Dương là còn
//     tiền.
//   • Thẻ tín dụng: `balance` là DƯ NỢ. Dương là ĐANG NỢ. Quẹt thẻ làm nó
//     tăng, trả thẻ làm nó giảm.
//
// Hai thứ ngược chiều nhau nên không gộp vào một phép cộng được: tổng tài sản
// phải lấy tiền mặt TRỪ dư nợ thẻ, không phải cộng tất cả lại.

export interface AccountRow {
  id: string;
  name: string;
  kind: string;
  bank: string | null;
  last4: string | null;
  openingBalance: number;
  openingDate: Date | null;
  creditLimit: number | null;
  statementDay: number | null;
  dueDay: number | null;
  status: string;
  notes: string | null;
}

export interface TxRow {
  date: Date;
  type: string;
  totalAmount: number;
  accountId: string | null;
  toAccountId: string | null;
}

export interface AccountBalance {
  id: string;
  name: string;
  kind: string;
  bank: string | null;
  last4: string | null;
  status: string;
  notes: string | null;
  openingBalance: number;
  openingDate: string | null;
  /** Số dư (hoặc dư nợ với thẻ) tính tới hôm nay. */
  balance: number;
  creditLimit: number | null;
  /** Hạn mức còn dùng được. `null` nếu không phải thẻ hoặc chưa đặt hạn mức. */
  available: number | null;
  /** Tỷ lệ dùng hạn mức, %. */
  utilization: number | null;
  statementDay: number | null;
  dueDay: number | null;
  txCount: number;
  lastTxDate: string | null;
}

export const isCard = (kind: string) => kind === "credit_card";

/**
 * Một giao dịch làm số dư của tài khoản đổi bao nhiêu.
 *
 * `role` cho biết tài khoản đang xét là bên TRẢ (`from`) hay bên NHẬN (`to`)
 * của giao dịch — trả thẻ tín dụng là một giao dịch nhưng chạm vào hai tài
 * khoản theo hai chiều ngược nhau.
 */
export function deltaFor(
  tx: { type: string; totalAmount: number },
  role: "from" | "to",
  kind: string
): number {
  const amount = tx.totalAmount;
  const card = isCard(kind);
  const kindOf = tx.type?.trim().toLowerCase();

  if (role === "to") {
    // Tiền chảy VÀO tài khoản này: ngân hàng thì cộng số dư, thẻ thì giảm dư nợ.
    return card ? -amount : amount;
  }

  switch (kindOf) {
    case "income":
      return card ? -amount : amount;
    case "expense":
      // Quẹt thẻ: chưa mất tiền ngay, nhưng nợ tăng.
      return card ? amount : -amount;
    case "refund":
      return card ? -amount : amount;
    case "transfer":
      // Rời khỏi tài khoản nguồn. Với thẻ, rút tiền mặt từ thẻ là nợ tăng.
      return card ? amount : -amount;
    default:
      // Loại khác (Adjustment và những gì chưa biết) không đoán chiều — bỏ qua
      // còn hơn đoán sai rồi số dư lệch mà không ai hiểu vì sao.
      return 0;
  }
}

export function accountBalances(accounts: AccountRow[], transactions: TxRow[]) {
  const byId = new Map<string, AccountRow>(accounts.map((a) => [a.id, a]));
  const sum = new Map<string, number>();
  const count = new Map<string, number>();
  const lastDate = new Map<string, Date>();

  const touch = (id: string, delta: number, date: Date) => {
    sum.set(id, (sum.get(id) || 0) + delta);
    count.set(id, (count.get(id) || 0) + 1);
    const prev = lastDate.get(id);
    if (!prev || date > prev) lastDate.set(id, date);
  };

  for (const tx of transactions) {
    if (tx.accountId) {
      const acc = byId.get(tx.accountId);
      if (acc) touch(acc.id, deltaFor(tx, "from", acc.kind), tx.date);
    }
    if (tx.toAccountId) {
      const acc = byId.get(tx.toAccountId);
      if (acc) touch(acc.id, deltaFor(tx, "to", acc.kind), tx.date);
    }
  }

  const rows: AccountBalance[] = accounts.map((a) => {
    const balance = a.openingBalance + (sum.get(a.id) || 0);
    const card = isCard(a.kind);
    const available =
      card && a.creditLimit !== null ? a.creditLimit - balance : null;
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      bank: a.bank,
      last4: a.last4,
      status: a.status,
      notes: a.notes,
      openingBalance: a.openingBalance,
      openingDate: a.openingDate ? a.openingDate.toISOString().slice(0, 10) : null,
      balance,
      creditLimit: a.creditLimit,
      available,
      utilization:
        card && a.creditLimit && a.creditLimit > 0
          ? Math.round((balance / a.creditLimit) * 100)
          : null,
      statementDay: a.statementDay,
      dueDay: a.dueDay,
      txCount: count.get(a.id) || 0,
      lastTxDate: lastDate.get(a.id)?.toISOString().slice(0, 10) || null,
    };
  });

  const open = rows.filter((r) => r.status !== "closed");
  const cash = open.filter((r) => !isCard(r.kind)).reduce((s, r) => s + r.balance, 0);
  const cardDebt = open.filter((r) => isCard(r.kind)).reduce((s, r) => s + r.balance, 0);
  const creditLimit = open.reduce((s, r) => s + (r.creditLimit || 0), 0);

  return {
    accounts: rows,
    totals: {
      cash,
      cardDebt,
      /** Tiền thật đang có sau khi trừ dư nợ thẻ. */
      net: cash - cardDebt,
      creditLimit,
      creditAvailable: creditLimit > 0 ? creditLimit - cardDebt : 0,
    },
  };
}
