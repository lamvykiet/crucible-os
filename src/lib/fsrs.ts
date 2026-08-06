/**
 * FSRS-4.5 — lịch ôn tập cho thẻ ghi nhớ.
 *
 * Schema `Flashcard` có đủ trường của thuật toán (stability, difficulty, reps,
 * state, lastReview, dueDate) từ đầu, nhưng chưa dòng code nào tính toán chúng:
 * trang ôn tập cũ có bốn nút "Quên / Khó / Tốt / Dễ" cùng gọi đúng một hàm
 * `handleNext()` chuyển sang thẻ kế tiếp, và ba thẻ thì viết cứng trong file.
 *
 * Tham số w là bộ mặc định của FSRS-4.5. Không tự chế: bộ số này được tối ưu
 * trên hàng trăm triệu lượt ôn, và chỉnh tay khi chưa có dữ liệu của riêng
 * người dùng chỉ làm lịch tệ đi.
 */

export const FSRS_WEIGHTS = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;

/** Mức nhớ mong muốn tại thời điểm ôn lại. 0.9 là mặc định của FSRS. */
export const REQUEST_RETENTION = 0.9;

const DECAY = -0.5;
const FACTOR = 19 / 81;

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MAX_INTERVAL_DAYS = 365 * 5;

export const STATE = { NEW: 0, LEARNING: 1, REVIEW: 2, RELEARNING: 3 } as const;

/** 1 = Quên, 2 = Khó, 3 = Tốt, 4 = Dễ. */
export type Grade = 1 | 2 | 3 | 4;

export interface CardState {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  state: number;
  lastReview: Date | null;
  dueDate: Date;
}

export interface ScheduleResult extends CardState {
  /** Khoảng cách tới lần ôn kế tiếp, tính bằng phút — để hiển thị trên nút. */
  intervalMinutes: number;
}

const clampDifficulty = (d: number) => Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, d));

/** Xác suất còn nhớ sau `elapsedDays` ngày với độ bền `stability`. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** Số ngày tới khi mức nhớ tụt xuống REQUEST_RETENTION. */
function intervalFromStability(stability: number): number {
  const days = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));
}

const initialStability = (g: Grade) => Math.max(0.1, FSRS_WEIGHTS[g - 1]);

const initialDifficulty = (g: Grade) =>
  clampDifficulty(FSRS_WEIGHTS[4] - (g - 3) * FSRS_WEIGHTS[5]);

function nextDifficulty(difficulty: number, g: Grade): number {
  const delta = difficulty - FSRS_WEIGHTS[6] * (g - 3);
  // Kéo nhẹ về mức khó khởi tạo của "Dễ" — chính là cơ chế chống trôi (mean
  // reversion) của FSRS, giữ độ khó không leo thang vô hạn.
  return clampDifficulty(FSRS_WEIGHTS[7] * initialDifficulty(4) + (1 - FSRS_WEIGHTS[7]) * delta);
}

function stabilityAfterRecall(d: number, s: number, r: number, g: Grade): number {
  const hardPenalty = g === 2 ? FSRS_WEIGHTS[15] : 1;
  const easyBonus = g === 4 ? FSRS_WEIGHTS[16] : 1;
  return (
    s *
    (1 +
      Math.exp(FSRS_WEIGHTS[8]) *
        (11 - d) *
        Math.pow(s, -FSRS_WEIGHTS[9]) *
        (Math.exp((1 - r) * FSRS_WEIGHTS[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function stabilityAfterLapse(d: number, s: number, r: number): number {
  return (
    FSRS_WEIGHTS[11] *
    Math.pow(d, -FSRS_WEIGHTS[12]) *
    (Math.pow(s + 1, FSRS_WEIGHTS[13]) - 1) *
    Math.exp((1 - r) * FSRS_WEIGHTS[14])
  );
}

/**
 * Các bước học ngắn, tính bằng phút.
 *
 * FSRS thuần chỉ làm việc theo ngày, nhưng thẻ vừa quên mà hẹn lại sau một ngày
 * thì gần như chắc chắn quên tiếp. Giữ đúng thông lệ của Anki/FSRS: thẻ mới và
 * thẻ vừa sai được ôn lại trong cùng phiên.
 */
const LEARNING_STEPS_MINUTES: Record<Grade, number> = { 1: 1, 2: 6, 3: 10, 4: 0 };

export function schedule(card: CardState, grade: Grade, now: Date = new Date()): ScheduleResult {
  const elapsedDays = card.lastReview
    ? Math.max(0, (now.getTime() - card.lastReview.getTime()) / 86_400_000)
    : 0;

  const isNew = card.state === STATE.NEW || card.stability <= 0;

  let stability: number;
  let difficulty: number;

  if (isNew) {
    stability = initialStability(grade);
    difficulty = initialDifficulty(grade);
  } else {
    const r = retrievability(elapsedDays, card.stability);
    difficulty = nextDifficulty(card.difficulty, grade);
    stability =
      grade === 1
        ? stabilityAfterLapse(difficulty, card.stability, r)
        : stabilityAfterRecall(difficulty, card.stability, r, grade);
  }
  stability = Math.max(0.1, stability);

  // Trạng thái kế tiếp
  let state: number;
  if (grade === 1) {
    state = isNew ? STATE.LEARNING : STATE.RELEARNING;
  } else if (isNew && grade < 4) {
    state = STATE.LEARNING;
  } else {
    state = STATE.REVIEW;
  }

  let intervalMinutes: number;
  let scheduledDays: number;

  if (state === STATE.LEARNING || state === STATE.RELEARNING) {
    intervalMinutes = LEARNING_STEPS_MINUTES[grade] || 1;
    scheduledDays = 0;
  } else {
    scheduledDays = intervalFromStability(stability);
    intervalMinutes = scheduledDays * 24 * 60;
  }

  return {
    stability,
    difficulty,
    elapsedDays: Math.round(elapsedDays),
    scheduledDays,
    reps: card.reps + 1,
    state,
    lastReview: now,
    dueDate: new Date(now.getTime() + intervalMinutes * 60_000),
    intervalMinutes,
  };
}

/** Nhãn "1 phút / 3 ngày / 2 tháng" hiện trên từng nút chấm điểm. */
export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} phút`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} giờ`;
  const days = minutes / 1440;
  if (days < 30) return `${Math.round(days)} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1)} năm`;
}

/** Xem trước khoảng cách của cả bốn lựa chọn, để hiện ngay trên nút. */
export function previewIntervals(card: CardState, now: Date = new Date()): Record<Grade, string> {
  return {
    1: formatInterval(schedule(card, 1, now).intervalMinutes),
    2: formatInterval(schedule(card, 2, now).intervalMinutes),
    3: formatInterval(schedule(card, 3, now).intervalMinutes),
    4: formatInterval(schedule(card, 4, now).intervalMinutes),
  };
}
