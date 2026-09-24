"use client";

import { useState, useEffect } from "react";
import {
  PenLine, Loader2, AlertCircle, RefreshCw, Timer, Check, X, Sparkles, Info,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { WRITING_TASKS, WRITING_CRITERIA, type CriterionKey } from "@/lib/ieltsFormat";

interface Task {
  taskType: "task1" | "task2";
  prompt: string;
  promptData: string | null;
  minWords: number;
  minMinutes: number;
}

interface Graded {
  id: string;
  band: number | null;
  criteria: Record<string, number>;
  feedback: { quote: string; issue: string; better: string }[];
  summary: string | null;
  wordCount: number;
}

const clock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Luyện viết theo định dạng IELTS.
 *
 * Bám sát cách kỳ thi vận hành ở những chỗ thật sự tạo ra áp lực: thời gian
 * riêng cho từng task, số từ tối thiểu, và bốn tiêu chí chấm. Đó là thông tin
 * công khai về định dạng; đề thì do AI sinh mới chứ không chép đề thi thật.
 *
 * Đồng hồ đếm xuôi chứ không đếm ngược và không tự khoá bài khi hết giờ. Lúc
 * luyện, viết xong một bài dài quá giờ vẫn có ích hơn là bị cắt giữa chừng —
 * nhưng vẫn thấy mình đã vượt bao nhiêu.
 */
export default function WritingPractice({ languageId }: { languageId?: string }) {
  const { t } = useLanguage();

  const [taskType, setTaskType] = useState<"task1" | "task2">("task2");
  const [task, setTask] = useState<Task | null>(null);
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  const [loadingTask, setLoadingTask] = useState(false);
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spec = WRITING_TASKS.find((x) => x.id === taskType)!;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Đồng hồ chỉ chạy khi đã có đề và chưa nộp.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const newTask = async () => {
    setLoadingTask(true);
    setError(null);
    setGraded(null);
    setText("");
    setSeconds(0);
    setRunning(false);
    try {
      const res = await fetch("/api/learning/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không ra được đề");
      setTask(json.task);
      setRunning(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingTask(false);
    }
  };

  const submit = async () => {
    if (!task || grading || !text.trim()) return;
    setGrading(true);
    setRunning(false);
    setError(null);
    try {
      const res = await fetch("/api/learning/writing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: task.taskType,
          prompt: task.prompt,
          promptData: task.promptData,
          response: text,
          minutesSpent: Math.round(seconds / 60),
          languageId,
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không chấm được bài");
      setGraded(json.submission);
    } catch (err) {
      setError((err as Error).message);
      setRunning(true);
    } finally {
      setGrading(false);
    }
  };

  const overtime = seconds > spec.minMinutes * 60;
  const short = words > 0 && words < spec.minWords;

  return (
    <div className="space-y-6">
      {/* Chọn dạng bài */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="c-seg">
          {WRITING_TASKS.map((x) => (
            <button
              key={x.id}
              className={`c-seg-opt ${taskType === x.id ? "active" : ""}`}
              onClick={() => { setTaskType(x.id); setTask(null); setGraded(null); }}
            >
              {t(x.en, x.vi)}
            </button>
          ))}
        </div>

        <button onClick={newTask} disabled={loadingTask} className="c-btn c-btn-primary">
          {loadingTask ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {task ? t("New prompt", "Đề khác") : t("Get a prompt", "Lấy đề")}
        </button>

        {task && (
          <span
            className={`c-stat-label inline-flex items-center gap-1.5 tabular-nums ${
              overtime ? "text-[var(--color-warning)]" : ""
            }`}
          >
            <Timer size={13} />
            {clock(seconds)} / {spec.minMinutes}:00
          </span>
        )}
      </div>

      <p className="c-help">
        {t(
          `${spec.briefEn} Aim for ${spec.minWords}+ words in about ${spec.minMinutes} minutes.`,
          `${spec.briefVi} Hướng tới ${spec.minWords}+ từ trong khoảng ${spec.minMinutes} phút.`
        )}
      </p>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <div className="flex-1 space-y-2">
            <p>{error}</p>
            <button onClick={graded ? newTask : submit} className="c-btn c-btn-secondary c-btn-sm">
              <RefreshCw size={14} />
              {t("Try again", "Thử lại")}
            </button>
          </div>
        </div>
      )}

      {!task ? (
        <div className="c-card p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] grid place-content-center">
            <PenLine size={28} />
          </div>
          <p className="c-h3">{t("No prompt yet", "Chưa có đề")}</p>
          <p className="c-card-body max-w-sm">
            {t(
              "Prompts are written fresh each time, in the format of the real exam.",
              "Đề được soạn mới mỗi lần, theo đúng định dạng của bài thi thật."
            )}
          </p>
        </div>
      ) : (
        <>
          {/* Đề */}
          <div className="c-card p-6 space-y-3">
            <p className="c-card-kicker">{t("Prompt", "Đề bài")}</p>
            <p className="text-[17px] leading-relaxed">{task.prompt}</p>
            {task.promptData && (
              <div className="rounded-xl p-4 bg-[var(--color-surface-2)] whitespace-pre-wrap text-sm">
                {task.promptData}
              </div>
            )}
          </div>

          {/* Bài làm */}
          {!graded && (
            <div className="space-y-3">
              <textarea
                className="c-textarea w-full min-h-[340px] leading-relaxed"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => !graded && setRunning(true)}
                placeholder={t("Start writing...", "Bắt đầu viết...")}
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className={`c-stat-label tabular-nums ${short ? "text-[var(--color-warning)]" : ""}`}>
                  {t(`${words} words`, `${words} từ`)}
                  {short && t(` · ${spec.minWords} needed`, ` · cần ${spec.minWords}`)}
                </span>
                <button
                  onClick={submit}
                  disabled={grading || !text.trim()}
                  className="c-btn c-btn-primary ml-auto"
                >
                  {grading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {grading ? t("Marking...", "Đang chấm...") : t("Submit for marking", "Nộp bài chấm")}
                </button>
              </div>
            </div>
          )}

          {/* Kết quả */}
          {graded && (
            <div className="space-y-5">
              <div className="c-card c-elev-md p-6 space-y-5">
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="c-card-kicker">{t("Estimated band", "Band ước lượng")}</p>
                    <p className="c-stat-value">{graded.band?.toFixed(1) ?? "—"}</p>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    {WRITING_CRITERIA.map((c) => (
                      <div key={c.key}>
                        <p className="c-stat-value text-[24px]">
                          {graded.criteria[c.key as CriterionKey]?.toFixed(1) ?? "—"}
                        </p>
                        <p className="c-stat-label max-w-[110px] leading-tight">{t(c.en, c.vi)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nói rõ đây là ước lượng — để người học không mang con số này đi
                    đặt kỳ vọng cho kỳ thi thật. */}
                <div className="c-alert c-alert-info">
                  <Info size={18} className="icon" />
                  <span className="flex-1">
                    {t(
                      "This band is an AI estimate for practice. It is not an examiner's mark.",
                      "Band này do AI ước lượng để bạn tự luyện, không phải điểm của giám khảo."
                    )}
                  </span>
                </div>

                {graded.summary && <p className="leading-relaxed">{graded.summary}</p>}
              </div>

              {graded.feedback.length > 0 && (
                <div className="space-y-3">
                  <h3 className="c-h3">{t("Line by line", "Sửa từng chỗ")}</h3>
                  {graded.feedback.map((f, i) => (
                    <div key={i} className="c-card p-4 space-y-2">
                      <p className="text-sm line-through text-[var(--color-text-muted)]">{f.quote}</p>
                      <p className="text-sm flex items-start gap-2">
                        <X size={14} className="text-[var(--color-error)] flex-none mt-0.5" />
                        {f.issue}
                      </p>
                      <p className="text-sm flex items-start gap-2">
                        <Check size={14} className="text-[var(--color-success)] flex-none mt-0.5" />
                        <span className="font-medium">{f.better}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button onClick={newTask} className="c-btn c-btn-primary">
                  <Sparkles size={16} />
                  {t("Another prompt", "Làm đề khác")}
                </button>
                <button onClick={() => setGraded(null)} className="c-btn c-btn-secondary">
                  {t("Back to my answer", "Xem lại bài của tôi")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
