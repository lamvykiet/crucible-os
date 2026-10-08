import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { applyProjectSplits, syncProjectLedger, ProjectSplitError } from "@/lib/projectLedger";
import { getDriveClient, moveFile, getOrCreateFolderIds, INVOICE_ROOT_FOLDER_ID } from "@/lib/drive";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { date, supplier, type, categoryGroup, subGroup, totalAmount, amount, paymentMethod, notes, source, driveFileIds, subtotal, tax, serviceCharge, discount, items, accountId, toAccountId, projectSplits } = body;

    const finalAmount = totalAmount || amount;

    if (!date || !type || !finalAmount) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const transactionId = `RCP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Giao dịch, phân bổ dự án và bút toán sổ cái dự án ghi chung một lần:
    // hỏng ở bước nào thì cả ba cùng huỷ.
    const transaction = await prisma.$transaction(async (tx) => {
     const created = await tx.transaction.create({
      data: {
        id: transactionId,
        userId: user.id,
        date: new Date(date),
        supplier: supplier || "N/A",
        type: type,
        categoryGroup: categoryGroup || "Other",
        subGroup: subGroup || null,
        subtotal: subtotal !== undefined ? Number(subtotal) : Number(finalAmount),
        tax: tax ? Number(tax) : 0,
        serviceCharge: serviceCharge ? Number(serviceCharge) : 0,
        discount: discount ? Number(discount) : 0,
        totalAmount: Number(finalAmount),
        paymentMethod: paymentMethod || "cash",
        // Tiền ra/vào tài khoản nào. Rỗng vẫn hợp lệ: giao dịch cũ và giao dịch
        // quét từ hoá đơn chưa chắc biết thẻ nào.
        accountId: accountId || null,
        toAccountId: toAccountId || null,
        source: source || "manual",
        driveFileId: driveFileIds ? (Array.isArray(driveFileIds) ? driveFileIds.join(",") : driveFileIds) : null,
        notes: notes || null,
        items: items && items.length > 0 ? {
          create: items.map((item: any, idx: number) => ({
            id: `ITM-${Date.now()}-${Math.floor(Math.random() * 10000) + idx}`,
            productName: item.productName,
            quantity: item.quantity ? Number(item.quantity) : 1,
            unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
            totalPrice: item.totalPrice ? Number(item.totalPrice) : 0
          }))
        } : undefined
      },
      include: {
        items: true
      }
     });
     await applyProjectSplits(tx, {
       userId: user.id,
       transactionId: created.id,
       type: created.type,
       totalAmount: created.totalAmount,
       rawSplits: projectSplits ?? [],
     });
     return created;
    });

    // If source is OCR and drive files exist, move them to Approved
    if (source === "ocr" && driveFileIds) {
      const drive = getDriveClient();
      const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
      const idsArray = Array.isArray(driveFileIds) ? driveFileIds : driveFileIds.split(",");
      for (const fileId of idsArray) {
        // Assume they are currently in Review or Incoming, we just move them to Approved
        try {
           // We might not know fromFolderId without fetching it, but drive.files.update requires removeParents.
           // Actually, we can get the file's current parents first.
           const fileMeta = await drive.files.get({ fileId, fields: "parents" });
           if (fileMeta.data.parents && fileMeta.data.parents.length > 0) {
             const currentParent = fileMeta.data.parents[0];
             await moveFile(drive, fileId, currentParent, folderIds.APPROVED);
           }
        } catch (e) {
           console.error("Failed to move file to Approved:", e);
        }
      }
    }

    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    if (error instanceof ProjectSplitError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("Failed to create transaction:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { id, date, supplier, type, categoryGroup, subGroup, totalAmount, amount, paymentMethod, notes, source, driveFileIds, subtotal, tax, serviceCharge, discount, items, accountId, toAccountId, projectSplits } = body;

    const finalAmount = totalAmount || amount;

    if (!id || !date || !type || !finalAmount) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const transaction = await prisma.$transaction(async (tx) => {
     // Delete existing items to recreate them
     if (items !== undefined) {
      await tx.transactionLine.deleteMany({
        where: { transactionId: id }
      });
     }

     const updated = await tx.transaction.update({
      where: {
        id: id
      },
      data: {
        date: new Date(date),
        supplier: supplier || "N/A",
        type: type,
        categoryGroup: categoryGroup || "Other",
        subGroup: subGroup || null,
        subtotal: subtotal !== undefined ? Number(subtotal) : Number(finalAmount),
        tax: tax ? Number(tax) : 0,
        serviceCharge: serviceCharge ? Number(serviceCharge) : 0,
        discount: discount ? Number(discount) : 0,
        totalAmount: Number(finalAmount),
        paymentMethod: paymentMethod || "cash",
        // Chỉ đụng khoá ngoại khi form CÓ gửi chúng. Form nào không biết tới
        // một trường (gửi thiếu khoá) thì giữ nguyên giá trị trong DB — đừng
        // coi "không gửi" là "xoá đi". Chuỗi rỗng mới là bỏ gắn. Phân bổ dự án
        // theo cùng luật, ở `applyProjectSplits` bên dưới.
        ...("accountId" in body && { accountId: accountId || null }),
        ...("toAccountId" in body && { toAccountId: toAccountId || null }),
        source: source || "manual",
        ...(driveFileIds !== undefined && { driveFileId: Array.isArray(driveFileIds) ? driveFileIds.join(",") : driveFileIds }),
        notes: notes || null,
        ...(items !== undefined && {
          items: {
            create: items.map((item: any, idx: number) => ({
              id: `ITM-${Date.now()}-${Math.floor(Math.random() * 10000) + idx}`,
              productName: item.productName,
              quantity: item.quantity ? Number(item.quantity) : 1,
              unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
              totalPrice: item.totalPrice ? Number(item.totalPrice) : 0
            }))
          }
        })
      },
      include: {
        items: true
      }
     });
     await applyProjectSplits(tx, {
       userId: user.id,
       transactionId: updated.id,
       type: updated.type,
       totalAmount: updated.totalAmount,
       rawSplits: "projectSplits" in body ? projectSplits ?? [] : undefined,
     });
     return updated;
    });

    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    if (error instanceof ProjectSplitError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("Failed to update transaction:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing transaction ID" }, { status: 400 });
    }

    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // Xoá giao dịch thì phân bổ đi theo (cascade), còn sổ cái dự án nhận bút
    // toán đảo — dòng cũ không bao giờ bị xoá.
    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } });
      await syncProjectLedger(tx, user.id, [id]);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
