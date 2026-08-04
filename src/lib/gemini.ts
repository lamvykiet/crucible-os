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
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// OCR hoá đơn chạy theo lô và không cần suy luận sâu — dùng bản flash rẻ hơn.
export const GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL || "gemini-3.6-flash";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
