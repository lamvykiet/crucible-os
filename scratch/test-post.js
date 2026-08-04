const payload = {
  date: "2026-08-04",
  supplier: "Test BHX",
  type: "Expense",
  categoryGroup: "Food & Dining",
  subtotal: 100000,
  tax: 0,
  serviceCharge: 0,
  discount: 0,
  totalAmount: 100000,
  paymentMethod: "cash",
  notes: "",
  source: "ocr",
  items: [
    {
      productName: "Apple",
      quantity: 1,
      unitPrice: 100000,
      totalPrice: 100000
    }
  ]
};

async function testPost() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  // Get the first user
  const user = await prisma.user.findFirst();
  if (!user) return console.log("No user");

  const transactionId = `RCP-${Date.now()}-TEST`;
  try {
    const transaction = await prisma.transaction.create({
      data: {
        id: transactionId,
        userId: user.id,
        date: new Date(payload.date),
        supplier: payload.supplier,
        type: payload.type,
        categoryGroup: payload.categoryGroup,
        subtotal: payload.subtotal,
        totalAmount: payload.totalAmount,
        paymentMethod: payload.paymentMethod,
        source: payload.source,
        notes: payload.notes || null,
        items: payload.items && payload.items.length > 0 ? {
          create: payload.items.map((item, idx) => ({
            id: `ITM-${Date.now()}-${idx}`,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          }))
        } : undefined
      },
      include: {
        items: true
      }
    });
    console.log("SUCCESS:", transaction.id, transaction.items.length);
  } catch (e) {
    console.log("ERROR:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPost();
