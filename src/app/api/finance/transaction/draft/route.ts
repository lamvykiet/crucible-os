import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toVnd } from "@/lib/invoice";

/**
 * Bước 1 của luồng OCR: lưu bản nháp sau khi người dùng xem lại kết quả quét.
 *
 * Bản nháp nằm trong bảng `DraftReceipt`, KHÔNG phải file JSON trên Drive như
 * trước. Ảnh vẫn ở `Incoming_Invoices` — chỉ khi bấm "Duyệt hoá đơn" ở bước 2
 * ảnh mới chuyển sang `Review_Invoices`.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { driveFileIds, driveFileName, formData, items } = body;

    if (!Array.isArray(driveFileIds) || driveFileIds.length === 0) {
      return NextResponse.json({ success: false, error: "Thiếu driveFileIds" }, { status: 400 });
    }
    if (!formData) {
      return NextResponse.json({ success: false, error: "Thiếu dữ liệu hoá đơn" }, { status: 400 });
    }

    const draft = await prisma.draftReceipt.create({
      data: {
        status: "Pending",
        // Ngày để trống vẫn hợp lệ ở bản nháp — người dùng sẽ điền ở bước duyệt.
        date: formData.date ? new Date(formData.date) : null,
        supplier: formData.supplier || null,
        type: formData.type || "Expense",
        categoryGroup: formData.categoryGroup || null,
        subGroup: formData.subGroup || null,
        subtotal: toVnd(formData.subtotal),
        tax: toVnd(formData.tax),
        serviceCharge: toVnd(formData.serviceCharge),
        discount: toVnd(formData.discount),
        totalAmount: toVnd(formData.totalAmount),
        paymentMethod: formData.paymentMethod || "unknown",
        language: formData.language || null,
        notes: formData.notes || null,
        driveFileIds: driveFileIds.join(","),
        driveFileName: driveFileName || null,
        userId: user.id,
        items:
          Array.isArray(items) && items.length > 0
            ? {
                create: items.map((item: any) => ({
                  productName: item.productName || "",
                  quantity: Number(item.quantity) || 0,
                  unitPrice: toVnd(item.unitPrice) ?? 0,
                  totalPrice: toVnd(item.totalPrice) ?? 0,
                  suggestedCategoryGroup: item.suggestedCategoryGroup || null,
                  confidence:
                    item.confidence === undefined || item.confidence === null
                      ? null
                      : Number(item.confidence),
                })),
              }
            : undefined,
      },
    });

    return NextResponse.json({ success: true, draftId: draft.id });
  } catch (error) {
    console.error("Save draft error:", error);
    const message = error instanceof Error ? error.message : "Không lưu được bản nháp";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
