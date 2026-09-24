/**
 * Khoá Gemini đang ở gói nào, model nào còn hạn mức.
 *
 * Chạy:  node scripts/check-gemini.mjs
 *
 * Dùng khi AI trong Learning Hub báo hết hạn mức, và để kiểm chứng sau khi bật
 * thanh toán cho khoá ở Google AI Studio. Hạn mức của Gemini tính theo TỪNG
 * MODEL chứ không theo khoá, nên phải hỏi từng cái một.
 *
 * Mỗi lượt kiểm tra ăn đúng 1 lượt trong hạn mức ngày của model đó.
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("Không thấy .env ở thư mục hiện tại. Hãy chạy từ gốc dự án.");
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ])
);

const KEY = env.GEMINI_API_KEY;
if (!KEY) {
  console.error("Trong .env chưa có GEMINI_API_KEY.");
  process.exit(1);
}

const MODELS = [
  ["gemini-3.1-pro-preview", "Pro"],
  ["gemini-pro-latest", "Pro"],
  ["gemini-3.6-flash", "Flash"],
  ["gemini-3-flash-preview", "Flash"],
  ["gemini-2.5-flash", "Flash"],
  ["gemini-2.5-flash-lite", "Flash nhẹ"],
  ["gemini-flash-lite-latest", "Flash nhẹ"],
];

console.log(`Khoá: ${KEY.slice(0, 4)}… (${KEY.length} ký tự)\n`);

let anyPro = false;
let freeTier = false;

for (const [model, tier] of MODELS) {
  const startedAt = Date.now();
  let line;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "ok" }] }] }),
      }
    );
    const body = await res.json();
    const ms = Date.now() - startedAt;

    if (res.ok) {
      if (tier === "Pro") anyPro = true;
      line = `✅ chạy được   ${ms}ms`;
    } else {
      const raw = JSON.stringify(body);
      if (/free_tier|FreeTier/.test(raw)) freeTier = true;
      const limit = raw.match(/limit: (\d+)/)?.[1];
      // Hạn mức 0 nghĩa là gói hiện tại KHÔNG ĐƯỢC CẤP model này, khác hẳn với
      // hạn mức lớn hơn 0 mà đã dùng hết trong ngày.
      const why =
        limit === "0"
          ? "gói hiện tại không được dùng model này"
          : limit
            ? `đã dùng hết ${limit} lượt/ngày`
            : (body.error?.message ?? "").slice(0, 60);
      line = `❌ ${body.error?.code ?? "?"}  ${why}`;
    }
  } catch (error) {
    line = `⚠️  ${String(error.message).slice(0, 60)}`;
  }
  console.log(`${model.padEnd(26)} ${tier.padEnd(10)} ${line}`);
}

console.log("");
if (anyPro) {
  console.log("➜ Khoá ĐÃ dùng được dòng Pro. Learning Hub sẽ tự ưu tiên Pro, không cần sửa gì.");
} else if (freeTier) {
  console.log("➜ Khoá đang ở GÓI MIỄN PHÍ: 20 lượt/ngày cho mỗi model, và không được dùng dòng Pro.");
  console.log("  Bật thanh toán cho khoá ở https://aistudio.google.com/apikey rồi chạy lại lệnh này.");
  console.log("  Lưu ý: gói Gemini Pro ở gemini.google.com KHÔNG cấp hạn mức cho API.");
} else {
  console.log("➜ Không kết luận được. Xem lại từng dòng bên trên.");
}
