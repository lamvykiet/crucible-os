"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, Eye, Loader2, Play, Volume2, X, BookX,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, speechSupported } from "@/lib/speech";

interface Item {
  id: string;
  source: string;
  refKey: string;
  prompt: string;
  answer: string;
  lastWrong: string | null;
  wrongCount: number;
  rightStreak: number;
  lastWrongAt: string;
}

const SOURCE_LABEL: Record<string, [string, string]> = {
  typing: ["Sentence typing", "Gõ câu"],
  translate: ["Translation", "Dịch câu"],
  flashcard: ["Flashcards", "Thẻ từ"],
  dictation: ["Dictation", "Chép chính tả"],
  collocation: ["Collocations", "Kết hợp từ"],
};

interface Verdict {
  correct: boolean;
  cleared: boolean;
  streak: number;
  answer: string;
}

/**
 * Sổ lỗi sai — học từ mục "Ôn lỗi sai" của aioenglish.com.
 *
 * Gom mọi câu đã làm sai ở Gõ câu, Dịch câu, thẻ từ và chép chính tả về một chỗ.
 * Ôn lại thì gõ đáp án; đúng đủ số lần liên tiếp là câu tự rời sổ.
 */
export default function MistakeBook({ languageId, langCode }: { languageId: string; langCode: string }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [clearStreak, setClearStreak] = useState(2);
  const [clearedThisWeek, setClearedThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [openAnswers, setOpenAnswers] = useState<Set<string>>(new Set());

  const [queue, setQueue] = useState<Item[] | null>(null);
  const [at, setAt] = useState(0);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState({ right: 0, cleared: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const canHear = speechSupported();

  const load = useCallback(
    () =>
      fetch(`/api/learning/mistakes?languageId=${encodeURIComponent(languageId)}`)
        .then((r) => r.json())
        .then((json) => {
          if (!json.success) throw new Error(json.error || "Không đọc được sổ lỗi sai");
          setItems(json.items);
          setClearStreak(json.clearStreak);
          setClearedThisWeek(json.clearedThisWeek);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Không đọc được sổ lỗi sai"))
        .finally(() => setLoading(false)),
    [languageId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const label = (src: string) => {
    const pair = SOURCE_LABEL[src];
    return pair ? t(pair[0], pair[1]) : src;
  };

  const visible = items.filter((i) => filter === "all" || i.source === filter);
  const sources = Array.from(new Set(items.map((i) => i.source)));

  const startReview = () => {
    // Câu sai nhiều nhất lên trước, tối đa 15 câu một lượt.
    setQueue(visible.slice(0, 15));
    setAt(0);
    setTyped("");
    setVerdict(null);
    setTally({ right: 0, cleared: 0 });
  };

  const cur = queue?.[at] ?? null;

  // Câu chép chính tả: tự đọc lên khi tới lượt, vì đề bài vốn là âm thanh.
  useEffect(() => {
    if (cur?.source === "dictation" && canHear) speak(cur.answer, langCode);
  }, [cur, canHear, langCode]);

  const submit = async () => {
    if (!cur || !typed.trim() || busy || verdict) return;
    setBusy(true);
    try {
      const res = await fetch("/api/learning/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cur.id, typed }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không chấm được");
      setVerdict(json);
      setTally((x) => ({ right: x.right + (json.correct ? 1 : 0), cleared: x.cleared + (json.cleared ? 1 : 0) }));
      if (canHear) speak(cur.answer, langCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chấm được");
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!queue) return;
    if (at >= queue.length - 1) {
      setQueue(null);
      setLoading(true);
      void load();
      return;
    }
    setAt((x) => x + 1);
    setTyped("");
    setVerdict(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/learning/mistakes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (json.success) setItems((list) => list.filter((i) => i.id !== id));
    else setError(json.error || "Không bỏ được câu này");
  };

  /* ── Đang ôn ──────────────────────────────────────────────────────────── */
  if (queue && cur) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setQueue(null); setLoading(true); void load(); }} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
            <ArrowLeft size={16} />
            {t("Stop", "Dừng")}
          </button>
          <span className="c-stat-label tabular-nums ml-auto">
            {t(`${at + 1} of ${queue.length}`, `${at + 1}/${queue.length}`)}
          </span>
        </div>
        <div className="c-progress">
          <span style={{ width: `${(at / queue.length) * 100}%` }} />
        </div>

        <div className="c-card c-elev-md p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="c-chip c-chip-outline">{label(cur.source)}</span>
            <span className="c-stat-label tabular-nums">
              {t(`wrong ${cur.wrongCount}×`, `đã sai ${cur.wrongCount} lần`)}
            </span>
          </div>

          {cur.source === "dictation" ? (
            <div className="space-y-2">
              <p className="c-help">{t("Listen and write it down.", "Nghe và chép lại.")}</p>
              <button onClick={() => speak(cur.answer, langCode)} disabled={!canHear} className="c-btn c-btn-primary">
                <Volume2 size={16} />
                {t("Play", "Nghe")}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="c-stat-label">
                {cur.source === "flashcard" ? t("Meaning", "Nghĩa") : t("Vietnamese", "Nghĩa tiếng Việt")}
              </p>
              <p className="c-h3">{cur.prompt}</p>
            </div>
          )}

          <input
            ref={inputRef}
            autoFocus
            value={typed}
            disabled={Boolean(verdict)}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (verdict) next();
                else void submit();
              }
            }}
            placeholder={t("Type the answer…", "Gõ đáp án…")}
            className="c-input w-full text-[17px]"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          {verdict ? (
            <div className="space-y-3">
              <div className={`c-alert ${verdict.correct ? "c-alert-success" : "c-alert-warning"}`}>
                {verdict.correct ? <Check size={18} className="icon" /> : <X size={18} className="icon" />}
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{verdict.answer}</p>
                  <p className="c-help">
                    {verdict.correct
                      ? verdict.cleared
                        ? t("Right again — it leaves the book.", "Đúng lần nữa — câu này rời sổ.")
                        : t(`Right. ${clearStreak - verdict.streak} more in a row to clear it.`, `Đúng. Thêm ${clearStreak - verdict.streak} lần đúng liền nữa là rời sổ.`)
                      : t("Not yet. It stays in the book.", "Chưa đúng. Câu này vẫn ở lại sổ.")}
                  </p>
                </div>
              </div>
              {cur.source === "dictation" && <p className="c-help">{cur.prompt}</p>}
              <button onClick={next} className="c-btn c-btn-primary">
                {at >= queue.length - 1 ? t("Finish", "Xong") : t("Next", "Câu tiếp")}
                <ArrowRight size={16} /> <span className="c-kbd">Enter</span>
              </button>
            </div>
          ) : (
            <button onClick={() => void submit()} disabled={!typed.trim() || busy} className="c-btn c-btn-primary">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t("Check", "Kiểm tra")} <span className="c-kbd">Enter</span>
            </button>
          )}
        </div>

        <p className="c-stat-label tabular-nums">
          {t(`${tally.right} right · ${tally.cleared} cleared this round`, `${tally.right} câu đúng · ${tally.cleared} câu rời sổ trong lượt này`)}
        </p>
      </div>
    );
  }

  /* ── Danh sách ────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <p className="c-help">
        {t(
          `Every sentence or card you got wrong — in sentence typing, translation, flashcards or dictation — lands here. Get one right ${clearStreak} times in a row and it leaves the book.`,
          `Mọi câu, mọi thẻ bạn làm sai ở Gõ câu, Dịch câu, thẻ từ hay chép chính tả đều về đây. Làm đúng ${clearStreak} lần liền thì câu đó rời sổ.`
        )}
      </p>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 c-help">
          <Loader2 size={16} className="animate-spin" />
          {t("Loading…", "Đang tải…")}
        </div>
      ) : items.length === 0 ? (
        <div className="c-card p-10 text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-success-tint)] text-[var(--color-success)] grid place-content-center">
            <BookX size={26} />
          </div>
          <p className="c-h3">{t("The book is empty", "Sổ đang trống")}</p>
          <p className="c-card-body">
            {clearedThisWeek > 0
              ? t(`${clearedThisWeek} cleared this week.`, `Tuần này đã gỡ ${clearedThisWeek} câu khỏi sổ.`)
              : t("Mistakes from your practice will show up here.", "Câu làm sai khi luyện sẽ hiện ở đây.")}
          </p>
        </div>
      ) : (
        <>
          <div className="c-card c-elev-md p-6 flex flex-wrap items-center gap-6">
            <div>
              <p className="c-h2 tabular-nums">{items.length}</p>
              <p className="c-stat-label">{t("to review", "câu cần ôn")}</p>
            </div>
            <div>
              <p className="c-h2 tabular-nums text-[var(--color-success)]">{clearedThisWeek}</p>
              <p className="c-stat-label">{t("cleared this week", "đã gỡ tuần này")}</p>
            </div>
            <button onClick={startReview} disabled={visible.length === 0} className="c-btn c-btn-primary c-btn-lg ml-auto">
              <Play size={18} />
              {t(`Review ${Math.min(15, visible.length)}`, `Ôn ${Math.min(15, visible.length)} câu`)}
            </button>
          </div>

          {sources.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilter("all")} className={`c-chip ${filter === "all" ? "c-chip-solid" : "c-chip-outline"}`}>
                {t("All", "Tất cả")} ({items.length})
              </button>
              {sources.map((src) => (
                <button key={src} onClick={() => setFilter(src)} className={`c-chip ${filter === src ? "c-chip-solid" : "c-chip-outline"}`}>
                  {label(src)} ({items.filter((i) => i.source === src).length})
                </button>
              ))}
            </div>
          )}

          <ul className="c-card divide-y divide-[var(--color-border)]">
            {visible.map((i) => {
              const shown = openAnswers.has(i.id);
              return (
                <li key={i.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium">{i.prompt}</p>
                    {shown ? (
                      <p className="text-[var(--color-success)]">{i.answer}</p>
                    ) : (
                      <button
                        onClick={() => setOpenAnswers((s) => new Set(s).add(i.id))}
                        className="c-btn c-btn-tertiary c-btn-sm -ml-3"
                      >
                        <Eye size={14} />
                        {t("Show answer", "Hiện đáp án")}
                      </button>
                    )}
                    {shown && i.lastWrong && (
                      <p className="c-help line-through">{i.lastWrong}</p>
                    )}
                    <p className="c-stat-label">
                      {label(i.source)}
                      {" · "}
                      {t(`wrong ${i.wrongCount}×`, `sai ${i.wrongCount} lần`)}
                      {i.rightStreak > 0 && ` · ${t(`${i.rightStreak} right in a row`, `đúng liền ${i.rightStreak}`)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => void remove(i.id)}
                    className="c-btn c-btn-tertiary c-btn-sm flex-none"
                    title={t("I know this now", "Đã nhớ, bỏ khỏi sổ")}
                  >
                    <Check size={14} />
                    {t("Known", "Đã nhớ")}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
