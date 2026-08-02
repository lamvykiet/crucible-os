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

    // Currently we just fetch everything to calculate total debts since there is no 'Debt' model
    // Just find all 'Debt' / 'Loan' transactions.
    // If they represent taking a loan (Income-like) vs paying a loan (Expense-like), we'd need more logic.
    // For now, assume this is a placeholder that will return 0 since there's no data.
    
    const txs = await prisma.transaction.findMany({
      where: { 
        userId,
        type: { in: ['Debt', 'Loan', 'debt', 'loan'] }
      },
    });

    // Chưa có model Debt nên các con số này còn bằng 0. Khai báo kiểu tường
    // minh thay vì để mảng rỗng suy ra `any[]` — bằng không TypeScript sẽ báo
    // lỗi implicit any và build hỏng.
    const totalOutstanding = 0;
    const monthlyPayment = 0;
    const principalPaid = 0;
    const active = 0;
    const settled = 0;
    const dueThisMonth: DueEntry[] = [];
    const debtsList: DebtEntry[] = [];

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
        hasData: txs.length > 0,
      }
    });
  } catch (error) {
    console.error("Debts Data Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
