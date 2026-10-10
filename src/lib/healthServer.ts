import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MUSCLES } from "@/lib/health";

/** Hồ sơ có thuộc tài khoản này không. Mọi route của module đều phải hỏi câu này. */
export async function ownProfile(userId: string, profileId: unknown) {
  if (typeof profileId !== "string" || !profileId) return null;
  return prisma.healthProfile.findFirst({ where: { id: profileId, userId } });
}

/** Số trong khoảng hợp lý hoặc null. Số rác (âm, NaN, 9999 kg) bị bỏ chứ không lưu. */
const numIn = (v: unknown, min: number, max: number, integer = false): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return integer ? Math.round(n) : Math.round(n * 1000) / 1000;
};

/** Giới hạn từng chỉ số — đủ rộng cho mọi người lớn, đủ hẹp để chặn lỗi gõ. */
const FIELDS: Record<string, [number, number, boolean?]> = {
  age: [1, 120, true],
  heightCm: [50, 250],
  weightKg: [10, 400],
  bodyScore: [0, 100, true],
  systolic: [50, 260, true],
  diastolic: [30, 180, true],
  heartRate: [20, 250, true],
  bmi: [5, 80],
  pbf: [1, 75],
  fatMassKg: [0, 300],
  smmKg: [1, 150],
  leanMassKg: [5, 200],
  musclePct: [5, 90],
  smi: [1, 30],
  proteinPct: [1, 40],
  proteinKg: [0.5, 60],
  mineralKg: [0.2, 15],
  waterPct: [10, 90],
  waterL: [5, 120],
  visceralFat: [1, 30, true],
  whr: [0.4, 2],
  bmr: [400, 5000, true],
  bmrLow: [400, 5000, true],
  bmrHigh: [400, 5000, true],
  obesityPct: [0, 400, true],
  targetWeightKg: [10, 400],
  weightControlKg: [-200, 200],
  muscleControlKg: [-100, 100],
  fatControlKg: [-200, 200],
  maintenanceKcal: [500, 8000, true],
};

const SEGMENTS = ["leftArm", "rightArm", "trunk", "leftLeg", "rightLeg"] as const;

function segments(v: unknown): Prisma.InputJsonValue | null {
  if (!v || typeof v !== "object") return null;
  const out: Record<string, number> = {};
  for (const k of SEGMENTS) {
    const n = numIn((v as Record<string, unknown>)[k], 0, 150);
    if (n !== null) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

function ranges(v: unknown): Prisma.InputJsonValue | null {
  if (!v || typeof v !== "object") return null;
  const out: Record<string, [number, number]> = {};
  for (const [k, r] of Object.entries(v as Record<string, unknown>)) {
    if (!(k in FIELDS) && k !== "pbf" && k !== "bmi") continue;
    if (!Array.isArray(r) || r.length !== 2) continue;
    const a = Number(r[0]);
    const b = Number(r[1]);
    if (Number.isFinite(a) && Number.isFinite(b) && a < b) out[k] = [a, b];
  }
  return Object.keys(out).length ? out : null;
}

const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};

/**
 * Phần dữ liệu ghi xuống `BodyMeasurement` từ body request, bỏ mọi khoá lạ.
 * `partial` = PUT: khoá không gửi thì giữ nguyên giá trị cũ.
 */
export function measurementData(body: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (!partial || body[key] !== undefined) data[key] = value;
  };
  for (const [key, [min, max, integer]] of Object.entries(FIELDS)) set(key, numIn(body[key], min, max, integer));
  set("device", text(body.device, 120));
  set("fileName", text(body.fileName, 200));
  set("bodyType", text(body.bodyType, 80));
  set("note", text(body.note, 1000));
  set("source", body.source === "import" ? "import" : "manual");
  if (!partial || body.segmentalLean !== undefined) data.segmentalLean = segments(body.segmentalLean) ?? Prisma.DbNull;
  if (!partial || body.segmentalFat !== undefined) data.segmentalFat = segments(body.segmentalFat) ?? Prisma.DbNull;
  if (!partial || body.ranges !== undefined) data.ranges = ranges(body.ranges) ?? Prisma.DbNull;
  return data;
}

/** Ngày giờ hợp lệ trong khoảng 1990 → ngày mai, hoặc null. */
export function validDate(v: unknown): Date | null {
  if (typeof v !== "string" && !(v instanceof Date)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() < 1990 || d.getTime() > Date.now() + 86_400_000) return null;
  return d;
}

const KINDS = ["weight", "bodyweight", "duration"];

/** Bài tập + hiệp từ body request, dạng `create` lồng nhau của Prisma. */
export function exercisesData(v: unknown): Prisma.WorkoutExerciseCreateWithoutWorkoutInput[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 40)
    .map((raw, order) => {
      const ex = (raw ?? {}) as Record<string, unknown>;
      const name = text(ex.name, 120);
      if (!name) return null;
      const kind = KINDS.includes(String(ex.kind)) ? String(ex.kind) : "weight";
      const muscle = MUSCLES.some((m) => m.value === ex.muscleGroup) ? String(ex.muscleGroup) : null;
      const sets = (Array.isArray(ex.sets) ? ex.sets : [])
        .slice(0, 50)
        .map((rawSet, i) => {
          const s = (rawSet ?? {}) as Record<string, unknown>;
          const row = {
            order: i,
            weightKg: numIn(s.weightKg, 0, 1000),
            reps: numIn(s.reps, 0, 1000, true),
            durationSec: numIn(s.durationSec, 0, 86_400, true),
            rpe: numIn(s.rpe, 1, 10),
            warmup: s.warmup === true,
          };
          // Hiệp trống hoàn toàn là dòng người dùng bấm thêm rồi bỏ đó.
          return row.weightKg || row.reps || row.durationSec ? row : null;
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s, i) => ({ ...s, order: i }));
      return {
        order,
        name,
        kind,
        muscleGroup: muscle,
        note: text(ex.note, 500),
        sets: { create: sets },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .map((e, i) => ({ ...e, order: i }));
}

export const WORKOUT_INCLUDE = {
  exercises: {
    orderBy: { order: "asc" as const },
    include: { sets: { orderBy: { order: "asc" as const } } },
  },
};
