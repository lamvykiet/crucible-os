"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search, X, Loader2, Bookmark, BookmarkCheck, Volume2, Gauge, AlertCircle, Check,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak } from "@/lib/speech";

interface Result {
  definition: string;
  phonetic?: string | null;
  tone?: string | null;
  example?: string | null;
  exampleTranslation?: string | null;
  domain?: string | null;
  tags?: string[];
}

interface Deck {
  id: string;
  name: string;
  count: number;
}

/** Giữ bao lâu thì coi là "giữ lâu" thay vì "bấm". */
const HOLD_MS = 450;

/**
 * Tra nhanh một từ, ở bất cứ đâu trong Learning Hub.
 *
 * Nút nổi góc phải màn hình, mở ra ô tìm kiếm. Gặp từ lạ lúc đang đọc tài liệu
 * thì tra ngay tại chỗ, không phải rời trang sang kho thuật ngữ rồi mất mạch.
 *
 * Nút lưu có hai hành vi, đúng như bản tham chiếu mô tả:
 *  - Bấm một lần : lưu thẳng vào kho, không hỏi gì.
 *  - Giữ lâu     : mở danh sách bộ thẻ để chọn nơi cất trước khi lưu.
 *
 * Hai hành vi trên cùng một nút là có chủ ý: việc thường làm (lưu đại đi, phân
 * loại sau) phải nhanh nhất, còn việc cẩn thận hơn thì bỏ thêm công.
 */
export default function WordSearch() {
  const { t } = useLanguage();

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [decks, setDecks] = useState<Deck[]>([]);
  const [pickingDeck, setPickingDeck] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  // Ctrl/Cmd+K mở ô tìm kiếm — phím tắt quen thuộc, không phải học lại.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const lookup = async () => {
    const cleaned = term.trim();
    if (!cleaned || looking) return;
    setLooking(true);
    setError(null);
    setResult(null);
    setSavedAs(null);
    try {
      const res = await fetch("/api/learning/dictionary/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: cleaned }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tra được");
      setResult(json.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLooking(false);
    }
  };

  const save = async (deckId: string | null, deckName: string | null) => {
    if (!result || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: term.trim(),
          definition: result.definition,
          phonetic: result.phonetic ?? "",
          tone: result.tone ?? "",
          example: result.example ?? "",
          exampleTranslation: result.exampleTranslation ?? "",
          domain: result.domain ?? "",
          tags: result.tags ?? [],
          deckId,
          createFlashcard: true,
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không lưu được");
      setSavedAs(deckName ?? t("your cards", "kho thẻ"));
      setPickingDeck(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /** Giữ lâu: nạp danh sách bộ thẻ rồi mở bảng chọn. */
  const startHold = () => {
    heldRef.current = false;
    holdTimer.current = setTimeout(async () => {
      heldRef.current = true;
      try {
        const res = await fetch("/api/learning/inventory?page=0");
        const json = await res.json();
        if (json?.success) setDecks(json.decks ?? []);
      } catch {
        // Không lấy được danh sách bộ thì vẫn cho lưu vào kho chung.
      }
      setPickingDeck(true);
    }, HOLD_MS);
  };

  const endHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    // Nhả tay trước ngưỡng giữ ⇒ đây là một cú bấm ⇒ lưu thẳng.
    if (!heldRef.current && !pickingDeck) save(null, null);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title={t("Look up a word (Ctrl+K)", "Tra từ (Ctrl+K)")}
        aria-label={t("Look up a word", "Tra từ")}
        className="fixed right-5 bottom-24 md:bottom-8 z-40 w-12 h-12 rounded-full c-card c-elev-lg grid place-content-center hover:border-[var(--color-primary)] transition-colors"
      >
        <Search size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] bg-black/40">
      <div className="c-card c-elev-lg w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={17} />
            <input
              ref={inputRef}
              className="c-input w-full pl-10!"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder={t("Type any word...", "Gõ từ bất kỳ...")}
              autoComplete="off"
            />
          </div>
          <button onClick={lookup} disabled={!term.trim() || looking} className="c-btn c-btn-primary">
            {looking ? <Loader2 size={16} className="animate-spin" /> : t("Look up", "Tra")}
          </button>
          <button onClick={() => setOpen(false)} className="c-btn c-btn-secondary c-btn-icon" aria-label={t("Close", "Đóng")}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="c-alert c-alert-error">
            <AlertCircle size={18} className="icon" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {savedAs && (
          <div className="c-alert c-alert-success">
            <Check size={18} className="icon" />
            <span className="flex-1">{t(`Saved to ${savedAs}`, `Đã lưu vào ${savedAs}`)}</span>
          </div>
        )}

        {result && (
          <div className="c-card p-5 space-y-3 relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="c-h3 break-words">{term.trim()}</p>
                {result.phonetic && (
                  <p className="c-stat-label font-mono">
                    {result.phonetic}
                    {result.tone && ` · ${result.tone}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-none">
                <button
                  onClick={() => speak(term.trim(), "en")}
                  className="c-btn c-btn-secondary c-btn-icon"
                  title={t("Listen", "Nghe")}
                >
                  <Volume2 size={15} />
                </button>
                <button
                  onClick={() => speak(term.trim(), "en", 0.5)}
                  className="c-btn c-btn-secondary c-btn-icon"
                  title={t("Half speed", "Phát chậm")}
                >
                  <Gauge size={15} />
                </button>
                <button
                  onPointerDown={startHold}
                  onPointerUp={endHold}
                  onPointerLeave={() => holdTimer.current && clearTimeout(holdTimer.current)}
                  disabled={saving}
                  className="c-btn c-btn-primary c-btn-icon"
                  title={t(
                    "Click to save · hold to pick a deck",
                    "Bấm để lưu · giữ lâu để chọn bộ thẻ"
                  )}
                >
                  {saving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : savedAs ? (
                    <BookmarkCheck size={15} />
                  ) : (
                    <Bookmark size={15} />
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-xl p-3 bg-[var(--color-surface-2)]">
              <p className="leading-relaxed">{result.definition}</p>
            </div>

            {result.example && (
              <div className="space-y-1">
                <p className="c-card-kicker">{t("Example", "Ví dụ")}</p>
                <p>{result.example}</p>
                {result.exampleTranslation && (
                  <p className="text-sm text-[var(--color-text-muted)]">{result.exampleTranslation}</p>
                )}
              </div>
            )}

            <p className="c-help">
              {t(
                "Click the bookmark to save. Hold it to choose a deck first.",
                "Bấm dấu trang để lưu ngay. Giữ lâu để chọn bộ thẻ trước."
              )}
            </p>

            {/* Bảng chọn bộ thẻ, hiện khi giữ lâu */}
            {pickingDeck && (
              <div className="absolute inset-0 rounded-[inherit] bg-[var(--color-surface)] p-4 flex flex-col gap-2 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <p className="c-card-kicker">{t("Save to deck", "Lưu vào bộ thẻ")}</p>
                  <button onClick={() => setPickingDeck(false)} className="c-btn c-btn-secondary c-btn-icon">
                    <X size={14} />
                  </button>
                </div>
                <button
                  onClick={() => save(null, null)}
                  className="c-btn c-btn-secondary justify-start"
                >
                  {t("No deck (just save)", "Không xếp bộ (lưu vào kho)")}
                </button>
                {decks.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => save(d.id, d.name)}
                    className="c-btn c-btn-secondary justify-between"
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="c-stat-label tabular-nums">{d.count}</span>
                  </button>
                ))}
                {decks.length === 0 && (
                  <p className="c-card-body">{t("No decks yet.", "Chưa có bộ thẻ nào.")}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
