import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { collocationsFor, findCollocationSet, checkAnswer } from "@/lib/collocationSets";

export const dynamic = "force-dynamic";

/**
 * Kết hợp từ, cụm động từ, cấu tạo từ, giới từ.
 *
 * Không dùng AI: đây là dữ kiện về tiếng Anh và phải ổn định. Chấm ở máy chủ —
 * đáp án không gửi xuống trình duyệt lúc phát đề, chỉ trả về sau khi đã chấm.
 */
async function resolveLang(userId: string, languageId?: string | null) {
  if (!languageId) return { code: "en", id: null as string | null };
  const language = await prisma.language.findFirst({
    where: { id: languageId, userId },
    select: { id: true, code: true },
  });
  return { code: language?.code ?? "en", id: language?.id ?? null };
}

/** Danh sách bộ, kèm tiến độ. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = new URL(req.url).searchParams;
  const { code } = await resolveLang(user.id, params.get("languageId")?.trim());
  const pack = collocationsFor(code);

  if (!pack) return NextResponse.json({ success: true, code, sets: [] });

  const logs = await prisma.collocationLog.findMany({
    where: { userId: user.id, langCode: code },
    select: { setId: true, cleared: true },
  });

  const clearedBySet = new Map<string, number>();
  for (const log of logs) {
    if (log.cleared) clearedBySet.set(log.setId, (clearedBySet.get(log.setId) ?? 0) + 1);
  }

  return NextResponse.json({
    success: true,
    code,
    scale: pack.scale,
    levels: pack.levels,
    references: pack.references ?? [],
    sets: pack.sets.map((set) => ({
      id: set.id,
      title: set.title,
      kind: set.kind,
      level: set.level,
      note: set.note,
      total: set.items.length,
      cleared: clearedBySet.get(set.id) ?? 0,
    })),
  });
}

/** Mở một bộ: trả câu có chỗ trống, KHÔNG trả đáp án. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { languageId, setId } = await req.json();
  const { code } = await resolveLang(user.id, languageId);
  const found = findCollocationSet(code, String(setId ?? ""));

  if (!found) {
    return NextResponse.json({ success: false, error: "Không có bộ này" }, { status: 404 });
  }

  const logs = await prisma.collocationLog.findMany({
    where: { userId: user.id, langCode: code, setId: found.set.id },
    select: { index: true, cleared: true },
  });
  const cleared = new Set(logs.filter((l) => l.cleared).map((l) => l.index));

  return NextResponse.json({
    success: true,
    set: {
      id: found.set.id,
      title: found.set.title,
      kind: found.set.kind,
      note: found.set.note,
      items: found.set.items.map((item, index) => ({
        index,
        sentence: item.sentence,
        cleared: cleared.has(index),
        // `answer` và `note` giữ lại tới lúc chấm.
      })),
    },
  });
}

/** Nộp một câu. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { languageId, setId, index, input } = await req.json();
  const { code, id } = await resolveLang(user.id, languageId);
  const found = findCollocationSet(code, String(setId ?? ""));
  const item = found?.set.items[Number(index)];

  if (!found || !item) {
    return NextResponse.json({ success: false, error: "Không có câu này" }, { status: 404 });
  }

  const graded = checkAnswer(String(input ?? ""), item);

  await prisma.collocationLog.upsert({
    where: {
      userId_langCode_setId_index: {
        userId: user.id, langCode: code, setId: found.set.id, index: Number(index),
      },
    },
    create: {
      userId: user.id, languageId: id, langCode: code,
      setId: found.set.id, index: Number(index),
      attempts: 1, cleared: graded.correct,
    },
    update: {
      attempts: { increment: 1 },
      // Đã từng đúng thì giữ cờ, đừng bỏ khi lần sau gõ sai.
      ...(graded.correct ? { cleared: true } : {}),
      lastDoneAt: new Date(),
    },
  });

  if (id) {
    try {
      await prisma.skillProgress.upsert({
        where: { userId_languageId_skill: { userId: user.id, languageId: id, skill: "vocabulary" } },
        create: {
          userId: user.id, languageId: id, skill: "vocabulary",
          xp: graded.correct ? 3 : 1, lessonsDone: 1, lastPracticedAt: new Date(),
        },
        update: { xp: { increment: graded.correct ? 3 : 1 }, lastPracticedAt: new Date() },
      });
    } catch (progressError) {
      console.error("Skill progress write failed:", progressError);
    }
  }

  return NextResponse.json({
    success: true,
    result: { correct: graded.correct, answer: item.answer, note: item.note, alt: item.alt ?? [] },
  });
}
