// Định giá tài sản: khấu hao, giá trị còn lại, và vốn chủ sở hữu.
//
// Tách khỏi route handler để kiểm chứng được bằng dữ liệu thật mà không cần đi
// qua tầng xác thực — cùng lý do với lib lịch trả nợ.

export interface AssetLike {
  acquisitionDate: Date;
  acquisitionCost: number;
  depreciationMethod: string;
  usefulLifeMonths: number;
  salvageValue: number;
  currentValue: number | null;
  status: string;
  disposalAmount: number | null;
}

/** Đời hữu dụng mặc định theo nhóm, tính bằng tháng. Sửa được ở từng tài sản. */
export const DEFAULT_LIFE_MONTHS: Record<string, number> = {
  "Real Estate": 0, // không khấu hao — nhà lên xuống theo thị trường, không mòn theo sổ
  Vehicle: 120,
  Electronics: 48,
  Furniture: 120,
  Equipment: 60,
  Other: 60,
};

export const ASSET_CATEGORIES = Object.keys(DEFAULT_LIFE_MONTHS);

/** Số tháng trọn vẹn đã trôi qua giữa hai mốc. Chưa đủ một tháng thì bằng 0. */
export function monthsElapsed(from: Date, to: Date): number {
  let m =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * Khấu hao luỹ kế theo đường thẳng.
 *
 * Không bao giờ ăn xuống dưới `salvageValue`: hết đời hữu dụng thì tài sản dừng
 * ở giá trị thanh lý chứ không tụt về 0 rồi thành số âm.
 */
export function accumulatedDepreciation(asset: AssetLike, asOf: Date): number {
  if (asset.depreciationMethod === "none" || asset.usefulLifeMonths <= 0) return 0;
  const depreciable = Math.max(0, asset.acquisitionCost - asset.salvageValue);
  if (depreciable === 0) return 0;
  const used = Math.min(monthsElapsed(asset.acquisitionDate, asOf), asset.usefulLifeMonths);
  return Math.round((depreciable * used) / asset.usefulLifeMonths);
}

/** Nguyên giá trừ khấu hao luỹ kế. */
export function bookValue(asset: AssetLike, asOf: Date): number {
  return asset.acquisitionCost - accumulatedDepreciation(asset, asOf);
}

/**
 * Giá trị dùng để tính tài sản ròng.
 *
 * `currentValue` do người dùng tự đặt khi biết giá thị trường — có thì nó đè
 * lên giá trị sổ sách. Đó là cách duy nhất phản ánh đúng bất động sản, vì nhà
 * không mòn đi mà lên xuống theo thị trường.
 */
export function currentWorth(asset: AssetLike, asOf: Date): number {
  if (asset.status === "sold") return 0;
  if (asset.currentValue !== null && asset.currentValue !== undefined) {
    return asset.currentValue;
  }
  return bookValue(asset, asOf);
}

/**
 * Vốn chủ sở hữu = giá trị hiện tại − dư nợ còn lại của khoản vay gắn với nó.
 *
 * Trả gốc không làm tài sản đắt lên, nó làm nợ nhỏ đi; vốn chủ sở hữu tự tăng
 * đúng bằng số đó. Cộng gốc đã trả vào giá trị tài sản là đếm hai lần.
 */
export function equity(worth: number, outstandingDebt: number): number {
  return worth - outstandingDebt;
}

/** Khấu hao một tháng, để hiện "tài sản này ngốn bao nhiêu mỗi tháng". */
export function monthlyDepreciation(asset: AssetLike): number {
  if (asset.depreciationMethod === "none" || asset.usefulLifeMonths <= 0) return 0;
  const depreciable = Math.max(0, asset.acquisitionCost - asset.salvageValue);
  return Math.round(depreciable / asset.usefulLifeMonths);
}

/** Số tháng còn lại trước khi khấu hao hết. */
export function remainingLifeMonths(asset: AssetLike, asOf: Date): number {
  if (asset.depreciationMethod === "none" || asset.usefulLifeMonths <= 0) return 0;
  return Math.max(0, asset.usefulLifeMonths - monthsElapsed(asset.acquisitionDate, asOf));
}
