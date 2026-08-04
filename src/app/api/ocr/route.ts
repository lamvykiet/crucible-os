import { NextRequest, NextResponse } from "next/server";
import { SchemaType, Schema } from "@google/generative-ai";
import { genAI, GEMINI_VISION_MODEL } from "@/lib/gemini";
import { requireUser } from "@/lib/auth";
import { getDriveClient, INVOICE_ROOT_FOLDER_ID, getOrCreateFolderIds, uploadToDrive, moveFile } from "@/lib/drive";

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

  let driveFileIds: string[] = [];

  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);

    const imageParts = [];

    for (const file of files) {
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

      // Upload to Incoming
      const driveFileId = await uploadToDrive(drive, buffer, file.type, file.name, folderIds.INCOMING);
      if (driveFileId) {
        driveFileIds.push(driveFileId);
      }

      imageParts.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: file.type
        }
      });
    }

    const model = genAI.getGenerativeModel({
      model: GEMINI_VISION_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const prompt = `Analyze these receipt images (they may belong to a single long receipt). Extract the line items and totals. 
    IMPORTANT: The currency is Vietnamese Dong (VND). Do NOT include decimals in any monetary values. 
    Dots (.) and commas (,) in amounts are thousands separators, NOT decimal points. For example, '139.900' or '139,900' must be extracted as the integer 139900.
    Convert all monetary values to integers.`;
    
    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    // Parse the JSON strictly
    const data = JSON.parse(responseText);

    return NextResponse.json({ data, driveFileIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("OCR Error:", error);
    // Return driveFileIds if files were uploaded but Gemini failed
    // This allows the frontend to know the files are safe in the drive queue
    return NextResponse.json({ error: message, driveFileIds }, { status: 500 });
  }
}
