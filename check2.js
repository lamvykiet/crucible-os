const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany({ select: { type: true, categoryGroup: true }});
  const types = [...new Set(txs.map(t => t.type))];
  const groups = [...new Set(txs.map(t => t.categoryGroup))];
  console.log("Types:", types);
  console.log("Groups:", groups);
}

main().catch(console.error).finally(() => prisma.$disconnect());
