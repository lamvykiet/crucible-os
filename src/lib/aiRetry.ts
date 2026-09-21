import type { GenerativeModel, Part } from "@google/generative-ai";

/**
 * Gọi AI có thử lại.
 *
 * Gemini thường xuyên trả 503 "This model is currently experiencing high
 * demand" — và chính thông báo đó nói tình trạng này là tạm thời. Bỏ cuộc ngay
 * lần đầu nghĩa là tính năng hỏng vì một cơn quá tải kéo dài vài giây.
 *
 * Chỉ thử lại với lỗi thoáng qua. Lỗi do mình (prompt sai, thiếu khoá, vượt
 * hạn mức) thì thử lại bao nhiêu lần cũng vẫn hỏng, chỉ tổ bắt người dùng chờ
 * lâu gấp ba.
 */

/** Những lỗi đáng thử lại: quá tải, quá nhịp, quá giờ, lỗi cổng. */
const TRANSIENT = /\b(429|500|502|503|504)\b|high demand|unavailable|timeout|deadline|overloaded|ECONNRESET|ETIMEDOUT/i;

export const isTransientAiError = (error: unknown) =>
  TRANSIENT.test(error instanceof Error ? error.message : String(error));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Options {
  /** Số lần gọi tối đa, tính cả lần đầu. */
  attempts?: number;
  /** Chờ bao lâu trước lần thử thứ hai; các lần sau nhân đôi. */
  baseDelayMs?: number;
  timeoutMs?: number;
  /**
   * Trần thời gian cho CẢ chuỗi thử lại.
   *
   * Thiếu nó thì 3 lượt × 25 giây hoá ra bắt người dùng ngồi chờ hơn một phút
   * trước khi biết là hỏng — đã đo được 42 giây trong một lần Gemini quá tải.
   * Hết ngân sách thì dừng, báo lỗi, để người dùng tự bấm thử lại.
   */
  totalBudgetMs?: number;
}

/**
 * Gọi `generateContent`, thử lại khi gặp lỗi thoáng qua.
 *
 * Giãn cách tăng gấp đôi và có nhiễu ngẫu nhiên: nếu nhiều request cùng hỏng
 * rồi cùng thử lại đúng một thời điểm thì chỉ làm cơn quá tải nặng thêm.
 */
export async function generateWithRetry(
  model: GenerativeModel,
  request: string | Array<string | Part>,
  { attempts = 3, baseDelayMs = 700, timeoutMs = 25_000, totalBudgetMs = 30_000 }: Options = {}
) {
  let lastError: unknown;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const spent = Date.now() - startedAt;
    if (spent >= totalBudgetMs) break;
    try {
      // Lượt cuối chỉ được dùng nốt phần ngân sách còn lại.
      const remaining = totalBudgetMs - (Date.now() - startedAt);
      return await model.generateContent(
        request as Parameters<GenerativeModel["generateContent"]>[0],
        { timeout: Math.min(timeoutMs, remaining) }
      );
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransientAiError(error)) throw error;

      const jitter = Math.random() * 250;
      const delay = baseDelayMs * 2 ** (attempt - 1) + jitter;
      if (Date.now() - startedAt + delay >= totalBudgetMs) break;
      await sleep(delay);
    }
  }

  // Thoát vòng vì hết ngân sách chứ không phải vì lỗi: lúc đó `lastError` còn
  // trống, và `throw undefined` sẽ ném ra thứ không ai đọc được.
  throw lastError ?? new Error("AI không phản hồi kịp, thử lại sau");
}
