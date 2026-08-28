// Sinh giao dịch từ một kỳ trả nợ.
//
// Trả một kỳ vay là MỘT lần tiền rời tài khoản nhưng là HAI việc khác nhau:
//
//   • Phần LÃI là chi phí thật — tiền mất đi, đổi lấy quyền được vay.
//     Ghi `Expense` / Debt & Installments / Loan Interest.
//
//   • Phần GỐC không phải tiêu — nó chuyển từ tiền mặt sang phần sở hữu căn
//     nhà, tổng tài sản không đổi. Ghi `Transfer`, mà `classify()` bên
//     dashboard đã xếp là "không tính vào thu/chi".
//
// Gộp cả hai thành một khoản chi sẽ thổi phồng chi tiêu 5,8 triệu mỗi tháng và
// kéo tỷ lệ tiết kiệm xuống một cách vô lý suốt 20 năm.
//
// Id giao dịch suy ra từ id của kỳ nên tất định: chạy lại bao nhiêu lần cũng ra
// đúng hai dòng đó, và khi kỳ bị đổi về "tạm tính" thì biết chính xác phải xoá
// dòng nào.

export const DEBT_CATEGORY_GROUP = "Debt & Installments";
export const DEBT_SUB_INTEREST = "Loan Interest";
export const DEBT_SUB_PRINCIPAL = "Principal Repayment";
/** Đánh dấu giao dịch do hệ thống sinh từ lịch trả nợ, không phải người nhập. */
export const DEBT_TX_SOURCE = "debt";

export interface DebtTxInput {
  scheduleId: string;
  userId: string;
  debtName: string;
  period: number;
  totalPeriods: number;
  dueDate: Date;
  principal: number;
  interest: number;
  interestRate: number;
  interestDays: number;
  /** Cách thanh toán; mặc định chuyển khoản vì kỳ vay thường bị ngân hàng tự trừ. */
  paymentMethod?: string;
}

export function debtTxIds(scheduleId: string) {
  return {
    interest: `DEBT-${scheduleId}-INT`,
    principal: `DEBT-${scheduleId}-PRI`,
  };
}

export interface DebtTxRow {
  id: string;
  date: Date;
  supplier: string;
  type: string;
  categoryGroup: string;
  subGroup: string;
  totalAmount: number;
  paymentMethod: string;
  source: string;
  notes: string;
  userId: string;
}

/** Hai dòng giao dịch của một kỳ. Bỏ qua dòng có số tiền bằng 0. */
export function buildDebtTransactions(input: DebtTxInput): DebtTxRow[] {
  const ids = debtTxIds(input.scheduleId);
  const ky = `Kỳ ${input.period}/${input.totalPeriods}`;
  const pm = input.paymentMethod || "bank_transfer";
  const rows: DebtTxRow[] = [];

  if (input.interest > 0) {
    rows.push({
      id: ids.interest,
      date: input.dueDate,
      supplier: input.debtName,
      type: "Expense",
      categoryGroup: DEBT_CATEGORY_GROUP,
      subGroup: DEBT_SUB_INTEREST,
      totalAmount: input.interest,
      paymentMethod: pm,
      source: DEBT_TX_SOURCE,
      notes: `${ky} — lãi ${input.interestRate}% × ${input.interestDays} ngày`,
      userId: input.userId,
    });
  }

  if (input.principal > 0) {
    rows.push({
      id: ids.principal,
      date: input.dueDate,
      supplier: input.debtName,
      type: "Transfer",
      categoryGroup: DEBT_CATEGORY_GROUP,
      subGroup: DEBT_SUB_PRINCIPAL,
      totalAmount: input.principal,
      paymentMethod: pm,
      source: DEBT_TX_SOURCE,
      notes: `${ky} — gốc (giảm dư nợ, không tính vào chi tiêu)`,
      userId: input.userId,
    });
  }

  return rows;
}
