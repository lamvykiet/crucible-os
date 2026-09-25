"use client";

import { useState, useRef, useEffect } from "react";
import {
  Loader2, AlertCircle, Volume2, Gauge, Check, ArrowLeft, ArrowRight,
  Headphones, CircleCheck, Eye, RotateCcw, PenLine,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, stopSpeaking, speechSupported, hasVoiceFor, whenVoicesReady } from "@/lib/speech";

interface SetCard {
  id: string;
  title: string;
  level: string;
  note: string;
  total: number;
  cleared: number;
}

interface LineState {
  index: number;
  cleared: boolean;
  lastAccuracy: number;
  attempts: number;
}

interface Mark {
  unit: string;
  typed: string;
  correct: boolean;
}

interface Verdict {
  accuracy: number;
  perfect: boolean;
  correct: number;
  total: number;
  extra: number;
  marks: Mark[];
  text: string;
  phonetic: string;
  meaning: string;
}

/**
 * Nghe chép chính tả.
 *
 * Khác hẳn phần luyện nghe đã có. Luyện nghe hỏi "bài này nói về gì" — nghe sót
 * vài chữ vẫn trả lời đúng. Chép chính tả bắt viết lại TỪNG CHỮ, nên nó lộ ra
 * đúng những âm mình vẫn nghe nhầm bấy lâu.
 *
 * Câu không nằm sẵn trong trang: mỗi lượt bấm phát mới xin máy chủ đúng câu đó.
 * Với bài chép chính tả thì chỉ liếc thấy một chữ là hỏng cả câu.
 */
export default function DictationPractice({
  languageId,
  langCode,
}: {
  languageId: string;
  langCode: string;
}) {
  const { t } = useLanguage();

  const [sets, setSets] = useState<SetCard[]>([]);
  const [scale, setScale] = useState<string | null>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [level, setLevel] = useState("all");

  const [open, setOpen] = useState<{ id: string; title: string; note: string; accepts: string[] } | null>(null);
  const [lines, setLines] = useState<LineState[]>([]);
  const [at, setAt] = useState(0);

  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [plays, setPlays] = useState(0);
  const [tries, setTries] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [voiceReady, setVoiceReady] = useState(() => hasVoiceFor(langCode));

  const inputRef = useRef<HTMLInputElement>(null);
  /** Chữ của câu đang nghe, chỉ giữ trong bộ nhớ để đọc — không render ra. */
  const spokenRef = useRef<string>("");

  const loading = loadedFor !== langCode;
  const canHear = speechSupported() && voiceReady;

  // Danh sách giọng nạp không đồng bộ: hỏi lần đầu thường trả về rỗng.
  useEffect(() => whenVoicesReady(() => setVoiceReady(hasVoiceFor(langCode))), [langCode]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/dictation?languageId=${encodeURIComponent(languageId)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không đọc được danh sách");
        setSets(json.sets ?? []);
        setScale(json.scale ?? null);
        setLevels(json.levels ?? []);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(langCode);
      });
    return () => controller.abort();
  }, [languageId, langCode]);

  useEffect(() => () => stopSpeaking(), []);

  const openSet = async (card: SetCard) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/dictation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, setId: card.id }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không mở được bộ câu");
      setOpen({ id: json.set.id, title: json.set.title, note: json.set.note, accepts: json.set.accepts });
      setLines(json.set.lines ?? []);
      // Nhảy thẳng tới câu đầu tiên chưa gõ đúng, đừng bắt làm lại từ đầu.
      const next = (json.set.lines ?? []).findIndex((l: LineState) => !l.cleared);
      setAt(next >= 0 ? next : 0);
      setTyped("");
      setVerdict(null);
      setPlays(0);
      setTries(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const play = async (rate = 1) => {
    if (!open) return;
    setError(null);
    try {
      // Đã chấm rồi thì chữ có sẵn, khỏi xin lại.
      if (verdict) {
        speak(verdict.text, langCode, rate);
        setPlays((n) => n + 1);
        return;
      }
      if (!spokenRef.current) {
        const res = await fetch("/api/learning/dictation/line", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ languageId, setId: open.id, index: at }),
        });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.error || "Không lấy được câu");
        spokenRef.current = json.text;
      }
      speak(spokenRef.current, langCode, rate);
      setPlays((n) => n + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const submit = async () => {
    if (!open || busy || verdict) return;
    setBusy(true);
    setError(null);
    stopSpeaking();
    try {
      const res = await fetch("/api/learning/dictation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, setId: open.id, index: at, input: typed, firstTry: tries === 0 }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không chấm được");
      setVerdict(json.result);
      setTries((n) => n + 1);
      setLines((prev) =>
        prev.map((l) =>
          l.index === at
            ? { ...l, cleared: l.cleared || json.result.perfect, lastAccuracy: json.result.accuracy, attempts: l.attempts + 1 }
            : l
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const goTo = (index: number) => {
    stopSpeaking();
    spokenRef.current = "";
    setAt(index);
    setTyped("");
    setVerdict(null);
    setPlays(0);
    setTries(0);
    inputRef.current?.focus();
  };

  const retry = () => {
    stopSpeaking();
    setTyped("");
    setVerdict(null);
    inputRef.current?.focus();
  };

  /* ── Chọn bộ câu ─────────────────────────────────────────────────────── */
  if (!open) {
    const visible = level === "all" ? sets : sets.filter((s) => s.level === level);
    return (
      <div className="space-y-6">
        {!canHear && (
          <div className="c-alert c-alert-warning">
            <AlertCircle size={18} className="icon" />
            <span className="flex-1">
              {t(
                "This device has no voice for this language, so nothing can be played aloud. Dictation needs one.",
                "Máy này chưa có giọng cho thứ tiếng đang học nên không phát được tiếng. Chép chính tả thì bắt buộc phải có."
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

        <p className="c-help">
          {t(
            "Listen and write down exactly what you hear, word by word. Comprehension questions let you skate past the words you miss; this does not.",
            "Nghe rồi chép lại đúng từng chữ. Câu hỏi hiểu ý cho phép lướt qua những chữ nghe hụt, còn cách này thì không."
          )}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 c-help">
            <Loader2 size={16} className="animate-spin" />
            {t("Loading…", "Đang tải…")}
          </div>
        ) : sets.length === 0 ? (
          <div className="c-card p-10 text-center space-y-2">
            <p className="c-h3">{t("Nothing here yet", "Chưa có bộ câu")}</p>
            <p className="c-card-body">
              {t(
                "This language does not have a hand-written sentence set yet.",
                "Thứ tiếng này chưa có bộ câu soạn tay."
              )}
            </p>
          </div>
        ) : (
          <>
            {scale && (
              <div className="space-y-2">
                <p className="c-stat-label">
                  {scale === "Tự đặt"
                    ? t("Levels on this project's own scale", "Cấp độ theo thang tự đặt của dự án")
                    : t(`Levels on the ${scale} scale`, `Cấp độ theo thang ${scale}`)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setLevel("all")}
                    className={`c-chip ${level === "all" ? "c-chip-solid" : "c-chip-outline"}`}
                  >
                    {t("All", "Tất cả")} ({sets.length})
                  </button>
                  {levels.map((lv) => {
                    const n = sets.filter((s) => s.level === lv).length;
                    if (n === 0) return null;
                    return (
                      <button
                        key={lv}
                        onClick={() => setLevel(lv)}
                        className={`c-chip ${level === lv ? "c-chip-solid" : "c-chip-outline"}`}
                      >
                        {lv} ({n})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((card) => {
                const done = card.total > 0 ? Math.round((card.cleared / card.total) * 100) : 0;
                return (
                  <button
                    key={card.id}
                    onClick={() => void openSet(card)}
                    disabled={busy}
                    className="c-card p-5 text-left space-y-2 hover:border-[var(--color-primary)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium flex-1">{card.title}</p>
                      <span className="c-chip c-chip-outline flex-none">{card.level}</span>
                    </div>
                    <p className="c-help line-clamp-2">{card.note}</p>
                    <div className="c-progress">
                      <div className="c-progress-fill" style={{ width: `${done}%` }} />
                    </div>
                    <p className="c-stat-label tabular-nums">
                      {t(`${card.cleared} of ${card.total} written`, `Đã chép đúng ${card.cleared}/${card.total}`)}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  /* ── Đang chép một bộ ────────────────────────────────────────────────── */
  const clearedCount = lines.filter((l) => l.cleared).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            stopSpeaking();
            spokenRef.current = "";
            setOpen(null);
            setVerdict(null);
          }}
          className="c-btn c-btn-tertiary c-btn-sm -ml-3"
        >
          <ArrowLeft size={16} />
          {t("All sets", "Mọi bộ câu")}
        </button>
        <span className="font-medium">{open.title}</span>
        <span className="c-stat-label ml-auto tabular-nums">
          {t(`${clearedCount}/${lines.length} written`, `đúng ${clearedCount}/${lines.length}`)}
        </span>
      </div>

      {/* Dải ô vuông: nhìn là biết câu nào đã xong, bấm là nhảy tới */}
      <div className="flex flex-wrap gap-1.5">
        {lines.map((l) => (
          <button
            key={l.index}
            onClick={() => goTo(l.index)}
            title={t(`Sentence ${l.index + 1}`, `Câu ${l.index + 1}`)}
            className={`w-7 h-7 rounded-md text-[11px] font-bold tabular-nums grid place-content-center transition-colors ${
              l.index === at
                ? "bg-[var(--color-primary)] text-white"
                : l.cleared
                  ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
            }`}
          >
            {l.index + 1}
          </button>
        ))}
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      <div className="c-card c-elev-md p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="c-chip c-chip-solid tabular-nums">
            {t(`Sentence ${at + 1}`, `Câu ${at + 1}`)}
          </span>
          <button onClick={() => void play(1)} disabled={!canHear} className="c-btn c-btn-primary">
            <Volume2 size={16} />
            {plays === 0 ? t("Play", "Nghe") : t("Play again", "Nghe lại")}
          </button>
          <button onClick={() => void play(0.6)} disabled={!canHear} className="c-btn c-btn-secondary">
            <Gauge size={16} />
            {t("Slower", "Chậm hơn")}
          </button>
          <span className="c-stat-label tabular-nums">
            {t(`played ${plays}×`, `đã nghe ${plays} lần`)}
          </span>
        </div>

        {!verdict ? (
          <>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder={
                open.accepts.includes("phonetic")
                  ? t("Type what you heard — script or romanisation", "Gõ lại điều bạn nghe được — chữ viết hoặc phiên âm")
                  : t("Type what you heard", "Gõ lại điều bạn nghe được")
              }
              className="c-input w-full text-[17px]"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={submit} disabled={busy || !typed.trim()} className="c-btn c-btn-primary">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {t("Check", "Chấm")}
              </button>
              <button
                onClick={() => {
                  setTyped("");
                  void submit();
                }}
                disabled={busy}
                className="c-btn c-btn-tertiary c-btn-sm"
              >
                <Eye size={14} />
                {t("Give up, show me", "Chịu, cho xem đáp án")}
              </button>
            </div>
            {open.accepts.includes("phonetic") && (
              <p className="c-help">
                {t(
                  "Either the script or the romanisation counts. The point is hearing the sentence, not typing speed.",
                  "Gõ chữ viết hay phiên âm đều được tính. Mục tiêu là nghe ra câu, không phải thi gõ bàn phím."
                )}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`c-chip ${verdict.perfect ? "c-chip-success" : "c-chip-warning"}`}>
                {verdict.perfect ? <CircleCheck size={13} /> : <PenLine size={13} />}
                {verdict.perfect
                  ? t("Every word right", "Đúng từng chữ")
                  : t(`${verdict.correct}/${verdict.total} right`, `đúng ${verdict.correct}/${verdict.total}`)}
              </span>
              <span className="c-stat-label tabular-nums">{verdict.accuracy}%</span>
              {verdict.extra > 0 && (
                <span className="c-stat-label">
                  {t(`${verdict.extra} extra`, `thừa ${verdict.extra}`)}
                </span>
              )}
            </div>

            {/* Đối chiếu từng chữ: chỗ nào sai thì hiện cả chữ đúng lẫn chữ đã gõ */}
            <div className="flex flex-wrap gap-1.5">
              {verdict.marks.map((m, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 rounded-md text-[15px] ${
                    m.correct
                      ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                      : "bg-[var(--color-error-tint)] text-[var(--color-error)]"
                  }`}
                >
                  {m.unit}
                  {!m.correct && (
                    <span className="c-stat-label ml-1.5 line-through opacity-70">{m.typed || "—"}</span>
                  )}
                </span>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <p className="text-[19px] leading-relaxed">{verdict.text}</p>
              <p className="c-stat-label">{verdict.phonetic}</p>
              <p className="c-help">{verdict.meaning}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={retry} className="c-btn c-btn-secondary">
                <RotateCcw size={16} />
                {t("Try this one again", "Chép lại câu này")}
              </button>
              {at < lines.length - 1 ? (
                <button onClick={() => goTo(at + 1)} className="c-btn c-btn-primary">
                  {t("Next sentence", "Câu tiếp")}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button onClick={() => setOpen(null)} className="c-btn c-btn-primary">
                  <Headphones size={16} />
                  {t("Another set", "Bộ khác")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
