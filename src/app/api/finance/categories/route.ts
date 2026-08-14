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
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    // Màn hình quản lý cần thấy cả danh mục đã tắt; các form nhập liệu thì chỉ
    // muốn danh mục đang bật.
    const includeInactive = new URL(req.url).searchParams.get("all") === "1";

    const rows = await prisma.category.findMany({
      where: { userId: user.id, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: "asc" },
    });

    // `name` (tiếng Anh) là giá trị CHUẨN được lưu vào Transaction/Budget;
    // `nameVi` chỉ để hiển thị. Trả cả hai để giao diện tự chọn theo ngôn ngữ,
    // nhưng giá trị ghi xuống DB thì luôn là `name`.
    const byKind = (kind: string) => {
      const all = rows.filter((r) => r.kind === kind);
      return all
        .filter((r) => !r.parentId)
        .map((parent) => ({
          id: parent.id,
          name: parent.name,
          nameVi: parent.nameVi,
          children: all
            .filter((c) => c.parentId === parent.id)
            .map((c) => ({ id: c.id, name: c.name, nameVi: c.nameVi })),
        }));
    };

    return NextResponse.json({
      success: true,
      data: {
        expenseGroups: byKind("expense_group"),
        incomeGroups: byKind("income_group"),
        transactionTypes: rows.filter((r) => r.kind === "transaction_type").map((r) => r.name),
        // Dạng phẳng, kèm cờ active — dùng cho màn hình quản lý danh mục.
        all: rows.map((r) => ({
          id: r.id, kind: r.kind, name: r.name, nameVi: r.nameVi,
          active: r.active, parentId: r.parentId,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load categories:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

const KINDS = ["expense_group", "income_group", "transaction_type"];

/** Thêm một danh mục (hoặc danh mục con nếu truyền parentId). */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { kind, name, nameVi, parentId } = await req.json();
    const cleaned = String(name ?? "").trim();
    const cleanedVi = String(nameVi ?? "").trim() || null;

    if (!KINDS.includes(kind)) {
      return NextResponse.json({ success: false, error: "kind không hợp lệ" }, { status: 400 });
    }
    if (!cleaned) {
      return NextResponse.json({ success: false, error: "Chưa nhập tên danh mục" }, { status: 400 });
    }

    // Trùng tên trong cùng nhóm là lỗi im lặng tệ nhất: giao dịch sẽ chia đôi
    // giữa hai danh mục trông y hệt nhau trên báo cáo.
    const duplicate = await prisma.category.findFirst({
      where: { userId: user.id, kind, name: { equals: cleaned, mode: "insensitive" } },
    });
    if (duplicate) {
      return NextResponse.json({ success: false, error: `"${cleaned}" đã tồn tại` }, { status: 409 });
    }

    if (parentId) {
      const parent = await prisma.category.findFirst({ where: { id: parentId, userId: user.id } });
      if (!parent) {
        return NextResponse.json({ success: false, error: "Danh mục cha không tồn tại" }, { status: 400 });
      }
      if (parent.parentId) {
        return NextResponse.json({ success: false, error: "Chỉ hỗ trợ cây 2 cấp" }, { status: 400 });
      }
    }

    const category = await prisma.category.create({
      data: { kind, name: cleaned, nameVi: cleanedVi, parentId: parentId || null, userId: user.id },
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tạo được danh mục";
    console.error("Create category error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Sửa một danh mục: bật/tắt, đổi nhãn tiếng Việt, hoặc đổi tên chuẩn.
 *
 * Tắt là cách "xoá" an toàn cho danh mục đang có dữ liệu.
 *
 * Đổi `name` là việc nguy hiểm: bốn bảng khớp với nó bằng chuỗi chứ không bằng
 * khoá ngoại, nên đổi mỗi bảng Category sẽ để lại giao dịch trỏ tới một nhóm
 * không còn tồn tại — dashboard đếm thiếu mà không báo lỗi. Vì vậy đổi tên
 * được thực hiện trong một transaction, dời hết dữ liệu rồi mới đổi.
 * Sửa `nameVi` thì vô hại: nó chỉ là nhãn hiển thị.
 */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, active, name, nameVi } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const current = await prisma.category.findFirst({ where: { id, userId: user.id } });
    if (!current) {
      return NextResponse.json({ success: false, error: "Không tìm thấy danh mục" }, { status: 404 });
    }

    const data: { active?: boolean; name?: string; nameVi?: string | null } = {};
    if (active !== undefined) data.active = Boolean(active);
    if (nameVi !== undefined) data.nameVi = String(nameVi ?? "").trim() || null;

    const newName = name === undefined ? null : String(name).trim();
    if (newName !== null && !newName) {
      return NextResponse.json({ success: false, error: "Tên không được để trống" }, { status: 400 });
    }

    const renaming = newName !== null && newName !== current.name;
    if (renaming) {
      const duplicate = await prisma.category.findFirst({
        where: {
          userId: user.id, kind: current.kind, id: { not: id },
          name: { equals: newName, mode: "insensitive" },
        },
      });
      if (duplicate) {
        return NextResponse.json({ success: false, error: `"${newName}" đã tồn tại` }, { status: 409 });
      }
      data.name = newName;
    }

    await prisma.$transaction(async (tx) => {
      // Dời dữ liệu trước, đổi tên sau: nếu bước sau hỏng thì transaction cuốn
      // ngược lại toàn bộ, không để lại trạng thái nửa vời.
      if (renaming && !current.parentId) {
        const from = current.name;
        await tx.transaction.updateMany({
          where: { userId: user.id, categoryGroup: from }, data: { categoryGroup: newName },
        });
        await tx.budget.updateMany({
          where: { userId: user.id, categoryGroup: from }, data: { categoryGroup: newName },
        });
        await tx.vendor.updateMany({
          where: { defaultCategoryGroup: from }, data: { defaultCategoryGroup: newName },
        });
        await tx.classificationRule.updateMany({
          where: { categoryGroup: from }, data: { categoryGroup: newName },
        });
      } else if (renaming) {
        // Danh mục con nằm ở cột subGroup của Transaction.
        await tx.transaction.updateMany({
          where: { userId: user.id, subGroup: current.name }, data: { subGroup: newName },
        });
      }

      await tx.category.update({ where: { id }, data });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

/**
 * Xoá hẳn một danh mục — chỉ khi nó chưa dính vào dữ liệu nào.
 *
 * Cùng ba rào chắn của hệ "Sổ Chi Tiêu": còn danh mục con, đang có giao dịch,
 * hoặc đang có ngân sách thì từ chối và gợi ý tắt thay vì xoá. Xoá bừa ở đây sẽ
 * để lại giao dịch trỏ tới một nhóm không còn tồn tại.
 */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const category = await prisma.category.findFirst({ where: { id, userId: user.id } });
    if (!category) {
      return NextResponse.json({ success: false, error: "Không tìm thấy danh mục" }, { status: 404 });
    }

    const [children, transactions, budgets] = await Promise.all([
      prisma.category.count({ where: { parentId: id } }),
      prisma.transaction.count({ where: { userId: user.id, categoryGroup: category.name } }),
      prisma.budget.count({ where: { userId: user.id, categoryGroup: category.name } }),
    ]);

    if (children > 0) {
      return NextResponse.json(
        { success: false, error: `Còn ${children} danh mục con — xoá chúng trước.` },
        { status: 409 }
      );
    }
    if (transactions > 0 || budgets > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Đang được dùng bởi ${transactions} giao dịch và ${budgets} ngân sách. Hãy TẮT thay vì xoá.`,
          inUse: true,
        },
        { status: 409 }
      );
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
