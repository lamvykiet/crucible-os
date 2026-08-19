"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Network, Layers, Plus, Trash2, Loader2, X, Copy, AlertCircle, Check,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface Props {
  /** Drive file id của tài liệu đang chọn; null nghĩa là chưa chọn nguồn nào. */
  fileId: string | null;
  fileName: string | null;
}

type Action = "summary" | "mindmap" | "flashcards";

/**
 * Panel 3 — Studio.
 *
 * Bản cũ là bốn ô vuông không có `onClick` (Tổng quan / Bản trình bày / Bản đồ
 * tư duy / Thẻ ghi nhớ) cộng một nút "Thêm ghi chú" cũng không làm gì, bên dưới
 * là dòng chữ "Ghi chú đã lưu sẽ hiện ở đây" — trong khi không có đường nào lưu
 * được ghi chú. "Bản trình bày" bị bỏ vì hệ thống không có gì render slide.
 */
export default function StudioPanel({ fileId, fileName }: Props) {
  const { t } = useLanguage();

  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [running, setRunning] = useState<Action | null>(null);
  const [result, setResult] = useState<{ title: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadNotes = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/knowledge/notes?fileId=${encodeURIComponent(id)}`, { signal });
      const json = await res.json();
      if (json?.success) setNotes(json.notes || []);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNotes([]);
    }
  }, []);

  useEffect(() => {
    if (!fileId) {
      setNotes([]);
      setResult(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    loadNotes(fileId, controller.signal);
    return () => controller.abort();
  }, [fileId, loadNotes]);

  const runAction = async (action: Action) => {
    if (!fileId) return;
    setRunning(action);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/knowledge/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, action }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || `Lỗi ${res.status}`);

      if (action === "flashcards") {
        setResult({
          title: t("Flashcards created", "Đã tạo thẻ ghi nhớ"),
          text:
            t(`Created ${json.created} cards from`, `Đã tạo ${json.created} thẻ từ`) +
            ` "${json.documentName}".\n` +
            t("Open Learning Hub to review them.", "Vào Học tập để ôn.") +
            "\n\n" +
            (json.cards as Array<{ front: string; back: string }>)
              .map((c, i) => `${i + 1}. ${c.front}\n   → ${c.back}`)
              .join("\n"),
        });
      } else {
        setResult({
          title: action === "summary" ? t("Summary", "Tóm tắt") : t("Mind map", "Bản đồ tư duy"),
          text: json.text,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(null);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileId || !draft.trim() || savingNote) return;
    setSavingNote(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, content: draft }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || `Lỗi ${res.status}`);
      setNotes((prev) => [json.note, ...prev]);
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/knowledge/notes?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard?.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tools: Array<{ key: Action; label: string; icon: typeof FileText; tint: string; fg: string }> = [
    { key: "summary", label: t("Summary", "Tóm tắt"), icon: FileText, tint: "var(--color-info-tint)", fg: "var(--color-info)" },
    { key: "mindmap", label: t("Mind map", "Bản đồ tư duy"), icon: Network, tint: "var(--color-warning-tint)", fg: "var(--color-warning)" },
    { key: "flashcards", label: t("Flashcards", "Thẻ ghi nhớ"), icon: Layers, tint: "var(--color-success-tint)", fg: "var(--color-success)" },
  ];

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex-1 flex flex-col min-h-0 shadow-inner">
      <div className="flex justify-between items-center mb-4">
        <h3 className="c-h3 tracking-wide">Studio</h3>
        {fileName && (
          <span className="text-[10px] text-[var(--color-text-faint)] truncate max-w-[150px]" title={fileName}>
            {fileName}
          </span>
        )}
      </div>

      {!fileId ? (
        <p className="text-xs text-[var(--color-text-faint)] py-6 text-center">
          {t("Pick a source to use these tools.", "Chọn một nguồn để dùng các công cụ này.")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const busy = running === tool.key;
              return (
                <button
                  key={tool.key}
                  onClick={() => runAction(tool.key)}
                  disabled={running !== null}
                  title={tool.label}
                  className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] p-3 rounded-2xl flex flex-col items-center gap-2 group transition-all border border-transparent hover:border-[var(--color-border-strong)] disabled:opacity-50"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: tool.tint, color: tool.fg }}
                  >
                    {busy ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                  </div>
                  <span className="text-[10px] font-semibold text-center leading-tight">{tool.label}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mb-3 flex items-start gap-2 text-xs text-[var(--color-error)] p-2 rounded-lg bg-[var(--color-error-tint)]">
              <AlertCircle size={14} className="mt-0.5 flex-none" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {result && (
            <div className="mb-4 border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col max-h-64">
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
                <span className="text-xs font-bold">{result.title}</span>
                <div className="flex gap-1">
                  <button onClick={copyResult} title={t("Copy", "Sao chép")} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                    {copied ? <Check size={14} className="text-[var(--color-success)]" /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => setResult(null)} title={t("Close", "Đóng")} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <pre className="p-3 text-[11px] leading-relaxed whitespace-pre-wrap overflow-y-auto text-[var(--color-text)]" style={{ fontFamily: "var(--font-body)" }}>
                {result.text}
              </pre>
            </div>
          )}

          <form onSubmit={addNote} className="mb-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder={t("Write a note...", "Viết ghi chú...")}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-xl px-3 py-2 text-xs focus:outline-none resize-none text-[var(--color-text)] placeholder-[var(--color-text-faint)]"
            />
            <button
              type="submit"
              disabled={!draft.trim() || savingNote}
              className="w-full mt-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold py-2 rounded-xl text-xs flex justify-center gap-2 items-center hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("Add note", "Thêm ghi chú")}
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
            {notes.length === 0 ? (
              <p className="text-xs text-[var(--color-text-faint)] text-center py-4">
                {t("No notes for this source yet.", "Chưa có ghi chú nào cho nguồn này.")}
              </p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="group bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-3 text-xs"
                >
                  <p className="whitespace-pre-wrap text-[var(--color-text)] break-words">{note.content}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-[var(--color-text-faint)]">
                      {new Date(note.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    <button
                      onClick={() => deleteNote(note.id)}
                      aria-label={t("Delete note", "Xoá ghi chú")}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
