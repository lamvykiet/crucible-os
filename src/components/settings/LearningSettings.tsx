"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, AlertCircle, Folder, ExternalLink, FileText } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Domain {
  id: string;
  name: string;
  webViewLink: string | null;
  documentCount: number;
}

/**
 * Quản lý lĩnh vực học tập.
 *
 * Lĩnh vực chính là thư mục con trong Drive tài liệu, nên thêm một lĩnh vực ở
 * đây là tạo thật một thư mục — không phải một bảng riêng nào đó chỉ tồn tại
 * trong ứng dụng rồi lệch pha với Drive.
 *
 * Bản cũ giữ bốn lĩnh vực trong `useState` kèm danh sách môn bịa (Finance →
 * CFA, CMA), và không nút nào có `onClick`; `setDomains` khai báo rồi bỏ đó.
 */
export default function LearningSettings() {
  const { t } = useLanguage();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/learning/domains", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được lĩnh vực");
        setDomains(json.domains);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const add = async () => {
    const name = draft.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tạo được");
      setDomains((prev) => [...prev, json.domain].sort((a, b) => a.name.localeCompare(b.name)));
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2
          className="text-2xl font-bold text-[var(--color-text)] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("Subjects", "Lĩnh vực học tập")}
        </h2>
        <p className="text-[var(--color-text-muted)] text-sm">
          {t(
            "Each subject is a folder inside your Knowledge Drive folder.",
            "Mỗi lĩnh vực là một thư mục con trong thư mục tài liệu trên Drive."
          )}
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-8 text-[var(--color-info)]">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {domains.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]"
              >
                <Folder size={18} className="text-[var(--color-warning)] flex-none" />
                <span className="flex-1 font-medium text-sm text-[var(--color-text)]">{d.name}</span>
                <span className="text-xs text-[var(--color-text-faint)] flex items-center gap-1.5">
                  <FileText size={12} /> {d.documentCount}
                </span>
                {d.webViewLink && (
                  <a
                    href={d.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("Open in Drive", "Mở trong Drive")}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
            {domains.length === 0 && (
              <p className="text-sm text-[var(--color-text-faint)] text-center py-6">
                {t("No subjects yet.", "Chưa có lĩnh vực nào.")}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={t("New subject name...", "Tên lĩnh vực mới...")}
            className="flex-1 border border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-success)]"
          />
          <button
            onClick={add}
            disabled={!draft.trim() || saving}
            className="bg-[#66c2c2] hover:bg-[var(--color-success)] text-white font-bold px-4 py-2 rounded-xl text-sm shadow flex items-center gap-1 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t("Add", "Thêm")}
          </button>
        </div>

        <p className="text-[11px] text-[var(--color-text-faint)] mt-3">
          {t(
            "To rename or delete a subject, do it in Google Drive — this list mirrors the folders there.",
            "Muốn đổi tên hay xoá lĩnh vực thì làm trong Google Drive — danh sách này phản chiếu thư mục bên đó."
          )}
        </p>
      </div>
    </div>
  );
}
