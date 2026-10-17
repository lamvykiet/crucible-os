const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users:", users.map(u => ({ id: u.id, email: u.email })));
  
  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, userId: true, supplier: true, createdAt: true, source: true }
  });
  console.log("Recent TXs:", txs);
}

main().finally(() => prisma.$disconnect());
