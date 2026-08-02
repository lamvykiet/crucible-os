const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const newId = 'f92c8bbc-418a-4b48-9a13-8e8118c92f78';
    
    await prisma.$executeRawUnsafe(`UPDATE "User" SET id = '${newId}' WHERE id = 'user_123'`);
    console.log("Updated user ID via SQL!");
    
    const result = await prisma.transaction.updateMany({
      where: { userId: 'user_123' },
      data: { userId: newId }
    });
    console.log(`Updated ${result.count} transactions to new UUID!`);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
