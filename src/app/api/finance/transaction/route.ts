import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { date, supplier, type, categoryGroup, subGroup, amount, paymentMethod, notes } = body;

    if (!date || !type || !amount) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        date: new Date(date),
        supplier: supplier || "N/A",
        type: type,
        categoryGroup: categoryGroup || "Other",
        subGroup: subGroup || null,
        subtotal: Number(amount),
        tax: 0,
        serviceCharge: 0,
        discount: 0,
        totalAmount: Number(amount),
        paymentMethod: paymentMethod || "cash",
        source: "manual",
        notes: notes || null,
      }
    });

    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    console.error("Failed to create transaction:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
