"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lightbulb, Plus, Clock, CheckCircle2, Zap, Trash2, X, Loader2,
  AlertCircle, RotateCcw,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

// Toàn bộ dữ liệu đến từ /api/ideas. Bản cũ render một mảng 3 dự án viết cứng,
// không nút nào có onClick, và Prisma cũng chưa có bảng nào để lưu.

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: string;
  lastActiveAt: string;
  blueprint: string | null;
  isStale: boolean;
}

export default function IdeaTrackerTab() {
  const { t } = useLanguage();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleDays, setStaleDays] = useState(30);

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [blueprintFor, setBlueprintFor] = useState<Idea | null>(null);
  const [blueprintText, setBlueprintText] = useState("");
  const [generating, setGenerating] = useState(false);

  // Nút "Thử lại" tăng khoá này để effect chạy lại, thay vì gọi thẳng một hàm
  // fetch từ bên ngoài. Nhờ vậy mọi lần tải đều đi qua đúng một đường dẫn, và
  // request cũ luôn được huỷ.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ideas", { signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `Lỗi ${res.status}`);
        }
        setIdeas(json.data);
        if (typeof json.staleDays === "number") setStaleDays(json.staleDays);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [reloadKey]);

  const createIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Lỗi ${res.status}`);

      setIdeas((prev) => [json.data, ...prev]);
      setNewTitle("");
      setNewDescription("");
      setShowForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const patchIdea = async (id: string, patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Lỗi ${res.status}`);
      setIdeas((prev) => prev.map((i) => (i.id === id ? json.data : i)));
      return json.data as Idea;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  };

  const deleteIdea = async (id: string) => {
    // Xoá là hành động không hoàn tác được — hỏi trước.
    if (!window.confirm(t("Delete this idea permanently?", "Xoá vĩnh viễn ý tưởng này?"))) {
      return;
    }
    try {
      const res = await fetch(`/api/ideas/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Lỗi ${res.status}`);
      setIdeas((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const generateBlueprint = async (idea: Idea) => {
    setBlueprintFor(idea);
    setBlueprintText(idea.blueprint || "");
    if (idea.blueprint) return; // đã có sẵn, khỏi gọi lại cho tốn quota

    setGenerating(true);
    try {
      const res = await fetch("/api/ai/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: `${idea.title}\n\n${idea.description || ""}`.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.reply) throw new Error(json?.error || `Lỗi ${res.status}`);

      setBlueprintText(json.reply);
      // Lưu lại để lần sau mở là có ngay.
      await patchIdea(idea.id, { blueprint: json.reply });
    } catch (err) {
      setBlueprintText(`⚠️ ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-display)" }}>
            {t("Idea & Project Tracker", "Quản lý Dự án & Ý tưởng")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("Track projects, revive stale ideas, and generate AI blueprints.",
               "Theo dõi dự án, khơi lại ý tưởng bỏ quên và tạo dàn ý bằng AI.")}
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="c-btn c-btn-primary c-btn-pill flex items-center gap-2"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? t("Cancel", "Huỷ") : t("New Idea", "Ý tưởng mới")}
        </button>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
          <button onClick={reload} className="c-btn c-btn-tertiary c-btn-sm flex items-center gap-1.5">
            <RotateCcw size={14} /> {t("Retry", "Thử lại")}
          </button>
        </div>
      )}

      {/* Form tạo mới */}
      {showForm && (
        <form onSubmit={createIdea} className="c-card space-y-4 animate-in fade-in">
          <div className="c-field">
            <label htmlFor="idea-title">{t("Title", "Tiêu đề")}</label>
            <input
              id="idea-title"
              className="c-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("e.g. Redesign the Finance dashboard", "Vd: Thiết kế lại dashboard Tài chính")}
              autoFocus
              required
            />
          </div>
          <div className="c-field">
            <label htmlFor="idea-desc">{t("Description", "Mô tả")}</label>
            <textarea
              id="idea-desc"
              className="c-textarea min-h-[90px] resize-y"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t("Optional", "Không bắt buộc")}
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={!newTitle.trim() || saving} className="c-btn c-btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {t("Save", "Lưu")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="c-btn c-btn-tertiary">
              {t("Cancel", "Huỷ")}
            </button>
          </div>
        </form>
      )}

      {/* Danh sách */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading...", "Đang tải...")}</span>
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <Lightbulb size={32} />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--color-text)]">
              {t("No ideas yet", "Chưa có ý tưởng nào")}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {t("Capture the first one before it slips away.", "Ghi lại ý tưởng đầu tiên trước khi nó trôi mất.")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ideas.map((idea) => {
            const done = idea.status === "completed";
            return (
              <div
                key={idea.id}
                className="c-card flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow"
              >
                {idea.isStale && (
                  <div className="absolute top-0 right-0 c-chip c-chip-warning rounded-none rounded-bl-lg text-[10px] py-1">
                    <Clock size={10} /> {t(`Stale > ${staleDays}d`, `Bỏ trống > ${staleDays} ngày`)}
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb
                      size={18}
                      className={done ? "text-[var(--color-success)]" : "text-[var(--color-text-faint)]"}
                    />
                    <span className={`c-chip text-[10px] py-1 ${done ? "c-chip-success" : ""}`}>
                      {done ? t("Completed", "Đã hoàn thành") : t("In Progress", "Đang thực hiện")}
                    </span>
                  </div>
                  <h3 className="font-bold text-[var(--color-text)] text-lg">{idea.title}</h3>
                  {idea.description && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-2 line-clamp-3">
                      {idea.description}
                    </p>
                  )}
                  <p className="text-xs text-[var(--color-text-faint)] mt-3">
                    {t("Last active:", "Hoạt động cuối:")} {formatDate(idea.lastActiveAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => generateBlueprint(idea)}
                    className="flex-1 c-btn c-btn-secondary c-btn-sm flex items-center justify-center gap-1.5"
                  >
                    <Zap size={14} className="text-[var(--color-warning)]" />
                    {idea.blueprint ? t("View plan", "Xem dàn ý") : t("AI Blueprint", "Dàn ý AI")}
                  </button>
                  <button
                    onClick={() => patchIdea(idea.id, { status: done ? "active" : "completed" })}
                    aria-label={done ? t("Reopen", "Mở lại") : t("Mark complete", "Đánh dấu hoàn thành")}
                    className={`c-btn c-btn-sm c-btn-icon ${done ? "c-btn-tertiary" : "c-btn-secondary"}`}
                  >
                    {done ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                  </button>
                  <button
                    onClick={() => deleteIdea(idea.id)}
                    aria-label={t("Delete", "Xoá")}
                    className="c-btn c-btn-sm c-btn-icon c-btn-tertiary text-[var(--color-error)]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cửa sổ dàn ý AI */}
      {blueprintFor && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setBlueprintFor(null)}
        >
          <div
            className="c-card c-elev-lg w-full max-w-2xl max-h-[80vh] flex flex-col p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
              <div className="flex items-center gap-3 min-w-0">
                <Zap className="text-[var(--color-warning)] flex-none" size={20} />
                <h3 className="text-lg font-bold truncate" style={{ fontFamily: "var(--font-display)" }}>
                  {blueprintFor.title}
                </h3>
              </div>
              <button
                onClick={() => setBlueprintFor(null)}
                aria-label={t("Close", "Đóng")}
                className="c-btn c-btn-tertiary c-btn-icon"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {generating ? (
                <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                  <Loader2 size={18} className="animate-spin" />
                  {t("Generating blueprint...", "Đang tạo dàn ý...")}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-[var(--color-text)] leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                  {blueprintText}
                </pre>
              )}
            </div>

            {!generating && blueprintText && (
              <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
                <button
                  onClick={() => navigator.clipboard?.writeText(blueprintText)}
                  className="c-btn c-btn-secondary c-btn-sm"
                >
                  {t("Copy", "Sao chép")}
                </button>
                <button
                  onClick={() => {
                    const target = blueprintFor;
                    setBlueprintText("");
                    patchIdea(target.id, { blueprint: "" }).then(() =>
                      generateBlueprint({ ...target, blueprint: null })
                    );
                  }}
                  className="c-btn c-btn-tertiary c-btn-sm"
                >
                  {t("Regenerate", "Tạo lại")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
