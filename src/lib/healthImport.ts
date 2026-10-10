import { SchemaType, type Schema } from "@google/generative-ai";

/**
 * Đọc phiếu kết quả đo cơ thể và ảnh chụp buổi tập bằng Gemini.
 *
 * Cả hai đường chỉ ĐỌC, không ghi gì xuống DB: kết quả mở ra một form điền sẵn
 * để người dùng soát rồi mới bấm lưu — cùng nguyên tắc với luồng OCR hoá đơn
 * (quét không phải là ghi sổ). Mọi trường đều `nullable`: không đọc được thì để
 * trống, tuyệt đối không đoán.
 */

const num = (description: string): Schema => ({ type: SchemaType.NUMBER, nullable: true, description });
const int = (description: string): Schema => ({ type: SchemaType.INTEGER, nullable: true, description });
const str = (description: string): Schema => ({ type: SchemaType.STRING, nullable: true, description });

const range = (what: string): Schema => ({
  type: SchemaType.ARRAY,
  nullable: true,
  description: `Personal NORMAL range printed for ${what}, as [low, high]. Example: the scale "< 7.5 | 7.5 - 15 | > 15" gives [7.5, 15]. Null if not printed.`,
  items: { type: SchemaType.NUMBER },
});

const segment = (what: string): Schema => ({
  type: SchemaType.OBJECT,
  nullable: true,
  description: `${what} per body segment in kg. Null if that tab/table is not visible.`,
  properties: {
    leftArm: num("Tay trái / left arm"),
    rightArm: num("Tay phải / right arm"),
    trunk: num("Thân / trunk"),
    leftLeg: num("Chân trái / left leg"),
    rightLeg: num("Chân phải / right leg"),
  },
});

export const BODY_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    measuredAt: str("Measurement time as local 'YYYY-MM-DDTHH:mm'. Vietnamese reports print DD/MM/YYYY — convert. Prefer 'Thời gian đo' over the browser print timestamp."),
    device: str("Station / device / app that produced the report, e.g. 'CiviPay · GoTrust v1.6.3'"),
    personName: str("Name in the profile block, null if masked with asterisks"),
    age: int("Age in years, null if masked"),
    heightCm: num("Height in cm"),
    weightKg: num("Weight in kg"),
    bodyScore: int("Overall body score out of 100 (Điểm sức khỏe hình thể)"),
    systolic: int("Blood pressure systolic (first number of e.g. 126/82)"),
    diastolic: int("Blood pressure diastolic (second number)"),
    heartRate: int("Heart rate, beats per minute"),
    bmi: num("BMI"),
    pbf: num("Percent body fat, PBF (Tỷ lệ mỡ) in %"),
    fatMassKg: num("Body fat mass in kg (Khối lượng mỡ)"),
    smmKg: num("Skeletal muscle mass, SMM, kg (Khối lượng cơ xương / Cơ xương)"),
    leanMassKg: num("Lean body mass in kg (Khối lượng cơ nạc)"),
    musclePct: num("Muscle percentage % (Tỉ lệ cơ bắp)"),
    smi: num("Skeletal muscle index kg/m² (Chỉ số cơ xương)"),
    proteinPct: num("Protein % (Tỉ lệ đạm)"),
    proteinKg: num("Protein mass kg (Khối lượng đạm)"),
    mineralKg: num("Minerals kg (Khoáng chất)"),
    waterPct: num("Body water % (Tỉ lệ nước)"),
    waterL: num("Total body water in litres (Thể tích nước cơ thể)"),
    visceralFat: int("Visceral fat level (Mức mỡ nội tạng)"),
    whr: num("Waist-hip ratio (Chỉ số eo hông)"),
    bmr: int("Basal metabolic rate kcal/day"),
    bmrLow: int("Low end of the recommended BMR range"),
    bmrHigh: int("High end of the recommended BMR range"),
    obesityPct: int("'Tỷ lệ béo phì' percentage badge"),
    bodyType: str("Body-type label exactly as printed, e.g. 'Cân đối loại I'"),
    targetWeightKg: num("Target weight kg (Cân nặng mục tiêu)"),
    weightControlKg: num("Weight control kg, signed (Điều chỉnh cân nặng), e.g. -11.6"),
    muscleControlKg: num("Muscle control kg, signed (Điều chỉnh cơ)"),
    fatControlKg: num("Fat control kg, signed (Điều chỉnh mỡ)"),
    maintenanceKcal: int("Calories to maintain weight (Lượng calo để duy trì cân nặng)"),
    segmentalLean: segment("Lean mass (Nạc)"),
    segmentalFat: segment("Fat mass (Mỡ)"),
    ranges: {
      type: SchemaType.OBJECT,
      nullable: true,
      description: "Normal ranges the report prints next to each metric",
      properties: {
        fatMassKg: range("fat mass kg"),
        proteinPct: range("protein %"),
        proteinKg: range("protein kg"),
        leanMassKg: range("lean mass kg"),
        smmKg: range("skeletal muscle kg"),
        smi: range("skeletal muscle index"),
        waterPct: range("water %"),
        waterL: range("body water L"),
        musclePct: range("muscle %"),
        mineralKg: range("minerals kg"),
        whr: range("waist-hip ratio"),
        pbf: range("body fat % (the bar's green zone, e.g. 10-20)"),
        bmi: range("BMI (the bar's green zone, e.g. 18.5-25)"),
      },
    },
  },
};

export const BODY_PROMPT = `You read body-composition / vital-signs reports (InBody, CiviPay/GoTrust kiosks, smart scales), usually in Vietnamese.
Extract every number exactly as printed. Never compute, estimate or infer a value that is not printed; use null instead.
Decimal separator may be "." — keep numbers as numbers. Ignore the countdown timer ("Truy cập trong") and the browser print timestamp in the footer.
For range scales printed as three cells "< a | a - b | > b", the normal range is [a, b]. For bars labelled only "< a" and "> b" at the ends, the normal range is [a, b].`;

export const WORKOUT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: str("Workout title exactly as shown, e.g. 'Buổi 2: Lưng - Tay trước'"),
    startedAt: str("Start time as local 'YYYY-MM-DDTHH:mm'. '04 Tháng 10 2026 lúc 07:10 CH' means 2026-10-04T19:10 (CH = PM, SA = AM)."),
    durationSec: int("Duration in seconds ('1h 6m' = 3960)"),
    calories: int("Calories if shown"),
    exercises: {
      type: SchemaType.ARRAY,
      description: "Exercises in the order shown. Screenshots overlap — merge duplicates so each exercise appears ONCE with each set ONCE (match by set number).",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "Exercise name exactly as shown (English as in Hevy/Strong)" },
          kind: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["weight", "bodyweight", "duration"],
            description: "weight = 'kg x reps'; bodyweight = reps only; duration = time only (plank, cardio)",
          },
          sets: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                weightKg: num("Weight in kg"),
                reps: int("Repetitions"),
                durationSec: int("Duration in seconds ('1m 30s' = 90)"),
                warmup: { type: SchemaType.BOOLEAN, nullable: true, description: "True only if marked as warm-up (W)" },
              },
            },
          },
        },
        required: ["name", "kind", "sets"],
      },
    },
  },
  required: ["exercises"],
};

export const WORKOUT_PROMPT = `These are screenshots of ONE workout from a gym-logging app (Hevy, Strong, …), possibly in Vietnamese.
Screenshots overlap: the same set can appear on two images — list it only once. Do not invent sets that are cut off.
Ignore the estimated 1RM column, PR badges, likes/comments, and any upsell/locked panels.
Return null for anything not visible.`;

/** Tệp nhận được: ảnh chụp màn hình và PDF in từ trình duyệt. */
export const IMPORT_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_MAX_FILES = 6;
