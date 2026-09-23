"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Palette, TrendingUp, BarChart3, Languages as LanguagesIcon, Megaphone, Folder,
  Loader2, AlertCircle, ArrowRight, FileText, BookMarked, Layers,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { DomainStat } from "@/lib/learningStats";

interface Domain {
  id: string;
  name: string;
  webViewLink: string | null;
  documentCount: number;
}

interface LanguageRow {
  id: string;
  name: string;
  nativeName: string | null;
  deckCount: number;
  itemCount: number;
}

/**
 * Biểu tượng theo tên môn.
 *
 * Trang trí thuần tuý: tên môn đến từ thư mục Drive, bảng này chỉ chọn icon.
 * Tên lạ thì rơi về icon thư mục — thêm môn mới vẫn chạy ngay.
 */
const LOOK: Record<string, { icon: typeof Palette; fg: string; tint: string }> = {
  "3d design": { icon: Palette, fg: "var(--color-error)", tint: "var(--color-error-tint)" },
  finance: { icon: TrendingUp, fg: "var(--color-success)", tint: "var(--color-success-tint)" },
  "data analyst": { icon: BarChart3, fg: "var(--color-warning)", tint: "var(--color-warning-tint)" },
  marketing: { icon: Megaphone, fg: "var(--color-accent)", tint: "var(--color-accent-tint)" },
};

const lookFor = (name: string) =>
  LOOK[name.trim().toLowerCase()] ?? {
    icon: Folder,
    fg: "var(--color-text-muted)",
    tint: "var(--color-surface-2)",
  };

const normalize = (s: string) => s.trim().toLowerCase();

/** Tên thư mục Drive được coi là trùng nghĩa với thẻ Ngôn ngữ. */
const LANGUAGE_FOLDER_NAMES = new Set(["language", "languages", "ngôn ngữ", "ngon ngu"]);

interface Card {
  key: string;
  href: string;
  name: string;
  subtitle: string | null;
  icon: typeof Palette;
  fg: string;
  tint: string;
  documentCount: number;
  termCount: number;
  cardCount: number;
  dueCount: number;
  /** Thẻ Ngôn ngữ đứng đầu vì nó không phải một thư mục như các môn khác. */
  pinned?: boolean;
}

/**
 * Lưới môn học — màn hình đầu tiên của Learning Hub.
 *
 * Bản cũ mở ra là một dải mười một công cụ phẳng (ôn thẻ, kho thẻ, thi thử,
 * lịch sử...), còn môn học bị đẩy xuống cuối trang. Nhưng người ta không ngồi
 * xuống để "dùng công cụ ôn thẻ" — người ta ngồi xuống để *học tiếng Trung*
 * hay *học Blender*. Nên môn học lên trước, công cụ nằm bên trong từng môn.
 *
 * Hai loại môn, cố ý không gộp làm một:
 *  - Ngôn ngữ: dựa trên bảng `Language`, vì mỗi thứ tiếng có hệ chữ, phiên âm
 *    và thanh điệu riêng. Bấm vào là ra danh sách các tiếng đang học.
 *  - Các môn còn lại: mỗi môn là một thư mục Drive. Bấm vào là ra bàn học của
 *    môn đó.
 *
 * Có một chỗ PHẢI khớp theo tên: thư mục Drive tên "Language". Nếu để nguyên
 * thì lưới hiện hai thẻ gần như cùng tên, mà bấm vào lại ra hai nơi khác nhau —
 * người dùng nghĩ "Ngôn ngữ" là MỘT môn. Nên thư mục đó được gộp vào thẻ Ngôn
 * ngữ, giữ lại số tài liệu của nó.
 *
 * Khớp tên vốn mong manh, nên phạm vi được giữ rất hẹp (đúng vài tên, không
 * phân biệt hoa thường) và hỏng thì chỉ quay về hiện hai thẻ như trước, không
 * mất dữ liệu gì.
 */
export default function SubjectGrid({ stats = [] }: { stats?: DomainStat[] }) {
  const { t } = useLanguage();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [languages, setLanguages] = useState<LanguageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/learning/domains", { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/learning/languages", { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([d, l]) => {
        if (controller.signal.aborted) return;
        if (d?.success) setDomains(d.domains);
        else setError(d?.error || "Không tải được danh sách môn");
        if (l?.success) setLanguages(l.languages);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });

    return () => controller.abort();
  }, []);

  const statFor = (name: string) =>
    stats.find((s) => normalize(s.domain) === normalize(name));

  // Thư mục Drive trùng nghĩa với thẻ Ngôn ngữ, nếu có.
  const languageFolder = domains.find((d) => LANGUAGE_FOLDER_NAMES.has(normalize(d.name)));

  const cards: Card[] = [];

  // Ngôn ngữ luôn đứng đầu, kể cả khi chưa thêm thứ tiếng nào — đó là lối vào
  // để thêm, chứ không phải một ô trống vô nghĩa.
  cards.push({
    key: "languages",
    href: "/learning/languages",
    name: t("Languages", "Ngôn ngữ"),
    subtitle:
      languages.length > 0
        ? languages.map((l) => l.name).join(" · ")
        : t("Not set up yet", "Chưa chọn thứ tiếng nào"),
    icon: LanguagesIcon,
    fg: "var(--color-info)",
    tint: "var(--color-info-tint)",
    documentCount: languageFolder?.documentCount ?? 0,
    termCount: languages.reduce((s, l) => s + l.itemCount, 0),
    cardCount: languages.reduce((s, l) => s + l.deckCount, 0),
    dueCount: 0,
    pinned: true,
  });

  for (const d of domains) {
    if (d.id === languageFolder?.id) continue; // đã gộp vào thẻ Ngôn ngữ
    const s = statFor(d.name);
    const look = lookFor(d.name);
    cards.push({
      key: d.id,
      href: `/learning/subject/${d.id}`,
      name: d.name,
      subtitle: null,
      icon: look.icon,
      fg: look.fg,
      tint: look.tint,
      documentCount: d.documentCount,
      termCount: s?.termCount ?? 0,
      cardCount: s?.cardCount ?? 0,
      dueCount: s?.dueCount ?? 0,
    });
  }

  // Môn nào còn thẻ tới hạn thì lên trước — đó là việc cần làm hôm nay. Thẻ
  // Ngôn ngữ vẫn giữ đầu bảng.
  const ordered = [
    ...cards.filter((c) => c.pinned),
    ...cards
      .filter((c) => !c.pinned)
      .sort((a, b) => b.dueCount - a.dueCount || a.name.localeCompare(b.name)),
  ];

  return (
    <section className="space-y-5" data-tour="subjects">
      <div>
        <h2 className="c-h2">{t("What are you studying?", "Bạn đang học gì?")}</h2>
        <p className="c-card-body mt-1">
          {t(
            "Pick a subject to open its desk. Each folder in your Knowledge Drive becomes one.",
            "Chọn một môn để mở bàn học của nó. Mỗi thư mục trong Drive tài liệu là một môn."
          )}
        </p>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {!loaded ? (
        <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ordered.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.key}
                href={c.href}
                className="group c-card c-elev-md p-6 flex flex-col gap-4 hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="w-14 h-14 rounded-2xl grid place-content-center flex-none group-hover:scale-105 transition-transform"
                    style={{ background: c.tint, color: c.fg }}
                  >
                    <Icon size={26} />
                  </span>
                  {c.dueCount > 0 && (
                    <span className="c-badge" title={t("cards due", "thẻ tới hạn")}>
                      {c.dueCount}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="c-card-title truncate">{c.name}</h3>
                  {c.subtitle && (
                    <p className="c-stat-label truncate" title={c.subtitle}>
                      {c.subtitle}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 c-stat-label mt-auto">
                  {c.pinned ? (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <LanguagesIcon size={12} />
                        {languages.length} {t("languages", "thứ tiếng")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Layers size={12} />
                        {c.cardCount} {t("decks", "bộ thẻ")}
                      </span>
                      {c.documentCount > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <FileText size={12} />
                          {c.documentCount} {t("docs", "tài liệu")}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <FileText size={12} />
                        {c.documentCount} {t("docs", "tài liệu")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <BookMarked size={12} />
                        {c.termCount} {t("terms", "thuật ngữ")}
                      </span>
                    </>
                  )}
                  <ArrowRight
                    size={15}
                    className="ml-auto text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {loaded && domains.length === 0 && (
        <p className="c-help">
          {t(
            "No folders found in your Knowledge Drive yet. Add one in Settings → Learning Hub.",
            "Chưa thấy thư mục nào trong Drive tài liệu. Thêm ở Cài đặt → Learning Hub."
          )}
        </p>
      )}
    </section>
  );
}
