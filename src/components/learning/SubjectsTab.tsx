"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Palette, TrendingUp, BarChart3, Languages, Megaphone, Folder,
  Loader2, AlertCircle, ExternalLink, FileText,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Domain {
  id: string;
  name: string;
  webViewLink: string | null;
  documentCount: number;
}

/**
 * Biểu tượng theo tên lĩnh vực.
 *
 * Đây là trang trí thuần tuý, không phải dữ liệu: tên lĩnh vực đến từ Drive,
 * bảng này chỉ quyết định hiện icon nào. Tên lạ thì rơi về icon thư mục.
 */
const LOOK: Record<string, { icon: typeof Palette; fg: string; tint: string }> = {
  "3d design": { icon: Palette, fg: "var(--color-error)", tint: "var(--color-error-tint)" },
  finance: { icon: TrendingUp, fg: "var(--color-success)", tint: "var(--color-success-tint)" },
  "data analyst": { icon: BarChart3, fg: "var(--color-warning)", tint: "var(--color-warning-tint)" },
  language: { icon: Languages, fg: "var(--color-info)", tint: "var(--color-info-tint)" },
  marketing: { icon: Megaphone, fg: "var(--color-accent)", tint: "var(--color-surface-2)" },
};

const lookFor = (name: string) =>
  LOOK[name.trim().toLowerCase()] ?? {
    icon: Folder,
    fg: "var(--color-text-muted)",
    tint: "var(--color-surface-2)",
  };

/**
 * Danh sách lĩnh vực học tập, lấy từ thư mục Drive.
 *
 * Bản cũ viết cứng bốn lĩnh vực kèm danh sách môn học bịa ("Blender Basics",
 * "CFA Level 1", "IELTS Academic"...) — không môn nào tồn tại ở đâu trong hệ
 * thống, và số tài liệu cũng không có thật.
 */
export default function SubjectsTab() {
  const { t } = useLanguage();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-display)" }}>
            {t("Subjects", "Lĩnh vực")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t(
              "Each subject is a folder in your Knowledge Drive.",
              "Mỗi lĩnh vực là một thư mục trong Drive tài liệu của bạn."
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading...", "Đang tải...")}</span>
        </div>
      ) : domains.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <Folder size={32} />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--color-text)]">
              {t("No subjects yet", "Chưa có lĩnh vực nào")}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {t(
                "Add one in Settings → Learning Hub, or create a folder in Drive.",
                "Thêm ở Cài đặt → Học tập, hoặc tạo thư mục trong Drive."
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {domains.map((domain) => {
            const { icon: Icon, fg, tint } = lookFor(domain.name);
            return (
              <div
                key={domain.id}
                className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-[var(--color-accent)] transition-all flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: tint, color: fg }}
                  >
                    <Icon size={28} />
                  </div>
                  {domain.webViewLink && (
                    <a
                      href={domain.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("Open in Drive", "Mở trong Drive")}
                      className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>

                <h3
                  className="text-xl font-bold text-[var(--color-text)] mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {domain.name}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5 mb-6">
                  <FileText size={12} />
                  {domain.documentCount} {t("documents", "tài liệu")}
                </p>

                <Link
                  href={`/learning/subject/${domain.id}`}
                  className="c-btn c-btn-secondary c-btn-sm w-full mt-auto justify-center"
                >
                  {t("Open workspace", "Mở không gian học")}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
