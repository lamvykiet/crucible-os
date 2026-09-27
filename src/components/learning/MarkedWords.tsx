"use client";

import { useState, useEffect } from "react";
import {
  Loader2, AlertCircle, BookmarkCheck, Play, Check, Sparkles, CalendarClock,
  Volume2, Eye, CircleCheck,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak } from "@/lib/speech";

interface Word {
  id: string;
  term: string;
  phonetic: string | null;
  definition: string;
  example: string | null;
  source: string | null;
  learnStartedAt: string | null;
  cyclesDone: number;
  totalCycles: number;
  dueAt: string | null;
  overdue: boolean;
}

interface Data {
  cycleDays: number;
  totalCycles: number;
  counts: { total: number; waiting: number; learning: number; due: number; finished: number };
  due: Word[];
  waiting: Word[];
  upcoming: Word[];
  finished: Word[];
  needMeaning: string[];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

/**
 * Từ đánh dấu lúc đọc sách, và vòng ôn của chúng.
 *
 * Điểm khác giáo trình theo ngày là MỐC ĐẾM: mỗi từ đếm mười ngày từ lúc bấm
 * "bắt đầu học" cho chính nó. Nên ở đây có hai trạng thái rõ rệt — đã đánh dấu
 * mà chưa đếm, và đang trong vòng ôn. Tô vàng một từ trong lúc đọc không có
 * nghĩa là nhận ngay một vòng ôn cho nó.
 *
 * Nghĩa của từ điền sau theo lô, vì lúc đọc mà dừng tra từng từ là mất mạch đọc.
 */
export default function MarkedWords({
  languageId,
  langCode,
}: {
  languageId?: string;
  langCode: string;
}) {
  const { t } = useLanguage();

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());

  const scope = languageId ? `?languageId=${encodeURIComponent(languageId)}` : "";
  const requestKey = `${reloadKey}:${languageId ?? ""}`;
  const loading = loadedFor !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/marked-words${scope}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không đọc được danh sách từ");
        setData(json);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(requestKey);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const reload = () => setReloadKey((n) => n + 1);

  const call = async (
    method: "POST" | "PUT" | "PATCH",
    body: Record<string, unknown>,
    tag: string
  ) => {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch("/api/learning/marked-words", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, languageId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không xong");
      reload();
      return json;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 c-help">
        <Loader2 size={16} className="animate-spin" />
        {t("Loading…", "Đang tải…")}
      </div>
    );
  }

  if (!data) {
    return error ? (
      <div className="c-alert c-alert-error">
        <AlertCircle size={18} className="icon" />
        <p className="flex-1">{error}</p>
      </div>
    ) : null;
  }

  // Chưa đánh dấu từ nào thì nói đường vào, đừng hiện một khung rỗng.
  if (data.counts.total === 0) {
    return (
      <div className="c-card p-5 space-y-2">
        <p className="c-h5 flex items-center gap-2">
          <BookmarkCheck size={16} />
          {t("Words you marked", "Từ bạn đánh dấu")}
        </p>
        <p className="c-help">
          {t(
            "Nothing marked yet. While reading a book unit, tap the bookmark on a word and it lands here — the 10-day cycle starts the day you press “start learning”.",
            "Chưa đánh dấu từ nào. Lúc đọc một unit trong sách, bấm dấu trang ở một từ là nó về đây — vòng 10 ngày bắt đầu tính từ ngày bạn bấm “bắt đầu học”."
          )}
        </p>
      </div>
    );
  }

  const reveal = (id: string) =>
    setShown((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const WordRow = ({ w, children }: { w: Word; children?: React.ReactNode }) => (
    <div className="c-card px-4 py-3 space-y-1.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {w.term}
            {w.phonetic && <span className="c-stat-label ml-2">/{w.phonetic}/</span>}
          </p>
          {w.definition ? (
            <p className="c-help">{w.definition}</p>
          ) : (
            <p className="c-help italic">{t("no meaning yet", "chưa có nghĩa")}</p>
          )}
          {w.source && <p className="c-stat-label mt-0.5">{w.source}</p>}
        </div>
        <button
          onClick={() => speak(w.term, langCode, 0.9)}
          aria-label={t(`Say ${w.term}`, `Đọc ${w.term}`)}
          className="w-11 h-11 -mt-1 grid place-content-center rounded-full text-[var(--color-text-faint)] hover:text-[var(--color-primary)] flex-none"
        >
          <Volume2 size={16} />
        </button>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="c-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="c-h5 flex items-center gap-2">
              <BookmarkCheck size={16} />
              {t("Words you marked", "Từ bạn đánh dấu")}
            </p>
            <p className="c-help">
              {t(
                `Each word runs its own cycle: every ${data.cycleDays} days, ${data.totalCycles} times, counted from the day you start it.`,
                `Mỗi từ có vòng riêng: lặp lại sau mỗi ${data.cycleDays} ngày, ${data.totalCycles} vòng, tính từ ngày bạn bắt đầu học từ đó.`
              )}
            </p>
          </div>
          {data.needMeaning.length > 0 && (
            <button
              onClick={() => void call("PATCH", {}, "fill")}
              disabled={busy === "fill"}
              className="c-btn c-btn-secondary flex-none"
            >
              {busy === "fill" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {t(
                `Fill ${data.needMeaning.length} meanings`,
                `Điền nghĩa (${data.needMeaning.length})`
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: t("Due today", "Tới hạn"), value: data.counts.due },
            { label: t("Learning", "Đang học"), value: data.counts.learning },
            { label: t("Not started", "Chưa bắt đầu"), value: data.counts.waiting },
            { label: t("Finished", "Xong 5 vòng"), value: data.counts.finished },
          ].map((s) => (
            <div key={s.label} className="c-card px-3 py-2">
              <p className="c-h4 tabular-nums">{s.value}</p>
              <p className="c-stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {/* Tới hạn hôm nay — việc cần làm, nên đặt trên cùng */}
      {data.due.length > 0 && (
        <section className="space-y-2">
          <p className="c-stat-label flex items-center gap-2">
            <CalendarClock size={13} />
            {t(`Due today · ${data.due.length}`, `Tới hạn hôm nay · ${data.due.length}`)}
          </p>
          {data.due.map((w) => (
            <WordRow key={w.id} w={w}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="c-chip c-chip-outline tabular-nums">
                  {t(
                    `cycle ${w.cyclesDone + 1}/${w.totalCycles}`,
                    `vòng ${w.cyclesDone + 1}/${w.totalCycles}`
                  )}
                </span>
                {w.overdue && (
                  <span className="c-chip" style={{ background: "var(--color-warning-tint)", color: "var(--color-warning)" }}>
                    {t("overdue", "quá hạn")}
                  </span>
                )}
                {!shown.has(w.id) && w.example && (
                  <button onClick={() => reveal(w.id)} className="c-btn c-btn-tertiary c-btn-sm">
                    <Eye size={15} />
                    {t("Show example", "Xem ví dụ")}
                  </button>
                )}
                <button
                  onClick={() => void call("PUT", { id: w.id }, w.id)}
                  disabled={busy === w.id}
                  className="c-btn c-btn-primary c-btn-sm ml-auto"
                >
                  {busy === w.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {t("Reviewed", "Đã ôn")}
                </button>
              </div>
              {shown.has(w.id) && w.example && (
                <p className="c-help italic border-l-2 border-[var(--color-border)] pl-3">
                  {w.example}
                </p>
              )}
            </WordRow>
          ))}
        </section>
      )}

      {/* Chưa vào vòng — bấm để bắt đầu đếm từ hôm nay */}
      {data.waiting.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="c-stat-label">
              {t(
                `Marked, not started · ${data.waiting.length}`,
                `Đã đánh dấu, chưa bắt đầu · ${data.waiting.length}`
              )}
            </p>
            <button
              onClick={() => void call("POST", { all: true }, "all")}
              disabled={busy === "all"}
              className="c-btn c-btn-secondary c-btn-sm"
            >
              {busy === "all" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {t("Start all", "Bắt đầu tất cả")}
            </button>
          </div>
          {data.waiting.map((w) => (
            <WordRow key={w.id} w={w}>
              <button
                onClick={() => void call("POST", { ids: [w.id] }, w.id)}
                disabled={busy === w.id}
                className="c-btn c-btn-tertiary c-btn-sm"
              >
                {busy === w.id ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {t("Start learning", "Bắt đầu học")}
              </button>
            </WordRow>
          ))}
        </section>
      )}

      {/* Lịch sắp tới — chỉ để biết trước, không phải việc phải làm */}
      {data.upcoming.length > 0 && (
        <details className="c-card p-4">
          <summary className="c-stat-label cursor-pointer flex items-center gap-2">
            <CalendarClock size={13} />
            {t(`Coming up · ${data.upcoming.length}`, `Sắp tới · ${data.upcoming.length}`)}
          </summary>
          <ul className="mt-3 space-y-1">
            {data.upcoming.slice(0, 20).map((w) => (
              <li key={w.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{w.term}</span>
                <span className="c-stat-label tabular-nums flex-none">
                  {w.dueAt && fmtDate(w.dueAt)} · {t(`cycle ${w.cyclesDone + 1}`, `vòng ${w.cyclesDone + 1}`)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {data.finished.length > 0 && (
        <details className="c-card p-4">
          <summary className="c-stat-label cursor-pointer flex items-center gap-2">
            <CircleCheck size={13} />
            {t(`Finished · ${data.finished.length}`, `Đã xong 5 vòng · ${data.finished.length}`)}
          </summary>
          <ul className="mt-3 space-y-1">
            {data.finished.map((w) => (
              <li key={w.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{w.term}</span>
                <span className="c-stat-label truncate flex-none">{w.definition}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
