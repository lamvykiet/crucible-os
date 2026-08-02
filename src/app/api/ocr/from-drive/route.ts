import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDriveClient, INVOICE_ROOT_FOLDER_ID, getOrCreateFolderIds, moveFile } from "@/lib/drive";
import { genAI, GEMINI_VISION_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: "No fileId provided" }, { status: 400 });
    }

    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);

    // Get file metadata to check size and mimeType
    const meta = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size",
    });

    const file = meta.data;
    if (!file || !file.mimeType || !file.size) {
      return NextResponse.json({ error: "Invalid file from Drive" }, { status: 400 });
    }

    const MAX_FILE_BYTES = 10 * 1024 * 1024;
    if (Number(file.size) > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `File vượt quá ${MAX_FILE_BYTES / 1024 / 1024}MB` }, { status: 413 });
    }

    // Download file content
    const fileRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    const buffer = Buffer.from(fileRes.data as ArrayBuffer);

    const model = genAI.getGenerativeModel({
      model: GEMINI_VISION_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `Analyze this receipt image. Extract the line items and totals. 
    IMPORTANT: The currency is Vietnamese Dong (VND). Do NOT include decimals in any monetary values. 
    Dots (.) and commas (,) in amounts are thousands separators, NOT decimal points. For example, '139.900' or '139,900' must be extracted as the integer 139900.
    Convert all monetary values to integers.
    Must return a JSON object with this exact schema: { supplier, date (YYYY-MM-DD), subtotal, tax, serviceCharge, discount, totalAmount, items: [{ productName, quantity, unitPrice, totalPrice }] }`;
    
    const imagePart = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: file.mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    // Parse the JSON strictly
    const data = JSON.parse(responseText);
    
    // Move to Review
    await moveFile(drive, fileId, folderIds.INCOMING, folderIds.REVIEW);

    return NextResponse.json({ data, driveFileIds: [fileId] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("OCR from drive Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
