"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, ArrowLeft, Loader2, Play, RotateCcw, Sparkles, Trash2, Check, BookX,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageContext";
import type { SentenceMode } from "@/lib/sentences";
import type { TypingLevel } from "@/lib/sentences/types";
import TranslateRunner from "./TranslateRunner";
import TypingRunner, { type TypingMode } from "./TypingRunner";
import type { OpenedSet, PracticeSentence, SentenceOutcome } from "./shared";

interface SetCard {
  id: string;
  title: string;
  level: string;
  topic: string;
  note: string;
  source: "builtin" | "ai" | "mine";
  total: number;
  cleared: number;
}

type Which = "unfinished" | "all";
type Order = "inOrder" | "shuffle";

interface Options {
  which: Which;
  order: Order;
  count: number; // 0 = cả bộ
  typingMode: TypingMode;
  typingLevel: TypingLevel;
}

const DEFAULTS: Options = { which: "unfinished", order: "inOrder", count: 10, typingMode: "meaning", typingLevel: "basic" };
const optKey = (mode: SentenceMode) => `crucible.sentences.options.${mode}`;

function loadOptions(mode: SentenceMode): Options {
  try {
    const raw = localStorage.getItem(optKey(mode));
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/**
 * Màn chọn bộ câu, dùng chung cho Gõ câu và Dịch câu.
 *
 * Ba nguồn câu nằm chung một lưới: câu ví dụ trên thẻ của chính mình, bộ AI
 * soạn theo chủ đề mình gõ, và bộ viết sẵn trong code. Lọc theo cấp như trang
 * chép chính tả.
 */
export default function SentencePractice({
  languageId,
  langCode,
  mode,
}: {
  languageId: string;
  langCode: string;
  mode: SentenceMode;
}) {
  const { t } = useLanguage();
  const [sets, setSets] = useState<SetCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const [picked, setPicked] = useState<OpenedSet | null>(null);
  const [opening, setOpening] = useState(false);
  const [opts, setOpts] = useState<Options>(() => loadOptions(mode));
  const [queue, setQueue] = useState<PracticeSentence[] | null>(null);
  const [outcomes, setOutcomes] = useState<SentenceOutcome[] | null>(null);

  const [topic, setTopic] = useState("");
  const [genLevel, setGenLevel] = useState("B2");
  const [generating, setGenerating] = useState(false);

  const setOpt = <K extends keyof Options>(k: K, v: Options[K]) => {
    setOpts((o) => {
      const next = { ...o, [k]: v };
      try {
        localStorage.setItem(optKey(mode), JSON.stringify(next));
      } catch {
        // Không nhớ được thì lần sau dùng mặc định.
      }
      return next;
    });
  };

  const fetchSets = useCallback(async (): Promise<SetCard[]> => {
    const res = await fetch(`/api/learning/sentences?mode=${mode}&languageId=${encodeURIComponent(languageId)}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Không đọc được danh sách");
    return json.sets;
  }, [languageId, mode]);

  // Chỉ đặt state trong `.then`: lần tải đầu đã có `loading = true` sẵn.
  const load = useCallback(
    () =>
      fetchSets()
        .then((list) => { setSets(list); setError(null); })
        .catch((err) => setError(err instanceof Error ? err.message : "Không đọc được danh sách"))
        .finally(() => setLoading(false)),
    [fetchSets]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openSet = async (setId: string) => {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/sentences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, setId, mode }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Không mở được bộ câu");
      setPicked(json.set);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không mở được bộ câu");
    } finally {
      setOpening(false);
    }
  };

  const start = (only?: PracticeSentence[]) => {
    if (!picked) return;
    let list = only ?? picked.sentences;
    if (!only) {
      if (opts.which === "unfinished") {
        const left = list.filter((s) => !s.cleared);
        list = left.length ? left : list;
      }
      if (opts.order === "shuffle") list = [...list].sort(() => Math.random() - 0.5);
      if (opts.count > 0) list = list.slice(0, opts.count);
    }
    setOutcomes(null);
    setQueue(list);
  };

  const generate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/sentences/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, topic, level: genLevel }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "AI chưa soạn được");
      setTopic("");
      await load();
      await openSet(json.setId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI chưa soạn được");
    } finally {
      setGenerating(false);
    }
  };

  const removeDeck = async (setId: string) => {
    if (!window.confirm(t("Delete this AI set and its progress?", "Xoá bộ AI này cùng tiến độ của nó?"))) return;
    const res = await fetch(`/api/learning/sentences/generate?setId=${encodeURIComponent(setId)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!json.success) {
      setError(json.error || "Không xoá được");
      return;
    }
    setPicked(null);
    void load();
  };

  const backToList = () => {
    setQueue(null);
    setOutcomes(null);
    setPicked(null);
    void load();
  };

  /* ── Đang làm ─────────────────────────────────────────────────────────── */
  if (queue && !outcomes) {
    const finish = (o: SentenceOutcome[]) => setOutcomes(o);
    const exit = () => { setQueue(null); if (picked) void openSet(picked.id); };
    return mode === "translate" ? (
      <TranslateRunner languageId={languageId} code={langCode} sentences={queue} onFinish={finish} onExit={exit} />
    ) : (
      <TypingRunner
        languageId={languageId} code={langCode} sentences={queue}
        mode={opts.typingMode} level={opts.typingLevel} onFinish={finish} onExit={exit}
      />
    );
  }

  /* ── Tổng kết lượt ────────────────────────────────────────────────────── */
  if (outcomes) {
    const clean = outcomes.filter((o) => o.clean).length;
    const helped = outcomes.filter((o) => o.perfect && !o.clean).length;
    const missed = outcomes.filter((o) => !o.perfect).length;
    const redo = outcomes.filter((o) => !o.clean).map((o) => o.sentence);
    return (
      <div className="space-y-6">
        <div className="c-card c-elev-md p-6 space-y-5">
          <h2 className="c-h2">{t("Round done", "Xong lượt")}</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="c-h2 tabular-nums text-[var(--color-success)]">{clean}</p>
              <p className="c-stat-label">{t("on your own", "tự làm trọn")}</p>
            </div>
            <div>
              <p className="c-h2 tabular-nums">{helped}</p>
              <p className="c-stat-label">{t("with hints", "cần gợi ý")}</p>
            </div>
            <div>
              <p className="c-h2 tabular-nums text-[var(--color-warning)]">{missed}</p>
              <p className="c-stat-label">{t("looked at the answer", "phải xem đáp án")}</p>
            </div>
          </div>
          {redo.length > 0 && (
            <ul className="space-y-2">
              {redo.map((s) => (
                <li key={`${s.ref.setId}#${s.ref.index}`} className="border-t border-[var(--color-border)] pt-2">
                  <p className="font-medium">{s.en}</p>
                  <p className="c-help">{s.vi}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {redo.length > 0 && (
              <button onClick={() => start(redo)} className="c-btn c-btn-primary">
                <RotateCcw size={16} />
                {t(`Redo ${redo.length} sentence(s)`, `Làm lại ${redo.length} câu chưa trọn`)}
              </button>
            )}
            <button onClick={backToList} className="c-btn c-btn-secondary">
              {t("Choose another set", "Chọn bộ khác")}
            </button>
            {redo.length > 0 && (
              <Link href={`/learning/languages/${languageId}/mistakes`} className="c-btn c-btn-tertiary">
                <BookX size={16} />
                {t("Mistake book", "Sổ lỗi sai")}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Đã chọn bộ: chọn cách học ───────────────────────────────────────── */
  if (picked) {
    const left = picked.sentences.filter((s) => !s.cleared).length;
    const seg = <V extends string | number>(value: V, current: V, label: string, on: (v: V) => void) => (
      <button key={String(value)} onClick={() => on(value)} className={`c-seg-opt ${current === value ? "active" : ""}`}>
        {label}
      </button>
    );
    return (
      <div className="space-y-6">
        <button onClick={() => setPicked(null)} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
          <ArrowLeft size={16} />
          {t("All sets", "Mọi bộ câu")}
        </button>

        <div className="c-card c-elev-md p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="c-h3">{picked.title}</h2>
              <p className="c-help tabular-nums">
                {t(
                  `${picked.sentences.length} sentences · ${picked.sentences.length - left} done`,
                  `${picked.sentences.length} câu · đã qua ${picked.sentences.length - left}`
                )}
              </p>
            </div>
            {picked.level !== "—" && <span className="c-chip c-chip-outline">{picked.level}</span>}
          </div>

          {mode === "typing" && (
            <>
              <div className="space-y-2">
                <p className="c-stat-label">{t("How", "Chế độ học")}</p>
                <div className="c-seg w-fit flex-wrap">
                  {seg<TypingMode>("meaning", opts.typingMode, t("See meaning, type", "Nhìn nghĩa, gõ lại"), (v) => setOpt("typingMode", v))}
                  {seg<TypingMode>("listen", opts.typingMode, t("Listen, type", "Nghe rồi viết"), (v) => setOpt("typingMode", v))}
                  {seg<TypingMode>("speak", opts.typingMode, t("Listen, say it", "Nghe & nói"), (v) => setOpt("typingMode", v))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="c-stat-label">{t("Difficulty", "Độ khó")}</p>
                <div className="c-seg w-fit flex-wrap">
                  {seg<TypingLevel>("basic", opts.typingLevel, t("Basic: word → phrase → sentence", "Cơ bản: từ → cụm → câu"), (v) => setOpt("typingLevel", v))}
                  {seg<TypingLevel>("medium", opts.typingLevel, t("Medium: word → sentence", "Trung cấp: từ → câu"), (v) => setOpt("typingLevel", v))}
                  {seg<TypingLevel>("hard", opts.typingLevel, t("Hard: sentence", "Nâng cao: cả câu"), (v) => setOpt("typingLevel", v))}
                </div>
                {picked.source === "mine" && opts.typingLevel !== "hard" && (
                  <p className="c-help">
                    {t(
                      "Sentences from your cards have no phrase breakdown, so they go straight to the whole sentence.",
                      "Câu lấy từ thẻ chưa được cắt cụm, nên sẽ gõ thẳng cả câu."
                    )}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-6">
            <div className="space-y-2">
              <p className="c-stat-label">{t("Which sentences", "Câu nào")}</p>
              <div className="c-seg w-fit">
                {seg<Which>("unfinished", opts.which, t(`Not done (${left})`, `Chưa qua (${left})`), (v) => setOpt("which", v))}
                {seg<Which>("all", opts.which, t("All", "Tất cả"), (v) => setOpt("which", v))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="c-stat-label">{t("Order", "Thứ tự")}</p>
              <div className="c-seg w-fit">
                {seg<Order>("inOrder", opts.order, t("In order", "Lần lượt"), (v) => setOpt("order", v))}
                {seg<Order>("shuffle", opts.order, t("Shuffle", "Ngẫu nhiên"), (v) => setOpt("order", v))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="c-stat-label">{t("How many", "Số câu")}</p>
              <div className="c-seg w-fit">
                {seg<number>(5, opts.count, "5", (v) => setOpt("count", v))}
                {seg<number>(10, opts.count, "10", (v) => setOpt("count", v))}
                {seg<number>(0, opts.count, t("All", "Cả bộ"), (v) => setOpt("count", v))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => start()} className="c-btn c-btn-primary c-btn-lg">
              <Play size={18} />
              {t("Start", "Bắt đầu")}
            </button>
            {picked.source === "ai" && (
              <button onClick={() => void removeDeck(picked.id)} className="c-btn c-btn-tertiary ml-auto">
                <Trash2 size={16} />
                {t("Delete set", "Xoá bộ")}
              </button>
            )}
          </div>
        </div>

        <div className="c-card p-5 space-y-2">
          <p className="c-stat-label">{t("In this set", "Trong bộ này")}</p>
          <ul className="space-y-1.5">
            {picked.sentences.map((s) => (
              <li key={`${s.ref.setId}#${s.ref.index}`} className="flex items-start gap-2 text-[15px]">
                <span className={`mt-1 flex-none ${s.cleared ? "text-[var(--color-success)]" : "text-[var(--color-text-faint)]"}`}>
                  <Check size={14} />
                </span>
                {/* Chỉ hiện nghĩa: hiện câu tiếng Anh ở đây là lộ đáp án trước khi làm. */}
                <span className={s.cleared ? "" : "text-[var(--color-text-muted)]"}>{s.vi}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  /* ── Danh sách bộ ─────────────────────────────────────────────────────── */
  const levels = Array.from(new Set(sets.filter((s) => s.source === "builtin").map((s) => s.level)));
  const visible = sets.filter((s) =>
    filter === "all" ? true : filter === "ai" ? s.source === "ai" : filter === "mine" ? s.source === "mine" : s.level === filter && s.source === "builtin"
  );

  return (
    <div className="space-y-6">
      <p className="c-help">
        {mode === "translate"
          ? t(
              "Read the Vietnamese, write it in English. Each word you get right uncovers its box; Ctrl+Space gives you the next word. If you phrase it differently, let AI judge it.",
              "Đọc câu tiếng Việt, viết lại bằng tiếng Anh. Gõ đúng chữ nào ô đó lật ra; Ctrl+Space hiện chữ kế tiếp. Dịch theo cách khác bản mẫu thì để AI chấm."
            )
          : t(
              "Build each sentence up: key words, then phrases, then the whole thing — by meaning, by ear, or out loud.",
              "Dựng câu từ nhỏ lên lớn: từ khoá, rồi cụm, rồi cả câu — nhìn nghĩa, nghe, hoặc nói thành tiếng."
            )}
      </p>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      <div className="c-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-accent)]" />
          <p className="font-bold">{t("New set from a topic", "Tạo bộ mới theo chủ đề")}</p>
        </div>
        <p className="c-help">
          {t(
            "AI writes 10 sentences at the level you pick and saves them, so you can come back to them. Uses one AI call.",
            "AI soạn 10 câu đúng cấp bạn chọn và lưu lại để học nhiều lần. Tốn một lượt AI."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void generate(); }}
            placeholder={t("e.g. negotiating a salary, ordering coffee…", "vd. đàm phán lương, gọi cà phê, báo cáo dự án…")}
            className="c-input flex-1 min-w-[200px]"
            maxLength={120}
          />
          <select value={genLevel} onChange={(e) => setGenLevel(e.target.value)} className="c-input w-auto">
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
          </select>
          <button onClick={() => void generate()} disabled={generating || !topic.trim()} className="c-btn c-btn-primary">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? t("Writing…", "Đang soạn…") : t("Create", "Tạo")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 c-help">
          <Loader2 size={16} className="animate-spin" />
          {t("Loading…", "Đang tải…")}
        </div>
      ) : sets.length === 0 ? (
        <div className="c-card p-10 text-center space-y-2">
          <p className="c-h3">{t("No sentences yet", "Chưa có câu nào")}</p>
          <p className="c-card-body">
            {t(
              "This language has no ready-made sets yet. Create one from a topic above.",
              "Thứ tiếng này chưa có bộ viết sẵn. Tạo một bộ theo chủ đề ở trên."
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("all")} className={`c-chip ${filter === "all" ? "c-chip-solid" : "c-chip-outline"}`}>
              {t("All", "Tất cả")} ({sets.length})
            </button>
            {levels.map((lv) => (
              <button key={lv} onClick={() => setFilter(lv)} className={`c-chip ${filter === lv ? "c-chip-solid" : "c-chip-outline"}`}>
                {lv}
              </button>
            ))}
            {sets.some((s) => s.source === "ai") && (
              <button onClick={() => setFilter("ai")} className={`c-chip ${filter === "ai" ? "c-chip-solid" : "c-chip-outline"}`}>
                {t("AI sets", "Bộ AI")}
              </button>
            )}
            {sets.some((s) => s.source === "mine") && (
              <button onClick={() => setFilter("mine")} className={`c-chip ${filter === "mine" ? "c-chip-solid" : "c-chip-outline"}`}>
                {t("From my cards", "Từ thẻ của tôi")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((card) => {
              const done = card.total > 0 ? Math.round((card.cleared / card.total) * 100) : 0;
              return (
                <button
                  key={card.id}
                  onClick={() => void openSet(card.id)}
                  disabled={opening}
                  className="c-card p-5 text-left space-y-2 hover:border-[var(--color-primary)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium flex-1">{card.title}</p>
                    {card.source === "ai" ? (
                      <span className="c-chip c-chip-outline flex-none inline-flex items-center gap-1">
                        <Sparkles size={11} /> {card.level}
                      </span>
                    ) : card.level !== "—" ? (
                      <span className="c-chip c-chip-outline flex-none">{card.level}</span>
                    ) : null}
                  </div>
                  <p className="c-help line-clamp-2">{card.note}</p>
                  <div className="c-progress">
                    <span style={{ width: `${done}%` }} />
                  </div>
                  <p className="c-stat-label tabular-nums">
                    {t(`${card.cleared} of ${card.total} done`, `Đã qua ${card.cleared}/${card.total}`)}
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
