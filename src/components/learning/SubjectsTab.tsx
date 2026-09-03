"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Palette, TrendingUp, BarChart3, Languages, Megaphone, Folder, Brain,
  Loader2, AlertCircle, ExternalLink, FileText, BookMarked,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { DomainStat } from "@/lib/learningStats";

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
 * bảng này chỉ quyết định hiện icon nào. Tên lạ thì rơi về icon thư mục — thêm
 * một mảng học mới vẫn chạy được ngay, chỉ là chưa có icon riêng.
 */
const LOOK: Record<string, { icon: typeof Palette; fg: string; tint: string }> = {
  "3d design": { icon: Palette, fg: "var(--color-error)", tint: "var(--color-error-tint)" },
  finance: { icon: TrendingUp, fg: "var(--color-success)", tint: "var(--color-success-tint)" },
  "data analyst": { icon: BarChart3, fg: "var(--color-warning)", tint: "var(--color-warning-tint)" },
  language: { icon: Languages, fg: "var(--color-info)", tint: "var(--color-info-tint)" },
  english: { icon: Languages, fg: "var(--color-info)", tint: "var(--color-info-tint)" },
  ielts: { icon: Languages, fg: "var(--color-info)", tint: "var(--color-info-tint)" },
  marketing: { icon: Megaphone, fg: "var(--color-accent)", tint: "var(--color-surface-2)" },
};

const lookFor = (name: string) =>
  LOOK[name.trim().toLowerCase()] ?? {
    icon: Folder,
    fg: "var(--color-text-muted)",
    tint: "var(--color-surface-2)",
  };

const normalize = (name: string) => name.trim().toLowerCase();

/** Một dòng trong lưới: gộp tài liệu (Drive) với số liệu học (Postgres). */
interface Row extends DomainStat {
  id: string | null;
  name: string;
  webViewLink: string | null;
  documentCount: number;
}

/**
 * Ghép danh sách thư mục Drive với số liệu học tập.
 *
 * Hai nguồn không trùng nhau hoàn toàn: một lĩnh vực có thư mục nhưng chưa có
 * thuật ngữ nào, và ngược lại một thuật ngữ có thể gắn lĩnh vực gõ tay không
 * ứng với thư mục nào. Cả hai đều phải hiện — bỏ vế sau thì người dùng mất dấu
 * những thẻ mình đã tạo.
 */
function mergeRows(domains: Domain[], stats: DomainStat[]): Row[] {
  const byName = new Map<string, Row>();

  for (const d of domains) {
    byName.set(normalize(d.name), {
      id: d.id,
      name: d.name,
      webViewLink: d.webViewLink,
      documentCount: d.documentCount,
      domain: d.name,
      termCount: 0,
      cardCount: 0,
      dueCount: 0,
      newCount: 0,
    });
  }

  for (const s of stats) {
    if (!s.domain.trim()) continue; // thuật ngữ chưa gắn lĩnh vực
    const key = normalize(s.domain);
    const existing = byName.get(key);
    if (existing) {
      Object.assign(existing, {
        termCount: s.termCount,
        cardCount: s.cardCount,
        dueCount: s.dueCount,
        newCount: s.newCount,
      });
    } else {
      byName.set(key, {
        id: null,
        name: s.domain,
        webViewLink: null,
        documentCount: 0,
        ...s,
      });
    }
  }

  // Còn thẻ tới hạn thì lên trước — đó là thứ cần làm hôm nay.
  return [...byName.values()].sort(
    (a, b) => b.dueCount - a.dueCount || a.name.localeCompare(b.name)
  );
}

/**
 * Lưới lĩnh vực học tập.
 *
 * Lĩnh vực = thư mục trong Drive tài liệu. Bản cũ viết cứng bốn lĩnh vực kèm
 * danh sách môn học bịa ("Blender Basics", "CFA Level 1", "IELTS Academic") —
 * không môn nào tồn tại ở đâu trong hệ thống.
 *
 * `stats` do trang chủ truyền xuống (đã gọi /api/learning/overview), nên thẻ
 * lĩnh vực hiện được cả số tài liệu lẫn số thẻ tới hạn mà không phải gọi thêm.
 */
export default function SubjectsTab({ stats = [] }: { stats?: DomainStat[] }) {
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

  const rows = mergeRows(domains, stats);

  return (
    <section className="space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="c-h2">{t("Fields of study", "Lĩnh vực học tập")}</h2>
          <p className="c-card-body mt-1">
            {t(
              "Each field is a folder in your Knowledge Drive.",
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

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading...", "Đang tải...")}</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <Folder size={32} />
          </div>
          <div>
            <p className="c-h3">{t("No fields yet", "Chưa có lĩnh vực nào")}</p>
            <p className="c-card-body mt-1">
              {t(
                "Add one in Settings → Learning Hub, or create a folder in Drive.",
                "Thêm ở Cài đặt → Học tập, hoặc tạo thư mục trong Drive."
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rows.map((row) => {
            const { icon: Icon, fg, tint } = lookFor(row.name);
            return (
              <article
                key={row.id ?? `stat:${row.name}`}
                className="group c-card c-elev-md p-6 flex flex-col hover:border-[var(--color-accent)] transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: tint, color: fg }}
                  >
                    <Icon size={28} />
                  </div>

                  <div className="flex items-center gap-2">
                    {row.dueCount > 0 && (
                      <span className="c-badge" title={t("cards due", "thẻ tới hạn")}>
                        {row.dueCount}
                      </span>
                    )}
                    {row.webViewLink && (
                      <a
                        href={row.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("Open in Drive", "Mở trong Drive")}
                        className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>

                <h3 className="c-card-title">{row.name}</h3>

                <div className="flex items-center gap-4 c-stat-label mb-5">
                  <span className="flex items-center gap-1.5">
                    <FileText size={12} />
                    {row.documentCount} {t("docs", "tài liệu")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookMarked size={12} />
                    {row.termCount} {t("terms", "thuật ngữ")}
                  </span>
                </div>

                <div className="flex gap-2 mt-auto">
                  <Link
                    href={`/learning/flashcards?domain=${encodeURIComponent(row.name)}`}
                    aria-disabled={row.cardCount === 0}
                    className={`c-btn c-btn-sm flex-1 justify-center ${
                      row.dueCount > 0 ? "c-btn-primary" : "c-btn-secondary"
                    }`}
                  >
                    <Brain size={14} />
                    {t("Review", "Ôn thẻ")}
                  </Link>

                  {row.id && (
                    <Link
                      href={`/learning/subject/${row.id}`}
                      className="c-btn c-btn-secondary c-btn-sm flex-1 justify-center"
                    >
                      {t("Documents", "Tài liệu")}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
