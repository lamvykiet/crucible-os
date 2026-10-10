// Module Sức khoẻ — mọi phép tính nằm ở đây, không tính lại ở component.
//
// Hai màn hình cùng hiện "kỷ lục" hay "số hiệp mỗi nhóm cơ" mà mỗi bên tự tính
// là hai con số khác nhau trên cùng một dữ liệu — cùng bài học với
// `src/lib/habits.ts`.

// ---------------------------------------------------------------------------
// Chỉ số thành phần cơ thể
// ---------------------------------------------------------------------------

export type Sex = "male" | "female";

/** Khoá số đo đơn (không gồm huyết áp — huyết áp là một cặp). */
export type MetricKey =
  | "weightKg" | "bodyScore" | "heartRate" | "bmi" | "pbf" | "fatMassKg" | "smmKg"
  | "leanMassKg" | "musclePct" | "smi" | "proteinPct" | "proteinKg" | "mineralKg"
  | "waterPct" | "waterL" | "visceralFat" | "whr" | "bmr";

export type Range = [number, number];

export interface MetricDef {
  key: MetricKey;
  en: string;
  vi: string;
  unit: string;
  digits: number;
  /** Cao hơn ngưỡng là TỐT (cơ, khoáng) chứ không phải xấu. */
  highIsGood?: boolean;
  /** Nhãn khi vượt ngưỡng trên mà là tốt — máy đo in "Vận động viên". */
  highLabel?: { en: string; vi: string };
  /**
   * Chênh lệch nhỏ hơn mức này giữa hai lần đo là sai số của máy, không phải
   * thay đổi thật. Số của InBody 770 (PMC11649400): 2,8 điểm % mỡ, 1,9 kg mỡ,
   * 2,4 kg nạc. Máy trạm đo công cộng còn kém chính xác hơn, nên đây là ngưỡng
   * dưới — chỉ số không có nghiên cứu thì để trống, không đoán.
   */
  noise?: number;
}

export const METRICS: Record<MetricKey, MetricDef> = {
  weightKg: { key: "weightKg", en: "Weight", vi: "Cân nặng", unit: "kg", digits: 1 },
  bodyScore: { key: "bodyScore", en: "Body score", vi: "Điểm hình thể", unit: "/100", digits: 0, highIsGood: true },
  heartRate: { key: "heartRate", en: "Heart rate", vi: "Nhịp tim", unit: "bpm", digits: 0 },
  bmi: { key: "bmi", en: "BMI", vi: "BMI", unit: "", digits: 1 },
  pbf: { key: "pbf", en: "Body fat", vi: "Tỷ lệ mỡ", unit: "%", digits: 1, noise: 2.8 },
  fatMassKg: { key: "fatMassKg", en: "Fat mass", vi: "Khối lượng mỡ", unit: "kg", digits: 1, noise: 1.9 },
  smmKg: {
    key: "smmKg", en: "Skeletal muscle", vi: "Cơ xương (SMM)", unit: "kg", digits: 1,
    highIsGood: true, highLabel: { en: "Athletic", vi: "Vận động viên" },
  },
  leanMassKg: {
    key: "leanMassKg", en: "Lean mass", vi: "Khối lượng nạc", unit: "kg", digits: 1, noise: 2.4,
    highIsGood: true, highLabel: { en: "Athletic", vi: "Vận động viên" },
  },
  musclePct: {
    key: "musclePct", en: "Muscle %", vi: "Tỷ lệ cơ bắp", unit: "%", digits: 1,
    highIsGood: true, highLabel: { en: "Athletic", vi: "Vận động viên" },
  },
  smi: {
    key: "smi", en: "Skeletal muscle index", vi: "Chỉ số cơ xương", unit: "kg/m²", digits: 1,
    highIsGood: true, highLabel: { en: "Athletic", vi: "Vận động viên" },
  },
  // Đạm vượt ngưỡng trên là có nhiều cơ hơn, không phải chuyện xấu — dù máy đo
  // CiviPay tô đỏ nó.
  proteinPct: {
    key: "proteinPct", en: "Protein %", vi: "Tỷ lệ đạm", unit: "%", digits: 1,
    highIsGood: true, highLabel: { en: "Good", vi: "Tốt" },
  },
  proteinKg: {
    key: "proteinKg", en: "Protein", vi: "Khối lượng đạm", unit: "kg", digits: 1,
    highIsGood: true, highLabel: { en: "Good", vi: "Tốt" },
  },
  mineralKg: {
    key: "mineralKg", en: "Minerals", vi: "Khoáng chất", unit: "kg", digits: 2,
    highIsGood: true, highLabel: { en: "Good", vi: "Tốt" },
  },
  waterPct: { key: "waterPct", en: "Body water %", vi: "Tỷ lệ nước", unit: "%", digits: 1 },
  waterL: { key: "waterL", en: "Body water", vi: "Thể tích nước", unit: "L", digits: 1 },
  visceralFat: { key: "visceralFat", en: "Visceral fat level", vi: "Mức mỡ nội tạng", unit: "", digits: 0 },
  whr: { key: "whr", en: "Waist–hip ratio", vi: "Chỉ số eo/hông", unit: "", digits: 2 },
  bmr: { key: "bmr", en: "Basal metabolic rate", vi: "Trao đổi chất cơ bản", unit: "kcal", digits: 0 },
};

/** Thứ tự hiện trong bảng chi tiết, gom theo nhóm như phiếu kết quả. */
export const METRIC_GROUPS: { en: string; vi: string; keys: MetricKey[] }[] = [
  { en: "Composition", vi: "Thành phần", keys: ["weightKg", "pbf", "fatMassKg", "smmKg", "leanMassKg", "musclePct"] },
  { en: "Risk markers", vi: "Chỉ dấu nguy cơ", keys: ["bmi", "whr", "visceralFat", "heartRate"] },
  { en: "Muscle & metabolism", vi: "Cơ & trao đổi chất", keys: ["smi", "bmr", "bodyScore"] },
  { en: "Body water & minerals", vi: "Nước & khoáng", keys: ["proteinPct", "proteinKg", "waterPct", "waterL", "mineralKg"] },
];

/**
 * Ngưỡng dự phòng khi máy đo KHÔNG in ngưỡng cá nhân. Chỉ những chỉ số có chuẩn
 * công bố rõ ràng — chỉ số nào chuẩn phụ thuộc máy thì không có dự phòng, và
 * màn hình để trống trạng thái thay vì bịa.
 *
 * - BMI: chuẩn châu Á (WHO Tây Thái Bình Dương 2000) — thừa cân từ 23, không
 *   phải 25. Máy CiviPay lại in "> 25", nên khi máy có in thì dùng số của máy
 *   cho thanh trạng thái, còn câu cảnh báo vẫn theo chuẩn châu Á (`bmiClass`).
 * - Mỡ %: mức chuẩn InBody (nam 10–20, nữ 18–28).
 * - Eo/hông: WHO 2008, nguy cơ tăng khi > 0,90 (nam) / > 0,85 (nữ).
 * - Mỡ nội tạng: thang 1–30 của InBody, dưới 10 là bình thường.
 * - Chỉ số cơ xương: ngưỡng thiểu cơ của AWGS 2019 cho máy BIA (nam 7,0; nữ 5,7).
 */
const FALLBACK: Partial<Record<MetricKey, Record<Sex, Range>>> = {
  bmi: { male: [18.5, 22.9], female: [18.5, 22.9] },
  pbf: { male: [10, 20], female: [18, 28] },
  whr: { male: [0.8, 0.9], female: [0.75, 0.85] },
  visceralFat: { male: [1, 9], female: [1, 9] },
  heartRate: { male: [60, 100], female: [60, 100] },
  smi: { male: [7, 11], female: [5.7, 9] },
};

export type Status = "low" | "normal" | "high";
export type Tone = "good" | "warn" | "bad" | "neutral";

export interface Reading {
  value: number;
  range: Range | null;
  status: Status | null;
  tone: Tone;
  label: { en: string; vi: string } | null;
}

/** Ngưỡng cho một lần đo: số máy in kèm trước, chuẩn công bố sau. */
export function rangeFor(key: MetricKey, sex: Sex, printed?: Partial<Record<string, Range>> | null): Range | null {
  const own = printed?.[key];
  if (Array.isArray(own) && own.length === 2 && own.every((n) => Number.isFinite(n))) return own as Range;
  return FALLBACK[key]?.[sex] ?? null;
}

export function readMetric(
  key: MetricKey,
  value: number | null | undefined,
  sex: Sex,
  printed?: Partial<Record<string, Range>> | null
): Reading | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const def = METRICS[key];
  const range = rangeFor(key, sex, printed);
  if (!range) return { value, range: null, status: null, tone: "neutral", label: null };
  const status: Status = value < range[0] ? "low" : value > range[1] ? "high" : "normal";
  let tone: Tone = "good";
  let label = { en: "Normal", vi: "Bình thường" };
  if (status === "low") {
    // Mỡ, mỡ nội tạng, eo/hông thấp hơn ngưỡng không phải chuyện đáng lo.
    tone = ["pbf", "fatMassKg", "visceralFat", "whr"].includes(key) ? "neutral" : "warn";
    label = { en: "Low", vi: "Thấp" };
  } else if (status === "high") {
    tone = def.highIsGood ? "good" : "bad";
    label = def.highIsGood ? def.highLabel ?? { en: "High", vi: "Cao" } : { en: "High", vi: "Cao" };
  }
  return { value, range, status, tone, label };
}

/** BMI theo chuẩn châu Á — câu chữ cho cảnh báo. */
export function bmiClass(bmi: number) {
  if (bmi < 18.5) return { tone: "warn" as Tone, en: "Underweight", vi: "Thiếu cân" };
  if (bmi < 23) return { tone: "good" as Tone, en: "Normal", vi: "Bình thường" };
  if (bmi < 25) return { tone: "warn" as Tone, en: "Overweight (Asian cut-off)", vi: "Thừa cân (chuẩn châu Á)" };
  return { tone: "bad" as Tone, en: "Obese (Asian cut-off)", vi: "Béo phì (chuẩn châu Á)" };
}

/**
 * Huyết áp theo AHA/ACC 2017 (bản 2025 giữ nguyên ngưỡng). Hội Tim mạch Việt
 * Nam và ESC chỉ gọi là tăng huyết áp từ 140/90 — màn hình ghi rõ đang dùng chuẩn
 * nào để không ai hiểu nhầm "giai đoạn 1" là chẩn đoán.
 */
export function bpCategory(sys: number, dia: number) {
  if (sys > 180 || dia > 120)
    return { tone: "bad" as Tone, en: "Hypertensive crisis — see a doctor", vi: "Cơn tăng huyết áp — cần gặp bác sĩ" };
  if (sys >= 140 || dia >= 90) return { tone: "bad" as Tone, en: "Stage 2", vi: "Tăng huyết áp độ 2" };
  if (sys >= 130 || dia >= 80) return { tone: "warn" as Tone, en: "Stage 1", vi: "Tăng huyết áp độ 1" };
  if (sys >= 120) return { tone: "warn" as Tone, en: "Elevated", vi: "Huyết áp tăng nhẹ" };
  return { tone: "good" as Tone, en: "Normal", vi: "Bình thường" };
}

export const toneVar = (tone: Tone) =>
  tone === "good"
    ? "var(--color-success)"
    : tone === "warn"
      ? "var(--color-warning)"
      : tone === "bad"
        ? "var(--color-error)"
        : "var(--color-text-muted)";

export const toneTint = (tone: Tone) =>
  tone === "neutral"
    ? "var(--color-surface-2)"
    : `color-mix(in srgb, ${toneVar(tone)} 14%, transparent)`;

/** Số có `digits` chữ số lẻ, dấu phẩy thập phân kiểu Việt. */
export function fmt(value: number | null | undefined, digits = 1, lang: "en" | "vi" = "vi") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Chênh lệch có dấu: "+0,9" / "−1,2". */
export function fmtSigned(value: number, digits = 1, lang: "en" | "vi" = "vi") {
  const s = fmt(Math.abs(value), digits, lang);
  if (Math.abs(value) < Math.pow(10, -digits) / 2) return `±${fmt(0, digits, lang)}`;
  return `${value > 0 ? "+" : "−"}${s}`;
}

// ---------------------------------------------------------------------------
// So sánh hai lần đo
// ---------------------------------------------------------------------------

export interface Change {
  key: MetricKey;
  from: number;
  to: number;
  diff: number;
  /** Chênh lệch nằm trong sai số đo của máy — đừng tô xanh/đỏ. */
  withinNoise: boolean;
}

type MeasurementLike = { measuredAt: string | Date } & Partial<Record<MetricKey, number | null>>;

export function change(key: MetricKey, prev: MeasurementLike | null | undefined, cur: MeasurementLike | null | undefined): Change | null {
  const a = prev?.[key];
  const b = cur?.[key];
  if (a == null || b == null) return null;
  const diff = b - a;
  const noise = METRICS[key].noise;
  return { key, from: a, to: b, diff, withinNoise: noise !== undefined && Math.abs(diff) < noise };
}

const DAY_MS = 86_400_000;

export function daysBetween(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}

/**
 * Tốc độ đổi cân nặng, % cân nặng mỗi tuần. Giảm 0,5–1 %/tuần là nhịp giữ được
 * cơ (Garthe 2011: nhóm 0,7 %/tuần còn TĂNG nạc, nhóm 1,4 %/tuần thì không).
 * Hai lần đo cách nhau dưới 7 ngày thì nhiễu nước/bữa ăn lấn át — trả null.
 */
export function weeklyRatePct(prev: MeasurementLike, cur: MeasurementLike): number | null {
  const days = daysBetween(prev.measuredAt, cur.measuredAt);
  if (days < 7 || prev.weightKg == null || cur.weightKg == null) return null;
  return ((cur.weightKg - prev.weightKg) / prev.weightKg) * 100 * (7 / days);
}

/**
 * Cần giảm bao nhiêu kg mỡ để mỡ % về mức chuẩn, GIỮ NGUYÊN khối nạc — cách
 * InBody tính "Fat Control". Mức chuẩn: 15 % (nam) / 23 % (nữ).
 */
export function fatToLose(weightKg: number, pbf: number, sex: Sex) {
  const ideal = sex === "female" ? 23 : 15;
  if (pbf <= ideal) return 0;
  const lean = weightKg * (1 - pbf / 100);
  const target = lean / (1 - ideal / 100);
  return weightKg - target;
}

/** Đo lại sau bao nhiêu ngày — hướng dẫn InBody: khoảng 4 tuần, cùng điều kiện. */
export const REMEASURE_DAYS = 28;

// ---------------------------------------------------------------------------
// Buổi tập
// ---------------------------------------------------------------------------

export const MUSCLES = [
  { value: "chest", en: "Chest", vi: "Ngực" },
  { value: "back", en: "Back", vi: "Lưng" },
  { value: "shoulders", en: "Shoulders", vi: "Vai" },
  { value: "biceps", en: "Biceps", vi: "Tay trước" },
  { value: "triceps", en: "Triceps", vi: "Tay sau" },
  { value: "forearms", en: "Forearms", vi: "Cẳng tay" },
  { value: "core", en: "Core", vi: "Bụng – core" },
  { value: "quads", en: "Quads", vi: "Đùi trước" },
  { value: "hamstrings", en: "Hamstrings", vi: "Đùi sau" },
  { value: "glutes", en: "Glutes", vi: "Mông" },
  { value: "calves", en: "Calves", vi: "Bắp chân" },
  { value: "fullbody", en: "Full body", vi: "Toàn thân" },
  { value: "cardio", en: "Cardio", vi: "Cardio" },
] as const;

export const EXERCISE_KINDS = [
  { value: "weight", en: "Weight × reps", vi: "Tạ × lần" },
  { value: "bodyweight", en: "Bodyweight reps", vi: "Thể trọng × lần" },
  { value: "duration", en: "Duration", vi: "Thời lượng" },
] as const;

export type ExerciseKind = (typeof EXERCISE_KINDS)[number]["value"];

export const muscleLabel = (value: string | null | undefined) => MUSCLES.find((m) => m.value === value);

/**
 * 1RM ước tính theo Epley: w × (1 + r/30) — đúng công thức Hevy dùng (kiểm trên
 * ảnh chụp: 6 kg × 20 → 10, 20 kg × 20 → 33; Brzycki ra 12,7 và 42,4).
 * Một lần nâng thì 1RM chính là mức tạ. Trên 12 lần mọi công thức đều trôi xa
 * thực tế, nên `reliable` báo cho giao diện ghi "ước lượng".
 */
export function e1rm(weightKg: number | null | undefined, reps: number | null | undefined) {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) return null;
  const value = reps === 1 ? weightKg : weightKg * (1 + reps / 30);
  return { value, reliable: reps <= 12 };
}

export interface SetLike {
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  warmup?: boolean;
}
export interface ExerciseLike {
  name: string;
  muscleGroup?: string | null;
  kind?: string;
  sets: SetLike[];
}
export interface WorkoutLike {
  id?: string;
  startedAt: string | Date;
  exercises: ExerciseLike[];
}

const working = (sets: SetLike[]) => sets.filter((s) => !s.warmup);

export const setVolume = (s: SetLike) => (s.weightKg && s.reps ? s.weightKg * s.reps : 0);

/** Tổng khối lượng (kg × lần) của bài/buổi — không tính hiệp khởi động. */
export const exerciseVolume = (ex: ExerciseLike) => working(ex.sets).reduce((sum, s) => sum + setVolume(s), 0);
export const workoutVolume = (w: WorkoutLike) => w.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0);
export const workoutSets = (w: WorkoutLike) => w.exercises.reduce((sum, ex) => sum + working(ex.sets).length, 0);

/** Khoá gom kỷ lục: cùng tên bài, không phân biệt hoa thường và khoảng trắng. */
export const exerciseKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export type PrType = "weight" | "e1rm" | "setVolume" | "sessionVolume" | "reps" | "duration";

export const PR_LABELS: Record<PrType, { en: string; vi: string }> = {
  weight: { en: "Heaviest", vi: "Tạ nặng nhất" },
  e1rm: { en: "1RM", vi: "1RM" },
  setVolume: { en: "Set volume", vi: "Khối lượng hiệp" },
  sessionVolume: { en: "Session volume", vi: "Khối lượng buổi" },
  reps: { en: "Most reps", vi: "Nhiều lần nhất" },
  duration: { en: "Longest", vi: "Lâu nhất" },
};

interface Best {
  weight: number;
  e1rm: number;
  setVolume: number;
  sessionVolume: number;
  reps: number;
  duration: number;
}

const ZERO: Best = { weight: 0, e1rm: 0, setVolume: 0, sessionVolume: 0, reps: 0, duration: 0 };

export interface SetPr {
  workoutId: string;
  exerciseIndex: number;
  setIndex: number;
  types: PrType[];
}

export interface ExerciseRecord {
  name: string;
  muscleGroup: string | null;
  kind: string;
  best: Best;
  /** Ngày lập từng kỷ lục. */
  at: Partial<Record<PrType, string>>;
  sessions: number;
  lastAt: string;
}

/**
 * Đi qua lịch sử theo thứ tự thời gian và đánh dấu kỷ lục như Hevy: trong mỗi
 * buổi, mỗi loại kỷ lục gắn vào ĐÚNG MỘT hiệp — hiệp đạt mức cao nhất của buổi
 * đó — và chỉ khi mức đó vượt mọi buổi trước.
 *
 * Buổi đầu tiên của một bài không tính là kỷ lục (chưa có gì để phá), nếu không
 * thì mọi bài mới đều rực huy chương. Kỷ lục khối lượng buổi gắn vào hiệp làm
 * việc cuối cùng của bài.
 */
export function computeRecords(workouts: WorkoutLike[]) {
  const sorted = [...workouts].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const bests = new Map<string, ExerciseRecord>();
  const prs: SetPr[] = [];

  for (const w of sorted) {
    const iso = new Date(w.startedAt).toISOString();
    const workoutId = w.id ?? iso;
    w.exercises.forEach((ex, exerciseIndex) => {
      const key = exerciseKey(ex.name);
      if (!key) return;
      const prev = bests.get(key);
      const kind = ex.kind ?? "weight";
      const best = prev ? { ...prev.best } : { ...ZERO };
      const at = prev ? { ...prev.at } : {};

      // Mức cao nhất của buổi này cho từng loại, và hiệp đạt nó.
      const top: Partial<Record<PrType, { value: number; setIndex: number }>> = {};
      const consider = (type: PrType, value: number, setIndex: number) => {
        if (value > 0 && value > (top[type]?.value ?? 0)) top[type] = { value, setIndex };
      };
      let lastWorking = -1;
      ex.sets.forEach((s, i) => {
        if (s.warmup) return;
        lastWorking = i;
        if (kind === "duration") consider("duration", s.durationSec ?? 0, i);
        else if (kind === "bodyweight") consider("reps", s.reps ?? 0, i);
        else {
          consider("weight", s.weightKg ?? 0, i);
          consider("e1rm", e1rm(s.weightKg, s.reps)?.value ?? 0, i);
          consider("setVolume", setVolume(s), i);
        }
      });
      if (kind === "weight" && lastWorking >= 0) consider("sessionVolume", exerciseVolume(ex), lastWorking);

      const bySet = new Map<number, PrType[]>();
      for (const type of Object.keys(top) as PrType[]) {
        const hit = top[type]!;
        if (hit.value <= best[type]) continue;
        if (prev && best[type] > 0) bySet.set(hit.setIndex, [...(bySet.get(hit.setIndex) ?? []), type]);
        best[type] = hit.value;
        at[type] = iso;
      }
      for (const [setIndex, types] of bySet) prs.push({ workoutId, exerciseIndex, setIndex, types });

      bests.set(key, {
        name: ex.name.trim(),
        muscleGroup: ex.muscleGroup || prev?.muscleGroup || null,
        kind,
        best,
        at,
        sessions: (prev?.sessions ?? 0) + 1,
        lastAt: iso,
      });
    });
  }

  return { records: [...bests.values()], prs };
}

/**
 * Số hiệp làm việc mỗi nhóm cơ trong một khoảng thời gian. Mốc tham chiếu
 * 10–20 hiệp/nhóm cơ/tuần (Schoenfeld 2017: ≥10 hiệp tốt hơn 5–9 hiệp; mức trên
 * là quy ước thực hành, nghiên cứu chưa đủ dữ liệu).
 */
export const WEEKLY_SETS_TARGET: Range = [10, 20];

export function setsByMuscle(workouts: WorkoutLike[], from: Date, to: Date) {
  const out = new Map<string, number>();
  for (const w of workouts) {
    const t = new Date(w.startedAt).getTime();
    if (t < from.getTime() || t >= to.getTime()) continue;
    for (const ex of w.exercises) {
      const m = ex.muscleGroup || "other";
      out.set(m, (out.get(m) ?? 0) + working(ex.sets).length);
    }
  }
  return out;
}

/** Hiệp gần nhất của một bài ở buổi TRƯỚC — để hiện "lần trước" cạnh ô nhập. */
export function lastPerformance(workouts: WorkoutLike[], name: string, before?: string | Date) {
  const key = exerciseKey(name);
  if (!key) return null;
  const cutoff = before ? new Date(before).getTime() : Infinity;
  const sorted = [...workouts]
    .filter((w) => new Date(w.startedAt).getTime() < cutoff)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  for (const w of sorted) {
    const ex = w.exercises.find((e) => exerciseKey(e.name) === key);
    if (ex) return { startedAt: w.startedAt, exercise: ex };
  }
  return null;
}

/** "1m 30s" / "1h 6m" — cùng kiểu Hevy. */
export function fmtDuration(sec: number | null | undefined) {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return s ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/** Mô tả một hiệp: "20 kg × 20", "× 15", "1m 30s". */
export function fmtSet(s: SetLike, kind: string | undefined, lang: "en" | "vi" = "vi") {
  if (kind === "duration") return fmtDuration(s.durationSec);
  if (kind === "bodyweight") return s.weightKg ? `+${fmt(s.weightKg, s.weightKg % 1 ? 1 : 0, lang)} kg × ${s.reps ?? 0}` : `× ${s.reps ?? 0}`;
  const w = s.weightKg ?? 0;
  return `${fmt(w, w % 1 ? 1 : 0, lang)} kg × ${s.reps ?? 0}`;
}

/** Thứ Hai của tuần chứa `d`, 00:00 giờ máy. */
export function weekStartOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}
