// Kiểm tra phần tính toán của Lộ trình (không đụng DB).
//   node --import ./scripts/register-ts.mjs --test scripts/test-learning-path.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChapters, allLessons, planToday, bandToLevel, etaDays, etaLabel, cooldownHours, gradeTest,
  startOfTodayVN, lessonsMinutes,
} from "../src/lib/learningPath.ts";
import { EN_SYLLABUS } from "../src/lib/grammar/en.ts";

test("chương = họ ngữ pháp có điểm ở cấp đó; mỗi điểm 3 bài", () => {
  const ch = buildChapters(EN_SYLLABUS.families, "B1", true);
  assert.equal(ch.length, 21);
  const lessons = allLessons(ch);
  assert.equal(lessons.length, 73 * 3);
  assert.deepEqual(lessons.slice(0, 3).map((l) => l.kind), ["grammar", "typing", "translate"]);
  assert.equal(new Set(lessons.map((l) => l.key)).size, lessons.length, "khoá bài phải duy nhất");
  assert.equal(buildChapters(EN_SYLLABUS.families, "B1", false).flatMap((c) => c.lessons).length, 73);
});

test("kế hoạch: bài làm hôm nay giữ dấu ✓, rồi nối bài chưa xong tới hết ngân sách", () => {
  const lessons = allLessons(buildChapters(EN_SYLLABUS.families, "A2", true));
  const done = new Set([lessons[0].key]);
  const plan = planToday({
    lessons,
    isDone: (l) => done.has(l.key),
    doneToday: (l) => done.has(l.key),
    minutesPerDay: 45,
    extras: [{ kind: "listening", done: false }],
  });
  assert.equal(plan[0].done, true);
  assert.equal(plan[1].lesson.key, lessons[1].key);
  assert.equal(plan.at(-1).kind, "listening");
  const minutes = plan.reduce((s, p) => s + p.minutes, 0);
  assert.ok(minutes <= 45 + 10, `tổng ${minutes} phút vượt quá xa ngân sách`);
});

test("ngân sách quá nhỏ vẫn có ít nhất một bài chưa xong", () => {
  const lessons = allLessons(buildChapters(EN_SYLLABUS.families, "A1", true));
  const plan = planToday({ lessons, isDone: () => false, doneToday: () => false, minutesPerDay: 10, extras: [{ kind: "writing", done: false }] });
  assert.ok(plan.some((p) => p.lesson));
});

test("band → cấp, ước lượng, thời gian chờ thi lại, chấm đạt", () => {
  assert.equal(bandToLevel("3.5"), "A2");
  assert.equal(bandToLevel("5.0"), "B1");
  assert.equal(bandToLevel("6.5"), "B2");
  assert.equal(bandToLevel("7.0"), "C1");
  assert.equal(etaDays(90, 45), 2);
  assert.equal(etaDays(0, 45), 0);
  assert.equal(etaLabel(30).vi, "khoảng 4 tuần");
  assert.deepEqual([0, 1, 2, 3, 9].map(cooldownHours), [0, 24, 72, 168, 168]);
  assert.equal(gradeTest({ vocab: 10, grammar: 12, reading: 7 }).passed, true);
  assert.equal(gradeTest({ vocab: 12, grammar: 12, reading: 6 }).passed, false);
  assert.equal(gradeTest({ vocab: 10, grammar: 10, reading: 8 }).passed, false);
  assert.ok(lessonsMinutes(allLessons(buildChapters(EN_SYLLABUS.families, "C1", true))) > 0);
});

test("đầu ngày theo giờ Việt Nam", () => {
  // 23:30 ngày 17 giờ VN = 16:30Z ngày 17 → đầu ngày là 17:00Z ngày 16.
  assert.equal(startOfTodayVN(new Date("2026-11-17T16:30:00Z")).toISOString(), "2026-11-16T17:00:00.000Z");
  // 00:30 ngày 18 giờ VN = 17:30Z ngày 17 → đầu ngày 17:00Z ngày 17.
  assert.equal(startOfTodayVN(new Date("2026-11-17T17:30:00Z")).toISOString(), "2026-11-17T17:00:00.000Z");
});
