const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.transaction.updateMany({
      where: { userId: 'user_123' },
      data: { userId: 'f92c8bbc-418a-4b48-9a13-8e8118c92f78' }
    });
    console.log(`Updated ${result.count} transactions to new UUID!`);
    
    // Check if the user exists in public.User, if not, create it or update it
    const existingUser = await prisma.user.findUnique({ where: { id: 'f92c8bbc-418a-4b48-9a13-8e8118c92f78' } });
    if (!existingUser) {
      // Find the old user_123
      const oldUser = await prisma.user.findUnique({ where: { id: 'user_123' } });
      if (oldUser) {
        await prisma.user.create({
          data: {
            id: 'f92c8bbc-418a-4b48-9a13-8e8118c92f78',
            email: oldUser.email,
            displayName: oldUser.displayName,
            role: oldUser.role
          }
        });
        console.log("Created real user in public.User!");
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
