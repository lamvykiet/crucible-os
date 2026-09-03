/**
 * Nền và hiệu ứng cho không gian học.
 *
 * Tất cả dựng bằng CSS, không dùng file ảnh: không tốn dung lượng, tải tức thì,
 * và tự đổi theo chế độ sáng/tối vì màu lấy từ token. Muốn ảnh minh hoạ thật
 * thì người dùng dán đường dẫn ảnh của chính họ — ứng dụng không đi kèm bộ
 * tranh nào.
 *
 * `css` là giá trị của thuộc tính `background`, gắn thẳng vào khung học.
 */

export interface Backdrop {
  id: string;
  en: string;
  vi: string;
  css: string;
}

export const BACKDROPS: Backdrop[] = [
  {
    id: "none",
    en: "None",
    vi: "Không dùng",
    css: "var(--color-bg)",
  },
  {
    id: "dawn",
    en: "Dawn",
    vi: "Bình minh",
    css: "linear-gradient(170deg, #F5D9B8 0%, #E8B98C 45%, #C98C6B 100%)",
  },
  {
    id: "afternoon",
    en: "Afternoon",
    vi: "Buổi chiều",
    css: "linear-gradient(170deg, #E8D9BC 0%, #D6B98E 50%, #A8836A 100%)",
  },
  {
    id: "dusk",
    en: "Dusk",
    vi: "Hoàng hôn",
    css: "linear-gradient(170deg, #8A6E8E 0%, #B07A72 55%, #E0A06B 100%)",
  },
  {
    id: "night",
    en: "Night",
    vi: "Đêm",
    css: "linear-gradient(170deg, #1B1B2E 0%, #2A2440 55%, #3D3050 100%)",
  },
  {
    id: "forest",
    en: "Forest",
    vi: "Rừng cây",
    css: "linear-gradient(170deg, #2E4034 0%, #4A6350 55%, #7A9070 100%)",
  },
  {
    id: "ocean",
    en: "Ocean",
    vi: "Biển",
    css: "linear-gradient(170deg, #1F3A46 0%, #2E5A6B 50%, #6FA0A8 100%)",
  },
  {
    id: "paper",
    en: "Paper",
    vi: "Giấy cũ",
    css: "linear-gradient(170deg, #EFE7D6 0%, #E2D5BE 60%, #D2C2A6 100%)",
  },
  {
    id: "ink",
    en: "Ink wash",
    vi: "Thuỷ mặc",
    css: "radial-gradient(120% 90% at 20% 10%, #F2F0EA 0%, #CFCabc 55%, #8E8B80 100%)",
  },
  {
    id: "plum",
    en: "Plum",
    vi: "Mận chín",
    css: "linear-gradient(170deg, #4A2B45 0%, #74405C 55%, #A9697A 100%)",
  },
];

export const backdropById = (id: string | null | undefined) =>
  BACKDROPS.find((b) => b.id === id) ?? null;

/**
 * Nền đang chọn, quy ra giá trị CSS.
 *
 * Người dùng dán đường dẫn ảnh riêng thì `background` bắt đầu bằng http — lúc
 * đó dùng ảnh đó thay cho nền dựng sẵn.
 */
export function backdropCss(background: string | null | undefined): string | null {
  if (!background) return null;
  if (/^https?:\/\//i.test(background)) {
    return `center / cover no-repeat url("${background.replace(/"/g, "%22")}")`;
  }
  return backdropById(background)?.css ?? null;
}

export interface WeatherEffect {
  id: string;
  en: string;
  vi: string;
}

/**
 * Lớp phủ thời tiết.
 *
 * Vẽ bằng canvas trong `WeatherLayer`, không dùng ảnh động — nhẹ hơn và tự tắt
 * khi người dùng bật chế độ giảm chuyển động.
 */
export const WEATHER_EFFECTS: WeatherEffect[] = [
  { id: "none", en: "None", vi: "Không" },
  { id: "snow", en: "Snow", vi: "Tuyết rơi" },
  { id: "rain", en: "Rain", vi: "Mưa" },
  { id: "petals", en: "Petals", vi: "Hoa bay" },
  { id: "fog", en: "Fog", vi: "Sương mù" },
  { id: "sunrays", en: "Sun rays", vi: "Nắng xuyên" },
];
