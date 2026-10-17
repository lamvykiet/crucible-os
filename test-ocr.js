const fs = require('fs');

async function processFile() {
  console.log("Processing file: 1JWkRyOX9mGX6o3PtStCgPIP0bu0ghJWn");
  try {
    const res = await fetch("http://localhost:3000/api/ocr/from-drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: "1JWkRyOX9mGX6o3PtStCgPIP0bu0ghJWn" })
    });
    const result = await res.json();
    console.log("OCR Result:", JSON.stringify(result, null, 2));

    if (result.success) {
      const { data, driveFileIds } = result;
      const payload = {
        date: data.date || new Date().toISOString().slice(0, 10),
        supplier: data.supplier || "Test Supplier",
        type: "Expense",
        categoryGroup: "Food & Dining",
        subtotal: data.subtotal,
        tax: data.tax,
        serviceCharge: data.serviceCharge,
        discount: data.discount,
        totalAmount: data.totalAmount,
        items: data.items || [],
        driveFileIds: driveFileIds,
        source: "ocr"
      };

      console.log("Submitting to /api/finance/transaction...");
      
      // Need a valid session cookie or to bypass auth? 
      // Since it's server-side, I should probably call the logic directly or bypass auth for local test.
      // But wait, the user wants me to show that it works ON VERCEL.
      // I can't hit Vercel API without their session cookie!
    }
  } catch(e) {
    console.error(e);
  }
}

processFile();
