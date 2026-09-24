import { GoogleGenerativeAI } from "@google/generative-ai";

// Tên model để ở một chỗ duy nhất. Trước đây "gemini-1.5-pro" được viết cứng
// trong 3 route khác nhau, nên mỗi lần Google đổi vòng đời model lại phải đi
// sửa từng file và rất dễ sót.
//
// Kiểm chứng ngày 02/08/2026 bằng chính API key của dự án:
//
//   gemini-1.5-pro    → KHÔNG còn trong ListModels. Đã bị Google gỡ.
//                       Đây là nguyên nhân thật khiến trợ lý AI không chạy.
//   gemini-2.5-pro    → 429 RESOURCE_EXHAUSTED. Gói của key này không có
//                       quota cho dòng Pro, nên KHÔNG đặt Pro làm mặc định.
//   gemini-3.6-flash  → OK, kể cả với responseSchema.
//   gemini-2.5-flash  → OK, kể cả với responseSchema.
//
// Chạy lại kiểm tra bất cứ lúc nào:
//   node scripts/list-gemini-models.js
//
// Nếu sau này nâng gói có quota Pro, chỉ cần đặt trong .env, không phải sửa code:
//   GEMINI_MODEL=gemini-3.1-pro-preview
// Đo ngày 22/09/2026 trên đúng tải thật (structured output, có responseSchema):
//   gemini-3.6-flash   3/3 lượt trả 503 "high demand"
//   gemini-2.5-flash   3/3 lượt thành công, trung bình 8,6 giây
// Nên 2.5-flash là model chính. Đây là chuyện tải của từng model chứ không
// phải Gemini nói chung — thấy 3.6 ổn định trở lại thì đổi lại bằng .env,
// không phải sửa code.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Model dùng khi model chính hỏng vì quá tải.
 *
 * Phải là một model KHÁC, không phải thử lại cùng một cái: sự cố vừa rồi là
 * riêng `gemini-3.6-flash` chết trong khi `gemini-2.5-flash` vẫn chạy tốt, nên
 * thử lại cùng model bao nhiêu lần cũng vẫn 503.
 */
export const GEMINI_FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";

/**
 * Model dùng cho việc CHẤM BÀI (viết, nói).
 *
 * Chấm bài cần suy luận sâu hơn hẳn việc soạn thẻ từ vựng: phải đọc cả bài, đối
 * chiếu bốn tiêu chí, rồi chỉ ra lỗi cụ thể kèm cách sửa. Một model mạnh hơn ở
 * đây đáng giá hơn nhiều so với ở chỗ khác.
 *
 * Đo ngày 24/09/2026: khoá API này CHƯA có quota cho các model Pro
 * (`gemini-3.1-pro-preview`, `gemini-pro-latest` đều trả 429). Gói Pro của ứng
 * dụng gemini.google.com không cấp quota cho API — đó là hai thứ tính tiền
 * riêng. Bật thanh toán cho khoá ở Google AI Studio rồi đặt biến này là dùng
 * được ngay, không phải sửa code:
 *
 *   GEMINI_GRADING_MODEL=gemini-3.1-pro-preview
 */
export const GEMINI_GRADING_MODEL =
  process.env.GEMINI_GRADING_MODEL || GEMINI_MODEL;

// OCR hoá đơn chạy theo lô và không cần suy luận sâu — dùng bản flash rẻ hơn.
export const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL || "gemini-3.6-flash";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Cặp model để `generateWithRetry` thử lần lượt: chính trước, dự phòng sau.
 *
 * Nhận đúng phần cấu hình của `getGenerativeModel` trừ tên model, vì tên model
 * chính là thứ đang thay đổi giữa hai lượt thử.
 */
export function modelsWithFallback(
  config: Omit<Parameters<typeof genAI.getGenerativeModel>[0], "model">,
  /** Model chính, nếu muốn khác mặc định — ví dụ model chấm bài. */
  primary: string = GEMINI_MODEL
) {
  const names = [primary, GEMINI_MODEL, GEMINI_FALLBACK_MODEL].filter(
    (name, i, all) => name && all.indexOf(name) === i
  );
  return names.map((model) => genAI.getGenerativeModel({ ...config, model }));
}
