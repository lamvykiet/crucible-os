import { prisma } from "@/lib/prisma";

type Status = "OK" | "ERROR" | "INFO";

interface LogInput {
  userId: string;
  status: Status;
  message: string;
  fileId?: string | null;
  fileName?: string | null;
  durationMs?: number | null;
}

/**
 * Ghi một dòng nhật ký OCR.
 *
 * Không bao giờ ném lỗi ra ngoài: nhật ký hỏng thì cùng lắm là mất một dòng
 * log, không có lý do gì để nó làm đổ cả lượt quét hoá đơn của người dùng.
 */
export async function logOcr({ userId, status, message, fileId, fileName, durationMs }: LogInput) {
  try {
    await prisma.ocrLog.create({
      data: {
        userId,
        status,
        // Thông điệp lỗi của Gemini có thể rất dài; cắt bớt để một dòng log
        // không nuốt mất nửa màn hình nhật ký.
        message: message.slice(0, 1000),
        fileId: fileId ?? null,
        fileName: fileName ?? null,
        durationMs: durationMs ?? null,
      },
    });
  } catch (error) {
    console.error("Không ghi được OcrLog:", error);
  }
}
