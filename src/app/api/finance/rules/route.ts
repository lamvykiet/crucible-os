import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { normalizeSupplier } from "@/lib/invoice";
import { MATCH_TYPES, MANUAL_RULE_PRIORITY, RULE_ORDER } from "@/lib/classify";

export const dynamic = "force-dynamic";

/** Danh sách quy tắc phân loại, kèm danh bạ nhà cung cấp đã tích luỹ. */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const [rules, vendors] = await Promise.all([
      prisma.classificationRule.findMany({ where: { userId: user.id }, orderBy: RULE_ORDER }),
      prisma.vendor.findMany({ where: { userId: user.id }, orderBy: { vendorName: "asc" } }),
    ]);

    return NextResponse.json({ success: true, rules, vendors });
  } catch (error) {
    console.error("List rules error:", error);
    return NextResponse.json({ success: false, error: "Server Error", rules: [], vendors: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { matchType, matchValue, transactionType, categoryGroup, subGroup, priority } = await req.json();

    if (!MATCH_TYPES.includes(matchType)) {
      return NextResponse.json({ success: false, error: "matchType không hợp lệ" }, { status: 400 });
    }
    if (!matchValue?.trim() || !categoryGroup?.trim()) {
      return NextResponse.json(
        { success: false, error: "Thiếu giá trị so khớp hoặc nhóm" },
        { status: 400 }
      );
    }

    // Chuẩn hoá ngay khi lưu, để lúc so khớp không phải xử lý dấu nữa.
    const normalized = normalizeSupplier(matchValue);
    if (!normalized) {
      return NextResponse.json(
        { success: false, error: "Giá trị so khớp phải có chữ hoặc số" },
        { status: 400 }
      );
    }

    const rule = await prisma.classificationRule.create({
      data: {
        matchType,
        matchValue: normalized,
        transactionType: transactionType || null,
        categoryGroup,
        subGroup: subGroup || null,
        priority: Number(priority) || MANUAL_RULE_PRIORITY,
        source: "manual",
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error("Create rule error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

/** Bật/tắt một quy tắc mà không xoá, giống nút toggle của hệ cũ. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, active } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const result = await prisma.classificationRule.updateMany({
      where: { id, userId: user.id },
      data: { active: Boolean(active) },
    });

    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy quy tắc" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Toggle rule error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    // deleteMany kèm userId: vừa là bộ lọc quyền, vừa tránh ném P2025 khi bản
    // ghi đã bị xoá ở một tab khác.
    const result = await prisma.classificationRule.deleteMany({ where: { id, userId: user.id } });

    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy quy tắc" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete rule error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
