import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    // Export all user data
    const userId = user.id;

    const [
      transactions,
      budgets,
      categories,
      materials,
      dictionaryItems,
      flashcards
    ] = await Promise.all([
      prisma.transaction.findMany({ where: { userId }, include: { items: true } }),
      prisma.budget.findMany({ where: { userId } }),
      prisma.category.findMany({ where: { userId } }),
      prisma.material.findMany({ where: { userId }, include: { annotations: true } }),
      prisma.dictionaryItem.findMany({ where: { userId } }),
      prisma.flashcard.findMany({ where: { userId } })
    ]);

    const backupData = {
      exportDate: new Date().toISOString(),
      user: { id: userId, email: user.email },
      finance: {
        transactions,
        budgets,
        categories
      },
      knowledge: {
        materials,
        dictionaryItems,
        flashcards
      }
    };

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(backupData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="crucible-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export data";
    console.error("Backup export error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
