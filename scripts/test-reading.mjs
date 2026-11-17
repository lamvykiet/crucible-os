// Cắt đoạn và rút chữ bài báo cho Đọc & dịch (không đụng mạng/DB).
//   node --import ./scripts/register-ts.mjs --test scripts/test-reading.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { splitParagraphs, MAX_WORDS } from "../src/lib/readingSplit.ts";
import { extractArticle, checkArticleUrl } from "../src/lib/articleText.ts";

test("giữ nguyên chữ gốc, nối dòng ngắt giữa đoạn, tách đoạn quá dài", () => {
  const raw = "The city has changed a lot in the last ten\nyears, and most people welcome it.\nHowever, rents have doubled since 2015 and many families moved out.\n\nShort.";
  const out = splitParagraphs(raw);
  assert.deepEqual(out, [
    "The city has changed a lot in the last ten years, and most people welcome it.",
    "However, rents have doubled since 2015 and many families moved out.",
  ]);
  const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} has exactly seven words.`).join(" ");
  const parts = splitParagraphs(long);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.split(" ").length <= MAX_WORDS));
  assert.equal(parts.join(" "), long);
});

test("rút đoạn từ <article>, bỏ script và nav", () => {
  const html = `<html><head><title>T</title><meta property="og:title" content="Real &amp; title"></head><body><nav><p>Menu menu menu menu menu menu menu menu</p></nav><article><p>First paragraph has more than eight words in it, really.</p><script>var x=1</script><p>Tiny</p><p>Second paragraph &mdash; also long enough to be kept here.</p></article></body></html>`;
  const a = extractArticle(html);
  assert.equal(a.title, "Real & title");
  assert.equal(a.paragraphs.length, 2);
  assert.ok(a.paragraphs[1].includes("—"));
});

test("chặn link nội bộ và giao thức lạ", () => {
  assert.throws(() => checkArticleUrl("http://localhost:3000/x"));
  assert.throws(() => checkArticleUrl("http://192.168.1.5/"));
  assert.throws(() => checkArticleUrl("file:///etc/passwd"));
  assert.equal(checkArticleUrl("https://www.theguardian.com/a").hostname, "www.theguardian.com");
});
