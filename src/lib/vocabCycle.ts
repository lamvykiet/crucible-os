import { DAY_MS } from "./learningDay";

/**
 * Vòng ôn cố định của phần từ vựng: ôn lại sau mỗi 10 ngày, tổng 5 vòng.
 *
 * Có HAI thứ chạy theo lịch này, và chúng đếm từ hai mốc khác nhau:
 *
 * - `VocabSet` — một ngày của giáo trình. Mốc là ngày người học mở bộ đó.
 * - `DictionaryItem` — một từ lẻ người học tự đánh dấu khi đọc sách. Mốc là
 *   ngày bấm "bắt đầu học" cho chính từ đó.
 *
 * Mốc riêng từng từ là điểm quan trọng: đánh dấu một từ hôm nay thì đúng mười
 * ngày sau nó quay lại, không phụ thuộc bộ nào, không phụ thuộc giáo trình nào.
 * Nếu đếm theo bộ thì một từ đánh dấu hôm nay sẽ tới hạn cùng lúc với bộ mở từ
 * chín ngày trước, tức ôn sau một ngày — vô nghĩa.
 *
 * Khác FSRS ở phần thẻ ghi nhớ: FSRS giãn cách theo mức độ nhớ từng thẻ, còn ở
 * đây ngày nào ôn gì là biết trước. Hai hệ chạy song song, không trộn, vì trộn
 * thì mất đúng cái ưu điểm của cả hai.
 */

export const CYCLE_DAYS = 10;
export const TOTAL_CYCLES = 5;

/**
 * Ngày tới hạn của vòng ôn kế tiếp.
 *
 * Null nghĩa là chưa vào vòng (chưa có mốc bắt đầu) hoặc đã xong cả năm vòng —
 * hai trường hợp khác nhau về ý nghĩa nhưng giống nhau ở chỗ "không có hạn nào
 * đang treo", nên chỗ gọi tự phân biệt bằng chính mốc bắt đầu.
 */
export function nextDueAt(startedAt: Date | null, cyclesDone: number): Date | null {
  if (!startedAt) return null;
  if (cyclesDone >= TOTAL_CYCLES) return null;
  return new Date(startedAt.getTime() + (cyclesDone + 1) * CYCLE_DAYS * DAY_MS);
}
