"use client";

import { useState, useRef, useEffect } from "react";
import {
  Loader2, AlertCircle, Clock, Volume2, Gauge, Check, Mic, Square, Play,
  Headphones, BookOpen, PenLine, MessageCircle, Info, Award,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, stopSpeaking, speechSupported } from "@/lib/speech";
import { toWav, toBase64, canRecord, pickRecordingType } from "@/lib/audioWav";
import {
  EXAM_SECTIONS, WRITING_TASKS, SPEAKING_PARTS, type ExamSection,
} from "@/lib/ieltsFormat";

type SectionId = "listening" | "reading" | "writing" | "speaking";

interface Question {
  type: "choice" | "tfng" | "gap";
  prompt: string;
  options: string[];
}

interface Passage {
  title: string;
  body: string | null;
  questions: Question[];
}

interface QResult {
  correct: boolean;
  answer: string;
  mine: string;
  explanation: string;
}

interface Graded {
  band: number | null;
  summary: string;
  transcript?: string;
}

/** Kết quả máy chủ trả về sau khi chấm một phần. Mỗi phần chỉ dùng vài trường. */
interface Report {
  band?: number | null;
  raw?: number;
  total?: number;
  results?: QResult[][];
  /** Chỉ phần Nghe: lời thoại, trả về sau khi đã chấm. */
  bodies?: string[];
  task1?: Graded | null;
  task2?: Graded | null;
  turns?: Record<string, Graded | null>;
}

const ICONS = { listening: Headphones, reading: BookOpen, writing: PenLine, speaking: MessageCircle };

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Mốc thời gian hiện tại.
 *
 * Tách ra ngoài component vì trình biên dịch React coi `Date.now()` viết thẳng
 * trong thân component là lời gọi không thuần, kể cả khi nó nằm trong một hàm
 * chỉ chạy lúc bấm nút. Ở đây đồng hồ chỉ được đọc từ trình xử lý sự kiện và từ
 * callback của `setInterval`, không bao giờ lúc dựng hình.
 */
const clockNow = () => Date.now();

/**
 * Thi thử đủ bốn kỹ năng, theo đúng thứ tự và thời lượng của bài thi thật.
 *
 * Đồng hồ chạy theo mốc thời gian (`deadline`) chứ không đếm lùi từng giây:
 * trình duyệt bóp nhịp `setInterval` khi tab chạy nền, nên đếm lùi sẽ chậm dần
 * và ba mươi phút phần Nghe thành bốn mươi phút thật.
 *
 * Hết giờ thì NỘP LUÔN, không hỏi lại. Đó là điểm của một bài thi thử — hỏi
 * "bạn có chắc không" lúc hết giờ là bỏ mất đúng thứ đang tập.
 */
export default function MockExamRunner({ languageId }: { languageId?: string }) {
  const { t } = useLanguage();

  const [examId, setExamId] = useState<string | null>(null);
  const [stage, setStage] = useState<"intro" | SectionId | "done">("intro");
  const [passages, setPassages] = useState<Passage[]>([]);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<string[]>([]);
  const [essays, setEssays] = useState<{ task1: string; task2: string }>({ task1: "", task2: "" });
  const [turns, setTurns] = useState<Record<string, { audio: string; seconds: number }>>({});
  const [plays, setPlays] = useState<number[]>([]);

  const [report, setReport] = useState<Report | null>(null);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [overall, setOverall] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const onDeadlineRef = useRef<(() => void) | null>(null);

  const [recordingPart, setRecordingPart] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const remaining = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  const spec: ExamSection | undefined = EXAM_SECTIONS.find((s) => s.id === stage);

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= deadline) onDeadlineRef.current?.();
    }, 500);
    return () => clearInterval(id);
  }, [deadline]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopSpeaking();
    },
    []
  );

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/mock-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không mở được bài thi");
      setExamId(json.examId);
      await openSection(json.examId, "listening");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const openSection = async (id: string, section: SectionId) => {
    setBusy(true);
    setError(null);
    setReport(null);
    setPassages([]);
    setAnswers([]);
    setPlays([]);
    stopSpeaking();
    try {
      const res = await fetch("/api/learning/mock-exam", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: id, section }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không soạn được đề");

      if (section === "listening" || section === "reading") {
        const list: Passage[] = json.passages ?? [];
        setPassages(list);
        setAnswers(new Array(list.reduce((n, p) => n + p.questions.length, 0)).fill(""));
        setPlays(new Array(list.length).fill(0));
      } else {
        setPrompts(json as Record<string, string>);
      }

      setStage(section);
      const minutes = EXAM_SECTIONS.find((s) => s.id === section)?.minutes ?? 30;
      onDeadlineRef.current = () => void submitSection(id, section);
      const startedAt = clockNow();
      setNow(startedAt);
      setDeadline(startedAt + minutes * 60_000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitSection = async (id: string, section: SectionId) => {
    onDeadlineRef.current = null;
    setDeadline(null);
    stopSpeaking();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/mock-exam", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: id,
          section,
          answers: section === "listening" || section === "reading" ? answers : undefined,
          essays: section === "writing" ? essays : undefined,
          recordings: section === "speaking" ? turns : undefined,
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không chấm được");
      setReport(json as Report);
      setScores((prev) => ({ ...prev, [section]: json.band ?? null }));
      setOverall(json.overall ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const playPassage = (index: number) => {
    fetch("/api/learning/mock-exam/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, index }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.success) return setError(j?.error || "Không phát được");
        speak(j.body, "en", 1);
        setPlays((prev) => prev.map((n, i) => (i === index ? n + 1 : n)));
      })
      .catch(() => setError(t("Could not play the audio", "Không phát được đoạn nghe")));
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecordingPart(null);
  };

  const recordPart = async (partId: string) => {
    setError(null);
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickRecordingType() || undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const raw = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        try {
          const { wav, seconds } = await toWav(raw);
          const audio = await toBase64(wav);
          setTurns((prev) => ({ ...prev, [partId]: { audio, seconds } }));
        } catch {
          setError(t("Could not process the recording.", "Không xử lý được đoạn thu."));
        }
      };

      recorder.start();
      setRecordingPart(partId);
      // Cắt ở gấp rưỡi thời lượng phần đó — quá mức ấy là đã đi lạc, và đoạn thu
      // càng dài thì chấm càng lâu.
      const cap = (SPEAKING_PARTS.find((p) => p.id === partId)?.seconds ?? 120) * 1.5;
      setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        setRecordingPart(null);
      }, cap * 1000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(t("Microphone access was refused.", "Micro bị từ chối quyền."));
    }
  };

  const nextSection = (): SectionId | null => {
    const order: SectionId[] = ["listening", "reading", "writing", "speaking"];
    const at = order.indexOf(stage as SectionId);
    return at >= 0 && at < order.length - 1 ? order[at + 1] : null;
  };

  const setAnswer = (index: number, value: string) =>
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));

  /* ── Màn mở đầu ──────────────────────────────────────────────────────── */
  if (stage === "intro") {
    return (
      <div className="space-y-6">
        <div className="c-alert c-alert-info">
          <Info size={18} className="icon" />
          <span className="flex-1">
            {t(
              "Same four sections, order and timings as the real test, with questions written fresh each time. Bands are AI estimates, not examiner scores.",
              "Đúng bốn phần, đúng thứ tự và thời lượng như bài thi thật, đề soạn mới mỗi lượt. Band là ước lượng của AI, không phải điểm giám khảo."
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EXAM_SECTIONS.map((section) => {
            const Icon = ICONS[section.id];
            return (
              <div key={section.id} className="c-card p-5 space-y-2">
                <p className="c-card-kicker flex items-center gap-2">
                  <Icon size={14} />
                  {t(section.en, section.vi)}
                </p>
                <p className="c-stat-value tabular-nums">
                  {section.minutes}
                  <span className="c-stat-label ml-1">{t("min", "phút")}</span>
                  {section.questions && (
                    <span className="c-stat-label ml-3">
                      {section.questions} {t("questions", "câu")}
                    </span>
                  )}
                </p>
                <p className="c-help">{t(section.noteEn, section.noteVi)}</p>
              </div>
            );
          })}
        </div>

        {!speechSupported() && (
          <div className="c-alert c-alert-warning">
            <AlertCircle size={18} className="icon" />
            <span className="flex-1">
              {t(
                "This browser cannot read text aloud, so the listening section will not play.",
                "Trình duyệt này không đọc thành tiếng được, nên phần Nghe sẽ không phát."
              )}
            </span>
          </div>
        )}
        {!canRecord() && (
          <div className="c-alert c-alert-warning">
            <AlertCircle size={18} className="icon" />
            <span className="flex-1">
              {t(
                "This browser cannot record audio, so the speaking section will not work.",
                "Trình duyệt này không thu âm được, nên phần Nói sẽ không chạy."
              )}
            </span>
          </div>
        )}

        {error && (
          <div className="c-alert c-alert-error">
            <AlertCircle size={18} className="icon" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        <button onClick={begin} disabled={busy} className="c-btn c-btn-primary c-btn-lg">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {busy ? t("Writing the paper…", "Đang soạn đề…") : t("Start the test", "Bắt đầu thi")}
        </button>
        {busy && (
          <p className="c-help">
            {t(
              "Four listening parts are being written at once; this takes about half a minute.",
              "Bốn đoạn nghe đang được soạn cùng lúc, mất khoảng nửa phút."
            )}
          </p>
        )}
      </div>
    );
  }

  /* ── Đã xong cả bài ──────────────────────────────────────────────────── */
  if (stage === "done") {
    return (
      <div className="space-y-6">
        <div className="c-card c-elev-md p-6 space-y-4">
          <p className="c-card-kicker flex items-center gap-2">
            <Award size={14} />
            {t("Overall band", "Band tổng")}
          </p>
          <p className="c-display tabular-nums">{overall ?? "—"}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {EXAM_SECTIONS.map((section) => (
              <div key={section.id} className="flex items-baseline justify-between gap-2">
                <span className="c-stat-label">{t(section.en, section.vi)}</span>
                <span className="tabular-nums font-medium">{scores[section.id] ?? "—"}</span>
              </div>
            ))}
          </div>
          <p className="c-help flex items-start gap-2">
            <Info size={14} className="flex-none mt-0.5" />
            {t(
              "Raw-score conversion here is this project's own approximation, not the official table, and the writing and speaking bands come from an AI. Treat the number as a rough position, not a prediction.",
              "Bảng quy đổi điểm thô ở đây là bảng xấp xỉ của dự án, không phải bảng chính thức, còn band Viết và Nói do AI chấm. Hãy coi con số này là một vị trí áng chừng, không phải dự đoán."
            )}
          </p>
        </div>
        <button onClick={() => window.location.reload()} className="c-btn c-btn-primary">
          {t("Take another test", "Thi lượt khác")}
        </button>
      </div>
    );
  }

  /* ── Đang làm một phần ───────────────────────────────────────────────── */
  const section = stage as SectionId;
  const Icon = ICONS[section];
  const low = remaining > 0 && remaining <= 300;

  let at = 0;

  return (
    <div className="space-y-6">
      {/* Thanh đầu: phần nào, còn bao lâu */}
      <div className="c-card c-elev-md p-4 flex flex-wrap items-center gap-3 sticky top-2 z-10">
        <span className="c-chip c-chip-solid flex items-center gap-1.5">
          <Icon size={13} />
          {spec ? t(spec.en, spec.vi) : section}
        </span>
        {deadline !== null && (
          <span
            className={`tabular-nums font-medium flex items-center gap-1.5 ${
              low ? "text-[var(--color-error)]" : ""
            }`}
          >
            <Clock size={15} />
            {mmss(remaining)}
          </span>
        )}
        {!report && (
          <button
            onClick={() => examId && void submitSection(examId, section)}
            disabled={busy}
            className="c-btn c-btn-primary c-btn-sm ml-auto"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {t("Submit section", "Nộp phần này")}
          </button>
        )}
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {/* ── Đã chấm xong phần này ── */}
      {report ? (
        <div className="space-y-5">
          <div className="c-card c-elev-md p-6 space-y-2">
            <p className="c-card-kicker">{t("Section result", "Kết quả phần này")}</p>
            <p className="c-display tabular-nums">
              {report.band ?? "—"}
              {typeof report.raw === "number" && (
                <span className="c-stat-label ml-3">
                  {report.raw}/{report.total} {t("correct", "câu đúng")}
                </span>
              )}
            </p>
          </div>

          {/* Bài nghe: giờ mới được xem lời thoại */}
          {report.bodies && (
            <div className="space-y-3">
              {report.bodies.map((body, i) => (
                <div key={i} className="c-card p-5 space-y-2">
                  <p className="c-card-kicker">
                    {t(`Transcript — part ${i + 1}`, `Lời thoại — phần ${i + 1}`)}
                  </p>
                  <p className="leading-relaxed whitespace-pre-wrap">{body}</p>
                </div>
              ))}
            </div>
          )}

          {report.results && (
            <div className="space-y-3">
              {report.results.flat().map((r, i) => (
                <div key={i} className="c-card p-4 space-y-1">
                  <p className="text-sm flex items-center gap-2">
                    <span className="c-stat-label tabular-nums">{i + 1}.</span>
                    {r.correct ? (
                      <span className="c-chip c-chip-success">{t("Correct", "Đúng")}</span>
                    ) : (
                      <span className="c-chip c-chip-warning">
                        {t(`You: ${r.mine || "—"} · Answer: ${r.answer}`, `Bạn: ${r.mine || "—"} · Đáp án: ${r.answer}`)}
                      </span>
                    )}
                  </p>
                  <p className="c-help">{r.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {(report.task1 || report.task2) && (
            <div className="space-y-3">
              {(["task1", "task2"] as const).map((key) => {
                const graded = report[key];
                if (!graded) return null;
                const taskSpec = WRITING_TASKS.find((task) => task.id === key)!;
                return (
                  <div key={key} className="c-card p-5 space-y-2">
                    <p className="c-card-kicker">{t(taskSpec.en, taskSpec.vi)}</p>
                    <p className="c-stat-value tabular-nums">{graded.band}</p>
                    <p className="leading-relaxed">{graded.summary}</p>
                  </div>
                );
              })}
            </div>
          )}

          {report.turns && (
            <div className="space-y-3">
              {SPEAKING_PARTS.map((part) => {
                const graded = report.turns?.[part.id];
                if (!graded) return null;
                return (
                  <div key={part.id} className="c-card p-5 space-y-2">
                    <p className="c-card-kicker">{t(part.en, part.vi)}</p>
                    <p className="c-stat-value tabular-nums">{graded.band}</p>
                    <p className="leading-relaxed">{graded.summary}</p>
                    <p className="c-help whitespace-pre-wrap">{graded.transcript}</p>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => {
              const next = nextSection();
              if (next && examId) void openSection(examId, next);
              else setStage("done");
            }}
            disabled={busy}
            className="c-btn c-btn-primary c-btn-lg"
          >
            {nextSection()
              ? t(
                  `Continue to ${EXAM_SECTIONS.find((s) => s.id === nextSection())?.en}`,
                  `Sang phần ${EXAM_SECTIONS.find((s) => s.id === nextSection())?.vi}`
                )
              : t("See the overall band", "Xem band tổng")}
          </button>
        </div>
      ) : busy && passages.length === 0 && Object.keys(prompts).length === 0 ? (
        <div className="flex items-center gap-2 c-help">
          <Loader2 size={16} className="animate-spin" />
          {t("Writing the paper…", "Đang soạn đề…")}
        </div>
      ) : (
        <>
          {/* ── Nghe và Đọc ── */}
          {(section === "listening" || section === "reading") &&
            passages.map((passage, pi) => (
              <div key={pi} className="space-y-4">
                <div className="c-card p-6 space-y-3">
                  <p className="c-card-kicker">
                    {section === "listening"
                      ? t(`Part ${pi + 1}`, `Phần ${pi + 1}`)
                      : t(`Passage ${pi + 1}`, `Bài đọc ${pi + 1}`)}
                    {" · "}
                    {passage.title}
                  </p>
                  {section === "listening" ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => playPassage(pi)} className="c-btn c-btn-primary">
                        <Volume2 size={16} />
                        {plays[pi] === 0 ? t("Play", "Nghe") : t("Play again", "Nghe lại")}
                      </button>
                      <span className="c-stat-label tabular-nums flex items-center gap-1">
                        <Gauge size={13} />
                        {t(`played ${plays[pi] ?? 0}×`, `đã nghe ${plays[pi] ?? 0} lần`)}
                      </span>
                    </div>
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap text-[17px]">{passage.body}</p>
                  )}
                </div>

                <div className="space-y-4">
                  {passage.questions.map((q) => {
                    const index = at++;
                    return (
                      <div key={index} className="c-card p-5 space-y-3">
                        <p className="font-medium">
                          <span className="c-stat-label mr-2 tabular-nums">{index + 1}.</span>
                          {q.prompt}
                        </p>
                        {q.type === "gap" ? (
                          <input
                            value={answers[index] ?? ""}
                            onChange={(e) => setAnswer(index, e.target.value)}
                            placeholder={t("Type your answer", "Gõ đáp án")}
                            className="c-input w-full"
                          />
                        ) : (
                          <div className="grid gap-2">
                            {q.options.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setAnswer(index, opt)}
                                className={`c-btn justify-start text-left ${
                                  answers[index] === opt ? "c-btn-primary" : "c-btn-secondary"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {/* ── Viết ── */}
          {section === "writing" &&
            WRITING_TASKS.map((task) => {
              const key = task.id;
              const prompt = key === "task1" ? prompts.task1 : prompts.task2;
              const count = words(essays[key]);
              return (
                <div key={key} className="space-y-3">
                  <div className="c-card p-6 space-y-2">
                    <p className="c-card-kicker">{t(task.en, task.vi)}</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{prompt}</p>
                    {key === "task1" && prompts.task1Data && (
                      <p className="c-help whitespace-pre-wrap">{prompts.task1Data}</p>
                    )}
                    <p className="c-help">
                      {t(
                        `About ${task.minMinutes} minutes, at least ${task.minWords} words.`,
                        `Khoảng ${task.minMinutes} phút, tối thiểu ${task.minWords} từ.`
                      )}
                    </p>
                  </div>
                  <textarea
                    value={essays[key]}
                    onChange={(e) => setEssays((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={12}
                    className="c-input w-full leading-relaxed"
                    placeholder={t("Write your answer here", "Viết bài của bạn ở đây")}
                  />
                  <p
                    className={`c-stat-label tabular-nums ${
                      count < task.minWords ? "text-[var(--color-warning)]" : ""
                    }`}
                  >
                    {count}/{task.minWords} {t("words", "từ")}
                  </p>
                </div>
              );
            })}

          {/* ── Nói ── */}
          {section === "speaking" &&
            SPEAKING_PARTS.map((part) => {
              const done = turns[part.id];
              return (
                <div key={part.id} className="c-card p-6 space-y-3">
                  <p className="c-card-kicker">{t(part.en, part.vi)}</p>
                  <p className="leading-relaxed whitespace-pre-wrap">{prompts[part.id]}</p>
                  <p className="c-help">{t(part.briefEn, part.briefVi)}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {recordingPart === part.id ? (
                      <button onClick={stopRecording} className="c-btn c-btn-danger">
                        <Square size={16} />
                        {t("Done speaking", "Nói xong")}
                      </button>
                    ) : (
                      <button
                        onClick={() => void recordPart(part.id)}
                        disabled={Boolean(recordingPart)}
                        className="c-btn c-btn-primary"
                      >
                        <Mic size={16} />
                        {done ? t("Record again", "Thu lại") : t("Answer", "Trả lời")}
                      </button>
                    )}
                    {done && (
                      <span className="c-chip c-chip-success">
                        <Check size={13} />
                        {t(`recorded ${Math.round(done.seconds)}s`, `đã thu ${Math.round(done.seconds)} giây`)}
                      </span>
                    )}
                    {recordingPart === part.id && (
                      <span className="c-stat-label flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--color-error)] animate-pulse" />
                        {t("Recording", "Đang thu")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

          <button
            onClick={() => examId && void submitSection(examId, section)}
            disabled={busy}
            className="c-btn c-btn-primary c-btn-lg"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {busy ? t("Marking…", "Đang chấm…") : t("Submit section", "Nộp phần này")}
          </button>
        </>
      )}
    </div>
  );
}
