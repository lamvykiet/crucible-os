"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Gauge, Loader2, Mic, MicOff, Play, Plus, Trash2, Volume2,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { compareLine } from "@/lib/dictation/types";
import { listenOnce, speechInputSupported } from "@/lib/speechInput";
import type { Segment } from "@/lib/videoLesson";
import { useYouTube } from "./useYouTube";

interface ListItem { id: string; youtubeId: string; title: string; total: number; done: number; complete: boolean }
interface Full {
  id: string; youtubeId: string; title: string; lastIndex: number; until: number; complete: boolean;
  items: Segment[]; progress: Record<string, { dictation?: boolean; shadowing?: boolean }>;
}
type Mode = "watch" | "dictation" | "shadowing";

/** Nói nhại tính là đạt khi máy nghe ra từ 85% số chữ trở lên. */
const SHADOW_PASS = 85;

/**
 * Video học tiếng — học từ mục Video của aioenglish.com: dán link YouTube,
 * Gemini chép phụ đề song ngữ, rồi xem song ngữ / chép chính tả / nói nhại
 * từng câu ngay trên video gốc.
 */
export default function VideoStudy({ languageId, langCode }: { languageId: string; langCode: string }) {
  const { t } = useLanguage();
  const [list, setList] = useState<ListItem[] | null>(null);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Full | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/learning/video?languageId=${encodeURIComponent(languageId)}`)
        .then((r) => r.json())
        .then((json) => {
          if (!json.success) throw new Error(json.error);
          setList(json.videos);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Không đọc được danh sách")),
    [languageId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openVideo = async (id: string) => {
    const res = await fetch(`/api/learning/video?id=${encodeURIComponent(id)}`);
    const json = await res.json();
    if (json.success) setOpen(json.video);
    else setError(json.error);
  };

  const add = async () => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, url }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không thêm được video");
      setUrl("");
      await load();
      await openVideo(json.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được video");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("Remove this video and its progress?", "Xoá video này cùng tiến độ?"))) return;
    await fetch(`/api/learning/video?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    void load();
  };

  if (open) {
    return (
      <Study
        key={open.id}
        initial={open}
        langCode={langCode}
        onBack={() => { setOpen(null); void load(); }}
        reload={() => openVideo(open.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="c-help">
        {t(
          "Paste a YouTube link. AI listens and writes bilingual subtitles, then you can watch with them, take dictation sentence by sentence, or shadow out loud.",
          "Dán link YouTube. AI nghe và viết phụ đề song ngữ; sau đó bạn xem kèm phụ đề, chép chính tả từng câu, hoặc nói nhại thành tiếng."
        )}
      </p>

      <div className="c-card c-elev-md p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) void add(); }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="c-input flex-1 min-w-[220px]"
          />
          <button onClick={() => void add()} disabled={adding || !url.trim()} className="c-btn c-btn-primary">
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {adding ? t("Listening…", "Đang nghe…") : t("Add video", "Thêm video")}
          </button>
        </div>
        <p className="c-help">
          {adding
            ? t("AI is transcribing the first 2 minutes — about 20–30 seconds.", "AI đang chép phụ đề 2 phút đầu — khoảng 20–30 giây.")
            : t("Public videos only. Subtitles come 2 minutes at a time; load more as you go.", "Chỉ video công khai. Phụ đề được chép từng 2 phút một; học tới đâu tải thêm tới đó.")}
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error"><AlertCircle size={18} className="icon" /><p className="flex-1">{error}</p></div>
      )}

      {!list ? (
        <div className="flex items-center gap-2 c-help"><Loader2 size={16} className="animate-spin" />{t("Loading…", "Đang tải…")}</div>
      ) : list.length === 0 ? (
        <div className="c-card p-8 text-center space-y-1">
          <p className="c-h3">{t("No videos yet", "Chưa có video nào")}</p>
          <p className="c-card-body">{t("TED talks, podcasts and news clips with clear speech work best.", "Bài nói TED, podcast, bản tin có giọng rõ là hợp nhất.")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((v) => (
            <div key={v.id} className="c-card p-3 space-y-2 flex flex-col">
              <button onClick={() => void openVideo(v.id)} className="text-left space-y-2 flex-1">
                <div
                  className="w-full aspect-video rounded-2xl bg-[var(--color-surface-2)] bg-cover bg-center"
                  style={{ backgroundImage: `url(https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg)` }}
                />
                <p className="font-medium line-clamp-2 px-1">{v.title}</p>
                <p className="c-stat-label tabular-nums px-1">
                  {t(`${v.done} sentences practised · ${v.total}${v.complete ? "" : "+"} transcribed`, `Đã luyện ${v.done} câu · đã chép ${v.total}${v.complete ? "" : "+"} câu`)}
                </p>
              </button>
              <button onClick={() => void remove(v.id)} className="c-btn c-btn-tertiary c-btn-sm self-end">
                <Trash2 size={14} />{t("Remove", "Xoá")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Study({ initial, langCode, onBack, reload }: { initial: Full; langCode: string; onBack: () => void; reload: () => Promise<void> }) {
  const { t } = useLanguage();
  const v = initial;
  const { hostRef, ready, time, duration, playRange, pause } = useYouTube(v.youtubeId);
  // Còn phần chưa chép: máy chủ chưa gặp đoạn rỗng VÀ (chưa biết độ dài, hoặc
  // chép chưa tới cuối video theo trình phát).
  const hasMore = !v.complete && (duration === 0 || v.until < duration - 3);
  const [mode, setMode] = useState<Mode>("watch");
  const [showVi, setShowVi] = useState(true);
  const [at, setAt] = useState(Math.min(v.lastIndex, Math.max(0, v.items.length - 1)));
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ accuracy: number; perfect: boolean; marks: { unit: string; correct: boolean }[] } | null>(null);
  const [progress, setProgress] = useState(v.progress);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopMic = useRef<(() => void) | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const canSpeak = speechInputSupported();

  const seg = v.items[at];
  const playing = v.items.findIndex((s) => time >= s.start - 0.1 && time < s.end + 0.1);

  // Xem song ngữ: cuộn để câu đang nói luôn trong tầm mắt (cuộn trong khung riêng).
  useEffect(() => {
    if (mode !== "watch" || playing < 0) return;
    const el = listRef.current?.querySelector(`[data-i="${playing}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [playing, mode]);

  const go = (i: number) => {
    setAt(i);
    setTyped("");
    setResult(null);
    setError(null);
  };

  const record = async (perfect: boolean, typedText: string, m: "dictation" | "shadowing") => {
    setProgress((p) => ({ ...p, [at]: { ...(p[at] ?? {}), [m]: Boolean(p[at]?.[m]) || perfect } }));
    await fetch("/api/learning/video", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, action: "result", index: at, mode: m, perfect, typed: typedText }),
    }).catch(() => {});
  };

  const check = () => {
    if (!seg || !typed.trim() || result) return;
    const r = compareLine(typed, seg.en);
    setResult({ accuracy: r.accuracy, perfect: r.perfect, marks: r.marks });
    void record(r.perfect, typed, "dictation");
  };

  const shadow = () => {
    if (listening) {
      stopMic.current?.();
      return;
    }
    setResult(null);
    setTyped("");
    setListening(true);
    stopMic.current = listenOnce(langCode, {
      onText: (text, final) => {
        setTyped(text);
        if (final && seg) {
          const r = compareLine(text, seg.en);
          const perfect = r.accuracy >= SHADOW_PASS;
          setResult({ accuracy: r.accuracy, perfect, marks: r.marks });
          void record(perfect, text, "shadowing");
        }
      },
      onEnd: () => setListening(false),
      onError: (msg) => setError(msg),
    });
  };

  const loadMore = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, action: "more" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không tải thêm được");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải thêm được");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => () => stopMic.current?.(), []);

  const doneCount = Object.values(progress).filter((p) => p[mode === "shadowing" ? "shadowing" : "dictation"]).length;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="c-btn c-btn-tertiary c-btn-sm -ml-3"><ArrowLeft size={16} />{t("All videos", "Mọi video")}</button>
      <h2 className="c-h3">{v.title}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="space-y-3 lg:sticky lg:top-6">
          {/* Khung 16:9 cho trình phát — không phải thẻ kính, nên không dính luật ::before. */}
          <div ref={hostRef} className="w-full aspect-video rounded-3xl overflow-hidden bg-black [&>div]:w-full [&>div]:h-full [&_iframe]:w-full [&_iframe]:h-full" />
          {!ready && <p className="c-help flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{t("Loading the player…", "Đang tải trình phát…")}</p>}
          <div className="c-seg w-fit flex-wrap">
            <button onClick={() => { setMode("watch"); pause(); }} className={`c-seg-opt ${mode === "watch" ? "active" : ""}`}>{t("Watch bilingual", "Xem song ngữ")}</button>
            <button onClick={() => { setMode("dictation"); pause(); go(at); }} className={`c-seg-opt ${mode === "dictation" ? "active" : ""}`}>{t("Dictation", "Chép chính tả")}</button>
            <button onClick={() => { setMode("shadowing"); pause(); go(at); }} className={`c-seg-opt ${mode === "shadowing" ? "active" : ""}`}>{t("Shadowing", "Nói nhại")}</button>
          </div>
        </div>

        <div className="c-card p-5 space-y-4">
          {mode === "watch" ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="c-stat-label tabular-nums">{t(`${v.items.length} sentences`, `${v.items.length} câu`)}</p>
                <button onClick={() => setShowVi((s) => !s)} className="c-btn c-btn-tertiary c-btn-sm">
                  {showVi ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showVi ? t("Hide Vietnamese", "Ẩn tiếng Việt") : t("Show Vietnamese", "Hiện tiếng Việt")}
                </button>
              </div>
              {/* Vùng cuộn là div con, không phải chính thẻ (xem AGENTS.md). */}
              <div ref={listRef} className="max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1">
                {v.items.map((s, i) => (
                  <button
                    key={i}
                    data-i={i}
                    onClick={() => playRange(s.start, null)}
                    className={`w-full text-left rounded-2xl px-3 py-2 transition-colors ${
                      i === playing ? "bg-[var(--glass-on)] shadow-[0_0_0_1px_var(--glass-hair)]" : "hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    <span className="block text-[15px]">{s.en}</span>
                    {showVi && s.vi && <span className="block c-help">{s.vi}</span>}
                  </button>
                ))}
              </div>
            </>
          ) : seg ? (
            <>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {v.items.map((_, i) => {
                  const ok = progress[i]?.[mode === "shadowing" ? "shadowing" : "dictation"];
                  return (
                    <button
                      key={i}
                      onClick={() => go(i)}
                      className={`w-7 h-7 rounded-md text-[11px] font-bold tabular-nums grid place-content-center ${
                        i === at ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                          : ok ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <p className="c-stat-label tabular-nums">{t(`${doneCount}/${v.items.length} passed`, `Đạt ${doneCount}/${v.items.length} câu`)}</p>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => playRange(seg.start, seg.end)} disabled={!ready} className="c-btn c-btn-primary"><Volume2 size={16} />{t("Play sentence", "Nghe câu")}</button>
                <button onClick={() => playRange(seg.start, seg.end, 0.75)} disabled={!ready} className="c-btn c-btn-secondary"><Gauge size={16} />{t("Slower", "Chậm")}</button>
              </div>

              {mode === "dictation" ? (
                <>
                  <input
                    value={typed}
                    disabled={Boolean(result)}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (result) { if (at < v.items.length - 1) go(at + 1); } else check(); } }}
                    placeholder={t("Type what you hear", "Gõ lại điều nghe được")}
                    className="c-input w-full text-[16px]"
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  />
                  {!result && <button onClick={check} disabled={!typed.trim()} className="c-btn c-btn-primary"><Check size={16} />{t("Check", "Chấm")}</button>}
                </>
              ) : (
                <div className="space-y-2">
                  {!canSpeak && <p className="c-help">{t("This browser cannot hear you. Try Chrome, Dia, Edge or Safari.", "Trình duyệt này không nhận giọng nói. Dùng Chrome, Dia, Edge hoặc Safari.")}</p>}
                  <button onClick={shadow} disabled={!canSpeak} className={`c-btn ${listening ? "c-btn-danger" : "c-btn-primary"}`}>
                    {listening ? <MicOff size={16} /> : <Mic size={16} />}
                    {listening ? t("Stop", "Dừng") : t("Say it", "Nói lại")}
                  </button>
                  {typed && <p className="c-help">{t("Heard:", "Máy nghe được:")} {typed}</p>}
                </div>
              )}

              {result && (
                <div className={`c-alert ${result.perfect ? "c-alert-success" : "c-alert-warning"}`}>
                  <Check size={18} className="icon" />
                  <div className="flex-1 space-y-1">
                    <p className="flex flex-wrap gap-1">
                      {result.marks.map((m, k) => (
                        <span key={k} className={m.correct ? "" : "text-[var(--color-error)] underline"}>{m.unit}</span>
                      ))}
                    </p>
                    <p className="font-medium">{seg.en}</p>
                    {seg.vi && <p className="c-help">{seg.vi}</p>}
                    <p className="c-stat-label tabular-nums">{t(`${result.accuracy}% words right`, `Đúng ${result.accuracy}% số chữ`)}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {result && !result.perfect && (
                  <button onClick={() => go(at)} className="c-btn c-btn-secondary">{t("Try again", "Làm lại")}</button>
                )}
                {at < v.items.length - 1 && (
                  <button onClick={() => go(at + 1)} className="c-btn c-btn-tertiary ml-auto">{t("Next sentence", "Câu tiếp")}<ArrowRight size={16} /></button>
                )}
              </div>
            </>
          ) : null}

          {hasMore && (
            <button onClick={() => void loadMore()} disabled={loadingMore} className="c-btn c-btn-secondary w-full">
              {loadingMore ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {loadingMore ? t("Transcribing the next 2 minutes…", "Đang chép 2 phút tiếp…") : t("Load the next 2 minutes", "Tải thêm 2 phút")}
            </button>
          )}
          {error && <div className="c-alert c-alert-error"><AlertCircle size={18} className="icon" /><p className="flex-1">{error}</p></div>}
        </div>
      </div>
    </div>
  );
}
