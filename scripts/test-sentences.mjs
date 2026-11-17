// Soát kho câu và hàm so khớp của Gõ câu / Dịch câu (không đụng DB).
//   node --import ./scripts/register-ts.mjs --test scripts/test-sentences.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  staticSetsFor, validateSentence, sameSentence, revealedCount, hintNext, typingSteps, markWords,
} from "../src/lib/sentences/index.ts";

const LIMITS = { B1: [8, 14], B2: [10, 18], C1: [12, 24] };

test("mọi câu viết sẵn hợp lệ: cụm ghép ra câu, từ khoá nằm trong câu, đúng độ dài theo cấp", () => {
  const sets = staticSetsFor("en");
  assert.ok(sets.length >= 12);
  const ids = new Set();
  for (const set of sets) {
    assert.ok(!ids.has(set.id), `trùng id ${set.id}`);
    ids.add(set.id);
    for (const s of set.sentences) {
      assert.deepEqual(validateSentence(s), [], `${set.id}: ${s.en}`);
      const [min, max] = LIMITS[set.level];
      const n = s.en.split(/\s+/).length;
      assert.ok(n >= min && n <= max, `${set.id}: "${s.en}" dài ${n} từ, cấp ${set.level} cần ${min}–${max}`);
    }
  }
});

test("so câu bỏ qua hoa thường, dấu câu và dạng viết tắt", () => {
  assert.ok(sameSentence("I've been here for two years", "I have been here for two years."));
  assert.ok(sameSentence("we can't go", "We cannot go."));
  assert.ok(sameSentence("Let’s start", "let's start!"));
  assert.ok(!sameSentence("I have been here", "I have been there"));
});

test("lật ô theo chữ đã gõ đúng; chữ gõ dở chỉ tính khi khớp trọn", () => {
  const ref = "I booked a double room.";
  assert.equal(revealedCount("", ref), 0);
  assert.equal(revealedCount("i book", ref), 1);
  assert.equal(revealedCount("i booked", ref), 2);
  assert.equal(revealedCount("I booked a", ref), 3);
  assert.equal(revealedCount("I booked an ", ref), 2);
  assert.equal(revealedCount("I booked a double room", ref), 5);
});

test("gợi ý thay phần gõ dở bằng chữ kế tiếp", () => {
  const ref = "I booked a double room.";
  assert.equal(hintNext("I boo", ref), "I booked ");
  assert.equal(hintNext("I booked a double", ref), "I booked a double room.");
});

test("bậc gõ: cơ bản = từ khoá → cụm → câu; khó = chỉ câu", () => {
  const s = staticSetsFor("en")[0].sentences[0];
  const basic = typingSteps(s, "basic");
  assert.equal(basic[0].kind, "key");
  assert.equal(basic.at(-1).kind, "sentence");
  assert.ok(basic.some((x) => x.kind === "chunk"));
  assert.deepEqual(typingSteps(s, "hard").map((x) => x.kind), ["sentence"]);
});

test("tô từng chữ khi nộp", () => {
  const m = markWords("I booked an double room", "I booked a double room.");
  assert.deepEqual(m.map((x) => x.ok), [true, true, false, true, true]);
});
