import { prisma } from "@/lib/prisma";

/**
 * Sổ lỗi sai — ghi mọi câu/thẻ đã làm sai, ở bất kỳ màn luyện nào.
 *
 * Học từ mục "Ôn lỗi sai" của aioenglish.com: chỗ mình sai mới là chỗ cần ôn,
 * nhưng mỗi màn tự giữ lỗi của riêng nó thì không ai gom lại. Bảng `MistakeItem`
 * gộp theo `(source, refKey)`: sai lại cùng câu thì tăng đếm, không thêm dòng.
 *
 * Một câu rời sổ khi làm đúng `CLEAR_STREAK` lần liên tiếp — đúng một lần có
 * thể là ăn may, vừa thấy đáp án xong gõ lại ngay thì càng dễ.
 */

export const CLEAR_STREAK = 2;

export type MistakeSource = "typing" | "translate" | "flashcard" | "dictation" | "collocation";

export interface MistakeInput {
  userId: string;
  languageId: string | null;
  langCode: string;
  source: MistakeSource;
  refKey: string;
  prompt: string;
  answer: string;
  lastWrong?: string | null;
}

/** Ghi một lần sai. Đã rời sổ mà sai lại thì quay lại sổ. */
export async function recordMistake(m: MistakeInput) {
  const lastWrong = m.lastWrong?.slice(0, 500) ?? null;
  await prisma.mistakeItem.upsert({
    where: { userId_source_refKey: { userId: m.userId, source: m.source, refKey: m.refKey } },
    create: {
      userId: m.userId,
      languageId: m.languageId,
      langCode: m.langCode,
      source: m.source,
      refKey: m.refKey,
      prompt: m.prompt.slice(0, 1000),
      answer: m.answer.slice(0, 1000),
      lastWrong,
    },
    update: {
      wrongCount: { increment: 1 },
      rightStreak: 0,
      resolvedAt: null,
      lastWrong,
      lastWrongAt: new Date(),
      // Câu gốc có thể đã được sửa (bộ AI tạo lại), giữ bản mới nhất.
      prompt: m.prompt.slice(0, 1000),
      answer: m.answer.slice(0, 1000),
    },
  });
}

/**
 * Ghi một lần đúng. Chỉ có tác dụng với câu đang nằm trong sổ; câu chưa từng
 * sai thì không đẻ dòng mới. Trả về true nếu lần này làm câu rời sổ.
 */
export async function recordRight(userId: string, source: MistakeSource, refKey: string) {
  const row = await prisma.mistakeItem.findUnique({
    where: { userId_source_refKey: { userId, source, refKey } },
    select: { id: true, rightStreak: true, resolvedAt: true },
  });
  if (!row || row.resolvedAt) return false;

  const streak = row.rightStreak + 1;
  const cleared = streak >= CLEAR_STREAK;
  await prisma.mistakeItem.update({
    where: { id: row.id },
    data: { rightStreak: streak, ...(cleared ? { resolvedAt: new Date() } : {}) },
  });
  return cleared;
}
