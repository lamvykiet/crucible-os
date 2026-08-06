"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Category {
  id: string;
  kind: string;
  name: string;
  active: boolean;
  parentId: string | null;
}

const KINDS = [
  { key: "expense_group", vi: "Nhóm chi tiêu", en: "Expense groups" },
  { key: "income_group", vi: "Nhóm thu nhập", en: "Income groups" },
  { key: "transaction_type", vi: "Loại giao dịch", en: "Transaction types" },
] as const;

/**
 * Quản lý danh mục thu chi — dữ liệu thật từ bảng `Category`.
 *
 * Bản cũ giữ ba mảng trong `useState` viết cứng ngay trong component ("Food &
 * Dining", "Groceries"...), mọi nút Thêm/Xoá đều không có `onClick`, và danh
 * sách đó lệch hẳn với 26 danh mục thật trong DB — nhập từ Google Sheet của hệ
 * "Sổ Chi Tiêu". Người dùng sửa ở đây thì không có gì được lưu.
 */
export default function FinanceSettings() {
  const { t } = useLanguage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/finance/categories?all=1", { signal });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tải được danh mục");
      setCategories(json.data.all);
      setError(null);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const add = async (kind: string) => {
    const name = (drafts[kind] || "").trim();
    if (!name || saving) return;
    setSaving(kind);
    setError(null);
    try {
      const res = await fetch("/api/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không thêm được");
      setCategories((prev) => [...prev, json.category]);
      setDrafts((d) => ({ ...d, [kind]: "" }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const toggle = async (cat: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, active: !c.active } : c)));
    await fetch("/api/finance/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, active: !cat.active }),
    }).catch(() => {});
  };

  const remove = async (cat: Category) => {
    setError(null);
    const res = await fetch(`/api/finance/categories?id=${cat.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json?.success) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } else {
      // Danh mục đang có giao dịch thì không xoá được — API nói rõ lý do thay
      // vì xoá bừa và để lại giao dịch trỏ tới nhóm không còn tồn tại.
      setError(json?.error || "Không xoá được");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2
          className="text-2xl font-bold text-[var(--color-text)] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("Categories", "Danh mục")}
        </h2>
        <p className="text-[var(--color-text-muted)] text-sm">
          {t(
            "These are the groups used by the invoice scanner and every finance form.",
            "Đây chính là các nhóm mà máy quét hoá đơn và mọi biểu mẫu tài chính đang dùng."
          )}
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-[var(--color-info)]">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {KINDS.map(({ key, vi, en }) => {
            const items = categories.filter((c) => c.kind === key && !c.parentId);
            return (
              <div
                key={key}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm flex flex-col"
              >
                <h3 className="font-bold text-[var(--color-text)] mb-1">{t(en, vi)}</h3>
                <p className="text-[11px] text-[var(--color-text-faint)] mb-4">
                  {items.filter((c) => c.active).length}/{items.length} {t("active", "đang bật")}
                </p>

                <div className="flex flex-wrap gap-2 mb-6 flex-1 content-start">
                  {items.map((cat) => {
                    const children = categories.filter((c) => c.parentId === cat.id);
                    return (
                      <span
                        key={cat.id}
                        title={children.length ? `${children.length} danh mục con` : undefined}
                        className={`group inline-flex items-center gap-1.5 border px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-opacity ${
                          cat.active
                            ? "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
                            : "bg-transparent border-dashed border-[var(--color-border)] text-[var(--color-text-faint)]"
                        }`}
                      >
                        <button
                          onClick={() => toggle(cat)}
                          title={cat.active ? t("Disable", "Tắt") : t("Enable", "Bật")}
                          className={cat.active ? "text-[var(--color-success)]" : "text-[var(--color-text-faint)]"}
                        >
                          {cat.active ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        </button>
                        {cat.name}
                        {children.length > 0 && (
                          <span className="text-[10px] text-[var(--color-text-faint)]">+{children.length}</span>
                        )}
                        <button
                          onClick={() => remove(cat)}
                          title={t("Delete", "Xoá")}
                          className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="text-xs text-[var(--color-text-faint)]">{t("Empty", "Chưa có mục nào")}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={drafts[key] || ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && add(key)}
                    placeholder={t(`Add to ${en}...`, `Thêm vào ${vi.toLowerCase()}...`)}
                    className="flex-1 border border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-success)]"
                  />
                  <button
                    onClick={() => add(key)}
                    disabled={!drafts[key]?.trim() || saving === key}
                    className="bg-[#66c2c2] hover:bg-[var(--color-success)] text-white font-bold px-4 py-2 rounded-xl text-sm shadow flex items-center gap-1 disabled:opacity-50"
                  >
                    {saving === key ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {t("Add", "Thêm")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
