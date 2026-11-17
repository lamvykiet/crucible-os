"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, ExternalLink, Link2, Loader2, Sparkles, Trash2,
  Volume2, ClipboardPaste, Check,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak, stopSpeaking, speechSupported } from "@/lib/speech";

interface Item {
  id: string;
  title: string;
  source: "paste" | "link" | "ai";
  url: string | null;
  level: string | null;
  total: number;
  done: number;
}
interface Para { en: string; vi: string }
interface Prog { direction: "en-vi" | "vi-en"; text: string; score: number; verdict: string }
interface Full { id: string; title: string; source: string; url: string | null; level: string | null; paragraphs: Para[]; progress: Record<string, Prog> }
interface Grade { score: number; verdict: "correct" | "close" | "wrong"; corrected: string; summary: string; issues: { wrong: string; right: string; why: string }[] }

type Create = "paste" | "link" | "ai";
type Mode = "read" | "en-vi" | "vi-en";

/**
 * Đọc & dịch song ngữ — học từ aioenglish.com: dán văn bản hoặc link báo, hay
 * để AI soạn bài theo chủ đề; đọc song ngữ, hoặc tự dịch từng đoạn hai chiều
 * và được AI chấm.
 */
export default function ReadTranslate({ languageId, langCode }: { languageId: string; langCode: string }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [create, setCreate] = useState<Create>("paste");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("B2");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Full | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/learning/read-translate?languageId=${encodeURIComponent(languageId)}`)
        .then((r) => r.json())
        .then((json) => {
          if (!json.success) throw new Error(json.error);
          setItems(json.texts);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Không đọc được danh sách")),
    [languageId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openText = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/learning/read-translate?id=${encodeURIComponent(id)}`);
    const json = await res.json();
    if (json.success) setOpen(json.text);
    else setError(json.error);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body =
        create === "paste" ? { kind: "paste", text, title }
          : create === "link" ? { kind: "link", url }
            : { kind: "ai", topic, level };
      const res = await fetch("/api/learning/read-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, ...body }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không tạo được bài");
      setText(""); setTitle(""); setUrl(""); setTopic("");
      await load();
      await openText(json.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được bài");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("Delete this text?", "Xoá bài này?"))) return;
    await fetch(`/api/learning/read-translate?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    void load();
  };

  if (open) {
    return <Reader full={open} langCode={langCode} onBack={() => { stopSpeaking(); setOpen(null); void load(); }} />;
  }

  const canSubmit = create === "paste" ? text.trim().split(/\s+/).length >= 20 : create === "link" ? /^https?:\/\//.test(url.trim()) : topic.trim().length > 1;

  return (
    <div className="space-y-6">
      <p className="c-help">
        {t(
          "Read a bilingual text, or translate it paragraph by paragraph in either direction and get each one graded.",
          "Đọc bài song ngữ, hoặc tự dịch từng đoạn theo hai chiều và được chấm từng đoạn."
        )}
      </p>

      <div className="c-card c-elev-md p-5 space-y-4">
        <div className="c-seg w-fit flex-wrap">
          <button onClick={() => setCreate("paste")} className={`c-seg-opt ${create === "paste" ? "active" : ""}`}><ClipboardPaste size={15} />{t("Paste text", "Dán văn bản")}</button>
          <button onClick={() => setCreate("link")} className={`c-seg-opt ${create === "link" ? "active" : ""}`}><Link2 size={15} />{t("Article link", "Dán link bài báo")}</button>
          <button onClick={() => setCreate("ai")} className={`c-seg-opt ${create === "ai" ? "active" : ""}`}><Sparkles size={15} />{t("AI writes one", "AI soạn bài")}</button>
        </div>

        {create === "paste" && (
          <div className="space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Title (optional)", "Tiêu đề (không bắt buộc)")} className="c-input w-full" />
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={t("Paste an English text — an article, an email, a page of a book…", "Dán một đoạn tiếng Anh — bài báo, email, một trang sách…")} className="c-textarea w-full" />
            <p className="c-help">{t("Up to 14 paragraphs are kept, cut at sentence boundaries; your words are never rewritten.", "Giữ tối đa 14 đoạn, cắt ở ranh giới câu; chữ gốc giữ nguyên, không bị viết lại.")}</p>
          </div>
        )}
        {create === "link" && (
          <div className="space-y-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.theguardian.com/…" className="c-input w-full" />
            <p className="c-help">{t("Some sites block automated reading or need a login. If so, paste the text instead.", "Một số trang chặn đọc tự động hoặc cần đăng nhập. Gặp vậy thì dán nội dung vào ô Dán văn bản.")}</p>
          </div>
        )}
        {create === "ai" && (
          <div className="flex flex-wrap gap-2">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("Topic, e.g. remote work, city traffic…", "Chủ đề, vd. làm việc từ xa, giao thông đô thị…")} className="c-input flex-1 min-w-[200px]" maxLength={120} />
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="c-input w-auto">
              {["A2", "B1", "B2", "C1"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => void submit()} disabled={busy || !canSubmit} className="c-btn c-btn-primary">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {busy ? t("Preparing…", "Đang chuẩn bị…") : t("Create", "Tạo bài")}
          </button>
          {busy && <span className="c-help">{t("AI is translating each paragraph — up to 40 seconds.", "AI đang dịch từng đoạn — có thể tới 40 giây.")}</span>}
        </div>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {!items ? (
        <div className="flex items-center gap-2 c-help"><Loader2 size={16} className="animate-spin" />{t("Loading…", "Đang tải…")}</div>
      ) : items.length === 0 ? (
        <div className="c-card p-8 text-center space-y-1">
          <p className="c-h3">{t("No texts yet", "Chưa có bài nào")}</p>
          <p className="c-card-body">{t("Create your first one above.", "Tạo bài đầu tiên ở khung phía trên.")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.id} className="c-card p-5 space-y-2 flex flex-col">
              <button onClick={() => void openText(it.id)} className="text-left space-y-2 flex-1">
                <div className="flex items-start gap-2">
                  <p className="font-medium flex-1 line-clamp-2">{it.title}</p>
                  {it.level && <span className="c-chip c-chip-outline flex-none">{it.level}</span>}
                </div>
                <p className="c-stat-label">
                  {it.source === "link" ? t("Article", "Bài báo") : it.source === "ai" ? t("AI-written", "AI soạn") : t("Pasted", "Văn bản dán")}
                </p>
                <div className="c-progress"><span style={{ width: `${it.total ? (it.done / it.total) * 100 : 0}%` }} /></div>
                <p className="c-stat-label tabular-nums">{t(`${it.done}/${it.total} paragraphs translated`, `Đã dịch ${it.done}/${it.total} đoạn`)}</p>
              </button>
              <button onClick={() => void remove(it.id)} className="c-btn c-btn-tertiary c-btn-sm self-end -mr-2">
                <Trash2 size={14} />{t("Delete", "Xoá")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Reader({ full, langCode, onBack }: { full: Full; langCode: string; onBack: () => void }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>("read");
  const [showVi, setShowVi] = useState(true);
  const [at, setAt] = useState(() => {
    const firstUndone = full.paragraphs.findIndex((_, i) => !full.progress[String(i)]);
    return firstUndone < 0 ? 0 : firstUndone;
  });
  const [progress, setProgress] = useState<Record<string, Prog>>(full.progress);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [showRef, setShowRef] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canHear = speechSupported();

  const go = (i: number) => {
    setAt(i);
    setAnswer("");
    setGrade(null);
    setShowRef(false);
    setError(null);
  };

  const gradeIt = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const direction = mode === "vi-en" ? "vi-en" : "en-vi";
      const res = await fetch("/api/learning/read-translate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: full.id, index: at, direction, answer }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không chấm được");
      setGrade(json.grade);
      setProgress((p) => ({ ...p, [String(at)]: { direction, text: answer, score: json.grade.score, verdict: json.grade.verdict } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chấm được");
    } finally {
      setBusy(false);
    }
  };

  const para = full.paragraphs[at];
  const src = mode === "vi-en" ? para.vi : para.en;
  const ref = mode === "vi-en" ? para.en : para.vi;
  const prev = progress[String(at)];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="c-btn c-btn-tertiary c-btn-sm -ml-3"><ArrowLeft size={16} />{t("All texts", "Mọi bài")}</button>
      <div className="space-y-1">
        <h2 className="c-h2">{full.title}</h2>
        {full.url && (
          <a href={full.url} target="_blank" rel="noreferrer" className="c-help inline-flex items-center gap-1 underline">
            <ExternalLink size={13} />{new URL(full.url).hostname}
          </a>
        )}
      </div>

      <div className="c-seg w-fit flex-wrap">
        <button onClick={() => setMode("read")} className={`c-seg-opt ${mode === "read" ? "active" : ""}`}>{t("Bilingual reading", "Đọc song ngữ")}</button>
        <button onClick={() => { setMode("en-vi"); go(at); }} className={`c-seg-opt ${mode === "en-vi" ? "active" : ""}`}>{t("Translate EN → VI", "Dịch Anh → Việt")}</button>
        <button onClick={() => { setMode("vi-en"); go(at); }} className={`c-seg-opt ${mode === "vi-en" ? "active" : ""}`}>{t("Translate VI → EN", "Dịch Việt → Anh")}</button>
      </div>

      {mode === "read" ? (
        <div className="c-card p-6 space-y-5">
          <button onClick={() => setShowVi((v) => !v)} className="c-btn c-btn-secondary c-btn-sm">
            {showVi ? <EyeOff size={14} /> : <Eye size={14} />}
            {showVi ? t("Hide Vietnamese", "Ẩn bản dịch") : t("Show Vietnamese", "Hiện bản dịch")}
          </button>
          {full.paragraphs.map((p, i) => (
            <div key={i} className="space-y-1.5 pb-4 border-b border-[var(--color-border)] last:border-0">
              <div className="flex gap-2 items-start">
                <p className="flex-1 text-[17px] leading-relaxed">{p.en}</p>
                {canHear && (
                  <button onClick={() => speak(p.en, langCode)} className="c-btn c-btn-tertiary c-btn-sm flex-none" aria-label={t("Listen", "Nghe")}>
                    <Volume2 size={15} />
                  </button>
                )}
              </div>
              {showVi && <p className="c-card-body text-[var(--color-text-muted)]">{p.vi}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {full.paragraphs.map((_, i) => {
              const pg = progress[String(i)];
              return (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className={`w-8 h-8 rounded-full text-[12px] font-bold tabular-nums grid place-content-center transition-colors ${
                    i === at ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                      : pg ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="c-card c-elev-md p-6 space-y-4">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-[17px] leading-relaxed">{src}</p>
              {canHear && mode === "en-vi" && (
                <button onClick={() => speak(para.en, langCode)} className="c-btn c-btn-tertiary c-btn-sm flex-none"><Volume2 size={15} /></button>
              )}
            </div>

            {prev && !grade && (
              <p className="c-help">
                {t(`Last time: ${prev.score}/10.`, `Lần trước: ${prev.score}/10.`)}{" "}
                <button onClick={() => setAnswer(prev.text)} className="underline">{t("Load my answer", "Lấy lại bản đã dịch")}</button>
              </p>
            )}

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              disabled={busy}
              placeholder={mode === "en-vi" ? t("Your Vietnamese translation…", "Bản dịch tiếng Việt của bạn…") : t("Your English translation…", "Bản dịch tiếng Anh của bạn…")}
              className="c-textarea w-full text-[16px] leading-relaxed"
              spellCheck={mode === "vi-en" ? false : undefined}
            />

            <div className="flex flex-wrap gap-2">
              <button onClick={() => void gradeIt()} disabled={busy || !answer.trim()} className="c-btn c-btn-primary">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {t("Grade with AI", "Chấm bằng AI")}
              </button>
              <button onClick={() => setShowRef((v) => !v)} className="c-btn c-btn-secondary">
                {showRef ? <EyeOff size={16} /> : <Eye size={16} />}
                {t("Reference", "Bản tham khảo")}
              </button>
              {at < full.paragraphs.length - 1 && (
                <button onClick={() => go(at + 1)} className="c-btn c-btn-tertiary ml-auto">
                  {t("Next paragraph", "Đoạn tiếp")}<ArrowRight size={16} />
                </button>
              )}
            </div>

            {showRef && <p className="rounded-2xl bg-[var(--color-surface-2)] p-4 text-[15px] leading-relaxed">{ref}</p>}

            {error && (
              <div className="c-alert c-alert-error"><AlertCircle size={18} className="icon" /><p className="flex-1">{error}</p></div>
            )}

            {grade && (
              <div className="rounded-2xl bg-[var(--color-surface-2)] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-[var(--color-accent)]" />
                  <span className="font-bold tabular-nums">{grade.score}/10</span>
                  <span className={`c-chip ${grade.verdict === "correct" ? "c-chip-success" : grade.verdict === "close" ? "c-chip-warning" : "c-chip-error"}`}>
                    {grade.verdict === "correct" ? t("Good", "Tốt") : grade.verdict === "close" ? t("Nearly", "Gần đúng") : t("Off", "Chưa đúng")}
                  </span>
                </div>
                <p className="c-card-body">{grade.summary}</p>
                {grade.corrected.trim() !== answer.trim() && (
                  <p><span className="c-stat-label">{t("Your version, fixed: ", "Bản của bạn sau khi sửa: ")}</span>{grade.corrected}</p>
                )}
                {grade.issues.length > 0 && (
                  <ul className="space-y-1.5">
                    {grade.issues.map((i, k) => (
                      <li key={k} className="text-[14px]">
                        <span className="line-through text-[var(--color-error)]">{i.wrong}</span>{" → "}
                        <span className="text-[var(--color-success)] font-medium">{i.right}</span>
                        <span className="c-help"> · {i.why}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
