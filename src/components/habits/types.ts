// Kiểu dữ liệu dùng chung cho các màn hình Thói quen.
//
// Đây là hình dạng JSON mà route handler trả về — không phải kiểu Prisma:
// ngày đã đổi thành chuỗi "YYYY-MM-DD", và các số liệu tính sẵn (chuỗi ngày,
// tiến độ theo kỳ) đi kèm luôn trong cùng một object.

export interface HabitRow {
  id: string;
  name: string;
  cue: string | null;
  kind: string;
  group: string;
  color: string;
  icon: string | null;
  unit: string;
  target: number;
  period: string;
  step: number;
  weekdays: number[];
  reminderAt: string | null;
  scheduleStart: string | null;
  scheduleMinutes: number | null;
  autoSource: string;
  quitSince: string | null;
  archivedAt: string | null;
  sortOrder: number;

  /** Trạng thái của ngày đang xem. */
  amount: number;
  note: string | null;
  skipped: boolean;
  periodAmount: number;
  done: boolean;
  scheduled: boolean;
  streak: number;
}

export interface TodayResponse {
  success: boolean;
  date: string;
  today: string;
  habits: HabitRow[];
  percent: number;
  doneCount: number;
  dueCount: number;
  error?: string;
}

export interface TodoItem {
  id: string;
  title: string;
  note: string | null;
  due: string | null;
  dueTime: string | null;
  flagged: boolean;
  done: boolean;
  overdue: boolean;
}

export interface JournalItem {
  id: string;
  day: string;
  body: string;
  mood: number | null;
  energy: number | null;
  habit: { id: string; name: string; color: string } | null;
  createdAt: string;
}

export interface SessionItem {
  id: string;
  mode: string;
  minutes: number;
  seconds: number;
  note: string | null;
  habit: { id: string; name: string; color: string } | null;
  startedAt: string;
  endedAt: string;
}

export interface ReportHabit {
  id: string;
  name: string;
  kind: string;
  color: string;
  unit: string;
  target: number;
  period: string;
  group: string;
  quitSince: string | null;
  streak: number;
  percent: number;
  done: number;
  scheduled: number;
  total: number;
  /** -1 ngoài lịch · 0 chưa làm · 1 làm dở · 2 xong · 3 nghỉ */
  cells: number[];
}
