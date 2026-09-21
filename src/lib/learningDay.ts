/**
 * Cắt ngày cho toàn bộ Learning Hub.
 *
 * "Hôm nay", "chuỗi ngày" và "đồng hồ đếm ngược" chỉ có nghĩa khi có đúng MỘT
 * mốc nửa đêm. Máy chủ chạy UTC, nên nếu mỗi chỗ tự cắt theo giờ máy chủ thì
 * buổi ôn lúc 22h ở Việt Nam bị tính sang ngày hôm sau và chuỗi đứt oan.
 *
 * Trước đây logic này nằm rải ở overview, history và tasks — ba bản sao của
 * cùng một quy ước là ba cơ hội để chúng lệch nhau.
 */

export const TZ = "Asia/Ho_Chi_Minh";
export const DAY_MS = 86_400_000;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ngày dạng YYYY-MM-DD theo giờ Việt Nam. */
export const dayKey = (d: Date = new Date()) => dayFormatter.format(d);

/** Nửa đêm đầu ngày hôm nay (giờ VN), lưu dưới dạng mốc UTC. */
export const todayStart = (d: Date = new Date()) =>
  new Date(`${dayKey(d)}T00:00:00.000Z`);

/** Nửa đêm kế tiếp — mốc mà đồng hồ đếm ngược chạy tới. */
export const nextMidnight = (d: Date = new Date()) =>
  new Date(todayStart(d).getTime() + DAY_MS);

/**
 * Còn bao nhiêu giây tới nửa đêm.
 *
 * Tính ở máy chủ rồi để trình duyệt tự trừ dần: nếu để trình duyệt tự suy ra
 * nửa đêm thì máy đặt sai múi giờ sẽ đếm lệch hẳn vài tiếng so với lúc nhiệm
 * vụ thật sự đổi.
 */
export function secondsToMidnight(now: Date = new Date()): number {
  // Nửa đêm giờ VN quy ra mốc thật: chuỗi YYYY-MM-DD được đọc như UTC ở trên,
  // nên phải bù lại độ lệch giữa giờ VN và UTC.
  const offsetMs = todayStart(now).getTime() - startOfDayUtcOf(now);
  const realNextMidnight = nextMidnight(now).getTime() - offsetMs;
  return Math.max(0, Math.floor((realNextMidnight - now.getTime()) / 1000));
}

/** Nửa đêm UTC của chính thời điểm đó — dùng để đo độ lệch múi giờ. */
function startOfDayUtcOf(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Số ngày học liên tiếp tính tới hôm nay.
 *
 * Chưa học hôm nay thì chuỗi vẫn còn — nó chỉ đứt khi cả hôm qua cũng trống.
 * Nếu không, mở ứng dụng lúc sáng sớm sẽ thấy chuỗi về 0 dù chưa hết ngày.
 */
export function computeStreak(days: Set<string>, now: Date = new Date()): number {
  let cursor = now;

  if (!days.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}
