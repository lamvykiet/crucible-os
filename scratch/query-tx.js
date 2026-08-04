const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = "4ca3b48c-e0e3-4577-80e8-d81b18cda024";
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true }
  });
  console.log(JSON.stringify(tx, null, 2));
}

main().finally(() => prisma.$disconnect());
