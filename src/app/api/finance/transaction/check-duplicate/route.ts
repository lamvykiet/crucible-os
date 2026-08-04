import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { date, supplier, totalAmount } = body;

    if (!date || !supplier || totalAmount === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const duplicate = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        // Remove strict supplier check because OCR names might differ slightly (accents, casing)
        totalAmount: Number(totalAmount),
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true
      }
    });

    if (duplicate) {
      return NextResponse.json({ success: true, isDuplicate: true, data: duplicate });
    }

    return NextResponse.json({ success: true, isDuplicate: false });
  } catch (error) {
    console.error("Failed to check duplicate transaction:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
