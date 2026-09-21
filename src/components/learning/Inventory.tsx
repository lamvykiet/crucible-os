"use client";

import { useState, useEffect } from "react";
import {
  Search, Plus, Upload, Trash2, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Layers, Volume2, CheckSquare, Square,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { speak } from "@/lib/speech";
import ImportDialog from "@/components/learning/ImportDialog";
import DeckManager from "@/components/learning/DeckManager";

interface Item {
  id: string;
  term: string;
  definition: string;
  phonetic: string | null;
  tone: string | null;
  example: string | null;
  exampleTranslation: string | null;
  deck: { id: string; name: string } | null;
  flashcard: { id: string; dueDate: string; state: number; reps: number } | null;
}

interface Deck {
  id: string;
  name: string;
  count: number;
}

type Filter = "all" | "relearn" | "mastered";
type Tab = "cards" | "decks";

/**
 * Kho thẻ.
 *
 * Trước đây thẻ nằm rải hai chỗ — kho thuật ngữ là danh sách phẳng, màn bộ thẻ
 * chỉ thấy tên bộ chứ không thấy thẻ bên trong. Không chỗ nào trả lời được
 * "thẻ tôi đã thuộc là những thẻ nào".
 *
 * Về nút "xoá hết": bản tham chiếu có một nút xoá sạch kho. Ở đây phải chọn
 * thẻ rồi mới xoá được. Xoá toàn bộ từ vựng đã tích góp là việc không lùi lại
 * được, nó không nên nằm sau đúng một cú bấm.
 */
export default function Inventory() {
  const { t } = useLanguage();

  const [tab, setTab] = useState<Tab>("cards");
  const [filter, setFilter] = useState<Filter>("all");
  const [deckId, setDeckId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [items, setItems] = useState<Item[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const query = `filter=${filter}&page=${page}` +
    (deckId ? `&deck=${encodeURIComponent(deckId)}` : "") +
    (search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "");

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = `${reloadKey}:${query}`;
  const loading = loadedFor !== requestKey;

  useEffect(() => {
    const controller = new AbortController();

    // Gõ tới đâu lọc tới đó, nhưng chờ một nhịp để không bắn request mỗi phím.
    const timer = setTimeout(() => {
      fetch(`/api/learning/inventory?${query}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((json) => {
          if (controller.signal.aborted) return;
          if (!json?.success) throw new Error(json?.error || "Không đọc được kho thẻ");
          setItems(json.items);
          setDecks(json.decks);
          setTotal(json.total);
          setPageCount(json.pageCount);
          setError(null);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadedFor(requestKey);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const removeSelected = async () => {
    if (selected.size === 0) return;
    const msg = t(
      `Delete ${selected.size} cards? This cannot be undone.`,
      `Xoá ${selected.size} thẻ? Không khôi phục lại được.`
    );
    if (!window.confirm(msg)) return;

    setDeleting(true);
    try {
      await fetch("/api/learning/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      setSelected(new Set());
      setReloadKey((k) => k + 1);
    } finally {
      setDeleting(false);
    }
  };

  const filters: { id: Filter; en: string; vi: string }[] = [
    { id: "all", en: "All cards", vi: "Tất cả thẻ" },
    { id: "relearn", en: "To relearn today", vi: "Cần ôn hôm nay" },
    { id: "mastered", en: "Mastered", vi: "Đã thuộc" },
  ];

  return (
    <div className="space-y-6">
      {/* Hai mảng: thẻ và bộ thẻ */}
      <div className="c-seg self-start">
        {(["cards", "decks"] as const).map((x) => (
          <button
            key={x}
            className={`c-seg-opt ${tab === x ? "active" : ""}`}
            onClick={() => setTab(x)}
          >
            {x === "cards" ? t("Cards", "Thẻ") : t("Decks", "Bộ thẻ")}
          </button>
        ))}
      </div>

      {tab === "decks" ? (
        <DeckManager />
      ) : (
        <>
          {/* Lọc */}
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setPage(0); }}
                className={`c-chip ${filter === f.id ? "c-chip-solid" : "c-chip-outline"}`}
              >
                {t(f.en, f.vi)}
              </button>
            ))}
          </div>

          {/* Tìm và chọn bộ */}
          <div className="flex flex-wrap gap-2">
            <select
              className="c-select w-full sm:w-56"
              value={deckId}
              onChange={(e) => { setDeckId(e.target.value); setPage(0); }}
            >
              <option value="">{t("All decks", "Tất cả bộ thẻ")}</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.count})</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={16} />
              <input
                className="c-input w-full pl-9!"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder={t("Search a word...", "Tìm một từ...")}
              />
            </div>

            <button onClick={() => setShowImport(true)} className="c-btn c-btn-primary">
              <Upload size={15} />
              {t("Add words", "Thêm từ")}
            </button>
          </div>

          {error && (
            <div className="c-alert c-alert-error">
              <AlertCircle size={18} className="icon" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Thanh chọn nhiều */}
          {selected.size > 0 && (
            <div className="c-card p-3 flex flex-wrap items-center gap-3">
              <span className="font-bold text-sm">
                {t(`${selected.size} selected`, `Đã chọn ${selected.size} thẻ`)}
              </span>
              <button onClick={() => setSelected(new Set())} className="c-btn c-btn-secondary c-btn-sm">
                {t("Clear", "Bỏ chọn")}
              </button>
              <button
                onClick={removeSelected}
                disabled={deleting}
                className="c-btn c-btn-danger c-btn-sm ml-auto"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {t("Delete", "Xoá")}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] grid place-content-center">
                <Layers size={30} />
              </div>
              <p className="c-h3">
                {search || filter !== "all" || deckId
                  ? t("No cards match", "Không có thẻ nào khớp")
                  : t("No cards yet", "Chưa có thẻ nào")}
              </p>
              <button onClick={() => setShowImport(true)} className="c-btn c-btn-primary c-btn-sm">
                <Plus size={14} />
                {t("Add your first words", "Thêm từ đầu tiên")}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const picked = selected.has(item.id);
                  return (
                    <article
                      key={item.id}
                      className={`c-card p-4 flex flex-col gap-2 transition-colors ${
                        picked ? "border-[var(--color-primary)]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => toggle(item.id)}
                          className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors mt-0.5"
                          aria-label={t("Select", "Chọn thẻ")}
                        >
                          {picked ? (
                            <CheckSquare size={16} className="text-[var(--color-primary)]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="font-bold break-words">{item.term}</p>
                          {item.phonetic && (
                            <p className="c-stat-label font-mono">
                              {item.phonetic}
                              {item.tone && ` · ${item.tone}`}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => speak(item.term, "en")}
                          className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors flex-none"
                          aria-label={t("Listen", "Nghe")}
                        >
                          <Volume2 size={15} />
                        </button>
                      </div>

                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
                        {item.definition}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
                        {item.deck && <span className="c-chip c-chip-outline">{item.deck.name}</span>}
                        {item.flashcard && (
                          <span
                            className={`c-chip ${
                              new Date(item.flashcard.dueDate) <= new Date()
                                ? "c-chip-warning"
                                : item.flashcard.state === 2
                                  ? "c-chip-success"
                                  : "c-chip-outline"
                            }`}
                          >
                            {new Date(item.flashcard.dueDate) <= new Date()
                              ? t("due", "tới hạn")
                              : item.flashcard.state === 2
                                ? t("mastered", "đã thuộc")
                                : t("learning", "đang học")}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Phân trang */}
              <div className="flex items-center justify-between gap-3">
                <span className="c-stat-label tabular-nums">
                  {t(`${total} cards`, `${total} thẻ`)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="c-btn c-btn-secondary c-btn-icon"
                    aria-label={t("Previous page", "Trang trước")}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="c-stat-label tabular-nums">
                    {page + 1}/{pageCount}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                    className="c-btn c-btn-secondary c-btn-icon"
                    aria-label={t("Next page", "Trang sau")}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {showImport && (
        <ImportDialog
          deckId={deckId || undefined}
          onDone={() => setReloadKey((k) => k + 1)}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
