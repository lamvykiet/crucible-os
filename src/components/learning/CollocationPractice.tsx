"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2, AlertCircle, Check, X, ArrowLeft, ArrowRight, Link2, RotateCcw, Info,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { KIND_LABEL, type CollocationKind } from "@/lib/collocationSets";

interface SetCard {
  id: string;
  title: string;
  kind: CollocationKind;
  level: string;
  note: string;
  total: number;
  cleared: number;
}

interface Item {
  index: number;
  sentence: string;
  cleared: boolean;
}

interface Verdict {
  correct: boolean;
  answer: string;
  note: string;
  alt: string[];
}

/**
 * Luyện kết hợp từ, cụm động từ, cấu tạo từ và giới từ.
 *
 * Bốn mảng này là chỗ người học biết đủ từ mà viết ra vẫn không tự nhiên. Không
 * suy luận được, chỉ nhớ từng cụm — nên dạng bài là điền vào chỗ trống, và sau
 * khi chấm luôn kèm một câu giải thích VÌ SAO là từ đó.
 */
export default function CollocationPractice({ languageId }: { languageId: string }) {
  const { t } = useLanguage();

  const [sets, setSets] = useState<SetCard[]>([]);
  const [kind, setKind] = useState<CollocationKind | "all">("all");
  const [references, setReferences] = useState<string[]>([]);

  const [open, setOpen] = useState<{ id: string; title: string; note: string } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [at, setAt] = useState(0);
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loading = loadedFor !== languageId;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/collocations?languageId=${encodeURIComponent(languageId)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        setSets(json.sets ?? []);
        setReferences(json.references ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(languageId);
      });
    return () => controller.abort();
  }, [languageId]);

  const openSet = async (card: SetCard) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/collocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, setId: card.id }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không mở được bộ");
      setOpen({ id: json.set.id, title: json.set.title, note: json.set.note });
      setItems(json.set.items ?? []);
      const next = (json.set.items ?? []).findIndex((i: Item) => !i.cleared);
      setAt(next >= 0 ? next : 0);
      setTyped("");
      setVerdict(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!open || busy || verdict) return;
    setBusy(true);
    try {
      const res = await fetch("/api/learning/collocations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, setId: open.id, index: at, input: typed }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không chấm được");
      setVerdict(json.result);
      setItems((prev) =>
        prev.map((i) => (i.index === at ? { ...i, cleared: i.cleared || json.result.correct } : i))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const goTo = (index: number) => {
    setAt(index);
    setTyped("");
    setVerdict(null);
    inputRef.current?.focus();
  };

  /* ── Chọn bộ ─────────────────────────────────────────────────────────── */
  if (!open) {
    const kinds = [...new Set(sets.map((s) => s.kind))];
    const visible = kind === "all" ? sets : sets.filter((s) => s.kind === kind);
    return (
      <div className="space-y-6">
        <p className="c-help">
          {t(
            "Words that must go together. Nobody says 'do a mistake' or 'strong rain', but no rule tells you that — you learn them one pair at a time.",
            "Những từ buộc phải đi với nhau. Không ai nói 'do a mistake' hay 'strong rain', mà không quy tắc nào suy ra được — chỉ có học từng cụm."
          )}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 c-help">
            <Loader2 size={16} className="animate-spin" />
            {t("Loading…", "Đang tải…")}
          </div>
        ) : sets.length === 0 ? (
          <div className="c-card p-10 text-center space-y-2">
            <p className="c-h3">{t("Nothing here yet", "Chưa có bộ nào")}</p>
            <p className="c-card-body">
              {t(
                "This language does not have a collocation set yet.",
                "Thứ tiếng này chưa có bộ kết hợp từ."
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setKind("all")}
                className={`c-chip ${kind === "all" ? "c-chip-solid" : "c-chip-outline"}`}
              >
                {t("All", "Tất cả")} ({sets.length})
              </button>
              {kinds.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`c-chip ${kind === k ? "c-chip-solid" : "c-chip-outline"}`}
                >
                  {t(KIND_LABEL[k].en, KIND_LABEL[k].vi)} ({sets.filter((s) => s.kind === k).length})
                </button>
              ))}
            </div>

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
                    <p className="c-stat-label">{t(KIND_LABEL[card.kind].en, KIND_LABEL[card.kind].vi)}</p>
                    <p className="c-help line-clamp-2">{card.note}</p>
                    <div className="c-progress">
                      <span style={{ width: `${done}%` }} />
                    </div>
                    <p className="c-stat-label tabular-nums">
                      {t(`${card.cleared} of ${card.total}`, `đúng ${card.cleared}/${card.total}`)}
                    </p>
                  </button>
                );
              })}
            </div>

            {references.length > 0 && (
              <details className="c-card p-4">
                <summary className="c-stat-label cursor-pointer flex items-center gap-2">
                  <Info size={13} />
                  {t("Where this comes from", "Phần này dựa trên nguồn nào")}
                </summary>
                <ul className="mt-3 space-y-1.5">
                  {references.map((ref) => (
                    <li key={ref} className="c-help">
                      {ref}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    );
  }

  /* ── Đang luyện ──────────────────────────────────────────────────────── */
  const current = items[at];
  const clearedCount = items.filter((i) => i.cleared).length;
  const [before, after] = (current?.sentence ?? "").split("___");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setOpen(null)} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
          <ArrowLeft size={16} />
          {t("All sets", "Mọi bộ")}
        </button>
        <span className="font-medium">{open.title}</span>
        <span className="c-stat-label ml-auto tabular-nums">
          {t(`${clearedCount}/${items.length}`, `đúng ${clearedCount}/${items.length}`)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <button
            key={i.index}
            onClick={() => goTo(i.index)}
            className={`w-7 h-7 rounded-md text-[11px] font-bold tabular-nums grid place-content-center transition-colors ${
              i.index === at
                ? "bg-[var(--color-primary)] text-white"
                : i.cleared
                  ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
            }`}
          >
            {i.index + 1}
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
        <p className="text-[19px] leading-relaxed">
          {before}
          <span
            className={`inline-block min-w-[110px] mx-1 px-2 border-b-2 text-center font-medium ${
              verdict
                ? verdict.correct
                  ? "border-[var(--color-success)] text-[var(--color-success)]"
                  : "border-[var(--color-error)] text-[var(--color-error)]"
                : "border-[var(--color-border)]"
            }`}
          >
            {verdict ? verdict.answer : typed || " "}
          </span>
          {after}
        </p>

        {!verdict ? (
          <>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder={t("Type the missing word", "Gõ từ còn thiếu")}
              className="c-input w-full"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button onClick={submit} disabled={busy || !typed.trim()} className="c-btn c-btn-primary">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t("Check", "Chấm")}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`c-chip ${verdict.correct ? "c-chip-success" : "c-chip-warning"}`}>
                {verdict.correct ? <Check size={13} /> : <X size={13} />}
                {verdict.correct
                  ? t("Correct", "Đúng")
                  : t(`You typed "${typed}"`, `Bạn gõ "${typed}"`)}
              </span>
              {verdict.alt.length > 0 && (
                <span className="c-stat-label">
                  {t(`also accepted: ${verdict.alt.join(", ")}`, `cũng đúng: ${verdict.alt.join(", ")}`)}
                </span>
              )}
            </div>

            <p className="leading-relaxed flex items-start gap-2">
              <Link2 size={15} className="flex-none mt-1 text-[var(--color-text-faint)]" />
              {verdict.note}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {!verdict.correct && (
                <button onClick={() => goTo(at)} className="c-btn c-btn-secondary">
                  <RotateCcw size={16} />
                  {t("Try again", "Làm lại")}
                </button>
              )}
              {at < items.length - 1 ? (
                <button onClick={() => goTo(at + 1)} className="c-btn c-btn-primary">
                  {t("Next", "Câu tiếp")}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button onClick={() => setOpen(null)} className="c-btn c-btn-primary">
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
