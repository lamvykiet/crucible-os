"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, Clock, GraduationCap, Loader2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { TEST_MINUTES, TEST_PASS_SECTION, TEST_PASS_TOTAL, TEST_SECTION_SIZE } from "@/lib/learningPath";
import type { PathView } from "@/lib/pathServer";

interface PubQ { prompt: string; options: string[]; passage?: number }
interface Content {
  vocab: PubQ[];
  grammar: PubQ[];
  reading: { passages: { title: string; text: string }[]; questions: PubQ[] };
}
interface TestData { id: string; level: string; startedAt: string; minutes: number; content: Content }
interface Result {
  total: number;
  sections: { vocab: number; grammar: number; reading: number };
  passed: boolean;
  newLevel: string | null;
  right: boolean[];
  review: { correctIndex: number; explanation: string }[] | null;
}

type Section = "vocab" | "grammar" | "reading";
const SECTIONS: { id: Section; en: string; vi: string }[] = [
  { id: "vocab", en: "Vocabulary", vi: "Từ vựng" },
  { id: "grammar", en: "Grammar", vi: "Ngữ pháp" },
  { id: "reading", en: "Reading", vi: "Đọc" },
];
const ansKey = (id: string) => `crucible.levelTest.${id}`;

/**
 * Kiểm tra lên cấp — khuôn của aioenglish.com: 36 câu, 40 phút, đồng hồ vẫn
 * chạy khi rời trang, hết giờ tự nộp. Đáp án tạm giữ ở máy (localStorage) để
 * tải lại trang không mất bài.
 */
export default function LevelTest({ languageId }: { languageId: string }) {
  const { t } = useLanguage();
  const [view, setView] = useState<Extract<PathView, { available: true }> | null>(null);
  const [test, setTest] = useState<TestData | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [section, setSection] = useState<Section>("vocab");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/learning/path?languageId=${encodeURIComponent(languageId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.view?.available) setView(json.view);
        else setError(json?.error || t("No path yet.", "Chưa có lộ trình."));
      })
      .catch(() => setError(t("Could not load the path.", "Không đọc được lộ trình.")));
  }, [languageId, t]);

  const all = useMemo(() => (test ? [...test.content.vocab, ...test.content.grammar, ...test.content.reading.questions] : []), [test]);

  const begin = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/path/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.cooldownUntil ? `${json.error} (${new Date(json.cooldownUntil).toLocaleString("vi-VN")})` : json.error);
      const data: TestData = json.test;
      const total = data.content.vocab.length + data.content.grammar.length + data.content.reading.questions.length;
      let saved: (number | null)[] | null = null;
      try {
        const raw = localStorage.getItem(ansKey(data.id));
        saved = raw ? JSON.parse(raw) : null;
      } catch {
        saved = null;
      }
      setAnswers(saved && saved.length === total ? saved : new Array(total).fill(null));
      setTest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không bắt đầu được");
    } finally {
      setStarting(false);
    }
  };

  const submit = useCallback(async () => {
    if (!test || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch("/api/learning/path/test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId: test.id, answers }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không nộp được");
      setResult(json.result);
      try {
        localStorage.removeItem(ansKey(test.id));
      } catch {
        // Không xoá được bản nháp thì thôi.
      }
    } catch (err) {
      submittedRef.current = false;
      setError(err instanceof Error ? err.message : "Không nộp được");
    } finally {
      setSubmitting(false);
    }
  }, [test, answers]);

  // Đồng hồ: chạy theo mốc bắt đầu ở máy chủ, nên rời trang vẫn tính.
  useEffect(() => {
    if (!test || result) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [test, result]);

  const deadline = test ? new Date(test.startedAt).getTime() + test.minutes * 60_000 : 0;
  const left = test ? deadline - now : 0;
  // Hết giờ thì tự nộp: hẹn đúng mốc, không đợi người học bấm.
  useEffect(() => {
    if (!test || result) return;
    const timer = window.setTimeout(() => void submit(), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [test, result, submit, deadline]);

  const pick = (i: number, choice: number) => {
    if (result) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = choice;
      try {
        if (test) localStorage.setItem(ansKey(test.id), JSON.stringify(next));
      } catch {
        // Không lưu nháp được thì vẫn làm bài bình thường.
      }
      return next;
    });
  };

  /* ── Giới thiệu ───────────────────────────────────────────────────── */
  if (!test) {
    return (
      <div className="c-card c-elev-md p-6 space-y-5 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] grid place-content-center">
            <GraduationCap size={22} />
          </div>
          <div>
            <h2 className="c-h2">{view ? t(`Level-up test ${view.level}`, `Kiểm tra lên cấp ${view.level}`) : t("Level-up test", "Kiểm tra lên cấp")}</h2>
            {view && <p className="c-help">{t(`Pass to move on to ${view.nextLevel ?? "—"}.`, `Đạt thì lên cấp ${view.nextLevel ?? "—"}.`)}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SECTIONS.map((s) => (
            <div key={s.id} className="rounded-2xl bg-[var(--color-surface-2)] p-4">
              <p className="c-stat-label">{t(s.en, s.vi)}</p>
              <p className="c-h3 tabular-nums">{TEST_SECTION_SIZE} {t("qs", "câu")}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1.5 c-card-body list-disc pl-5">
          <li>{t(`${TEST_SECTION_SIZE * 3} questions, ${TEST_MINUTES} minutes. The clock keeps running if you leave the page; it submits itself at zero.`, `${TEST_SECTION_SIZE * 3} câu, ${TEST_MINUTES} phút. Đồng hồ vẫn chạy khi rời trang; hết giờ tự nộp.`)}</li>
          <li>{t(`Pass with at least ${TEST_PASS_TOTAL}/36 and ${TEST_PASS_SECTION}/12 in every part.`, `Đạt khi đúng ít nhất ${TEST_PASS_TOTAL}/36 câu và mỗi phần ít nhất ${TEST_PASS_SECTION}/12.`)}</li>
          <li>{t("Correct answers are shown only when you pass.", "Đáp án đúng chỉ hiện khi đạt.")}</li>
          <li>{t("Fail and you wait 24 hours, then 3 days, then 7 days between tries.", "Chưa đạt thì thi lại sau 24 giờ; trượt liên tiếp thì chờ 3 ngày, rồi 7 ngày.")}</li>
        </ul>
        {view && view.percent < 80 && !view.test.openTestId && (
          <div className="c-alert c-alert-info">
            <AlertCircle size={18} className="icon" />
            <p className="flex-1">{t(`Best taken after 80% of the path — you are at ${view.percent}%.`, `Nên làm khi đã xong 80% lộ trình — hiện bạn ở ${view.percent}%.`)}</p>
          </div>
        )}
        {error && (
          <div className="c-alert c-alert-error">
            <AlertCircle size={18} className="icon" />
            <p className="flex-1">{error}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => void begin()} disabled={starting || !view || Boolean(view.test.cooldownUntil)} className="c-btn c-btn-primary c-btn-lg">
            {starting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {starting ? t("Writing the test…", "Đang soạn đề…") : view?.test.openTestId ? t("Resume", "Làm tiếp") : t("Start", "Bắt đầu")}
          </button>
          {view?.test.cooldownUntil && (
            <span className="c-help">{t("Retake after", "Thi lại sau")} {new Date(view.test.cooldownUntil).toLocaleString("vi-VN")}</span>
          )}
          {starting && <span className="c-help">{t("About 30 seconds.", "Khoảng 30 giây.")}</span>}
        </div>
      </div>
    );
  }

  const n = TEST_SECTION_SIZE;
  const offset = section === "vocab" ? 0 : section === "grammar" ? n : 2 * n;
  const qs = section === "vocab" ? test.content.vocab : section === "grammar" ? test.content.grammar : test.content.reading.questions;
  const answered = answers.filter((a) => a !== null).length;
  const mm = Math.max(0, Math.floor(left / 60000));
  const ss = Math.max(0, Math.floor((left % 60000) / 1000));

  return (
    <div className="space-y-5">
      {result ? (
        <div className={`c-card c-elev-md p-6 space-y-4`}>
          <div className="flex items-center gap-3">
            <span className={`w-12 h-12 rounded-2xl grid place-content-center ${result.passed ? "bg-[var(--color-success-tint)] text-[var(--color-success)]" : "bg-[var(--color-warning-tint)] text-[var(--color-warning)]"}`}>
              {result.passed ? <Check size={24} /> : <X size={24} />}
            </span>
            <div>
              <h2 className="c-h2 tabular-nums">{result.total}/36</h2>
              <p className="c-help">
                {result.passed
                  ? result.newLevel
                    ? t(`Passed — your path moves up to ${result.newLevel}.`, `Đạt — lộ trình lên cấp ${result.newLevel}.`)
                    : t("Passed.", "Đạt.")
                  : t("Not yet. Keep going on the path and try again after the wait.", "Chưa đạt. Học tiếp lộ trình rồi thi lại sau thời gian chờ.")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {SECTIONS.map((s) => (
              <div key={s.id} className="rounded-2xl bg-[var(--color-surface-2)] p-4">
                <p className="c-stat-label">{t(s.en, s.vi)}</p>
                <p className={`c-h3 tabular-nums ${result.sections[s.id] < TEST_PASS_SECTION ? "text-[var(--color-warning)]" : ""}`}>{result.sections[s.id]}/12</p>
              </div>
            ))}
          </div>
          <Link href={`/learning/languages/${languageId}/path`} className="c-btn c-btn-primary">
            {t("Back to the path", "Về lộ trình")}
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="c-card p-4 flex flex-wrap items-center gap-3 sticky top-2 z-10">
          <span className={`inline-flex items-center gap-1.5 font-bold tabular-nums ${left < 5 * 60_000 ? "text-[var(--color-error)]" : ""}`}>
            <Clock size={16} />
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
          <span className="c-stat-label tabular-nums">{t(`${answered}/36 answered`, `đã làm ${answered}/36`)}</span>
          <button
            onClick={() => {
              if (answered < all.length && !window.confirm(t(`${all.length - answered} unanswered. Submit anyway?`, `Còn ${all.length - answered} câu chưa làm. Vẫn nộp?`))) return;
              void submit();
            }}
            disabled={submitting}
            className="c-btn c-btn-primary ml-auto"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {t("Submit", "Nộp bài")}
          </button>
        </div>
      )}

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      <div className="c-seg w-fit">
        {SECTIONS.map((s, si) => {
          const done = answers.slice(si * n, si * n + n).filter((a) => a !== null).length;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} className={`c-seg-opt ${section === s.id ? "active" : ""}`}>
              {t(s.en, s.vi)} <span className="tabular-nums opacity-70">{done}/{n}</span>
            </button>
          );
        })}
      </div>

      {section === "reading" &&
        test.content.reading.passages.map((p, pi) => (
          <div key={pi} className="c-card p-6 space-y-2">
            <p className="c-stat-label">{t(`Passage ${pi + 1}`, `Đoạn ${pi + 1}`)}</p>
            <h3 className="c-h3">{p.title}</h3>
            <p className="leading-relaxed whitespace-pre-wrap text-[16px]">{p.text}</p>
          </div>
        ))}

      <div className="space-y-4">
        {qs.map((q, qi) => {
          const i = offset + qi;
          const r = result?.right[i];
          const rev = result?.review?.[i];
          return (
            <div key={i} className="c-card p-5 space-y-3">
              <p className="font-medium">
                <span className="c-stat-label mr-2 tabular-nums">{qi + 1}.</span>
                {section === "reading" && q.passage !== undefined && <span className="c-stat-label mr-2">[{t(`Passage ${q.passage + 1}`, `Đoạn ${q.passage + 1}`)}]</span>}
                {q.prompt}
              </p>
              <div className="grid gap-2">
                {q.options.map((opt, oi) => {
                  const chosen = answers[i] === oi;
                  const cls = result
                    ? rev && rev.correctIndex === oi
                      ? "c-btn-success"
                      : chosen
                        ? r ? "c-btn-success" : "c-btn-danger"
                        : "c-btn-secondary"
                    : chosen ? "c-btn-primary" : "c-btn-secondary";
                  return (
                    <button key={oi} disabled={Boolean(result)} onClick={() => pick(i, oi)} className={`c-btn justify-start text-left ${cls}`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {rev?.explanation && <p className="c-help">{rev.explanation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
