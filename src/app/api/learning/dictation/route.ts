import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dictationFor, findSet, compareLine } from "@/lib/dictationSets";

export const dynamic = "force-dynamic";

/**
 * Nghe chép chính tả.
 *
 * Không dùng AI: bộ câu soạn tay nằm trong code. Người học nghe đi nghe lại một
 * câu qua nhiều ngày và tiến độ khoá theo vị trí câu, nên câu phải ĐỨNG YÊN —
 * sinh mới mỗi lần mở là tiến độ thành vô nghĩa. Thêm nữa, hạn mức AI của dự án
 * tính theo ngày, mà chép chính tả là thứ người ta làm hàng chục câu một buổi.
 *
 * Chấm ở máy chủ. Câu đúng không nằm sẵn trong trang — muốn nghe thì xin từng
 * câu một qua `dictation/line`.
 */
async function resolveLang(userId: string, languageId?: string | null) {
  if (!languageId) return { code: "en", id: null as string | null };
  const language = await prisma.language.findFirst({
    where: { id: languageId, userId },
    select: { id: true, code: true },
  });
  return { code: language?.code ?? "en", id: language?.id ?? null };
}

/** Danh sách bộ câu của một thứ tiếng, kèm tiến độ. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const { code } = await resolveLang(user.id, params.get("languageId")?.trim());
    const pack = dictationFor(code);

    if (!pack) {
      return NextResponse.json({ success: true, code, pack: null, sets: [] });
    }

    const logs = await prisma.dictationLog.findMany({
      where: { userId: user.id, langCode: code },
      select: { setId: true, index: true, cleared: true, lastAccuracy: true, attempts: true },
    });

    const bySet = new Map<string, typeof logs>();
    for (const log of logs) {
      const list = bySet.get(log.setId) ?? [];
      list.push(log);
      bySet.set(log.setId, list);
    }

    return NextResponse.json({
      success: true,
      code,
      scale: pack.scale,
      levels: pack.levels,
      accepts: pack.accepts,
      sets: pack.sets.map((set) => {
        const mine = bySet.get(set.id) ?? [];
        return {
          id: set.id,
          title: set.title,
          level: set.level,
          note: set.note,
          total: set.lines.length,
          cleared: mine.filter((l) => l.cleared).length,
          // Câu KHÔNG gửi kèm ở đây: đây là màn chọn bộ, chưa cần tới chữ.
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được danh sách";
    console.error("Dictation list error:", error);
    return NextResponse.json({ success: false, error: message, sets: [] }, { status: 500 });
  }
}

/** Mở một bộ: trả số câu và tiến độ, KHÔNG trả chữ. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { languageId, setId } = await req.json();
    const { code } = await resolveLang(user.id, languageId);
    const found = findSet(code, String(setId ?? ""));

    if (!found) {
      return NextResponse.json({ success: false, error: "Không có bộ câu này" }, { status: 404 });
    }

    const logs = await prisma.dictationLog.findMany({
      where: { userId: user.id, langCode: code, setId: found.set.id },
      select: { index: true, cleared: true, lastAccuracy: true, attempts: true },
    });
    const byIndex = new Map(logs.map((l) => [l.index, l]));

    return NextResponse.json({
      success: true,
      set: {
        id: found.set.id,
        title: found.set.title,
        level: found.set.level,
        note: found.set.note,
        accepts: found.pack.accepts,
        lines: found.set.lines.map((_, index) => ({
          index,
          cleared: byIndex.get(index)?.cleared ?? false,
          lastAccuracy: byIndex.get(index)?.lastAccuracy ?? 0,
          attempts: byIndex.get(index)?.attempts ?? 0,
          // Chữ không có ở đây. Xin qua `dictation/line` lúc bấm phát.
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không mở được bộ câu";
    console.error("Dictation open error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Nộp một câu đã gõ. Chấm và ghi tiến độ. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { languageId, setId, index, input, firstTry } = await req.json();
    const { code, id } = await resolveLang(user.id, languageId);
    const found = findSet(code, String(setId ?? ""));

    if (!found) {
      return NextResponse.json({ success: false, error: "Không có bộ câu này" }, { status: 404 });
    }

    const at = Number(index);
    const line = found.set.lines[at];
    if (!line) {
      return NextResponse.json({ success: false, error: "Không có câu này" }, { status: 400 });
    }

    const typed = String(input ?? "");

    // Chấm theo CẢ HAI cách viết rồi lấy cách nào khớp hơn. Người gõ được chữ
    // Hán thì gõ chữ Hán, người chưa cài bộ gõ thì gõ phiên âm — cả hai đều là
    // nghe ra đúng câu, và đó mới là thứ bài này đo.
    const candidates = found.pack.accepts.map((kind) =>
      compareLine(typed, kind === "script" ? line.text : line.phonetic)
    );
    const best = candidates.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));

    await prisma.dictationLog.upsert({
      where: {
        userId_langCode_setId_index: {
          userId: user.id, langCode: code, setId: found.set.id, index: at,
        },
      },
      create: {
        userId: user.id,
        languageId: id,
        langCode: code,
        setId: found.set.id,
        index: at,
        attempts: 1,
        firstTry: best.perfect && firstTry ? 1 : 0,
        lastAccuracy: best.accuracy,
        cleared: best.perfect,
      },
      update: {
        attempts: { increment: 1 },
        ...(best.perfect && firstTry ? { firstTry: { increment: 1 } } : {}),
        lastAccuracy: best.accuracy,
        // Đã từng gõ đúng thì giữ luôn cờ, đừng bỏ đi khi lần sau gõ sai.
        ...(best.perfect ? { cleared: true } : {}),
        lastDoneAt: new Date(),
      },
    });

    if (id) {
      try {
        await prisma.skillProgress.upsert({
          where: { userId_languageId_skill: { userId: user.id, languageId: id, skill: "listening" } },
          create: {
            userId: user.id, languageId: id, skill: "listening",
            xp: best.perfect ? 4 : 1, lessonsDone: 1, lastPracticedAt: new Date(),
          },
          update: {
            xp: { increment: best.perfect ? 4 : 1 },
            lastPracticedAt: new Date(),
          },
        });
      } catch (progressError) {
        console.error("Skill progress write failed:", progressError);
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        accuracy: best.accuracy,
        perfect: best.perfect,
        correct: best.correct,
        total: best.total,
        extra: best.extra,
        marks: best.marks,
        // Giờ mới trả câu đúng — đã chấm xong nên không còn là gian lận.
        text: line.text,
        phonetic: line.phonetic,
        meaning: line.meaning,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không chấm được";
    console.error("Dictation grade error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
