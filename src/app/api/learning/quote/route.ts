import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import { promptLanguageName } from "@/lib/translationLanguages";
import { todayStart } from "@/lib/learningDay";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Chờ AI tối đa bao lâu.
 *
 * Câu trích là thứ trang trí, không phải nội dung chính — để nó giữ chân cả
 * trang là sai thứ tự ưu tiên. Đã gặp thật: Gemini báo 503 "quá tải" và request
 * treo 82 giây trước khi bỏ cuộc.
 */
const AI_TIMEOUT_MS = 12_000;

/**
 * Câu trích mỗi ngày.
 *
 * Sinh một lần rồi giữ lại cho cả ngày. Một câu phải đứng yên suốt ngày: mỗi
 * lần mở trang lại ra câu khác thì nó không còn là "câu hôm nay", và cũng tốn
 * một lượt gọi AI cho mỗi lần tải trang.
 *
 * Kèm bản dịch sang ngôn ngữ người dùng đã chọn — câu trích tiếng Anh mà không
 * hiểu thì chỉ là hình trang trí.
 */

const QUOTE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    text: { type: SchemaType.STRING, description: "Câu trích tiếng Anh, ngắn, dưới 20 từ" },
    translation: { type: SchemaType.STRING, description: "Bản dịch sang thứ tiếng được yêu cầu" },
    author: { type: SchemaType.STRING, nullable: true, description: "Tác giả, để trống nếu không chắc" },
  },
  required: ["text", "translation"],
};

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const quoteDate = todayStart();

    const existing = await prisma.dailyQuote.findUnique({
      where: { userId_quoteDate: { userId: user.id, quoteDate } },
    });
    if (existing) {
      return NextResponse.json({ success: true, quote: existing });
    }

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const meaningLang = promptLanguageName(pref?.translationLanguage);

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json", responseSchema: QUOTE_SCHEMA },
      systemInstruction: `Bạn chọn một câu trích tiếng Anh ngắn cho người đang học tiếng Anh.

- Câu dưới 20 từ, dùng từ vựng ở tầm trung cấp, không quá bóng bẩy.
- "translation" là bản dịch sang ${meaningLang}.
- Chỉ ghi "author" khi chắc chắn; không chắc thì để trống, đừng gán bừa cho
  người nổi tiếng — câu trích gán sai tác giả là thông tin sai.`,
    });

    const result = await model.generateContent(
      `Cho câu trích của ngày ${quoteDate.toISOString().slice(0, 10)}.`,
      { timeout: AI_TIMEOUT_MS }
    );
    const parsed = JSON.parse(result.response.text()) as {
      text?: string; translation?: string; author?: string | null;
    };

    if (!parsed.text?.trim()) {
      return NextResponse.json({ success: false, error: "Không lấy được câu trích" }, { status: 502 });
    }

    // `upsert` chứ không `create`: hai tab mở cùng lúc sẽ cùng thấy chưa có câu
    // và cùng gọi AI, rồi cái thứ hai đâm vào ràng buộc duy nhất.
    const quote = await prisma.dailyQuote.upsert({
      where: { userId_quoteDate: { userId: user.id, quoteDate } },
      create: {
        quoteDate,
        text: parsed.text.trim(),
        translation: parsed.translation?.trim() || null,
        author: parsed.author?.trim() || null,
        userId: user.id,
      },
      update: {},
    });

    return NextResponse.json({ success: true, quote });
  } catch (error) {
    // AI quá tải hoặc quá giờ là chuyện thoáng qua, không phải hỏng hóc. Trả
    // 200 kèm success:false để giao diện lặng lẽ ẩn khối này đi, thay vì 500
    // làm bẩn log và khiến trình duyệt tưởng cả trang có vấn đề.
    const message = error instanceof Error ? error.message : "Không lấy được câu trích";
    const transient = /503|429|timeout|deadline|unavailable/i.test(message);
    if (!transient) console.error("Daily quote error:", error);
    return NextResponse.json(
      { success: false, error: message, transient },
      { status: 200 }
    );
  }
}
