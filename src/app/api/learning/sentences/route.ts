import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isSentenceMode, type SentenceMode } from "@/lib/sentences";
import { resolveLang, listSets, openSet } from "@/lib/sentenceSources";
import { recordMistake, recordRight } from "@/lib/mistakes";

export const dynamic = "force-dynamic";

/**
 * Kho câu cho Gõ câu (`mode=typing`) và Dịch câu (`mode=translate`).
 *
 * Khác bài chép chính tả, ở đây câu đúng ĐƯỢC gửi về trình duyệt: cả hai màn
 * lật ô chữ ngay lúc gõ, nên phải biết đáp án tại chỗ. Đây là bài tự luyện,
 * không phải bài thi — giấu đáp án chỉ làm màn hình chậm đi mà không chặn được ai.
 */

const SKILL: Record<SentenceMode, string> = { typing: "typing", translate: "translation" };

const key = (setId: string, index: number) => `${setId}#${index}`;

async function progressMap(userId: string, code: string, mode: SentenceMode) {
  const logs = await prisma.sentenceLog.findMany({
    where: { userId, langCode: code, mode },
    select: { setId: true, index: true, cleared: true, attempts: true, lastHints: true },
  });
  return new Map(logs.map((l) => [key(l.setId, l.index), l]));
}

/** Danh sách bộ câu kèm số câu đã qua ở màn này. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const mode = params.get("mode");
    if (!isSentenceMode(mode)) {
      return NextResponse.json({ success: false, error: "Thiếu chế độ luyện" }, { status: 400 });
    }
    const { code, id } = await resolveLang(user.id, params.get("languageId")?.trim());
    const [sets, progress] = await Promise.all([listSets(user.id, id, code), progressMap(user.id, code, mode)]);

    return NextResponse.json({
      success: true,
      code,
      sets: sets.map(({ refs, ...s }) => ({
        ...s,
        total: refs.length,
        cleared: refs.filter((r) => progress.get(key(r.setId, r.index))?.cleared).length,
      })),
    });
  } catch (error) {
    console.error("Sentence list error:", error);
    const message = error instanceof Error ? error.message : "Không đọc được danh sách";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Mở một bộ: trả đủ câu và tiến độ từng câu. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { languageId, setId, mode } = await req.json();
    if (!isSentenceMode(mode)) {
      return NextResponse.json({ success: false, error: "Thiếu chế độ luyện" }, { status: 400 });
    }
    const { code, id } = await resolveLang(user.id, languageId);
    const set = await openSet(user.id, id, code, String(setId ?? ""));
    if (!set) {
      return NextResponse.json({ success: false, error: "Không có bộ câu này" }, { status: 404 });
    }
    const progress = await progressMap(user.id, code, mode);

    return NextResponse.json({
      success: true,
      code,
      set: {
        ...set,
        sentences: set.sentences.map((s) => {
          const p = progress.get(key(s.ref.setId, s.ref.index));
          return { ...s, cleared: p?.cleared ?? false, attempts: p?.attempts ?? 0 };
        }),
      },
    });
  } catch (error) {
    console.error("Sentence open error:", error);
    const message = error instanceof Error ? error.message : "Không mở được bộ câu";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Ghi kết quả một câu.
 *
 * `perfect` = gõ trọn câu đúng mà không bấm xem đáp án. Có xin gợi ý từng chữ
 * thì vẫn qua câu, nhưng ít điểm hơn và không tính là "làm đúng" cho sổ lỗi sai.
 */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const mode = body.mode;
    if (!isSentenceMode(mode)) {
      return NextResponse.json({ success: false, error: "Thiếu chế độ luyện" }, { status: 400 });
    }
    const setId = String(body.setId ?? "").slice(0, 200);
    const index = Number(body.index);
    if (!setId || !Number.isInteger(index) || index < 0) {
      return NextResponse.json({ success: false, error: "Thiếu câu" }, { status: 400 });
    }

    const { code, id } = await resolveLang(user.id, body.languageId);
    const perfect = Boolean(body.perfect);
    const hints = Math.max(0, Math.min(100, Number(body.hints) || 0));
    const clean = perfect && hints === 0;

    await prisma.sentenceLog.upsert({
      where: { userId_langCode_setId_index_mode: { userId: user.id, langCode: code, setId, index, mode } },
      create: {
        userId: user.id, languageId: id, langCode: code, setId, index, mode,
        attempts: 1, cleared: perfect, lastHints: hints,
      },
      update: {
        attempts: { increment: 1 },
        lastHints: hints,
        ...(perfect ? { cleared: true } : {}),
        lastDoneAt: new Date(),
      },
    });

    const refKey = key(setId, index);
    let leftBook = false;
    if (clean) {
      leftBook = await recordRight(user.id, mode, refKey);
    } else if (typeof body.answer === "string" && typeof body.prompt === "string") {
      // Có xin gợi ý hay xem đáp án thì câu này mình chưa tự làm được — vào sổ.
      await recordMistake({
        userId: user.id, languageId: id, langCode: code, source: mode, refKey,
        prompt: body.prompt, answer: body.answer,
        lastWrong: typeof body.typed === "string" ? body.typed : null,
      });
    }

    if (id) {
      const xp = clean ? 3 : perfect ? 2 : 1;
      try {
        await prisma.skillProgress.upsert({
          where: { userId_languageId_skill: { userId: user.id, languageId: id, skill: SKILL[mode] } },
          create: {
            userId: user.id, languageId: id, skill: SKILL[mode],
            xp, lessonsDone: body.sessionEnd ? 1 : 0, lastPracticedAt: new Date(),
          },
          update: {
            xp: { increment: xp },
            ...(body.sessionEnd ? { lessonsDone: { increment: 1 } } : {}),
            lastPracticedAt: new Date(),
          },
        });
      } catch (progressError) {
        console.error("Skill progress write failed:", progressError);
      }
    }

    return NextResponse.json({ success: true, leftBook });
  } catch (error) {
    console.error("Sentence result error:", error);
    const message = error instanceof Error ? error.message : "Không ghi được kết quả";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
