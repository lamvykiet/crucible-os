// Nối lại chuỗi dư nợ của lịch trả nợ sau khi sửa một kỳ.
//
// Tách riêng khỏi route handler để kiểm chứng được bằng dữ liệu thật mà không
// cần đi qua tầng xác thực.
//
// Hai quy tắc, đừng đổi nếu chưa đọc kỹ:
//
//   1. CHUỖI DƯ NỢ được nối lại cho MỌI kỳ sau kỳ vừa sửa, kể cả kỳ đã chốt.
//      `dư nợ đầu kỳ = dư nợ cuối kỳ trước` là đẳng thức số học, không phải dự
//      đoán; để nó đứt là bảng tự mâu thuẫn.
//
//   2. TIỀN LÃI chỉ tính lại cho kỳ TẠM TÍNH. Kỳ đã chốt giữ nguyên số ngân
//      hàng thực thu — đó là lịch sử, không suy ra được từ công thức. Muốn đổi
//      thì sửa thẳng kỳ đó.
//
// Nhờ vậy, cấn một khoản hoàn vào kỳ quá khứ sẽ làm dư nợ mới lan xuống tới
// cuối và giảm phần lãi tương lai, mà không viết lại lịch sử đã trả.

export interface ScheduleRow {
  id: string;
  period: number;
  openingBalance: number;
  principal: number;
  interest: number;
  payment: number;
  closingBalance: number;
  interestRate: number;
  interestDays: number;
  status: string;
}

/** Lãi một kỳ theo đúng cách ngân hàng tính: dư nợ đầu kỳ × lãi suất × ngày/365. */
export function interestFor(openingBalance: number, ratePercent: number, days: number): number {
  return Math.round((openingBalance * (ratePercent / 100) * days) / 365);
}

/**
 * Tính lại từ `fromIndex` tới hết. Sửa `rows` tại chỗ và trả về những dòng đã đổi.
 */
export function recalcFrom(rows: ScheduleRow[], fromIndex: number): ScheduleRow[] {
  const changed: ScheduleRow[] = [];

  for (let i = Math.max(0, fromIndex); i < rows.length; i++) {
    const prev = rows[i - 1];
    const old = rows[i];
    const next = { ...old };

    if (prev) next.openingBalance = prev.closingBalance;
    if (next.status === "projected") {
      next.interest = interestFor(next.openingBalance, next.interestRate, next.interestDays);
    }
    next.payment = next.principal + next.interest;
    next.closingBalance = next.openingBalance - next.principal;

    if (
      next.openingBalance !== old.openingBalance ||
      next.interest !== old.interest ||
      next.payment !== old.payment ||
      next.closingBalance !== old.closingBalance
    ) {
      changed.push(next);
    }
    rows[i] = next;
  }

  return changed;
}
