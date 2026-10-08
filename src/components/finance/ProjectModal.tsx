"use client";

import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import AmountInput from "@/components/ui/AmountInput";
import CustomDatePicker from "@/components/ui/CustomDatePicker";

export interface ProjectDraft {
  id?: string;
  name: string;
  status: string;
  budget: number | null;
  startDate: string;
  notes: string;
}

export const emptyProject = (): ProjectDraft => ({
  name: "",
  status: "active",
  budget: null,
  startDate: "",
  notes: "",
});

interface Props {
  isOpen: boolean;
  draft: ProjectDraft;
  onClose: () => void;
  /** `id` của dự án vừa lưu (mới tạo thì là id mới), hoặc null nếu vừa xoá. */
  onSaved: (id: string | null) => void;
}

export default function ProjectModal({ isOpen, draft: initial, onClose, onSaved }: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Mở lại cho dự án khác thì nạp lại form — xem AccountModal, cùng một mẹo.
  const [lastKey, setLastKey] = useState(`${initial.id}|${isOpen}`);
  if (`${initial.id}|${isOpen}` !== lastKey) {
    setLastKey(`${initial.id}|${isOpen}`);
    setDraft(initial);
    setError("");
  }

  if (!isOpen) return null;

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setError("");
    if (!draft.name.trim()) {
      setError(t("Please enter a name", "Vui lòng nhập tên dự án"));
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/finance/projects", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (json.success) {
        onSaved(draft.id ?? json.data?.id ?? null);
        onClose();
      } else {
        setError(json.error || t("Save failed", "Lưu không thành công"));
      }
    } catch {
      setError(t("Save failed", "Lưu không thành công"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.id) return;
    // Nói rõ giao dịch KHÔNG mất theo — sợ mất dữ liệu là lý do người ta không
    // dám dọn dự án cũ.
    const ok = window.confirm(
      t(
        `Delete "${draft.name}"? Its transactions stay in your books, they just stop belonging to a project.`,
        `Xoá dự án "${draft.name}"? Các giao dịch vẫn nằm nguyên trong sổ thu chi, chỉ là không còn thuộc dự án nào.`
      )
    );
    if (!ok) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/finance/projects?id=${encodeURIComponent(draft.id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        onSaved(null);
        onClose();
      } else {
        setError(json.error || t("Delete failed", "Xoá không thành công"));
      }
    } catch {
      setError(t("Delete failed", "Xoá không thành công"));
    } finally {
      setIsSaving(false);
    }
  };

  const labelClass =
    "block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider";
  const inputClass =
    "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 min-h-11 text-base md:text-sm focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]";

  const STATUS_LABELS: Record<string, string> = {
    active: t("Running", "Đang chạy"),
    paused: t("Paused", "Tạm dừng"),
    closed: t("Closed", "Đã đóng"),
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-[var(--color-surface)] rounded-t-3xl md:rounded-3xl w-full max-w-xl max-h-[90dvh] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="shrink-0 p-5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <h2 className="c-h4 text-[var(--color-text)]">
            {draft.id ? t("Edit project", "Sửa dự án") : t("New project", "Dự án mới")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {error && (
            <p className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] rounded-xl p-3">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>{t("Name", "Tên dự án")}</label>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("e.g. 3D print shop", "VD: Xưởng in 3D")}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>{t("Status", "Trạng thái")}</label>
              <select
                value={draft.status}
                onChange={(e) => set("status", e.target.value)}
                className={inputClass}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelClass}>{t("Started on", "Ngày bắt đầu")}</label>
              <CustomDatePicker
                value={draft.startDate}
                onChange={(v) => set("startDate", v)}
                allowClear
                aria-label={t("Started on", "Ngày bắt đầu")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>{t("Planned capital", "Vốn dự định đầu tư")}</label>
            <AmountInput
              value={draft.budget ?? ""}
              onValueChange={(v) => set("budget", v === "" ? null : Number(v) || null)}
              aria-label={t("Planned capital", "Vốn dự định đầu tư")}
            />
            <p className="text-[10px] text-[var(--color-text-faint)]">
              {t(
                "optional — lets the page show how much of the plan is spent",
                "không bắt buộc — có thì trang dự án cho biết đã tiêu bao nhiêu phần kế hoạch"
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>{t("Notes", "Ghi chú")}</label>
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              className={`${inputClass} min-h-[72px] resize-none`}
            />
          </div>
        </div>

        <div className="shrink-0 p-5 border-t border-[var(--color-border)] flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="c-btn c-btn-primary c-btn-pill flex-1 md:flex-none"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {t("Save", "Lưu")}
          </button>
          <button onClick={onClose} className="c-btn c-btn-tertiary">
            {t("Cancel", "Hủy")}
          </button>
          {draft.id && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              aria-label={t("Delete project", "Xoá dự án")}
              title={t("Delete project", "Xoá dự án")}
              className="ml-auto w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-tint)] transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
