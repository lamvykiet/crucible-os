const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users:", users.length);
  
  for (const u of users) {
    const txCount = await prisma.transaction.count({ where: { userId: u.id } });
    console.log(`User ${u.id} (${u.email}) has ${txCount} transactions.`);
    if (txCount > 0) {
      const txs = await prisma.transaction.findMany({ where: { userId: u.id }, select: { date: true }});
      const dates = txs.map(t => t.date.toISOString().slice(0,7));
      const uniqueMonths = [...new Set(dates)].sort();
      console.log(`  Months with data: ${uniqueMonths.join(', ')}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
