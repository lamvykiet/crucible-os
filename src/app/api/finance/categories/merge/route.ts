export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Gộp hai danh mục làm một.
//
// Khác với đổi tên: đổi tên là một danh mục mang tên mới, gộp là HAI danh mục
// chập vào một và một cái biến mất. Luồng đổi tên sẵn có chặn việc này bằng lỗi
// 409 "đã tồn tại", đúng — nhưng khi hai danh mục thật sự cùng bản chất
// ("Assets & Equipment" và "Home Appliances") thì chặn không giải quyết được gì.
//
// Vẫn là cái bẫy đã ghi trong AGENTS.md: bốn bảng khớp danh mục bằng CHUỖI chứ
// không bằng khoá ngoại. Gộp mà quên dời một bảng thì giao dịch trỏ tới nhóm
// không còn tồn tại, và dashboard đếm thiếu mà không báo lỗi gì. Nên toàn bộ
// nằm trong một $transaction: hỏng bước nào thì cuốn ngược sạch.

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { fromId, intoId } = await req.json();
    if (!fromId || !intoId) {
      return NextResponse.json(
        { success: false, error: "Thiếu fromId hoặc intoId" },
        { status: 400 }
      );
    }
    if (fromId === intoId) {
      return NextResponse.json(
        { success: false, error: "Không thể gộp một danh mục vào chính nó" },
        { status: 400 }
      );
    }

    const [from, into] = await Promise.all([
      prisma.category.findFirst({ where: { id: fromId, userId: user.id } }),
      prisma.category.findFirst({ where: { id: intoId, userId: user.id } }),
    ]);
    if (!from || !into) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy danh mục" },
        { status: 404 }
      );
    }
    if (from.kind !== into.kind) {
      return NextResponse.json(
        { success: false, error: "Hai danh mục khác loại (thu / chi)" },
        { status: 400 }
      );
    }
    // Nhóm cha chỉ gộp với nhóm cha, danh mục con chỉ gộp với danh mục con
    // cùng cha: hai cấp nằm ở hai cột khác nhau của Transaction
    // (`categoryGroup` và `subGroup`), trộn cấp là dời sai cột.
    if ((from.parentId ?? null) !== (into.parentId ?? null)) {
      return NextResponse.json(
        { success: false, error: "Chỉ gộp được hai danh mục cùng cấp" },
        { status: 400 }
      );
    }

    const isGroup = !from.parentId;
    const moved = await prisma.$transaction(async (tx) => {
      let transactions = 0;
      let budgets = 0;
      let vendors = 0;
      let rules = 0;
      let children = 0;
      let drafts = 0;

      if (isGroup) {
        transactions = (
          await tx.transaction.updateMany({
            where: { userId: user.id, categoryGroup: from.name },
            data: { categoryGroup: into.name },
          })
        ).count;
        budgets = (
          await tx.budget.updateMany({
            where: { userId: user.id, categoryGroup: from.name },
            data: { categoryGroup: into.name },
          })
        ).count;
        vendors = (
          await tx.vendor.updateMany({
            where: { defaultCategoryGroup: from.name },
            data: { defaultCategoryGroup: into.name },
          })
        ).count;
        rules = (
          await tx.classificationRule.updateMany({
            where: { categoryGroup: from.name },
            data: { categoryGroup: into.name },
          })
        ).count;
        // Bảng THỨ NĂM, không có trong danh sách bốn bảng của AGENTS.md: hoá
        // đơn quét đang chờ duyệt cũng giữ tên nhóm. Bỏ qua thì bản nháp mở ra
        // với ô nhóm trỏ tới một danh mục không còn tồn tại.
        drafts = (
          await tx.draftReceipt.updateMany({
            where: { userId: user.id, categoryGroup: from.name },
            data: { categoryGroup: into.name },
          })
        ).count;

        // Hai nhóm cùng đặt ngân sách cho một kỳ thì sau khi gộp thành hai dòng
        // cho cùng một nhóm — bảng Budget không có ràng buộc duy nhất nên DB
        // không chặn, nhưng mọi phép tính ngân sách sẽ cộng đôi. Cộng chúng lại
        // thành một dòng.
        const after = await tx.budget.findMany({
          where: { userId: user.id, categoryGroup: into.name },
        });
        const byPeriod = new Map<string, typeof after>();
        for (const b of after) {
          const key = `${b.periodType}|${b.period}`;
          byPeriod.set(key, [...(byPeriod.get(key) || []), b]);
        }
        for (const rows of byPeriod.values()) {
          if (rows.length < 2) continue;
          const total = rows.reduce((sum, b) => sum + b.amount, 0);
          await tx.budget.update({ where: { id: rows[0].id }, data: { amount: total } });
          await tx.budget.deleteMany({
            where: { id: { in: rows.slice(1).map((b) => b.id) } },
          });
        }

        // Danh mục con của nhóm bị gộp chuyển sang nhóm đích. Trùng tên với một
        // danh mục con sẵn có thì bỏ bản thừa đi — giao dịch khớp `subGroup`
        // bằng chuỗi nên chúng vốn đã trỏ đúng chỗ.
        const fromChildren = await tx.category.findMany({ where: { parentId: from.id } });
        const intoChildren = await tx.category.findMany({ where: { parentId: into.id } });
        const existing = new Set(intoChildren.map((c) => c.name.toLowerCase()));
        for (const child of fromChildren) {
          if (existing.has(child.name.toLowerCase())) {
            await tx.category.delete({ where: { id: child.id } });
          } else {
            await tx.category.update({ where: { id: child.id }, data: { parentId: into.id } });
            children += 1;
          }
        }
      } else {
        transactions = (
          await tx.transaction.updateMany({
            where: { userId: user.id, subGroup: from.name },
            data: { subGroup: into.name },
          })
        ).count;
        drafts = (
          await tx.draftReceipt.updateMany({
            where: { userId: user.id, subGroup: from.name },
            data: { subGroup: into.name },
          })
        ).count;
      }

      await tx.category.delete({ where: { id: from.id } });
      return { transactions, budgets, vendors, rules, drafts, children };
    });

    return NextResponse.json({
      success: true,
      data: { from: from.name, into: into.name, ...moved },
    });
  } catch (error) {
    console.error("Merge category error:", error);
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
