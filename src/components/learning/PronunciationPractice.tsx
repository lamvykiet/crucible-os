"use client";

import { useState, useRef, useEffect } from "react";
import {
  Loader2, AlertCircle, Mic, Square, Volume2, Check, X, ArrowLeft, ArrowRight,
  Lightbulb, Ear, Gauge,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, stopSpeaking, speechSupported, hasVoiceFor } from "@/lib/speech";
import { toWav, toBase64, canRecord, pickRecordingType } from "@/lib/audioWav";

interface Target {
  id: string;
  symbol: string;
  en: string; vi: string;
  hintEn: string; hintVi: string;
  attempts: number;
  correct: number;
}

interface DrillItem {
  text: string;
  phonetic: string;
  watchFor: string;
}

interface Verdict {
  heard: string;
  accuracy: number;
  targetProduced: boolean;
  notes: string;
  tip: string;
}

/** Tối đa 15 giây cho một chữ — dài hơn thế là đang nói chuyện khác. */
const MAX_SECONDS = 15;

/**
 * Luyện phát âm từng chỗ khó.
 *
 * Phản hồi trả về ngay sau từng chữ, không dồn tới cuối bài: nghe mình vừa sai
 * đúng lúc vừa đọc thì còn sửa được, còn nhận một bảng điểm sau tám chữ thì
 * không nhớ chữ nào là chữ nào.
 *
 * Máy không có giọng cho thứ tiếng này thì nút nghe mẫu bị khoá kèm lời giải
 * thích, chứ không phát ra một giọng sai — bắt chước một mẫu sai thì tệ hơn là
 * không có mẫu nào.
 */
export default function PronunciationPractice({
  languageId,
}: {
  languageId?: string;
}) {
  const { t } = useLanguage();

  const [targets, setTargets] = useState<Target[]>([]);
  const [code, setCode] = useState("en");
  const [chosen, setChosen] = useState<Target | null>(null);
  const [items, setItems] = useState<DrillItem[]>([]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const listKey = languageId ?? "—";
  const loadingList = loadedFor !== listKey;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported = canRecord();
  const canHear = speechSupported() && hasVoiceFor(code);
  const current = items[at] ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const query = languageId ? `?languageId=${encodeURIComponent(languageId)}` : "";
    fetch(`/api/learning/pronunciation${query}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không đọc được danh sách");
        setTargets(json.targets ?? []);
        setCode(json.code ?? "en");
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(listKey);
      });
    return () => controller.abort();
  }, [listKey, languageId]);

  // Rời trang giữa lúc đang thu thì phải tắt micro, không thì đèn micro còn sáng.
  useEffect(
    () => () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopSpeaking();
    },
    []
  );

  const startDrill = async (target: Target) => {
    setBusy(true);
    setError(null);
    setChosen(target);
    setItems([]);
    setVerdict(null);
    setAt(0);
    try {
      const res = await fetch("/api/learning/pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, targetId: target.id }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không soạn được bài");
      setItems(json.items ?? []);
      setItemId(json.itemId ?? null);
    } catch (err) {
      setError((err as Error).message);
      setChosen(null);
    } finally {
      setBusy(false);
    }
  };

  const grade = async (wav: Blob) => {
    if (!itemId) return;
    setBusy(true);
    try {
      const audio = await toBase64(wav);
      const res = await fetch("/api/learning/pronunciation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, index: at, audio, mimeType: "audio/wav" }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không chấm được");
      setVerdict(json.result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  };

  const record = async () => {
    setError(null);
    setVerdict(null);
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
          const { wav } = await toWav(raw);
          await grade(wav);
        } catch {
          setError(t("Could not process the recording.", "Không xử lý được đoạn thu."));
        }
      };

      recorder.start();
      setRecording(true);
      stopTimerRef.current = setTimeout(stop, MAX_SECONDS * 1000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(
        t(
          "Microphone access was refused, so pronunciation practice cannot run.",
          "Micro bị từ chối quyền, nên phần luyện phát âm không chạy được."
        )
      );
    }
  };

  const move = (delta: number) => {
    stop();
    setVerdict(null);
    setAt((prev) => Math.max(0, Math.min(items.length - 1, prev + delta)));
  };

  if (!supported) {
    return (
      <div className="c-alert c-alert-warning">
        <AlertCircle size={18} className="icon" />
        <span className="flex-1">
          {t(
            "This browser cannot record audio, so pronunciation practice will not work here. Try Chrome or Safari.",
            "Trình duyệt này không thu âm được, nên phần luyện phát âm không chạy. Thử Chrome hoặc Safari."
          )}
        </span>
      </div>
    );
  }

  // ── Chọn chỗ khó ─────────────────────────────────────────────────────────
  if (!chosen) {
    return (
      <div className="space-y-6">
        {error && (
          <div className="c-alert c-alert-error">
            <AlertCircle size={18} className="icon" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {loadingList ? (
          <div className="flex items-center gap-2 c-help">
            <Loader2 size={16} className="animate-spin" />
            {t("Loading…", "Đang tải…")}
          </div>
        ) : targets.length === 0 ? (
          <div className="c-card p-10 text-center space-y-2">
            <p className="c-h3">{t("Nothing to drill yet", "Chưa có mục luyện")}</p>
            <p className="c-card-body">
              {t(
                "This language does not have a hand-written list of hard sounds yet.",
                "Thứ tiếng này chưa có danh sách chỗ khó viết tay."
              )}
            </p>
          </div>
        ) : (
          <>
            <p className="c-help">
              {t(
                "Each card is one sound to get right. Pick one and work through eight items.",
                "Mỗi thẻ là một âm cần làm cho đúng. Chọn một thẻ rồi đi qua tám chữ."
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {targets.map((target) => {
                const rate =
                  target.attempts > 0
                    ? Math.round((target.correct / target.attempts) * 100)
                    : null;
                return (
                  <button
                    key={target.id}
                    onClick={() => void startDrill(target)}
                    disabled={busy}
                    className="c-card p-5 text-left space-y-2 hover:border-[var(--color-primary)] transition-colors"
                  >
                    <p className="c-h4 text-[var(--color-primary)]">{target.symbol}</p>
                    <p className="font-medium">{t(target.en, target.vi)}</p>
                    <p className="c-help line-clamp-2">{t(target.hintEn, target.hintVi)}</p>
                    {rate !== null && (
                      <p className="c-stat-label tabular-nums">
                        {t(
                          `${rate}% correct over ${target.attempts} tries`,
                          `đúng ${rate}% trên ${target.attempts} lượt`
                        )}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Đang luyện ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            stop();
            setChosen(null);
            setItems([]);
            setVerdict(null);
          }}
          className="c-btn c-btn-tertiary c-btn-sm -ml-3"
        >
          <ArrowLeft size={16} />
          {t("All sounds", "Mọi âm")}
        </button>
        <span className="c-chip c-chip-solid">{chosen.symbol}</span>
        <span className="font-medium">{t(chosen.en, chosen.vi)}</span>
        {items.length > 0 && (
          <span className="c-stat-label ml-auto tabular-nums">
            {at + 1}/{items.length}
          </span>
        )}
      </div>

      <div className="c-card p-5">
        <p className="c-card-kicker flex items-center gap-2">
          <Lightbulb size={14} />
          {t("What to do", "Cách làm")}
        </p>
        <p className="leading-relaxed">{t(chosen.hintEn, chosen.hintVi)}</p>
      </div>

      {!canHear && (
        <div className="c-alert c-alert-warning">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">
            {t(
              "This device has no voice installed for this language, so there is no model to listen to. You can still record and get feedback.",
              "Máy này chưa có giọng cho thứ tiếng đang học, nên không có mẫu để nghe. Bạn vẫn thu âm và nhận nhận xét được."
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

      {items.length === 0 ? (
        <div className="flex items-center gap-2 c-help">
          <Loader2 size={16} className="animate-spin" />
          {t("Writing the drill…", "Đang soạn bài…")}
        </div>
      ) : (
        current && (
          <>
            <div className="c-card c-elev-md p-6 space-y-4">
              <div className="space-y-1">
                <p className="c-h1 break-words">{current.text}</p>
                <p className="c-stat-label">{current.phonetic}</p>
              </div>

              <p className="c-help">{current.watchFor}</p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => speak(current.text, code, 0.85)}
                  disabled={!canHear}
                  className="c-btn c-btn-secondary"
                >
                  <Volume2 size={16} />
                  {t("Hear the model", "Nghe mẫu")}
                </button>

                {recording ? (
                  <button onClick={stop} className="c-btn c-btn-danger">
                    <Square size={16} />
                    {t("Stop", "Dừng")}
                  </button>
                ) : (
                  <button onClick={() => void record()} disabled={busy} className="c-btn c-btn-primary">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                    {busy
                      ? t("Listening to you…", "Đang nghe bạn…")
                      : verdict
                        ? t("Try again", "Đọc lại")
                        : t("Say it", "Đọc đi")}
                  </button>
                )}

                {recording && (
                  <span className="c-stat-label flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-error)] animate-pulse" />
                    {t("Recording", "Đang thu")}
                  </span>
                )}
              </div>
            </div>

            {verdict && (
              <div className="c-card p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span
                    className={`c-chip ${verdict.targetProduced ? "c-chip-success c-pop" : "c-chip-warning c-nudge"}`}
                  >
                    {verdict.targetProduced ? <Check size={14} /> : <X size={14} />}
                    {verdict.targetProduced
                      ? t("Target sound produced", "Đã phát đúng âm cần luyện")
                      : t("Target sound not there yet", "Âm cần luyện chưa ra")}
                  </span>
                  <span className="c-stat-label flex items-center gap-1 tabular-nums">
                    <Gauge size={13} />
                    {verdict.accuracy}%
                  </span>
                </div>

                <div className="c-progress">
                  <span style={{ width: `${verdict.accuracy}%` }} />
                </div>

                <p className="flex items-start gap-2">
                  <Ear size={15} className="flex-none mt-1 text-[var(--color-text-faint)]" />
                  <span>
                    <span className="c-stat-label mr-2">{t("Heard", "Nghe được")}</span>
                    <span className="font-medium">{verdict.heard}</span>
                  </span>
                </p>

                <p className="leading-relaxed">{verdict.notes}</p>

                {verdict.tip && (
                  <p className="leading-relaxed flex items-start gap-2 text-[var(--color-primary)]">
                    <Lightbulb size={15} className="flex-none mt-1" />
                    {verdict.tip}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => move(-1)}
                disabled={at === 0}
                className="c-btn c-btn-secondary"
              >
                <ArrowLeft size={16} />
                {t("Back", "Trước")}
              </button>
              <button
                onClick={() => move(1)}
                disabled={at >= items.length - 1}
                className="c-btn c-btn-primary"
              >
                {t("Next", "Tiếp")}
                <ArrowRight size={16} />
              </button>
              {at >= items.length - 1 && (
                <button
                  onClick={() => void startDrill(chosen)}
                  disabled={busy}
                  className="c-btn c-btn-secondary"
                >
                  {t("Another set", "Bộ khác")}
                </button>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
