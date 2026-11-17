"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Loader2, Play, RefreshCw, RotateCcw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import TypingRunner, { type TypingMode } from "@/components/learning/sentences/TypingRunner";
import TranslateRunner from "@/components/learning/sentences/TranslateRunner";
import type { PracticeSentence, SentenceOutcome } from "@/components/learning/sentences/shared";
import type { PathView } from "@/lib/pathServer";
import { KIND_LABEL, lessonHref } from "./links";

interface Loaded {
  point: { id: string; title: string; level: string; family: string };
  sentences: PracticeSentence[];
}

/**
 * Một bài Gõ câu hoặc Dịch câu trên Lộ trình.
 *
 * Bộ 8 câu của điểm ngữ pháp được AI soạn ở lần mở đầu tiên (mất chừng 20
 * giây) rồi lưu lại; bài Dịch câu cùng điểm dùng lại đúng bộ đó.
 */
export default function PathLesson({
  languageId,
  langCode,
  pointId,
  kind,
}: {
  languageId: string;
  langCode: string;
  pointId: string;
  kind: "typing" | "translate";
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [queue, setQueue] = useState<PracticeSentence[] | null>(null);
  const [outcomes, setOutcomes] = useState<SentenceOutcome[] | null>(null);
  const [mode, setMode] = useState<TypingMode>("meaning");
  const [nextHref, setNextHref] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/path/deck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languageId, pointId, mode: kind }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json.success) throw new Error(json.error || "Không mở được bài");
        setData({ point: json.point, sentences: json.set.sentences });
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });
    return () => controller.abort();
  }, [languageId, pointId, kind, attempt]);

  // Xong lượt thì hỏi lộ trình bài kế tiếp là gì.
  useEffect(() => {
    if (!outcomes) return;
    const controller = new AbortController();
    fetch(`/api/learning/path?languageId=${encodeURIComponent(languageId)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        const v = json?.view as PathView | undefined;
        if (v?.available && v.next) setNextHref(lessonHref(languageId, v.next.kind, v.next.pointId));
        else if (v?.available) setNextHref(`/learning/languages/${languageId}/path/test`);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [outcomes, languageId]);

  const label = KIND_LABEL[kind];
  const backHref = `/learning/languages/${languageId}/path`;

  if (error) {
    return (
      <div className="c-alert c-alert-error">
        <AlertCircle size={18} className="icon" />
        <div className="flex-1 space-y-2">
          <p>{error}</p>
          <button onClick={() => { setError(null); setAttempt((a) => a + 1); }} className="c-btn c-btn-secondary c-btn-sm">
            <RefreshCw size={14} />
            {t("Try again", "Thử lại")}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="c-card p-10 flex flex-col items-center gap-3 text-center">
        <Loader2 size={22} className="animate-spin text-[var(--color-text-muted)]" />
        <p className="font-medium">{t("Preparing this lesson…", "Đang chuẩn bị bài…")}</p>
        <p className="c-help max-w-sm">
          {t(
            "The first time, AI writes 8 sentences for this grammar point (about 20 seconds). After that they are kept.",
            "Lần đầu, AI soạn 8 câu cho điểm ngữ pháp này (khoảng 20 giây). Từ lần sau dùng lại đúng bộ đó."
          )}
        </p>
      </div>
    );
  }

  if (queue && !outcomes) {
    const exit = () => setQueue(null);
    return kind === "translate" ? (
      <TranslateRunner languageId={languageId} code={langCode} sentences={queue} onFinish={setOutcomes} onExit={exit} />
    ) : (
      <TypingRunner languageId={languageId} code={langCode} sentences={queue} mode={mode} level="basic" onFinish={setOutcomes} onExit={exit} />
    );
  }

  const left = data.sentences.filter((s) => !s.cleared);
  const start = (list?: PracticeSentence[]) => {
    setOutcomes(null);
    setNextHref(null);
    setQueue(list ?? (left.length ? left : data.sentences));
  };

  if (outcomes) {
    const clean = outcomes.filter((o) => o.clean).length;
    const redo = outcomes.filter((o) => !o.clean).map((o) => o.sentence);
    return (
      <div className="c-card c-elev-md p-6 space-y-5">
        <p className="c-stat-label">{data.point.family} · {t(label[0], label[1])}</p>
        <h2 className="c-h2">{data.point.title}</h2>
        <p className="c-card-body">
          {t(
            `${clean} of ${outcomes.length} on your own. Sentences that needed help went to your mistake book.`,
            `Tự làm trọn ${clean}/${outcomes.length} câu. Câu cần gợi ý đã vào sổ lỗi sai.`
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {nextHref && (
            <Link href={nextHref} className="c-btn c-btn-primary c-btn-lg">
              {t("Next lesson", "Bài tiếp")}
              <ArrowRight size={18} />
            </Link>
          )}
          {redo.length > 0 && (
            <button onClick={() => start(redo)} className="c-btn c-btn-secondary">
              <RotateCcw size={16} />
              {t(`Redo ${redo.length}`, `Làm lại ${redo.length} câu`)}
            </button>
          )}
          <Link href={backHref} className="c-btn c-btn-tertiary">{t("Back to the path", "Về lộ trình")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="c-card c-elev-md p-6 space-y-5">
      <div>
        <p className="c-stat-label">{data.point.family} · {t(label[0], label[1])} · {data.point.level}</p>
        <h2 className="c-h2">{data.point.title}</h2>
        <p className="c-help tabular-nums">
          {t(
            `${data.sentences.length - left.length}/${data.sentences.length} sentences done`,
            `Đã qua ${data.sentences.length - left.length}/${data.sentences.length} câu`
          )}
        </p>
      </div>

      {kind === "typing" && (
        <div className="space-y-2">
          <p className="c-stat-label">{t("How", "Chế độ")}</p>
          <div className="c-seg w-fit flex-wrap">
            {(["meaning", "listen", "speak"] as TypingMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`c-seg-opt ${mode === m ? "active" : ""}`}>
                {m === "meaning" ? t("See meaning, type", "Nhìn nghĩa, gõ lại") : m === "listen" ? t("Listen, type", "Nghe rồi viết") : t("Listen, say it", "Nghe & nói")}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-1">
        {data.sentences.map((s) => (
          <li key={s.ref.index} className={`text-[15px] ${s.cleared ? "text-[var(--color-text-muted)] line-through" : ""}`}>
            {s.vi}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => start()} className="c-btn c-btn-primary c-btn-lg">
          <Play size={18} />
          {left.length && left.length < data.sentences.length
            ? t(`Continue (${left.length} left)`, `Làm tiếp (${left.length} câu)`)
            : t("Start", "Bắt đầu")}
        </button>
        {left.length === 0 && (
          <span className="c-help self-center">{t("All done — practise again anytime.", "Đã xong — muốn luyện lại lúc nào cũng được.")}</span>
        )}
      </div>
    </div>
  );
}
