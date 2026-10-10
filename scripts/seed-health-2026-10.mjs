// Nạp dữ liệu sức khoẻ có sẵn của Lâm Vỹ Kiệt vào module Sức khoẻ.
//
// Nguồn — chép tay từng con số, không suy diễn:
//   - CiviPay.pdf   : phiếu đo trạm CiviPay/GoTrust v1.6.2, 10:54 12/09/2026
//                     (tên và tuổi bị che trên phiếu — chiều cao/cân nặng khớp)
//   - CiviPay 4.pdf : phiếu đo trạm CiviPay/GoTrust v1.6.3, 10:44 04/10/2026
//   - 4 ảnh chụp Hevy: "Buổi 2: Lưng - Tay trước", 19:10 04/10/2026
//
// Chạy (trong thư mục dự án, sau khi đã tạo bảng):
//   node --env-file=.env scripts/seed-health-2026-10.mjs            # xem trước, không ghi
//   node --env-file=.env scripts/seed-health-2026-10.mjs --apply    # ghi thật
//   thêm  --wife "Tên vợ"  để tạo luôn hồ sơ thứ hai (nữ, chưa có số đo)
//
// Chạy lại không sinh bản trùng: lần đo/buổi tập trùng thời điểm thì bỏ qua.

import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const wifeIdx = process.argv.indexOf("--wife");
const wifeName = wifeIdx > 0 ? process.argv[wifeIdx + 1] : null;

const prisma = new PrismaClient();

const MEASUREMENTS = [
  {
    measuredAt: "2026-09-12T10:54:00+07:00",
    device: "CiviPay · GoTrust v1.6.2",
    fileName: "CiviPay.pdf",
    age: null,
    heightCm: 167.6,
    weightKg: 79.5,
    bodyScore: 72,
    systolic: 131,
    diastolic: 89,
    heartRate: 90,
    bmi: 28.3,
    pbf: 28.5,
    fatMassKg: 22.7,
    smmKg: 32.2,
    leanMassKg: 56.8,
    musclePct: 40.5,
    smi: 8.6,
    proteinPct: 14.2,
    proteinKg: 11.3,
    mineralKg: 3.7,
    waterPct: 52.6,
    waterL: 41.8,
    visceralFat: 9,
    whr: 0.93,
    bmr: 1597,
    bmrLow: 1684,
    bmrHigh: 1976,
    obesityPct: 29,
    bodyType: "Cân đối loại I",
    targetWeightKg: 67,
    weightControlKg: -12.6,
    muscleControlKg: 0,
    fatControlKg: -12.6,
    maintenanceKcal: 2236,
    segmentalLean: { leftArm: 3.38, rightArm: 3.32, trunk: 26.22, leftLeg: 8.75, rightLeg: 8.75 },
    ranges: {
      bmi: [18.5, 25],
      pbf: [10, 20],
      fatMassKg: [7.4, 14.8],
      whr: [0.8, 0.9],
      proteinPct: [15, 20],
      proteinKg: [9.3, 11.3],
      leanMassKg: [47.3, 57.8],
      smmKg: [26.3, 32.1],
      smi: [7, 11],
      waterPct: [45, 60],
      waterL: [34.7, 42.5],
      musclePct: [40, 50],
      mineralKg: [3.21, 3.93],
    },
  },
  {
    measuredAt: "2026-10-04T10:44:00+07:00",
    device: "CiviPay · GoTrust v1.6.3",
    fileName: "CiviPay 4.pdf",
    age: 35,
    heightCm: 168.7,
    weightKg: 80.4,
    bodyScore: 74,
    systolic: 126,
    diastolic: 82,
    heartRate: 88,
    bmi: 28.3,
    pbf: 27.3,
    fatMassKg: 21.9,
    smmKg: 33.2,
    leanMassKg: 58.5,
    musclePct: 41.3,
    smi: 8.8,
    proteinPct: 14.6,
    proteinKg: 11.7,
    mineralKg: 3.8,
    waterPct: 53.5,
    waterL: 43,
    visceralFat: 9,
    whr: 0.92,
    bmr: 1633,
    bmrLow: 1699,
    bmrHigh: 1994,
    obesityPct: 27,
    bodyType: "Cân đối loại I",
    targetWeightKg: 69,
    weightControlKg: -11.6,
    muscleControlKg: 0,
    fatControlKg: -11.6,
    maintenanceKcal: 2259,
    segmentalLean: { leftArm: 3.49, rightArm: 3.42, trunk: 26.74, leftLeg: 9.06, rightLeg: 9.1 },
    ranges: {
      bmi: [18.5, 25],
      pbf: [10, 20],
      fatMassKg: [7.5, 15],
      whr: [0.8, 0.9],
      proteinPct: [15, 20],
      proteinKg: [9.4, 11.6],
      leanMassKg: [47.9, 58.5],
      smmKg: [26.6, 32.6],
      smi: [7, 11],
      waterPct: [45, 60],
      waterL: [35.2, 43],
      musclePct: [40, 50],
      mineralKg: [3.26, 3.98],
    },
  },
];

const twentyReps = (weights) => weights.map((weightKg, order) => ({ order, weightKg, reps: 20 }));

const WORKOUTS = [
  {
    title: "Buổi 2: Lưng - Tay trước",
    startedAt: "2026-10-04T19:10:00+07:00",
    durationSec: 66 * 60,
    calories: 347,
    note: "Nhập từ Hevy (ảnh chụp). Hevy ghi 2.080 kg, 4 kỷ lục — kỷ lục của Hevy dựa trên lịch sử trước đó chưa có ở đây.",
    exercises: [
      { name: "Bent Over Row", muscleGroup: "back", kind: "weight", sets: twentyReps([6, 10, 16, 20]) },
      {
        name: "Front Plank",
        muscleGroup: "core",
        kind: "duration",
        sets: [0, 1, 2].map((order) => ({ order, durationSec: 90 })),
      },
      { name: "Romanian Deadlift", muscleGroup: "hamstrings", kind: "weight", sets: twentyReps([6, 10, 16, 20]) },
    ],
  },
];

async function main() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const user = users.find((u) => u.displayName.normalize("NFC") === "Lâm Vỹ Kiệt".normalize("NFC")) ?? (users.length === 1 ? users[0] : null);
  if (!user) throw new Error("Không xác định được tài khoản — sửa script để chọn đúng userId.");
  console.log(`Tài khoản: ${user.displayName} (${user.id})`);
  console.log(apply ? "CHẾ ĐỘ GHI THẬT" : "Xem trước — thêm --apply để ghi");

  let profile = await prisma.healthProfile.findFirst({
    where: { userId: user.id, name: "Lâm Vỹ Kiệt", archivedAt: null },
  });
  if (!profile) {
    console.log("+ hồ sơ: Lâm Vỹ Kiệt (nam, 168,7 cm)");
    if (apply) {
      profile = await prisma.healthProfile.create({
        data: { userId: user.id, name: "Lâm Vỹ Kiệt", sex: "male", heightCm: 168.7, sortOrder: 0 },
      });
    }
  } else {
    console.log(`= hồ sơ đã có: ${profile.name}`);
  }

  if (wifeName) {
    const wife = await prisma.healthProfile.findFirst({ where: { userId: user.id, name: wifeName, archivedAt: null } });
    if (!wife) {
      console.log(`+ hồ sơ: ${wifeName} (nữ, chưa có số đo)`);
      if (apply) await prisma.healthProfile.create({ data: { userId: user.id, name: wifeName, sex: "female", sortOrder: 1 } });
    } else console.log(`= hồ sơ đã có: ${wifeName}`);
  }

  for (const m of MEASUREMENTS) {
    const at = new Date(m.measuredAt);
    const dup = profile && (await prisma.bodyMeasurement.findFirst({ where: { profileId: profile.id, measuredAt: at } }));
    if (dup) {
      console.log(`= lần đo ${m.measuredAt} đã có, bỏ qua`);
      continue;
    }
    console.log(`+ lần đo ${m.measuredAt}: ${m.weightKg} kg, mỡ ${m.pbf}%, SMM ${m.smmKg} kg`);
    if (apply) {
      await prisma.bodyMeasurement.create({
        data: { ...m, measuredAt: at, source: "import", profileId: profile.id, userId: user.id },
      });
    }
  }

  for (const w of WORKOUTS) {
    const at = new Date(w.startedAt);
    const dup = profile && (await prisma.workout.findFirst({ where: { profileId: profile.id, startedAt: at } }));
    if (dup) {
      console.log(`= buổi tập ${w.startedAt} đã có, bỏ qua`);
      continue;
    }
    const volume = w.exercises.flatMap((e) => e.sets).reduce((s, x) => s + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
    console.log(`+ buổi tập ${w.startedAt}: ${w.title} — ${w.exercises.length} bài, ${volume} kg`);
    if (apply) {
      await prisma.workout.create({
        data: {
          title: w.title,
          startedAt: at,
          durationSec: w.durationSec,
          calories: w.calories,
          note: w.note,
          source: "import",
          profileId: profile.id,
          userId: user.id,
          exercises: {
            create: w.exercises.map((e, order) => ({
              order,
              name: e.name,
              muscleGroup: e.muscleGroup,
              kind: e.kind,
              sets: { create: e.sets },
            })),
          },
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
