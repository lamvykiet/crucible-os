"use client";

import { useState, useRef, useEffect } from "react";
import {
  Loader2, AlertCircle, Mic, Square, Play, RotateCcw, Sparkles, Check, Clock,
  MessageSquareQuote, Info,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { SPEAKING_PARTS, SPEAKING_CRITERIA } from "@/lib/ieltsFormat";
import { toWav, toBase64, canRecord, pickRecordingType } from "@/lib/audioWav";

interface Task {
  part: string;
  topic: string;
  prompt: string;
  seconds: number;
  prepSeconds: number;
}

interface Feedback {
  quote: string;
  issue: string;
  better: string;
}

interface Graded {
  transcript: string;
  seconds: number;
  band: number | null;
  criteria: Record<string, number>;
  feedback: Feedback[];
  summary: string | null;
  droppedQuotes: number;
}

type Phase = "idle" | "prep" | "recording" | "recorded" | "done";

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;

/**
 * Luyện nói theo ba phần của bài thi.
 *
 * Đồng hồ chạy theo MỐC THỜI GIAN thật (`deadline`) chứ không đếm lùi từng giây
 * trong một biến: trình duyệt bóp nhịp `setInterval` khi tab chạy nền, nên đếm
 * lùi sẽ chậm dần và hai phút Part 2 thành ba phút thật.
 *
 * Bài nói được gửi lên dưới dạng âm thanh để AI chấm cả phát âm — gỡ băng trước
 * rồi chấm chữ thì tiêu chí phát âm không còn căn cứ nào.
 */
export default function SpeakingPractice({
  languageId,
}: {
  languageId?: string;
}) {
  const { t } = useLanguage();

  const [partId, setPartId] = useState("part1");
  const [task, setTask] = useState<Task | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [recorded, setRecorded] = useState<{ wav: Blob; url: string; seconds: number } | null>(null);
  const [graded, setGraded] = useState<Graded | null>(null);

  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** Việc phải làm khi đồng hồ hết. Đặt cùng lúc với `deadline`. */
  const onDeadlineRef = useRef<(() => void) | null>(null);

  const spec = SPEAKING_PARTS.find((p) => p.id === partId) ?? SPEAKING_PARTS[0];
  const supported = canRecord();
  const remaining = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= deadline) onDeadlineRef.current?.();
    }, 250);
    return () => clearInterval(id);
  }, [deadline]);

  // Thu âm đang chạy mà rời trang thì phải tắt micro. Không tắt thì đèn micro
  // vẫn sáng sau khi người dùng đã đi sang tab khác.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    },
    []
  );

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopRecording = () => {
    onDeadlineRef.current = null;
    setDeadline(null);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const beginRecording = async () => {
    setError(null);
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
        releaseMic();
        const raw = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        try {
          const { wav, seconds } = await toWav(raw);
          setRecorded((prev) => {
            if (prev) URL.revokeObjectURL(prev.url);
            return { wav, url: URL.createObjectURL(wav), seconds };
          });
          setPhase("recorded");
        } catch {
          setError(
            t(
              "Could not process the recording on this device.",
              "Không xử lý được đoạn thu trên máy này."
            )
          );
          setPhase("idle");
        }
      };

      recorder.start();
      onDeadlineRef.current = stopRecording;
      setNow(Date.now());
      setDeadline(Date.now() + spec.seconds * 1000);
      setPhase("recording");
    } catch {
      releaseMic();
      setError(
        t(
          "Microphone access was refused, so speaking practice cannot run.",
          "Micro bị từ chối quyền, nên phần luyện nói không chạy được."
        )
      );
      setPhase("idle");
    }
  };

  /** Part 2 có một phút chuẩn bị; hai phần còn lại nói ngay. */
  const startTurn = () => {
    if (spec.prepSeconds > 0) {
      onDeadlineRef.current = () => void beginRecording();
      setNow(Date.now());
      setDeadline(Date.now() + spec.prepSeconds * 1000);
      setPhase("prep");
    } else {
      void beginRecording();
    }
  };

  const newTask = async () => {
    setLoading(true);
    setError(null);
    setTask(null);
    setGraded(null);
    setPhase("idle");
    setDeadline(null);
    onDeadlineRef.current = null;
    setRecorded((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    try {
      const res = await fetch("/api/learning/speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part: partId, languageId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không soạn được đề");
      setTask(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!recorded || !task || grading) return;
    setGrading(true);
    setError(null);
    try {
      const audio = await toBase64(recorded.wav);
      const res = await fetch("/api/learning/speaking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part: task.part,
          prompt: task.prompt,
          languageId,
          audio,
          mimeType: "audio/wav",
          seconds: Math.round(recorded.seconds),
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không chấm được bài");
      setGraded(json.attempt);
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGrading(false);
    }
  };

  if (!supported) {
    return (
      <div className="c-alert c-alert-warning">
        <AlertCircle size={18} className="icon" />
        <span className="flex-1">
          {t(
            "This browser cannot record audio, so speaking practice will not work here. Try Chrome or Safari.",
            "Trình duyệt này không thu âm được, nên phần luyện nói sẽ không chạy. Thử Chrome hoặc Safari."
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="c-seg">
          {SPEAKING_PARTS.map((p) => (
            <button
              key={p.id}
              className={`c-seg-opt ${partId === p.id ? "active" : ""}`}
              onClick={() => setPartId(p.id)}
              disabled={phase === "prep" || phase === "recording"}
            >
              {p.id === "part1" ? "Part 1" : p.id === "part2" ? "Part 2" : "Part 3"}
            </button>
          ))}
        </div>
        <button
          onClick={newTask}
          disabled={loading || phase === "prep" || phase === "recording"}
          className="c-btn c-btn-primary"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {task ? t("New question", "Đề khác") : t("Get a question", "Lấy đề")}
        </button>
      </div>

      <p className="c-help">{t(spec.briefEn, spec.briefVi)}</p>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {!task ? (
        <div className="c-card p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] grid place-content-center">
            <Mic size={28} />
          </div>
          <p className="c-h3">{t("Speaking practice", "Luyện nói")}</p>
          <p className="c-card-body max-w-sm">
            {t(
              "Answer out loud. Your recording is sent for transcription and a band estimate on all four criteria.",
              "Trả lời thành tiếng. Đoạn thu được gửi đi gỡ băng và ước lượng band trên cả bốn tiêu chí."
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="c-card p-6 space-y-3">
            <p className="c-card-kicker">{task.topic}</p>
            <p className="leading-relaxed whitespace-pre-wrap text-[17px]">{task.prompt}</p>
          </div>

          {/* Đồng hồ và nút thu */}
          <div className="c-card c-elev-md p-6 space-y-4">
            {phase === "prep" && (
              <div className="space-y-2">
                <p className="c-card-kicker">{t("Preparation", "Chuẩn bị")}</p>
                <p className="c-display tabular-nums">{mmss(remaining)}</p>
                <p className="c-help">
                  {t(
                    "Make notes. Recording starts on its own when this reaches zero.",
                    "Ghi ý ra giấy. Hết giờ là tự bắt đầu thu."
                  )}
                </p>
              </div>
            )}

            {phase === "recording" && (
              <div className="space-y-2">
                <p className="c-card-kicker flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-error)] animate-pulse" />
                  {t("Recording", "Đang thu")}
                </p>
                <p className="c-display tabular-nums">{mmss(remaining)}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {phase === "idle" && (
                <button onClick={startTurn} className="c-btn c-btn-primary c-btn-lg">
                  <Mic size={18} />
                  {spec.prepSeconds > 0
                    ? t(`Start — ${spec.prepSeconds}s to prepare`, `Bắt đầu — ${spec.prepSeconds}s chuẩn bị`)
                    : t("Start speaking", "Bắt đầu nói")}
                </button>
              )}

              {phase === "prep" && (
                <button onClick={() => void beginRecording()} className="c-btn c-btn-primary">
                  <Mic size={16} />
                  {t("Skip ahead and speak now", "Bỏ qua, nói luôn")}
                </button>
              )}

              {phase === "recording" && (
                <button onClick={stopRecording} className="c-btn c-btn-danger">
                  <Square size={16} />
                  {t("Done speaking", "Nói xong")}
                </button>
              )}

              {(phase === "recorded" || phase === "done") && recorded && (
                <>
                  <audio src={recorded.url} controls className="max-w-full" />
                  <span className="c-stat-label tabular-nums flex items-center gap-1">
                    <Clock size={13} />
                    {mmss(Math.round(recorded.seconds))}
                  </span>
                </>
              )}
            </div>

            {phase === "recorded" && (
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={submit} disabled={grading} className="c-btn c-btn-primary">
                  {grading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {grading ? t("Assessing…", "Đang chấm…") : t("Send for assessment", "Gửi đi chấm")}
                </button>
                <button onClick={startTurn} disabled={grading} className="c-btn c-btn-secondary">
                  <RotateCcw size={16} />
                  {t("Record again", "Thu lại")}
                </button>
              </div>
            )}

            {grading && (
              <p className="c-help">
                {t(
                  "Listening to the whole recording takes a moment — do not leave the page.",
                  "Nghe hết đoạn thu mất một lúc — đừng rời trang."
                )}
              </p>
            )}
          </div>

          {graded && (
            <div className="space-y-5">
              <div className="c-card c-elev-md p-6 space-y-4">
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="c-card-kicker">{t("Estimated band", "Band ước lượng")}</p>
                    <p className="c-display tabular-nums">{graded.band ?? "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 flex-1 min-w-[240px]">
                    {SPEAKING_CRITERIA.map((c) => (
                      <div key={c.key} className="flex items-baseline justify-between gap-2">
                        <span className="c-stat-label">{t(c.en, c.vi)}</span>
                        <span className="tabular-nums font-medium">
                          {graded.criteria?.[c.key] ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="c-help flex items-start gap-2">
                  <Info size={14} className="flex-none mt-0.5" />
                  {t(
                    "An AI estimate for practice, not an examiner's score. Use it to see roughly where you are and what to fix first.",
                    "Đây là ước lượng của AI để tự luyện, không phải điểm giám khảo. Dùng nó để biết mình đang ở quãng nào và nên sửa gì trước."
                  )}
                </p>

                {graded.summary && <p className="leading-relaxed">{graded.summary}</p>}
              </div>

              {graded.feedback.length > 0 && (
                <div className="space-y-3">
                  <p className="c-card-kicker">{t("Line by line", "Sửa từng chỗ")}</p>
                  {graded.feedback.map((f, i) => (
                    <div key={i} className="c-card p-5 space-y-2">
                      <p className="text-sm flex items-start gap-2 text-[var(--color-text-muted)]">
                        <MessageSquareQuote size={14} className="flex-none mt-1" />
                        <span>{f.quote}</span>
                      </p>
                      <p className="text-sm">{f.issue}</p>
                      <p className="text-sm font-medium text-[var(--color-success)]">{f.better}</p>
                    </div>
                  ))}
                </div>
              )}

              {graded.droppedQuotes > 0 && (
                <p className="c-help">
                  {t(
                    `${graded.droppedQuotes} suggestion(s) were dropped because their quote did not appear in the transcript.`,
                    `Đã bỏ ${graded.droppedQuotes} nhận xét vì chỗ trích không có trong bản gỡ băng.`
                  )}
                </p>
              )}

              <div className="c-card p-6 space-y-2">
                <p className="c-card-kicker">{t("Transcript", "Bản gỡ băng")}</p>
                <p className="c-help">
                  {t(
                    "Kept exactly as spoken, hesitations and all — the slips are the point.",
                    "Giữ đúng như đã nói, cả chỗ ngập ngừng — chính những chỗ sai đó mới là cái đáng xem."
                  )}
                </p>
                <p className="leading-relaxed whitespace-pre-wrap">{graded.transcript}</p>
              </div>

              <button onClick={newTask} className="c-btn c-btn-primary">
                <Play size={16} />
                {t("Next question", "Đề tiếp")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
