/**
 * Đọc thành tiếng bằng bộ tổng hợp giọng nói của trình duyệt.
 *
 * Dùng `speechSynthesis` sẵn có thay vì gọi dịch vụ ngoài: không tốn tiền,
 * không cần khoá API, và chạy được cả khi mất mạng. Đổi lại, chất lượng giọng
 * phụ thuộc vào máy người dùng — máy không cài giọng tiếng Quảng thì câu tiếng
 * Quảng sẽ đọc bằng giọng mặc định, nghe sai. Vì vậy `hasVoiceFor()` có mặt để
 * giao diện biết mà ẩn phần luyện nghe đi thay vì phát ra thứ sai lệch.
 */

/** Mã ngôn ngữ của ứng dụng → mã BCP-47 mà trình duyệt hiểu. */
const BCP47: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
  cmn: "zh-CN",
  yue: "zh-HK",
  ko: "ko-KR",
};

export const toBcp47 = (code: string) => BCP47[code] ?? code;

/** Trình duyệt có hỗ trợ đọc không. */
export const speechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * Máy có giọng cho thứ tiếng này không.
 *
 * Danh sách giọng nạp không đồng bộ nên lần gọi đầu có thể trả về mảng rỗng;
 * bên gọi nên nghe sự kiện `voiceschanged` rồi hỏi lại.
 */
export function hasVoiceFor(code: string): boolean {
  if (!speechSupported()) return false;
  const target = toBcp47(code).toLowerCase();
  const base = target.split("-")[0];
  return window.speechSynthesis
    .getVoices()
    .some((v) => v.lang.toLowerCase().startsWith(base));
}

/** Chờ tới khi trình duyệt nạp xong danh sách giọng. */
export function whenVoicesReady(callback: () => void): () => void {
  if (!speechSupported()) return () => {};
  if (window.speechSynthesis.getVoices().length > 0) {
    callback();
    return () => {};
  }
  const handler = () => callback();
  window.speechSynthesis.addEventListener("voiceschanged", handler);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
}

/**
 * Đọc một đoạn.
 *
 * `rate` 0.5 dùng cho nút "phát chậm" — nghe rõ từng âm tiết, thứ cần thiết khi
 * học tiếng có thanh điệu.
 */
export function speak(text: string, code: string, rate = 1) {
  if (!speechSupported() || !text.trim()) return;

  // Bỏ câu đang đọc dở, nếu không bấm nhanh hai lần sẽ nghe chồng tiếng.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const target = toBcp47(code);
  utterance.lang = target;
  utterance.rate = rate;

  const base = target.toLowerCase().split("-")[0];
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase() === target.toLowerCase())
    ?? window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(base));
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

export const stopSpeaking = () => {
  if (speechSupported()) window.speechSynthesis.cancel();
};

/**
 * So đáp án gõ tay với đáp án đúng.
 *
 * Bỏ qua hoa/thường, khoảng trắng thừa và dấu câu ở hai đầu — gõ thiếu dấu chấm
 * không phải là học sai. Nhưng dấu thanh trong từ thì giữ nguyên: "má" khác
 * "mà", đó chính là thứ đang học.
 */
export function answerMatches(input: string, expected: string): boolean {
  const clean = (s: string) =>
    s.trim().toLowerCase().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, "").replace(/\s+/g, " ");
  return clean(input) === clean(expected);
}
