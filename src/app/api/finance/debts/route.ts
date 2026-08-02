export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

interface DueEntry {
  id: string;
  name: string;
  dueDay: number;
  amount: number;
}

interface DebtEntry {
  id: string;
  name: string;
  outstanding: number;
  monthlyPayment: number;
  settled: boolean;
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const requested = searchParams.get("month");
    const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : now.toISOString().slice(0, 7);
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (!Number.isInteger(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json({ success: false, error: "Invalid month format" }, { status: 400 });
    }

    const userId = user.id;

    const debts = await prisma.debt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    let totalOutstanding = 0;
    let monthlyPayment = 0;
    let principalPaid = 0;
    let active = 0;
    let settled = 0;
    const dueThisMonth: DueEntry[] = [];
    const debtsList: DebtEntry[] = [];

    debts.forEach(d => {
      totalOutstanding += d.remaining;
      monthlyPayment += d.monthlyPayment;
      principalPaid += (d.principal - d.remaining);
      
      if (d.status === 'active') active++;
      else settled++;

      // Check if due this month
      if (d.dueDate) {
        const dueDate = new Date(d.dueDate);
        if (dueDate.getUTCFullYear() === year && dueDate.getUTCMonth() === monthNum - 1) {
          dueThisMonth.push({
            id: d.id,
            name: d.name,
            dueDay: dueDate.getUTCDate(),
            amount: d.monthlyPayment
          });
        }
      }

      debtsList.push({
        id: d.id,
        name: d.name,
        startDate: d.startDate.toISOString().split('T')[0],
        principal: d.principal,
        remaining: d.remaining,
        monthlyPayment: d.monthlyPayment,
        interestRate: d.interestRate,
        dueDate: d.dueDate ? d.dueDate.toISOString().split('T')[0] : 'N/A',
        remainingMonths: d.monthlyPayment > 0 ? Math.ceil(d.remaining / d.monthlyPayment) : 0,
        paidPercentage: d.principal > 0 ? Math.round(((d.principal - d.remaining) / d.principal) * 100) : 0,
        type: d.type,
      } as any);
    });

    // Sort due dates
    dueThisMonth.sort((a, b) => a.dueDay - b.dueDay);

    return NextResponse.json({
      success: true,
      data: {
        totalOutstanding,
        monthlyPayment,
        principalPaid,
        active,
        settled,
        dueThisMonth,
        debtsList,
        hasData: debts.length > 0,
      }
    });
  } catch (error) {
    console.error("Debts Data Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { name, type, startDate, dueDate, principal, remaining, monthlyPayment, interestRate, status } = body;

    if (!name || !type || principal === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const debt = await prisma.debt.create({
      data: {
        userId: user.id,
        name,
        type,
        startDate: new Date(startDate || new Date()),
        dueDate: dueDate ? new Date(dueDate) : null,
        principal: Number(principal),
        remaining: remaining !== undefined ? Number(remaining) : Number(principal),
        monthlyPayment: Number(monthlyPayment || 0),
        interestRate: Number(interestRate || 0),
        status: status || 'active'
      }
    });

    return NextResponse.json({ success: true, data: debt });
  } catch (error) {
    console.error("Failed to create debt:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
