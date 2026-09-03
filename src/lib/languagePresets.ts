/**
 * Quy ước sẵn của từng thứ tiếng.
 *
 * Đây là *cấu hình*, không phải dữ liệu học: nó chỉ nói cho giao diện biết ô
 * "cách đọc" nên gọi là gì, có cần ô thanh điệu không, và có bật phần luyện
 * viết chữ hay không. Người dùng vẫn phải tự bấm thêm thứ tiếng mình học —
 * không có dòng nào tự chui vào cơ sở dữ liệu.
 *
 * Thêm tiếng thứ sáu chỉ là thêm một phần tử vào mảng này.
 */

export type Script = "latin" | "hanzi" | "hangul";
export type PhoneticSystem = "ipa" | "pinyin" | "jyutping" | "romaja";

export interface LanguagePreset {
  code: string;
  name: string;
  nameEn: string;
  nativeName: string;
  script: Script;
  phoneticSystem: PhoneticSystem;
  hasTones: boolean;
  toneCount: number;
  levelScale: string;
  /// Các mức của thang cấp độ, dùng để xếp bộ thẻ từ dễ tới khó.
  levels: string[];
}

export const LANGUAGE_PRESETS: LanguagePreset[] = [
  {
    code: "en",
    name: "Tiếng Anh",
    nameEn: "English",
    nativeName: "English",
    script: "latin",
    phoneticSystem: "ipa",
    hasTones: false,
    toneCount: 0,
    levelScale: "CEFR",
    levels: ["A1", "A2", "B1", "B2", "C1", "C2"],
  },
  {
    code: "fr",
    name: "Tiếng Pháp",
    nameEn: "French",
    nativeName: "Français",
    script: "latin",
    phoneticSystem: "ipa",
    hasTones: false,
    toneCount: 0,
    levelScale: "CEFR",
    levels: ["A1", "A2", "B1", "B2", "C1", "C2"],
  },
  {
    // Quan Thoại: 4 thanh, cộng thanh nhẹ là 5 giá trị người học phải phân biệt.
    code: "cmn",
    name: "Tiếng Trung (Quan Thoại)",
    nameEn: "Mandarin Chinese",
    nativeName: "普通话",
    script: "hanzi",
    phoneticSystem: "pinyin",
    hasTones: true,
    toneCount: 5,
    levelScale: "HSK",
    levels: ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"],
  },
  {
    // Quảng Đông không có kỳ thi chuẩn phổ biến như HSK, nên thang cấp để tự đặt.
    code: "yue",
    name: "Tiếng Quảng Đông",
    nameEn: "Cantonese",
    nativeName: "廣東話",
    script: "hanzi",
    phoneticSystem: "jyutping",
    hasTones: true,
    toneCount: 6,
    levelScale: "Tự đặt",
    levels: ["Cấp 1", "Cấp 2", "Cấp 3", "Cấp 4", "Cấp 5", "Cấp 6"],
  },
  {
    code: "ko",
    name: "Tiếng Hàn",
    nameEn: "Korean",
    nativeName: "한국어",
    script: "hangul",
    phoneticSystem: "romaja",
    hasTones: false,
    toneCount: 0,
    levelScale: "TOPIK",
    levels: ["TOPIK1", "TOPIK2", "TOPIK3", "TOPIK4", "TOPIK5", "TOPIK6"],
  },
];

export const presetByCode = (code: string) =>
  LANGUAGE_PRESETS.find((p) => p.code === code) ?? null;

/** Nhãn hiện trên ô "cách đọc", khác nhau ở mỗi hệ phiên âm. */
export const READING_LABEL: Record<PhoneticSystem, { en: string; vi: string; hint: string }> = {
  ipa: { en: "IPA", vi: "Phiên âm IPA", hint: "/ˈwɔːtə/" },
  pinyin: { en: "Pinyin", vi: "Pinyin", hint: "shuǐ" },
  jyutping: { en: "Jyutping", vi: "Jyutping", hint: "seoi2" },
  romaja: { en: "Romaja", vi: "Phiên âm La-tinh", hint: "mul" },
};

/** Chữ tượng hình và Hangul cần luyện viết; chữ Latin thì không. */
export const needsWritingPractice = (script: Script) => script !== "latin";

/**
 * Tên các thanh điệu, để phần luyện thanh hiện nhãn cho người học chọn.
 * Quan Thoại đánh số 1–4 rồi tới thanh nhẹ; Quảng Đông đánh số 1–6.
 */
export const toneLabels = (code: string): string[] => {
  if (code === "cmn") return ["1 ˉ", "2 ˊ", "3 ˇ", "4 ˋ", "nhẹ"];
  if (code === "yue") return ["1", "2", "3", "4", "5", "6"];
  return [];
};
