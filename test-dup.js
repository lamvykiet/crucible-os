const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dateStr = "2026-08-02";
  const totalAmount = 529048;
  const userId = "f92c8bbc-418a-4b48-9a13-8e8118c92f78";

  const startDate = new Date(dateStr);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(dateStr);
  endDate.setHours(23, 59, 59, 999);

  console.log("Input Date:", dateStr);
  console.log("Start Date:", startDate.toISOString());
  console.log("End Date:", endDate.toISOString());

  const duplicate = await prisma.transaction.findFirst({
    where: {
      userId: userId,
      totalAmount: Number(totalAmount),
      date: {
        gte: startDate,
        lte: endDate,
      },
    }
  });

  console.log("Duplicate found:", duplicate ? duplicate.id : null);
}

main().finally(() => prisma.$disconnect());
