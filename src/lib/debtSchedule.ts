// Nối lại chuỗi dư nợ của lịch trả nợ sau khi sửa một kỳ.
//
// Tách riêng khỏi route handler để kiểm chứng được bằng dữ liệu thật mà không
// cần đi qua tầng xác thực.
//
// Ba quy tắc, đừng đổi nếu chưa đọc kỹ:
//
//   1. CHUỖI DƯ NỢ được nối lại cho MỌI kỳ sau kỳ vừa sửa, kể cả kỳ đã chốt.
//      `dư nợ đầu kỳ = dư nợ cuối kỳ trước` là đẳng thức số học, không phải dự
//      đoán; để nó đứt là bảng tự mâu thuẫn.
//
//   2. SỐ NGÀY TÍNH LÃI suy ra từ hai mốc ngày — ngày đến hạn kỳ trước và ngày
//      đến hạn kỳ này (kỳ đầu thì tính từ ngày giải ngân). Nó là phép trừ hai
//      ngày, không phải số nhập tay. Dời ngày đến hạn của một kỳ chỉ đổi số
//      ngày của CHÍNH kỳ đó và của kỳ ngay sau; các kỳ xa hơn có cửa sổ ngày
//      không đụng tới nên giữ nguyên.
//
//   3. LÃI và LÃI SUẤT là hai chiều ngược nhau của cùng một công thức, chọn
//      chiều nào là tuỳ trạng thái kỳ:
//
//        • Kỳ ĐÃ CHỐT: ngân hàng đã thu một số tiền lãi cụ thể. Đó là sự thật.
//          Lãi suất thực tế được suy NGƯỢC ra từ nó. Với khoản vay thả nổi, đây
//          là cách duy nhất biết ngân hàng thực sự áp bao nhiêu phần trăm.
//          Chỉ suy lại cho ĐÚNG kỳ vừa sửa. Suy cho cả các kỳ chốt phía sau sẽ
//          âm thầm viết lại hàng chục lãi suất chưa từng tồn tại: dư nợ của
//          chúng có đổi (quy tắc 1) nhưng tiền lãi ngân hàng thu thì không, nên
//          phép chia ra một con số không ứng với thực tế nào cả.
//
//        • Kỳ TẠM TÍNH: chưa có gì xảy ra, chỉ có giả định lãi suất. Tiền lãi
//          được suy XUÔI từ lãi suất đó.
//
// Nhờ vậy, cấn một khoản hoàn vào kỳ quá khứ sẽ làm dư nợ mới lan xuống tới
// cuối và giảm phần lãi tương lai, mà không viết lại lịch sử đã trả.

export interface ScheduleRow {
  id: string;
  period: number;
  dueDate: Date;
  openingBalance: number;
  principal: number;
  interest: number;
  payment: number;
  closingBalance: number;
  interestRate: number;
  interestDays: number;
  status: string;
}

/** Số ngày giữa hai mốc, tính theo UTC để không lệch vì múi giờ máy chủ. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/** Lãi một kỳ theo đúng cách ngân hàng tính: dư nợ đầu kỳ × lãi suất × ngày/365. */
export function interestFor(openingBalance: number, ratePercent: number, days: number): number {
  return Math.round((openingBalance * (ratePercent / 100) * days) / 365);
}

/**
 * Chiều ngược của `interestFor`: từ tiền lãi ngân hàng đã thu, suy ra lãi suất
 * thực tế đã áp. Làm tròn 2 chữ số thập phân cho khớp cách ngân hàng công bố.
 *
 * Trả về 0 khi không suy được (dư nợ hoặc số ngày bằng 0) thay vì Infinity/NaN
 * — một con số vô nghĩa lọt vào bảng còn tệ hơn một số 0 nhìn thấy ngay.
 */
export function rateFromInterest(
  openingBalance: number,
  interest: number,
  days: number
): number {
  if (openingBalance <= 0 || days <= 0) return 0;
  const rate = (interest * 365 * 100) / (openingBalance * days);
  return Math.round(rate * 100) / 100;
}

/**
 * Tính lại từ `fromIndex` tới hết. Sửa `rows` tại chỗ và trả về những dòng đã đổi.
 *
 * `loanStart` là ngày giải ngân, dùng làm mốc đếm ngày cho kỳ đầu tiên.
 */
export function recalcFrom(
  rows: ScheduleRow[],
  fromIndex: number,
  loanStart?: Date
): ScheduleRow[] {
  const changed: ScheduleRow[] = [];
  const editedIndex = Math.max(0, fromIndex);

  for (let i = editedIndex; i < rows.length; i++) {
    const prev = rows[i - 1];
    const old = rows[i];
    const next = { ...old };

    if (prev) next.openingBalance = prev.closingBalance;

    // Quy tắc 2 — chỉ kỳ vừa sửa và kỳ ngay sau nó có cửa sổ ngày thay đổi.
    if (i <= editedIndex + 1) {
      const from = prev ? prev.dueDate : loanStart;
      if (from) {
        const days = daysBetween(from, next.dueDate);
        if (days > 0) next.interestDays = days;
      }
    }

    // Quy tắc 3 — chọn chiều theo trạng thái.
    if (next.status === "projected") {
      next.interest = interestFor(next.openingBalance, next.interestRate, next.interestDays);
    } else if (i === editedIndex) {
      next.interestRate = rateFromInterest(
        next.openingBalance,
        next.interest,
        next.interestDays
      );
    }

    next.payment = next.principal + next.interest;
    next.closingBalance = next.openingBalance - next.principal;

    if (
      next.openingBalance !== old.openingBalance ||
      next.interest !== old.interest ||
      next.interestRate !== old.interestRate ||
      next.interestDays !== old.interestDays ||
      next.payment !== old.payment ||
      next.closingBalance !== old.closingBalance
    ) {
      changed.push(next);
    }
    rows[i] = next;
  }

  return changed;
}
