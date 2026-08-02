/**
 * Liệt kê các model Gemini mà API key hiện tại thực sự gọi được.
 *
 * Dùng khi trợ lý AI báo lỗi 404 model: Google gỡ model cũ theo vòng đời, và
 * lỗi trả về không phải lúc nào cũng nói rõ nguyên nhân. Chạy script này rồi
 * đặt lại GEMINI_MODEL trong .env là xong, không cần sửa code.
 *
 *   node scripts/list-gemini-models.js
 */
require('dotenv').config();

const KEY = process.env.GEMINI_API_KEY;

async function main() {
  if (!KEY) {
    console.error('Thiếu GEMINI_API_KEY trong .env');
    process.exitCode = 1;
    return;
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}&pageSize=200`
  );
  const json = await res.json();

  if (json.error) {
    console.error(`Lỗi API ${json.error.code}: ${json.error.message}`);
    process.exitCode = 1;
    return;
  }

  const usable = (json.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .sort();

  console.log(`\n=== ${usable.length} model hỗ trợ generateContent ===`);
  for (const n of usable) console.log(`  ${n}`);

  const configured = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
  const vision = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

  console.log('\n=== Model dự án đang cấu hình ===');
  for (const [label, name] of [['GEMINI_MODEL', configured], ['GEMINI_VISION_MODEL', vision]]) {
    const ok = usable.includes(name);
    console.log(`  ${ok ? '[OK]   ' : '[LỖI]  '} ${label.padEnd(20)} = ${name}`);
    if (!ok) console.log('           → Model này không gọi được. Đổi trong .env.');
  }
  console.log('');
}

main().catch((e) => {
  console.error('Lỗi:', e.message);
  process.exitCode = 1;
});
