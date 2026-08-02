import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // optional
    const type = searchParams.get("type"); // optional

    const userId = user.id;

    const whereClause: {
      userId: string;
      date?: { gte: Date; lt: Date };
      type?: string;
    } = { userId };

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);

      whereClause.date = {
        gte: new Date(Date.UTC(year, monthNum - 1, 1)),
        lt: new Date(Date.UTC(year, monthNum, 1)),
      };
    }

    if (type && type !== "All") {
      whereClause.type = type;
    }

    const txs = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
      take: 100, // Limit to 100 recent for now to prevent massive payloads
    });

    return NextResponse.json({
      success: true,
      data: txs.map(t => ({
        id: t.id,
        date: t.date.toISOString().split('T')[0],
        type: t.type,
        supplier: t.supplier || 'Unknown',
        amount: t.totalAmount,
        category: t.categoryGroup || 'Other',
        // Cột trong schema tên là `notes` (số nhiều), không phải `note`.
        note: t.notes || ''
      }))
    });
  } catch (error) {
    console.error("History Data Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
