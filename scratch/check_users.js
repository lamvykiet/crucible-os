const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.$queryRawUnsafe('SELECT id, email FROM auth.users');
    console.log("Supabase Auth Users:", users);
  } catch (error) {
    console.error("Error reading auth.users:", error);
  }
}

main();
