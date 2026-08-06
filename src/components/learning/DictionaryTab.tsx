"use client";

import { useState, useEffect } from "react";
import {
  Search, Plus, Filter, Tag as TagIcon, Loader2, AlertCircle, Trash2, X, Sparkles, Brain,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface DictionaryItem {
  id: string;
  term: string;
  definition: string;
  phonetic: string | null;
  example: string | null;
  domain: string | null;
  tags: string[];
  flashcard: { id: string; dueDate: string } | null;
}

const EMPTY_FORM = {
  term: "", definition: "", phonetic: "", example: "", domain: "",
  tags: "", createFlashcard: true,
};

/**
 * Từ điển cá nhân — dữ liệu thật từ /api/learning/dictionary.
 *
 * Bản cũ render bốn mục viết cứng trong chính component và nút "Thêm từ" không
 * có `onClick`. Bộ lọc thẻ thì lọc trên chính bốn mục bịa đó.
 */
export default function DictionaryTab() {
  const { t } = useLanguage();

  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedTag) params.set("tag", selectedTag);

    // Gõ tới đâu lọc tới đó, nhưng chờ một nhịp để không bắn request mỗi phím.
    const timer = setTimeout(() => {
      fetch(`/api/learning/dictionary?${params}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((json) => {
          if (controller.signal.aborted) return;
          if (!json?.success) throw new Error(json?.error || "Không tải được từ điển");
          setItems(json.items);
          setTags(json.tags);
          setError(null);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, selectedTag, reloadKey]);

  const lookup = async () => {
    if (!form.term.trim() || looking) return;
    setLooking(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/dictionary/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: form.term }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tra được");

      setForm((f) => ({
        ...f,
        definition: json.data.definition || f.definition,
        phonetic: json.data.phonetic || f.phonetic,
        example: json.data.example || f.example,
        domain: json.data.domain || f.domain,
        tags: (json.data.tags || []).join(", ") || f.tags,
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLooking(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.term.trim() || !form.definition.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không lưu được");

      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("Delete this term?", "Xoá từ này?"))) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/learning/dictionary?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-display)" }}>
            {t("Dictionary", "Từ Điển")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t(
              "Store vocabulary and terminology; every term can become a flashcard.",
              "Lưu từ vựng và thuật ngữ; mỗi từ đều có thể thành một thẻ ghi nhớ."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={18} />
            <input
              type="text"
              placeholder={t("Search terms...", "Tìm kiếm từ...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="c-input w-full pl-10 rounded-full"
            />
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white rounded-full flex-none font-bold shadow-sm"
          >
            {showForm ? <X size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />}
            {showForm ? t("Cancel", "Huỷ") : t("Add Term", "Thêm từ")}
          </button>
        </div>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="c-card space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="c-field md:col-span-2">
              <label htmlFor="term">{t("Term", "Từ / thuật ngữ")}</label>
              <div className="flex gap-2">
                <input
                  id="term"
                  className="c-input flex-1"
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                  placeholder="EBITDA"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={lookup}
                  disabled={!form.term.trim() || looking}
                  title={t("Look it up with AI", "Nhờ AI tra nghĩa")}
                  className="c-btn c-btn-secondary flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  {looking ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {t("Look up", "Tra nghĩa")}
                </button>
              </div>
            </div>
            <div className="c-field">
              <label htmlFor="phonetic">{t("Phonetic", "Phiên âm")}</label>
              <input
                id="phonetic"
                className="c-input"
                value={form.phonetic}
                onChange={(e) => setForm({ ...form, phonetic: e.target.value })}
                placeholder="/ɪˈbɪtdɑː/"
              />
            </div>
          </div>

          <div className="c-field">
            <label htmlFor="definition">{t("Definition", "Định nghĩa")}</label>
            <textarea
              id="definition"
              className="c-textarea min-h-[70px] resize-y"
              value={form.definition}
              onChange={(e) => setForm({ ...form, definition: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="c-field md:col-span-2">
              <label htmlFor="example">{t("Example", "Ví dụ")}</label>
              <input
                id="example"
                className="c-input"
                value={form.example}
                onChange={(e) => setForm({ ...form, example: e.target.value })}
              />
            </div>
            <div className="c-field">
              <label htmlFor="domain">{t("Domain", "Lĩnh vực")}</label>
              <input
                id="domain"
                className="c-input"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="Finance"
              />
            </div>
          </div>

          <div className="c-field">
            <label htmlFor="tags">{t("Tags (comma separated)", "Thẻ (cách nhau bằng dấu phẩy)")}</label>
            <input
              id="tags"
              className="c-input"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="Accounting, Metric, CFA"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.createFlashcard}
              onChange={(e) => setForm({ ...form, createFlashcard: e.target.checked })}
              className="accent-[#66c2c2]"
            />
            {t("Also create a flashcard for review", "Tạo luôn thẻ ghi nhớ để ôn tập")}
          </label>

          <div className="flex gap-3">
            <button type="submit" disabled={saving || !form.term.trim() || !form.definition.trim()} className="c-btn c-btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {t("Save", "Lưu")}
            </button>
          </div>
        </form>
      )}

      {tags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          <Filter size={16} className="text-[var(--color-text-faint)] flex-none" />
          <button
            onClick={() => setSelectedTag(null)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedTag === null
                ? "bg-[var(--color-success)] text-white"
                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {t("All Tags", "Tất cả")}
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedTag === tag
                  ? "bg-[var(--color-success)] text-white"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              # {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading...", "Đang tải...")}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <TagIcon size={32} />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--color-text)]">
              {search || selectedTag
                ? t("No matching terms", "Không có từ nào khớp")
                : t("No terms yet", "Chưa có từ nào")}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {search || selectedTag
                ? t("Try a different search.", "Thử từ khoá khác.")
                : t("Add the first term — AI can fill in the rest.", "Thêm từ đầu tiên — AI điền hộ phần còn lại.")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="group bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="text-xl font-bold text-[var(--color-primary)] break-words" style={{ fontFamily: "var(--font-display)" }}>
                    {item.term}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-none">
                    {item.flashcard && (
                      <span title={t("Has a flashcard", "Đã có thẻ ghi nhớ")} className="text-[var(--color-success)]">
                        <Brain size={14} />
                      </span>
                    )}
                    {item.domain && (
                      <span className="text-[10px] py-1 px-2 rounded-full bg-[var(--color-success-tint)] text-[var(--color-success)] font-bold tracking-wider uppercase border border-[var(--color-success)]">
                        {item.domain}
                      </span>
                    )}
                  </div>
                </div>
                {item.phonetic && (
                  <p className="text-sm font-medium text-[var(--color-text-faint)] mb-3">{item.phonetic}</p>
                )}
                <p className="text-[var(--color-text-muted)] text-sm mb-4 leading-relaxed whitespace-pre-wrap">
                  {item.definition}
                </p>
              </div>

              <div className="mt-auto space-y-4">
                {item.example && (
                  <div className="bg-[var(--color-surface-2)] p-3 rounded-xl border-l-2 border-[var(--color-success)]">
                    <p className="text-xs italic text-[var(--color-text-muted)]">&ldquo;{item.example}&rdquo;</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--color-border)]">
                  {item.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md flex items-center gap-1 hover:bg-[var(--color-surface-3)] transition-colors"
                    >
                      <TagIcon size={10} /> {tag}
                    </button>
                  ))}
                  <button
                    onClick={() => remove(item.id)}
                    aria-label={t("Delete", "Xoá")}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
