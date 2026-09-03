"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus, Loader2, AlertCircle, Trash2, Pause, Play, Lock, Check,
  Layers, Brain, Pencil, X,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Deck {
  id: string;
  name: string;
  description: string | null;
  level: string | null;
  topic: string | null;
  orderIndex: number;
  status: string;
  isPreset: boolean;
  completedAt: string | null;
  itemCount: number;
  dueCount: number;
  unlocked: boolean;
}

interface Props {
  /** Bộ thẻ của một thứ tiếng... */
  languageId?: string;
  /** ...hoặc của một lĩnh vực. Đúng một trong hai. */
  domain?: string;
  /** Các mức của thang cấp độ, để gợi ý khi tạo bộ mới. */
  levels?: string[];
}

/**
 * Quản lý bộ thẻ.
 *
 * Dùng chung cho cả ngôn ngữ lẫn lĩnh vực khác — đó là lý do nó nhận
 * `languageId` HOẶC `domain` chứ không viết cứng vào phần ngôn ngữ. Khi nhân
 * bản sang Finance hay 3D Design thì chỉ việc truyền `domain` vào.
 *
 * "Tạm dừng" khác "xoá": bộ tạm dừng vẫn còn nguyên thẻ, chỉ là không đẩy thẻ
 * vào hàng ôn hằng ngày nữa — để tập trung vào mảng đang cần mà không mất gì.
 */
export default function DeckManager({ languageId, domain, levels = [] }: Props) {
  const { t } = useLanguage();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", level: "", topic: "" });
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const scope = languageId ? `languageId=${languageId}` : `domain=${encodeURIComponent(domain ?? "")}`;

  // "Đang tải" suy ra từ việc danh sách trên màn có thuộc đúng phạm vi đang xem
  // hay không, thay vì giữ một cờ riêng. Đặt cờ trong thân effect sẽ loé danh
  // sách của thứ tiếng vừa xem trước đó một nhịp.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const requestKey = `${reloadKey}:${scope}`;
  const loading = loadedFor !== requestKey;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/learning/decks?${scope}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được bộ thẻ");
        setDecks(json.decks);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(requestKey);
      });

    return () => controller.abort();
  }, [scope, requestKey]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, languageId, domain }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tạo được");
      setForm({ name: "", level: "", topic: "" });
      setShowForm(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/learning/decks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không sửa được");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (deck: Deck) => {
    const msg = deck.itemCount
      ? t(
          `Delete deck "${deck.name}"? Its ${deck.itemCount} words stay in your term bank.`,
          `Xoá bộ "${deck.name}"? ${deck.itemCount} từ trong đó vẫn còn ở kho thuật ngữ.`
        )
      : t(`Delete deck "${deck.name}"?`, `Xoá bộ "${deck.name}"?`);
    if (!window.confirm(msg)) return;

    setBusy(deck.id);
    await fetch(`/api/learning/decks?id=${deck.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    setReloadKey((k) => k + 1);
  };

  const saveName = async (id: string) => {
    if (!editName.trim()) return setEditing(null);
    await patch(id, { name: editName.trim() });
    setEditing(null);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="c-h2">{t("Decks", "Bộ thẻ")}</h2>
          <p className="c-card-body mt-1">
            {t(
              "Pausing a deck keeps its words but drops it from the daily queue.",
              "Tạm dừng một bộ thì thẻ vẫn còn, chỉ là không vào hàng ôn hằng ngày nữa."
            )}
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="c-btn c-btn-primary c-btn-sm">
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? t("Cancel", "Huỷ") : t("New deck", "Bộ mới")}
        </button>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={create} className="c-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="c-field md:col-span-1">
            <label htmlFor="deck-name">{t("Deck name", "Tên bộ")}</label>
            <input
              id="deck-name"
              className="c-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("Food & drink", "Đồ ăn thức uống")}
              autoFocus
              required
            />
          </div>
          <div className="c-field">
            <label htmlFor="deck-level">{t("Level", "Cấp độ")}</label>
            <select
              id="deck-level"
              className="c-select"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            >
              <option value="">{t("None", "Không đặt")}</option>
              {levels.map((lv) => (
                <option key={lv} value={lv}>{lv}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={saving} className="c-btn c-btn-primary justify-center">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t("Create", "Tạo bộ")}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading...", "Đang tải...")}</span>
        </div>
      ) : decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <Layers size={32} />
          </div>
          <p className="c-h3">{t("No decks yet", "Chưa có bộ thẻ nào")}</p>
          <p className="c-card-body max-w-sm">
            {t("Create one to start grouping words.", "Tạo một bộ để bắt đầu gom từ theo chủ đề.")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {decks.map((deck) => {
            const paused = deck.status === "paused";
            return (
              <li
                key={deck.id}
                className={`c-card p-4 flex flex-wrap items-center gap-4 ${paused ? "opacity-60" : ""}`}
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center flex-none">
                  {!deck.unlocked ? <Lock size={16} /> : deck.completedAt ? <Check size={16} /> : <Layers size={16} />}
                </div>

                <div className="min-w-0 flex-1">
                  {editing === deck.id ? (
                    <div className="flex gap-2">
                      <input
                        className="c-input flex-1"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName(deck.id);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => saveName(deck.id)} className="c-btn c-btn-primary c-btn-sm">
                        {t("Save", "Lưu")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="font-bold truncate">{deck.name}</p>
                      <p className="c-stat-label">
                        {deck.level ? `${deck.level} · ` : ""}
                        {deck.itemCount} {t("words", "từ")}
                        {deck.dueCount > 0 && ` · ${deck.dueCount} ${t("due", "tới hạn")}`}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  {deck.dueCount > 0 && (
                    <Link
                      href={`/learning/flashcards?deck=${deck.id}`}
                      className="c-btn c-btn-primary c-btn-sm"
                    >
                      <Brain size={14} />
                      {t("Review", "Ôn")}
                    </Link>
                  )}
                  <button
                    onClick={() => { setEditing(deck.id); setEditName(deck.name); }}
                    title={t("Rename", "Đổi tên")}
                    className="c-btn c-btn-secondary c-btn-icon"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => patch(deck.id, { status: paused ? "active" : "paused" })}
                    disabled={busy === deck.id}
                    title={paused ? t("Resume", "Học lại") : t("Pause", "Tạm dừng")}
                    className="c-btn c-btn-secondary c-btn-icon"
                  >
                    {busy === deck.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : paused ? (
                      <Play size={14} />
                    ) : (
                      <Pause size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => remove(deck)}
                    title={t("Delete", "Xoá bộ")}
                    className="c-btn c-btn-secondary c-btn-icon text-[var(--color-error)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
