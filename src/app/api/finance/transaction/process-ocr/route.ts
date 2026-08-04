import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDriveClient, moveFile, deleteFile, getOrCreateFolderIds, INVOICE_ROOT_FOLDER_ID } from "@/lib/drive";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { draftFileId, driveFileIds, formData, items } = body;
    const { date, supplier, type, categoryGroup, subtotal, tax, discount, totalAmount } = formData;

    if (!date || !type || !totalAmount) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);

    // 1. Move to Processing temporarily (as requested by user)
    const idsArray = Array.isArray(driveFileIds) ? driveFileIds : [driveFileIds];
    for (const fileId of idsArray) {
      try {
        const fileMeta = await drive.files.get({ fileId, fields: "parents" });
        if (fileMeta.data.parents && fileMeta.data.parents.length > 0) {
          await moveFile(drive, fileId, fileMeta.data.parents[0], folderIds.PROCESSING);
        }
      } catch (e) {
        console.error("Failed to move to processing:", e);
      }
    }

    // 2. Check duplicate (Date + Total Amount exactly matching for this user)
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const duplicate = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        totalAmount: Number(totalAmount),
        date: {
          gte: startDate,
          lte: endDate,
        },
      }
    });

    if (duplicate) {
      // User requirement: if duplicate, delete image and processing data -> end.
      for (const fileId of idsArray) {
        await deleteFile(drive, fileId);
      }
      if (draftFileId) {
        await deleteFile(drive, draftFileId); // Delete the JSON draft too
      }
      
      return NextResponse.json({ 
        success: false, 
        isDuplicate: true, 
        duplicateData: duplicate,
        message: "Phát hiện trùng lặp. Đã tự động xóa file tải lên." 
      });
    }

    // 3. Generate Sequence IDs
    // Find count of transactions today for this user to generate XXXX
    const now = new Date();
    // Using startOfDay and endOfDay in UTC to match how typical JS servers treat DB inserts, 
    // or passing the user's timezone if possible. For simplicity, just bounding by the current 24-hr period using simple math.
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const countToday = await prisma.transaction.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        }
      }
    });
    
    // Format timestamp part (we use current unix timestamp as requested)
    const timestamp = Date.now().toString();
    const seqTransaction = String(countToday + 1).padStart(4, '0');
    const transactionId = `RCP-${timestamp}-${seqTransaction}`;

    // 4. Save to Database
    const transaction = await prisma.transaction.create({
      data: {
        id: transactionId,
        userId: user.id,
        date: new Date(date),
        supplier: supplier || "N/A",
        type: type,
        categoryGroup: categoryGroup || "Other",
        subtotal: subtotal ? Number(subtotal) : Number(totalAmount),
        tax: tax ? Number(tax) : 0,
        discount: discount ? Number(discount) : 0,
        totalAmount: Number(totalAmount),
        paymentMethod: "cash",
        source: "ocr",
        driveFileId: idsArray.join(","),
        items: items && items.length > 0 ? {
          create: items.map((item: any, idx: number) => {
            const seqItem = String(idx + 1).padStart(4, '0');
            return {
              id: `ITM-${timestamp}-${seqItem}`,
              productName: item.productName,
              quantity: item.quantity ? Number(item.quantity) : 1,
              unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
              totalPrice: item.totalPrice ? Number(item.totalPrice) : 0
            };
          })
        } : undefined
      }
    });

    // 5. Move to Approved
    for (const fileId of idsArray) {
      try {
        const fileMeta = await drive.files.get({ fileId, fields: "parents" });
        if (fileMeta.data.parents && fileMeta.data.parents.length > 0) {
          await moveFile(drive, fileId, fileMeta.data.parents[0], folderIds.APPROVED);
        }
      } catch (e) {
        console.error("Failed to move to approved:", e);
      }
    }
    
    // Delete the temporary draft JSON file now that it's processed
    if (draftFileId) {
      await deleteFile(drive, draftFileId);
    }

    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    console.error("Failed to process OCR transaction:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
