import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { normalizeSupplier, utcDayRange, toVnd } from "@/lib/invoice";

/**
 * Cảnh báo trùng lặp sớm, ngay sau khi OCR xong.
 *
 * Chỉ để *báo cho biết* — không xoá, không chặn lưu nháp. Quyết định thật sự
 * (xoá / cho vào thùng rác / vẫn ghi) diễn ra ở bước duyệt, trong `process-ocr`
 * và `resolve-duplicate`.
 *
 * Quy tắc: cùng ngày hoá đơn + cùng nhà cung cấp + cùng tổng tiền. Bản cũ cố ý
 * BỎ tên nhà cung cấp khỏi điều kiện ("tên OCR có thể lệch dấu"), nên hai lần
 * mua ở hai cửa hàng khác nhau cùng số tiền trong một ngày bị coi là trùng.
 * Cách xử lý đúng là vẫn so tên, nhưng so sau khi đã chuẩn hoá bỏ dấu.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { date, supplier, totalAmount } = await req.json();

    const amount = toVnd(totalAmount);
    if (!date || amount === null) {
      return NextResponse.json({ success: false, error: "Thiếu ngày hoặc tổng tiền" }, { status: 400 });
    }

    const { start, end } = utcDayRange(date);
    const candidates = await prisma.transaction.findMany({
      where: { userId: user.id, totalAmount: amount, date: { gte: start, lte: end } },
      select: { id: true, date: true, supplier: true, totalAmount: true, categoryGroup: true },
    });

    const target = normalizeSupplier(supplier);
    const duplicate = candidates.find((t) => normalizeSupplier(t.supplier) === target);

    return NextResponse.json({
      success: true,
      isDuplicate: Boolean(duplicate),
      data: duplicate ?? null,
    });
  } catch (error) {
    console.error("Failed to check duplicate transaction:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
