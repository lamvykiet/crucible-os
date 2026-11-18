// Video học tiếng: đọc ID YouTube và nối các đoạn phụ đề.
//   node --import ./scripts/register-ts.mjs --test scripts/test-video.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseYouTubeId, mergeChunk, parseStore } from "../src/lib/videoLesson.ts";

test("đọc ID từ mọi dạng link", () => {
  assert.equal(parseYouTubeId("https://www.youtube.com/watch?v=MMmOLN5zBLY&t=30s"), "MMmOLN5zBLY");
  assert.equal(parseYouTubeId("https://youtu.be/MMmOLN5zBLY?si=x"), "MMmOLN5zBLY");
  assert.equal(parseYouTubeId("https://m.youtube.com/shorts/MMmOLN5zBLY"), "MMmOLN5zBLY");
  assert.equal(parseYouTubeId("MMmOLN5zBLY"), "MMmOLN5zBLY");
  assert.equal(parseYouTubeId("https://vimeo.com/123"), null);
});

test("bỏ câu cắt dở ở ranh giới, đoạn sau bắt đầu lại từ đó", () => {
  const empty = { until: 0, complete: false, items: [] };
  const a = mergeChunk(empty, [
    { start: 1, end: 5, en: "One.", vi: "Một." },
    { start: 6, end: 179.5, en: "Cut in", vi: "Cắt" },
  ], 0, 180);
  assert.equal(a.items.length, 1);
  assert.equal(a.until, 6);
  assert.equal(a.complete, false);
  // AI dừng sớm ở 20s mà không báo hết video ⇒ chưa xong, lượt sau từ 20s.
  const b = mergeChunk(a, [
    { start: 3, end: 5, en: "Overlap", vi: "" },
    { start: 6, end: 12, en: "Cut in half sentence.", vi: "Câu." },
    { start: 13, end: 20, en: "Stopped early.", vi: "Dừng sớm." },
  ], 6, 186);
  assert.deepEqual(b.items.map((s) => s.en), ["One.", "Cut in half sentence.", "Stopped early."]);
  assert.equal(b.complete, false);
  assert.equal(b.until, 20);
  const c = mergeChunk(b, [{ start: 21, end: 25, en: "The end.", vi: "Hết." }], 20, 200, true);
  assert.equal(c.complete, true);
  assert.equal(c.items.length, 4);
  const d = mergeChunk(b, [], 20, 200);
  assert.equal(d.complete, true, "đoạn rỗng = hết video");
  assert.equal(parseStore(JSON.stringify(b)).items.length, 3);
});
