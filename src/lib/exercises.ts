import type { ExerciseKind } from "@/lib/health";

/**
 * Danh mục bài tập gợi ý cho ô tên bài (`<datalist>`).
 *
 * Tên giữ nguyên tiếng Anh như Hevy/Strong và KHÔNG dịch: `value` của datalist
 * được điền thẳng vào ô rồi lưu xuống DB, và kỷ lục cá nhân gom theo đúng chuỗi
 * tên — dịch là một bài thành hai bài với hai bộ kỷ lục (xem AGENTS.md).
 * Phần tiếng Việt chỉ là nhãn phụ để tìm.
 *
 * Bài không có trong danh mục vẫn nhập được; khi đó người dùng tự chọn nhóm cơ.
 */
export interface CatalogExercise {
  name: string;
  vi: string;
  muscle: string;
  kind: ExerciseKind;
}

export const EXERCISES: CatalogExercise[] = [
  // Ngực
  { name: "Bench Press (Barbell)", vi: "Đẩy ngực đòn", muscle: "chest", kind: "weight" },
  { name: "Bench Press (Dumbbell)", vi: "Đẩy ngực tạ đơn", muscle: "chest", kind: "weight" },
  { name: "Incline Bench Press (Barbell)", vi: "Đẩy ngực dốc lên đòn", muscle: "chest", kind: "weight" },
  { name: "Incline Bench Press (Dumbbell)", vi: "Đẩy ngực dốc lên tạ đơn", muscle: "chest", kind: "weight" },
  { name: "Chest Fly (Dumbbell)", vi: "Ép ngực tạ đơn", muscle: "chest", kind: "weight" },
  { name: "Cable Fly Crossovers", vi: "Ép ngực cáp", muscle: "chest", kind: "weight" },
  { name: "Chest Press (Machine)", vi: "Đẩy ngực máy", muscle: "chest", kind: "weight" },
  { name: "Push Up", vi: "Chống đẩy", muscle: "chest", kind: "bodyweight" },
  { name: "Chest Dip", vi: "Xà kép ngực", muscle: "chest", kind: "bodyweight" },
  // Lưng
  { name: "Bent Over Row", vi: "Gập người kéo đòn", muscle: "back", kind: "weight" },
  { name: "Dumbbell Row", vi: "Kéo tạ đơn một tay", muscle: "back", kind: "weight" },
  { name: "Lat Pulldown (Cable)", vi: "Kéo xô cáp", muscle: "back", kind: "weight" },
  { name: "Seated Cable Row", vi: "Kéo cáp ngồi", muscle: "back", kind: "weight" },
  { name: "T Bar Row", vi: "Kéo T-bar", muscle: "back", kind: "weight" },
  { name: "Pull Up", vi: "Kéo xà", muscle: "back", kind: "bodyweight" },
  { name: "Chin Up", vi: "Kéo xà tay ngửa", muscle: "back", kind: "bodyweight" },
  { name: "Deadlift (Barbell)", vi: "Deadlift", muscle: "back", kind: "weight" },
  { name: "Back Extension", vi: "Gập lưng", muscle: "back", kind: "bodyweight" },
  // Vai
  { name: "Overhead Press (Barbell)", vi: "Đẩy vai đòn", muscle: "shoulders", kind: "weight" },
  { name: "Shoulder Press (Dumbbell)", vi: "Đẩy vai tạ đơn", muscle: "shoulders", kind: "weight" },
  { name: "Lateral Raise (Dumbbell)", vi: "Dang vai tạ đơn", muscle: "shoulders", kind: "weight" },
  { name: "Rear Delt Reverse Fly (Dumbbell)", vi: "Vai sau tạ đơn", muscle: "shoulders", kind: "weight" },
  { name: "Face Pull", vi: "Kéo cáp về mặt", muscle: "shoulders", kind: "weight" },
  { name: "Shrug (Dumbbell)", vi: "Nhún vai", muscle: "shoulders", kind: "weight" },
  // Tay
  { name: "Bicep Curl (Barbell)", vi: "Cuốn tay trước đòn", muscle: "biceps", kind: "weight" },
  { name: "Bicep Curl (Dumbbell)", vi: "Cuốn tay trước tạ đơn", muscle: "biceps", kind: "weight" },
  { name: "Hammer Curl (Dumbbell)", vi: "Cuốn búa", muscle: "biceps", kind: "weight" },
  { name: "Preacher Curl", vi: "Cuốn tay ghế dốc", muscle: "biceps", kind: "weight" },
  { name: "Triceps Pushdown", vi: "Đẩy cáp tay sau", muscle: "triceps", kind: "weight" },
  { name: "Skullcrusher (Barbell)", vi: "Skullcrusher", muscle: "triceps", kind: "weight" },
  { name: "Overhead Triceps Extension", vi: "Duỗi tay sau qua đầu", muscle: "triceps", kind: "weight" },
  { name: "Triceps Dip", vi: "Xà kép tay sau", muscle: "triceps", kind: "bodyweight" },
  { name: "Wrist Curl", vi: "Cuốn cổ tay", muscle: "forearms", kind: "weight" },
  // Core
  { name: "Front Plank", vi: "Plank", muscle: "core", kind: "duration" },
  { name: "Side Plank", vi: "Plank nghiêng", muscle: "core", kind: "duration" },
  { name: "Crunch", vi: "Gập bụng", muscle: "core", kind: "bodyweight" },
  { name: "Hanging Leg Raise", vi: "Treo người nâng chân", muscle: "core", kind: "bodyweight" },
  { name: "Russian Twist", vi: "Xoay người", muscle: "core", kind: "bodyweight" },
  { name: "Cable Crunch", vi: "Gập bụng cáp", muscle: "core", kind: "weight" },
  // Chân
  { name: "Squat (Barbell)", vi: "Squat đòn", muscle: "quads", kind: "weight" },
  { name: "Front Squat", vi: "Squat trước", muscle: "quads", kind: "weight" },
  { name: "Goblet Squat", vi: "Squat ôm tạ", muscle: "quads", kind: "weight" },
  { name: "Leg Press (Machine)", vi: "Đạp đùi máy", muscle: "quads", kind: "weight" },
  { name: "Leg Extension (Machine)", vi: "Đá đùi máy", muscle: "quads", kind: "weight" },
  { name: "Lunge (Dumbbell)", vi: "Chùng chân tạ đơn", muscle: "quads", kind: "weight" },
  { name: "Bulgarian Split Squat", vi: "Squat Bulgaria", muscle: "quads", kind: "weight" },
  { name: "Romanian Deadlift", vi: "Deadlift Romania", muscle: "hamstrings", kind: "weight" },
  { name: "Lying Leg Curl (Machine)", vi: "Cuốn đùi sau nằm", muscle: "hamstrings", kind: "weight" },
  { name: "Seated Leg Curl (Machine)", vi: "Cuốn đùi sau ngồi", muscle: "hamstrings", kind: "weight" },
  { name: "Hip Thrust (Barbell)", vi: "Đẩy hông đòn", muscle: "glutes", kind: "weight" },
  { name: "Glute Bridge", vi: "Cầu mông", muscle: "glutes", kind: "bodyweight" },
  { name: "Hip Abduction (Machine)", vi: "Dạng hông máy", muscle: "glutes", kind: "weight" },
  { name: "Standing Calf Raise", vi: "Nhón bắp chân đứng", muscle: "calves", kind: "weight" },
  { name: "Seated Calf Raise", vi: "Nhón bắp chân ngồi", muscle: "calves", kind: "weight" },
  // Toàn thân / cardio
  { name: "Kettlebell Swing", vi: "Vung tạ ấm", muscle: "fullbody", kind: "weight" },
  { name: "Burpee", vi: "Burpee", muscle: "fullbody", kind: "bodyweight" },
  { name: "Treadmill", vi: "Chạy máy", muscle: "cardio", kind: "duration" },
  { name: "Stationary Bike", vi: "Đạp xe tại chỗ", muscle: "cardio", kind: "duration" },
  { name: "Rowing Machine", vi: "Máy chèo", muscle: "cardio", kind: "duration" },
  { name: "Elliptical Trainer", vi: "Máy elip", muscle: "cardio", kind: "duration" },
  { name: "Jump Rope", vi: "Nhảy dây", muscle: "cardio", kind: "duration" },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Tra danh mục theo tên (không phân biệt hoa thường). */
export function findExercise(name: string): CatalogExercise | undefined {
  const k = norm(name);
  return EXERCISES.find((e) => norm(e.name) === k);
}
