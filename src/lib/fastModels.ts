/**
 * Chuỗi model NHANH cho các lượt viết dài của phần học tiếng (soạn bài đọc, dịch
 * cả bài, ra đề kiểm tra, soạn bộ câu, chép phụ đề video).
 *
 * Đo 19/11/2026 trên Vercel: với chuỗi mặc định của `modelsWithFallback`, soạn
 * bài đọc 300 từ kèm bản dịch và chép 3 phút video đều bị ngắt ở giây ~55 (quá
 * giới hạn 60 giây của hàm). `gemini-2.5-flash` làm cùng việc trong 16–31 giây.
 * Dự phòng xếp theo tốc độ, giống chuỗi OCR (`GEMINI_VISION_CHAIN`).
 *
 * Đặt riêng ở đây thay vì đổi `GEMINI_MODEL` dùng chung: các chức năng khác đã
 * đo và chọn model của chúng.
 */
export const FAST_MODEL = process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash";
export const FAST_FALLBACKS = ["gemini-2.5-flash-lite", "gemini-3.6-flash"];
