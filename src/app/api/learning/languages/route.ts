import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { LANGUAGE_PRESETS, presetByCode } from "@/lib/languagePresets";

export const dynamic = "force-dynamic";

/**
 * Các thứ tiếng người dùng đang học.
 *
 * Trả kèm `presets` để giao diện gợi ý những tiếng chưa thêm — nhưng không tự
 * chèn dòng nào: danh sách học là do người dùng chọn, không phải do code đoán.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const languages = await prisma.language.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { decks: true, items: true } },
      },
    });

    const taken = new Set(languages.map((l) => l.code));

    return NextResponse.json({
      success: true,
      languages: languages.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        nativeName: l.nativeName,
        script: l.script,
        phoneticSystem: l.phoneticSystem,
        hasTones: l.hasTones,
        toneCount: l.toneCount,
        levelScale: l.levelScale,
        active: l.active,
        deckCount: l._count.decks,
        itemCount: l._count.items,
      })),
      // Những tiếng còn thêm được
      presets: LANGUAGE_PRESETS.filter((p) => !taken.has(p.code)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được danh sách ngôn ngữ";
    console.error("List languages error:", error);
    return NextResponse.json({ success: false, error: message, languages: [], presets: [] }, { status: 500 });
  }
}

/** Thêm một thứ tiếng, từ mẫu có sẵn hoặc tự khai báo. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const code = String(body.code ?? "").trim();
    if (!code) {
      return NextResponse.json({ success: false, error: "Thiếu mã ngôn ngữ" }, { status: 400 });
    }

    const preset = presetByCode(code);
    // Tiếng tự khai báo thì phải tự nói rõ quy ước của nó; thiếu thì lấy mặc
    // định chữ Latin + IPA, đúng với phần lớn tiếng châu Âu.
    const name = String(body.name ?? preset?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Thiếu tên ngôn ngữ" }, { status: 400 });
    }

    const count = await prisma.language.count({ where: { userId: user.id } });

    const language = await prisma.language.create({
      data: {
        code,
        name,
        nativeName: body.nativeName ?? preset?.nativeName ?? null,
        script: body.script ?? preset?.script ?? "latin",
        phoneticSystem: body.phoneticSystem ?? preset?.phoneticSystem ?? "ipa",
        hasTones: body.hasTones ?? preset?.hasTones ?? false,
        toneCount: body.toneCount ?? preset?.toneCount ?? 0,
        levelScale: body.levelScale ?? preset?.levelScale ?? "CEFR",
        sortOrder: count,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, language });
  } catch (error) {
    // @@unique([userId, code]) chặn thêm trùng một thứ tiếng hai lần.
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Bạn đã thêm thứ tiếng này rồi"
        : error instanceof Error
          ? error.message
          : "Không thêm được ngôn ngữ";
    console.error("Create language error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

/** Đổi tên, bật/tắt, hoặc sửa quy ước của một thứ tiếng. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, ...rest } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const owned = await prisma.language.findFirst({ where: { id, userId: user.id } });
    if (!owned) {
      return NextResponse.json({ success: false, error: "Không tìm thấy ngôn ngữ" }, { status: 404 });
    }

    // Chỉ nhận đúng những trường được phép sửa, tránh ghi đè userId từ body.
    const allowed = [
      "name", "nativeName", "script", "phoneticSystem",
      "hasTones", "toneCount", "levelScale", "active", "sortOrder",
    ] as const;
    const data = Object.fromEntries(
      allowed.filter((k) => rest[k] !== undefined).map((k) => [k, rest[k]])
    );

    const language = await prisma.language.update({ where: { id }, data });
    return NextResponse.json({ success: true, language });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không sửa được";
    console.error("Update language error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Bỏ một thứ tiếng khỏi danh sách học.
 *
 * Bộ thẻ của nó bị xoá theo (onDelete: Cascade), nhưng các mục từ vựng thì
 * KHÔNG — `DictionaryItem.languageId` chỉ bị gỡ về null. Xoá nhầm một thứ tiếng
 * mà mất luôn hàng trăm từ đã nhập thì quá đắt cho một cú bấm.
 */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const result = await prisma.language.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy ngôn ngữ" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete language error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
