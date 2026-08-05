import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Danh mục thu/chi thật của người dùng.
 *
 * Ba modal tài chính đang mỗi nơi giữ một mảng tiếng Anh viết cứng
 * ("Transport", "Bills & Utilities", "Health & Fitness"...) trong khi bảng
 * `Category` — nhập từ Google Sheet của hệ "Sổ Chi Tiêu" — dùng "Transportation",
 * "Utilities", "Health" và còn 8 nhóm nữa mà UI không hề có (Groceries,
 * Education, Subscription, Housing, Travel, Personal Care, Debt Payment,
 * Breakfast). Hệ quả: hoá đơn quét bằng OCR rơi vào một hệ danh mục song song,
 * dashboard và ngân sách đếm tách làm đôi.
 *
 * `kind` theo đúng quy ước hệ cũ: expense_group | income_group | transaction_type.
 * `parentId` khác null nghĩa là danh mục con (cây 2 cấp).
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const rows = await prisma.category.findMany({
      where: { userId: user.id, active: true },
      orderBy: { name: "asc" },
    });

    const byKind = (kind: string) => {
      const all = rows.filter((r) => r.kind === kind);
      return all
        .filter((r) => !r.parentId)
        .map((parent) => ({
          id: parent.id,
          name: parent.name,
          children: all.filter((c) => c.parentId === parent.id).map((c) => c.name),
        }));
    };

    return NextResponse.json({
      success: true,
      data: {
        expenseGroups: byKind("expense_group"),
        incomeGroups: byKind("income_group"),
        transactionTypes: rows.filter((r) => r.kind === "transaction_type").map((r) => r.name),
      },
    });
  } catch (error) {
    console.error("Failed to load categories:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
