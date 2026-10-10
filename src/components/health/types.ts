import type { MetricKey, Range, Sex } from "@/lib/health";

export interface HealthProfile {
  id: string;
  name: string;
  sex: Sex;
  birthYear: number | null;
  heightCm: number | null;
  targetWeightKg: number | null;
  lastMeasuredAt: string | null;
  lastWorkoutAt: string | null;
  measurementCount: number;
  workoutCount: number;
}

export type Segments = Partial<Record<"leftArm" | "rightArm" | "trunk" | "leftLeg" | "rightLeg", number>>;

export type Measurement = {
  id: string;
  profileId: string;
  measuredAt: string;
  source: string;
  device: string | null;
  fileName: string | null;
  age: number | null;
  heightCm: number | null;
  systolic: number | null;
  diastolic: number | null;
  bmrLow: number | null;
  bmrHigh: number | null;
  obesityPct: number | null;
  bodyType: string | null;
  targetWeightKg: number | null;
  weightControlKg: number | null;
  muscleControlKg: number | null;
  fatControlKg: number | null;
  maintenanceKcal: number | null;
  segmentalLean: Segments | null;
  segmentalFat: Segments | null;
  ranges: Partial<Record<string, Range>> | null;
  note: string | null;
} & Record<MetricKey, number | null>;

export interface WSet {
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  warmup: boolean;
  rpe?: number | null;
}

export interface WExercise {
  name: string;
  muscleGroup: string | null;
  kind: string;
  note?: string | null;
  sets: WSet[];
}

export interface Workout {
  id: string;
  profileId: string;
  title: string;
  startedAt: string;
  durationSec: number | null;
  calories: number | null;
  note: string | null;
  source: string;
  exercises: WExercise[];
}

/** Bản nháp form ghi buổi tập — số đo đọc từ ảnh cũng đi vào đây. */
export interface WorkoutDraft {
  id?: string;
  title: string;
  startedAt: string;
  durationSec: number | null;
  calories: number | null;
  note: string;
  source: "manual" | "import";
  exercises: WExercise[];
}

export const SEGMENT_LABELS = [
  { key: "leftArm", en: "Left arm", vi: "Tay trái" },
  { key: "rightArm", en: "Right arm", vi: "Tay phải" },
  { key: "trunk", en: "Trunk", vi: "Thân" },
  { key: "leftLeg", en: "Left leg", vi: "Chân trái" },
  { key: "rightLeg", en: "Right leg", vi: "Chân phải" },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → giá trị cho `<input type="datetime-local">` theo giờ máy. */
export function toLocalInput(d: string | Date = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

/** Giá trị `datetime-local` (giờ máy) → ISO để gửi máy chủ. */
export function fromLocalInput(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "04/10/2026" hoặc "04/10/2026 10:44". */
export function fmtDate(d: string | Date, withTime = false) {
  const x = new Date(d);
  const date = `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
  return withTime ? `${date} ${pad(x.getHours())}:${pad(x.getMinutes())}` : date;
}

/** Gửi JSON, trả về body; ném lỗi kèm `status` và `duplicate` để form hỏi lại. */
export async function sendJson<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    const err = new Error(json?.error || `Lỗi ${res.status}`) as Error & { status?: number; duplicate?: boolean };
    err.status = res.status;
    err.duplicate = Boolean(json?.duplicate);
    throw err;
  }
  return json as T;
}
