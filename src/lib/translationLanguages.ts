/**
 * Ngôn ngữ dùng để VIẾT NGHĨA của từ.
 *
 * Đây không phải "học tiếng nào" — thứ đó nằm ở bảng `Language` và màn
 * `/learning/languages`. Đây là tiếng mà nghĩa của từ và bản dịch câu ví dụ
 * được viết ra: học tiếng Hàn mà đặt cái này là `en` thì 물 → "water", đặt `vi`
 * thì 물 → "nước".
 *
 * Cũng không phải ngôn ngữ giao diện. Giao diện do `LanguageContext` lo và lưu
 * ở localStorage. Người học tiếng Hàn qua tiếng Anh nhưng vẫn muốn nút bấm bằng
 * tiếng Việt là chuyện hoàn toàn bình thường, nên hai thứ phải tách.
 */

export interface TranslationLanguage {
  code: string;
  /** Tên tiếng Việt, hiện ở dòng trên. */
  name: string;
  /** Tên do chính người bản ngữ gọi, hiện ở dòng dưới. */
  nativeName: string;
  /** Mã ngắn hiện trong ô vuông — thay cho cờ, vì hệ thiết kế không dùng emoji. */
  tag: string;
  /** Nghĩa mẫu của từ "apple", dùng cho thẻ xem trước lúc chọn. */
  sampleMeaning: string;
  /** Bản dịch mẫu của câu ví dụ. */
  sampleExample: string;
}

/**
 * Nghĩa mẫu ở đây là *chuỗi giao diện*, không phải dữ liệu học.
 *
 * Chúng chỉ tồn tại để thẻ xem trước cho thấy trước lựa chọn sẽ ra cái gì —
 * đúng một từ, cố định, không bao giờ ghi xuống cơ sở dữ liệu. Không có cái này
 * thì người dùng phải chọn mù rồi vào tận màn học mới biết mình chọn sai.
 */
export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  {
    code: "vi", name: "Tiếng Việt", nativeName: "Tiếng Việt", tag: "VI",
    sampleMeaning: "quả táo — loại quả tròn, vỏ đỏ, xanh hoặc vàng",
    sampleExample: "Tôi ăn một quả táo mỗi sáng.",
  },
  {
    code: "en", name: "Tiếng Anh", nativeName: "English", tag: "EN",
    sampleMeaning: "a round fruit with red, green, or yellow skin",
    sampleExample: "I eat an apple every morning.",
  },
  {
    code: "zh-Hans", name: "Tiếng Trung (giản thể)", nativeName: "简体中文", tag: "简",
    sampleMeaning: "苹果 — 一种红色、绿色或黄色外皮的圆形水果",
    sampleExample: "我每天早上吃一个苹果。",
  },
  {
    code: "zh-Hant", name: "Tiếng Trung (phồn thể)", nativeName: "繁體中文", tag: "繁",
    sampleMeaning: "蘋果 — 一種紅色、綠色或黃色外皮的圓形水果",
    sampleExample: "我每天早上吃一個蘋果。",
  },
  {
    code: "ja", name: "Tiếng Nhật", nativeName: "日本語", tag: "JA",
    sampleMeaning: "りんご — 赤・緑・黄色の皮をした丸い果物",
    sampleExample: "毎朝りんごを食べます。",
  },
  {
    code: "ko", name: "Tiếng Hàn", nativeName: "한국어", tag: "KO",
    sampleMeaning: "사과 — 빨강, 초록 또는 노란 껍질의 둥근 과일",
    sampleExample: "저는 매일 아침 사과를 먹습니다.",
  },
  {
    code: "th", name: "Tiếng Thái", nativeName: "ไทย", tag: "TH",
    sampleMeaning: "แอปเปิล — ผลไม้ทรงกลม เปลือกสีแดง เขียว หรือเหลือง",
    sampleExample: "ฉันกินแอปเปิลทุกเช้า",
  },
  {
    code: "de", name: "Tiếng Đức", nativeName: "Deutsch", tag: "DE",
    sampleMeaning: "Apfel — eine runde Frucht mit roter, grüner oder gelber Schale",
    sampleExample: "Ich esse jeden Morgen einen Apfel.",
  },
  {
    code: "id", name: "Tiếng Indonesia", nativeName: "Bahasa Indonesia", tag: "ID",
    sampleMeaning: "apel — buah bulat berkulit merah, hijau, atau kuning",
    sampleExample: "Saya makan apel setiap pagi.",
  },
  {
    code: "my", name: "Tiếng Miến Điện", nativeName: "မြန်မာဘာသာ", tag: "MY",
    sampleMeaning: "ပန်းသီး — အနီ၊ အစိမ်း သို့မဟုတ် အဝါရောင် အခွံရှိသော လုံးဝန်းသည့် သစ်သီး",
    sampleExample: "ကျွန်တော် နံနက်တိုင်း ပန်းသီးတစ်လုံး စားပါတယ်။",
  },
  {
    code: "hi", name: "Tiếng Hindi", nativeName: "हिन्दी", tag: "HI",
    sampleMeaning: "सेब — लाल, हरे या पीले छिलके वाला एक गोल फल",
    sampleExample: "मैं हर सुबह एक सेब खाता हूँ।",
  },
];

export const translationLanguageByCode = (code: string | null | undefined) =>
  TRANSLATION_LANGUAGES.find((l) => l.code === code) ?? TRANSLATION_LANGUAGES[0];

/**
 * Tên thứ tiếng để nhét vào prompt gửi cho AI.
 *
 * Dùng tên bản ngữ chứ không dùng mã: mô hình hiểu "한국어" chắc chắn hơn "ko",
 * và mã hai chữ dễ bị lẫn với thứ khác trong câu lệnh.
 */
export const promptLanguageName = (code: string | null | undefined) => {
  const lang = translationLanguageByCode(code);
  return `${lang.nativeName}`;
};
