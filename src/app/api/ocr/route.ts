import { NextRequest, NextResponse } from "next/server";
import { SchemaType, Schema } from "@google/generative-ai";
import { genAI, GEMINI_VISION_MODEL } from "@/lib/gemini";
import { requireUser } from "@/lib/auth";

// Hoá đơn chụp bằng điện thoại hiếm khi vượt 10MB. Chặn sớm để không nạp cả
// file khổng lồ vào RAM rồi mới base64 hoá.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

const schema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    supplier: { type: SchemaType.STRING, description: "Name of the store or supplier" },
    date: { type: SchemaType.STRING, description: "Date of the receipt in YYYY-MM-DD format" },
    subtotal: { type: SchemaType.NUMBER, description: "Subtotal amount before tax/discount" },
    tax: { type: SchemaType.NUMBER, description: "Tax amount" },
    serviceCharge: { type: SchemaType.NUMBER, description: "Service charge amount" },
    discount: { type: SchemaType.NUMBER, description: "Discount amount (positive number)" },
    totalAmount: { type: SchemaType.NUMBER, description: "Final total amount paid" },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          productName: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unitPrice: { type: SchemaType.NUMBER },
          totalPrice: { type: SchemaType.NUMBER }
        },
        required: ["productName", "quantity", "unitPrice", "totalPrice"]
      }
    }
  },
  required: ["supplier", "date", "subtotal", "tax", "discount", "totalAmount", "items"]
};

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File vượt quá ${MAX_FILE_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }
    if (file.type && !ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: `Định dạng không hỗ trợ: ${file.type}` },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // In a full implementation, we'd also upload this buffer to Google Drive here
    // and get back the driveFileId to save in the database.

    const model = genAI.getGenerativeModel({
      model: GEMINI_VISION_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const prompt = "Analyze this receipt and extract the line items and totals. Convert all monetary values to numbers without currency symbols.";
    
    const image = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: file.type
      }
    };

    const result = await model.generateContent([prompt, image]);
    const responseText = result.response.text();
    
    // Parse the JSON strictly
    const data = JSON.parse(responseText);
    
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("OCR Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
