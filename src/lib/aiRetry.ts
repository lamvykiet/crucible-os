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

/**
 * Hết hạn mức THEO NGÀY — không phải lỗi thoáng qua.
 *
 * Gói miễn phí của Gemini chặn theo ngày (đo ngày 24/09/2026: 20 lượt mỗi ngày
 * cho mỗi model). Lỗi đó cũng mang mã 429 như lúc quá nhịp, nên nếu chỉ soi mã
 * số thì mã sẽ thử lại ba lần một việc không thể thành công, rồi báo "thử lại
 * sau" trong khi hôm nay thử lại bao nhiêu lần cũng vẫn hỏng.
 *
 * Phân biệt bằng chính `quotaId` mà Google trả về: hạn mức theo ngày có chữ
 * `PerDay`, còn hạn mức theo phút thì không.
 */
const DAILY_QUOTA = /PerDay|RequestsPerDay|free_tier_requests/i;

export const isDailyQuotaError = (error: unknown) =>
  DAILY_QUOTA.test(error instanceof Error ? error.message : String(error));

export const isTransientAiError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (DAILY_QUOTA.test(message)) return false;
  return TRANSIENT.test(message);
};

/**
 * Câu báo lỗi cho người dùng, thay cho nguyên văn thông báo của Google.
 *
 * Thông báo gốc dài, toàn tiếng Anh lẫn JSON, và không nói người dùng phải làm
 * gì. Hết hạn mức ngày là việc chỉ sửa được ở phía tài khoản, nên phải nói
 * thẳng ra chứ không giấu sau chữ "thử lại sau".
 */
export function aiErrorMessage(error: unknown): string {
  if (isDailyQuotaError(error)) {
    return "Đã hết hạn mức AI miễn phí trong ngày trên MỌI model dự phòng. Bật thanh toán cho khoá ở Google AI Studio, hoặc chờ sang ngày mới.";
  }
  if (isTransientAiError(error)) {
    return "AI đang quá tải, thử lại sau một lát.";
  }
  return error instanceof Error ? error.message : "AI không phản hồi được";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Options {
  /**
   * Số lần gọi tối đa, tính cả lần đầu.
   *
   * Bỏ trống thì lấy đúng bằng độ dài chuỗi model (tối thiểu 3), để lượt nào
   * cũng còn model mới mà thử.
   */
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
  /**
   * Một model, hoặc danh sách model thử theo thứ tự.
   *
   * Đổi hẳn sang model khác mới là cách chữa đúng, vì hai lý do khác nhau:
   *
   * - **Quá tải** là chuyện của từng model: sự cố 22/09 là riêng
   *   `gemini-3.6-flash` trả 503 trong khi `gemini-2.5-flash` vẫn chạy tốt.
   * - **Hạn mức gói miễn phí tính theo TỪNG MODEL**, không theo khoá. Đo ngày
   *   25/09/2026: `gemini-2.5-flash` cạn 20 lượt/ngày và trả 429, cùng lúc đó
   *   `gemini-3.6-flash` và `gemini-2.5-flash-lite` vẫn chạy.
   */
  models: GenerativeModel | GenerativeModel[],
  request: string | Array<string | Part>,
  { attempts, baseDelayMs = 700, timeoutMs = 25_000, totalBudgetMs = 30_000 }: Options = {}
) {
  const chain = Array.isArray(models) ? models : [models];
  if (chain.length === 0) throw new Error("Chưa cấu hình model nào");

  // Ít nhất phải đủ lượt để đi hết chuỗi model, nếu không thì có model dự phòng
  // mà không bao giờ dùng tới.
  const maxAttempts = attempts ?? Math.max(3, chain.length);

  let lastError: unknown;
  let modelIndex = 0;
  const startedAt = Date.now();

  /**
   * Thời gian đã tiêu vào việc va phải model cạn hạn mức.
   *
   * KHÔNG tính vào ngân sách: nhảy model không phải một lượt thử mà chỉ là dò
   * xem model nào còn chỗ, và nó trả lời trong khoảng một giây. Tính vào ngân
   * sách thì với chuỗi năm model, chỉ riêng việc dò đã ăn hết phần thời gian
   * đáng lẽ dành cho lượt gọi thật.
   */
  let skippedMs = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const spent = Date.now() - startedAt - skippedMs;
    if (spent >= totalBudgetMs) break;

    const model = chain[Math.min(modelIndex, chain.length - 1)];
    const attemptStartedAt = Date.now();

    try {
      // Lượt này chỉ được dùng nốt phần ngân sách còn lại.
      const remaining = totalBudgetMs - (Date.now() - startedAt - skippedMs);
      return await model.generateContent(
        request as Parameters<GenerativeModel["generateContent"]>[0],
        { timeout: Math.min(timeoutMs, remaining) }
      );
    } catch (error) {
      lastError = error;

      // Cạn hạn mức NGÀY của model này: chờ bao lâu cũng vô ích, nhưng model
      // khác thì còn hạn mức riêng. Nhảy sang model kế tiếp ngay, không chờ.
      // Hết sạch chuỗi mới chịu thua.
      if (isDailyQuotaError(error)) {
        skippedMs += Date.now() - attemptStartedAt;
        modelIndex += 1;
        if (modelIndex >= chain.length) throw error;
        // Không tính là một lượt thử: lượt này chưa gọi được model nào.
        attempt -= 1;
        continue;
      }

      if (attempt === maxAttempts || !isTransientAiError(error)) throw error;

      // Quá tải thì vừa lùi sang model khác vừa giãn cách — nhiễu ngẫu nhiên để
      // nhiều request cùng hỏng không cùng thử lại đúng một thời điểm.
      modelIndex += 1;
      const jitter = Math.random() * 250;
      const delay = baseDelayMs * 2 ** (attempt - 1) + jitter;
      if (Date.now() - startedAt - skippedMs + delay >= totalBudgetMs) break;
      await sleep(delay);
    }
  }

  // Thoát vòng vì hết ngân sách chứ không phải vì lỗi: lúc đó `lastError` còn
  // trống, và `throw undefined` sẽ ném ra thứ không ai đọc được.
  throw lastError ?? new Error("AI không phản hồi kịp, thử lại sau");
}
