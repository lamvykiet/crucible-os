const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const newId = 'f92c8bbc-418a-4b48-9a13-8e8118c92f78';
    
    // Check if the user exists in public.User, if not, create it
    const existingUser = await prisma.user.findUnique({ where: { id: newId } });
    if (!existingUser) {
      // Find the old user_123
      const oldUser = await prisma.user.findUnique({ where: { id: 'user_123' } });
      if (oldUser) {
        await prisma.user.create({
          data: {
            id: newId,
            email: oldUser.email,
            displayName: oldUser.displayName,
            role: oldUser.role
          }
        });
        console.log("Created real user in public.User!");
      } else {
        await prisma.user.create({
          data: {
            id: newId,
            email: 'ruper@crucible.com',
            displayName: 'Lâm Vỹ Kiệt',
            role: 'admin'
          }
        });
      }
    }

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
