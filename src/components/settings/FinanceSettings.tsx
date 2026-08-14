"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Loader2, AlertCircle, CheckCircle2, XCircle,
  ChevronRight, Pencil, Check, X,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { invalidateCategories } from "@/lib/useCategories";

interface Category {
  id: string;
  kind: string;
  name: string;
  nameVi: string | null;
  active: boolean;
  parentId: string | null;
}

const KINDS = [
  { key: "expense_group", vi: "Nhóm chi tiêu", en: "Expense groups", nested: true },
  { key: "income_group", vi: "Nhóm thu nhập", en: "Income groups", nested: true },
  { key: "transaction_type", vi: "Loại giao dịch", en: "Transaction types", nested: false },
] as const;

/**
 * Quản lý danh mục thu chi — dữ liệu thật từ bảng `Category`.
 *
 * Cây hai cấp: nhóm cha rồi danh mục con. Bản trước chỉ hiển thị được cấp cha
 * dưới dạng chip và không có cách nào tạo danh mục con, dù API đã nhận
 * `parentId` từ đầu — nên ô "Danh mục con" ở mọi biểu mẫu luôn trống.
 *
 * Mỗi mục có hai tên: `name` tiếng Anh là tên CHUẨN được ghi vào
 * Transaction.categoryGroup, `nameVi` chỉ là nhãn hiển thị. Đổi `name` sẽ kéo
 * theo việc dời dữ liệu ở bốn bảng — API lo phần đó trong một transaction.
 */
export default function FinanceSettings() {
  const { t, language } = useLanguage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [groupDraft, setGroupDraft] = useState<Record<string, { en: string; vi: string }>>({});
  const [subDraft, setSubDraft] = useState<Record<string, { en: string; vi: string }>>({});
  const [editing, setEditing] = useState<{ id: string; en: string; vi: string } | null>(null);

  const labelOf = (c: Category) => (language === "vi" ? c.nameVi || c.name : c.name);

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

  /** Modal nhập liệu cache danh mục ở cấp module, phải xoá cache sau mỗi thay đổi. */
  const refresh = async () => {
    invalidateCategories();
    await load();
  };

  const create = async (kind: string, name: string, nameVi: string, parentId?: string) => {
    const cleaned = name.trim();
    if (!cleaned || busy) return false;
    setBusy(parentId || kind);
    setError(null);
    try {
      const res = await fetch("/api/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: cleaned, nameVi: nameVi.trim() || null, parentId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không thêm được");
      await refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch("/api/finance/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const json = await res.json().catch(() => null);
    if (!json?.success) {
      setError(json?.error || "Không lưu được");
      await refresh();
      return false;
    }
    return true;
  };

  const toggle = async (cat: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, active: !c.active } : c)));
    if (await patch(cat.id, { active: !cat.active })) invalidateCategories();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(editing.id);
    const ok = await patch(editing.id, { name: editing.en, nameVi: editing.vi });
    setBusy(null);
    if (ok) {
      setEditing(null);
      await refresh();
    }
  };

  const remove = async (cat: Category) => {
    setError(null);
    const res = await fetch(`/api/finance/categories?id=${cat.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json?.success) {
      await refresh();
    } else {
      // Danh mục đang có giao dịch thì không xoá được — API nói rõ lý do thay
      // vì xoá bừa và để lại giao dịch trỏ tới nhóm không còn tồn tại.
      setError(json?.error || "Không xoá được");
    }
  };

  /** Hàng của một danh mục — dùng chung cho nhóm cha và danh mục con. */
  const Row = ({ cat, isChild }: { cat: Category; isChild?: boolean }) => {
    if (editing?.id === cat.id) {
      return (
        <div className="flex items-center gap-2 py-1.5">
          <input
            value={editing.en}
            onChange={(e) => setEditing({ ...editing, en: e.target.value })}
            placeholder="English"
            className="c-input flex-1 text-sm"
          />
          <input
            value={editing.vi}
            onChange={(e) => setEditing({ ...editing, vi: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
            placeholder="Tiếng Việt"
            className="c-input flex-1 text-sm"
          />
          <button onClick={saveEdit} disabled={busy === cat.id} className="c-btn c-btn-primary c-btn-sm">
            {busy === cat.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button onClick={() => setEditing(null)} className="c-btn c-btn-tertiary c-btn-sm">
            <X size={13} />
          </button>
        </div>
      );
    }

    return (
      <div className="group flex items-center gap-2 py-1.5">
        <button
          onClick={() => toggle(cat)}
          title={cat.active ? t("Disable", "Tắt") : t("Enable", "Bật")}
          className={cat.active ? "text-[var(--color-success)]" : "text-[var(--color-text-faint)]"}
        >
          {cat.active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        </button>

        <span className={`text-sm flex-1 min-w-0 truncate ${cat.active ? "text-[var(--color-text)]" : "text-[var(--color-text-faint)] line-through"}`}>
          {labelOf(cat)}
          {/* Hiện luôn tên còn lại để biết mục nào chưa có bản dịch. */}
          <span className="text-[var(--color-text-faint)] text-xs ml-2">
            {language === "vi" ? (cat.nameVi ? cat.name : t("(no VI label)", "(chưa có nhãn Việt)")) : cat.nameVi || t("(no VI label)", "(chưa có nhãn Việt)")}
          </span>
        </span>

        <button
          onClick={() => setEditing({ id: cat.id, en: cat.name, vi: cat.nameVi || "" })}
          title={t("Rename", "Đổi tên")}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => remove(cat)}
          title={t("Delete", "Xoá")}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={isChild ? 12 : 13} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1" style={{ fontFamily: "var(--font-display)" }}>
          {t("Categories", "Danh mục")}
        </h2>
        <p className="text-[var(--color-text-muted)] text-sm">
          {t(
            "These are the groups used by the invoice scanner and every finance form. The English name is what gets stored; the Vietnamese one is just a label.",
            "Đây chính là các nhóm mà máy quét hoá đơn và mọi biểu mẫu tài chính đang dùng. Tên tiếng Anh là tên được lưu xuống; tiếng Việt chỉ là nhãn hiển thị."
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
        <div className="space-y-6">
          {KINDS.map(({ key, vi, en, nested }) => {
            const groups = categories.filter((c) => c.kind === key && !c.parentId);
            const draft = groupDraft[key] || { en: "", vi: "" };

            return (
              <div key={key} className="c-card">
                <h3 className="font-bold text-[var(--color-text)]">{t(en, vi)}</h3>
                <p className="text-[11px] text-[var(--color-text-faint)] mb-4">
                  {groups.filter((c) => c.active).length}/{groups.length} {t("active", "đang bật")}
                </p>

                <div className="divide-y divide-[var(--color-border)]">
                  {groups.map((cat) => {
                    const children = categories.filter((c) => c.parentId === cat.id);
                    const isOpen = expanded.has(cat.id);
                    const sd = subDraft[cat.id] || { en: "", vi: "" };

                    return (
                      <div key={cat.id} className="py-1">
                        <div className="flex items-center gap-1">
                          {nested ? (
                            <button
                              onClick={() =>
                                setExpanded((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(cat.id)) next.delete(cat.id);
                                  else next.add(cat.id);
                                  return next;
                                })
                              }
                              className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] p-0.5"
                              title={t("Show sub-categories", "Xem danh mục con")}
                            >
                              <ChevronRight size={14} className={isOpen ? "rotate-90 transition-transform" : "transition-transform"} />
                            </button>
                          ) : (
                            <span className="w-[19px]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <Row cat={cat} />
                          </div>
                          {nested && children.length > 0 && (
                            <span className="c-chip text-[10px] py-0.5">{children.length}</span>
                          )}
                        </div>

                        {nested && isOpen && (
                          <div className="ml-6 pl-3 border-l border-[var(--color-border)] mb-2">
                            {children.map((child) => (
                              <Row key={child.id} cat={child} isChild />
                            ))}
                            {children.length === 0 && (
                              <p className="text-xs text-[var(--color-text-faint)] py-1.5">
                                {t("No sub-categories yet", "Chưa có danh mục con")}
                              </p>
                            )}

                            <div className="flex gap-2 mt-2">
                              <input
                                value={sd.en}
                                onChange={(e) => setSubDraft((d) => ({ ...d, [cat.id]: { ...sd, en: e.target.value } }))}
                                placeholder={t("Sub-category (English)", "Danh mục con (tiếng Anh)")}
                                className="c-input flex-1 text-sm"
                              />
                              <input
                                value={sd.vi}
                                onChange={(e) => setSubDraft((d) => ({ ...d, [cat.id]: { ...sd, vi: e.target.value } }))}
                                onKeyDown={async (e) => {
                                  if (e.key !== "Enter") return;
                                  if (await create(cat.kind, sd.en, sd.vi, cat.id)) {
                                    setSubDraft((d) => ({ ...d, [cat.id]: { en: "", vi: "" } }));
                                  }
                                }}
                                placeholder={t("Vietnamese label", "Nhãn tiếng Việt")}
                                className="c-input flex-1 text-sm"
                              />
                              <button
                                onClick={async () => {
                                  if (await create(cat.kind, sd.en, sd.vi, cat.id)) {
                                    setSubDraft((d) => ({ ...d, [cat.id]: { en: "", vi: "" } }));
                                  }
                                }}
                                disabled={!sd.en.trim() || busy === cat.id}
                                className="c-btn c-btn-secondary c-btn-sm disabled:opacity-50"
                              >
                                {busy === cat.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {groups.length === 0 && (
                    <p className="text-xs text-[var(--color-text-faint)] py-2">{t("Empty", "Chưa có mục nào")}</p>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                  <input
                    value={draft.en}
                    onChange={(e) => setGroupDraft((d) => ({ ...d, [key]: { ...draft, en: e.target.value } }))}
                    placeholder={t("New group (English)", "Nhóm mới (tiếng Anh)")}
                    className="c-input flex-1 text-sm"
                  />
                  <input
                    value={draft.vi}
                    onChange={(e) => setGroupDraft((d) => ({ ...d, [key]: { ...draft, vi: e.target.value } }))}
                    onKeyDown={async (e) => {
                      if (e.key !== "Enter") return;
                      if (await create(key, draft.en, draft.vi)) {
                        setGroupDraft((d) => ({ ...d, [key]: { en: "", vi: "" } }));
                      }
                    }}
                    placeholder={t("Vietnamese label", "Nhãn tiếng Việt")}
                    className="c-input flex-1 text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (await create(key, draft.en, draft.vi)) {
                        setGroupDraft((d) => ({ ...d, [key]: { en: "", vi: "" } }));
                      }
                    }}
                    disabled={!draft.en.trim() || busy === key}
                    className="c-btn c-btn-primary c-btn-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    {busy === key ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
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
