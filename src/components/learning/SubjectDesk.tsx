"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Brain, BookMarked, ClipboardCheck, FolderOpen, Loader2, AlertCircle,
  ExternalLink, ArrowRight, CheckCircle2, ChevronRight, Folder, FileText, Layers,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import DeckManager from "@/components/learning/DeckManager";
import type { DomainStat } from "@/lib/learningStats";

interface Child {
  id: string;
  name: string;
  webViewLink: string | null;
  documentCount: number;
  childFolderCount: number;
}

interface FolderInfo {
  id: string;
  name: string;
  webViewLink: string | null;
}

/**
 * Bàn học của một thư mục trong cây học tập.
 *
 * Cây của người dùng là ba tầng — nhóm ▸ lớp ▸ môn — nhưng KHÔNG đều:
 *
 *   Finance ▸ CFA ▸ 1. Quantitative Methods ▸ tài liệu
 *   Language ▸ IELTS                          (lớp chưa chia kỹ năng)
 *   3D Design ▸ tài liệu                      (nhóm có tài liệu ngay)
 *
 * Nên màn này không dựng cứng ba tầng. Nó hỏi đúng một câu: thư mục này còn
 * thư mục con không.
 *
 *   Còn con  → hiện danh sách con để đi tiếp, kèm phần học rút gọn bên dưới.
 *   Hết con  → đây là nơi thật sự ngồi học: tài liệu, thẻ, bộ thẻ, đề thi thử.
 *
 * Dựng cứng ba tầng sẽ vỡ ngay ở 3D Design, và chặn luôn việc chia sâu thêm.
 */
export default function SubjectDesk({ subjectId }: { subjectId: string }) {
  const { t } = useLanguage();

  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [stat, setStat] = useState<DomainStat | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "Đang tải" suy ra từ việc dữ liệu trên màn có thuộc đúng thư mục đang mở
  // hay không. Đặt cờ trong thân effect thì đi sâu một tầng sẽ loé nội dung của
  // thư mục vừa rời khỏi một nhịp trước khi cờ kịp bật.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = loadedFor === subjectId;

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch(`/api/learning/folder?id=${encodeURIComponent(subjectId)}`, {
        signal: controller.signal,
      }).then((r) => r.json()),
      fetch("/api/learning/overview", { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([f, o]) => {
        if (controller.signal.aborted) return;

        if (!f?.success) {
          setError(f?.error || "Không mở được thư mục");
          return;
        }
        setFolder(f.folder);
        setBreadcrumb(f.breadcrumb ?? []);
        setChildren(f.children ?? []);
        setDocumentCount(f.documentCount ?? 0);

        // Thẻ ghi nhớ gắn với tên lĩnh vực, nên khớp theo tên thư mục đang mở.
        const match = (o?.domains ?? []).find(
          (s: DomainStat) => s.domain.trim().toLowerCase() === f.folder.name.trim().toLowerCase()
        );
        setStat(match ?? null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(subjectId);
      });

    return () => controller.abort();
  }, [subjectId]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[var(--color-text-muted)]">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center space-y-4">
        <div className="c-alert c-alert-error max-w-md mx-auto text-left">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error ?? t("Not found", "Không tìm thấy")}</span>
        </div>
        <Link href="/learning" className="c-btn c-btn-secondary c-btn-sm">
          {t("Back to Learning Hub", "Về Learning Hub")}
        </Link>
      </div>
    );
  }

  const due = stat?.dueCount ?? 0;
  const q = encodeURIComponent(folder.name);
  const isLeaf = children.length === 0;

  const tools = [
    {
      href: `/learning/flashcards?domain=${q}`,
      icon: Brain,
      label: t("Review cards", "Ôn thẻ"),
      note: due > 0 ? t(`${due} due now`, `${due} thẻ tới hạn`) : t("Nothing due", "Chưa tới hạn"),
      primary: due > 0,
    },
    {
      href: `/learning/inventory?domain=${q}`,
      icon: BookMarked,
      label: t("Term bank", "Kho thuật ngữ"),
      note: t(`${stat?.termCount ?? 0} terms`, `${stat?.termCount ?? 0} thuật ngữ`),
      primary: false,
    },
    {
      href: "/learning/exam",
      icon: ClipboardCheck,
      label: t("Mock exam", "Thi thử"),
      note: t("From these documents", "Ra đề từ tài liệu ở đây"),
      primary: false,
    },
    {
      href: `/learning/subject/${subjectId}/documents`,
      icon: FolderOpen,
      label: t("Documents", "Tài liệu"),
      note: t(`${documentCount} here`, `${documentCount} tài liệu`),
      primary: false,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-8">
      {/* Đường dẫn — biết mình đang đứng đâu trong cây, và lùi được từng tầng */}
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        <Link href="/learning" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
          <ArrowLeft size={15} />
          {t("All subjects", "Tất cả môn học")}
        </Link>
        {breadcrumb.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-[var(--color-text-faint)]" />
            <Link
              href={`/learning/subject/${crumb.id}`}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {crumb.name}
            </Link>
          </span>
        ))}
        <ChevronRight size={14} className="text-[var(--color-text-faint)]" />
        <span className="font-bold">{folder.name}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="c-card-kicker">
            {isLeaf ? t("Study desk", "Bàn học") : t("Browse", "Danh mục")}
          </p>
          <h1 className="c-display mt-1">{folder.name}</h1>
        </div>
        {folder.webViewLink && (
          <a
            href={folder.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="c-btn c-btn-secondary c-btn-sm"
          >
            <ExternalLink size={14} />
            {t("Open in Drive", "Mở trong Drive")}
          </a>
        )}
      </header>

      {/* Thư mục con — đi tiếp vào trong */}
      {children.length > 0 && (
        <section className="space-y-4">
          <h2 className="c-h3">{t("Inside", "Bên trong")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((c) => (
              <Link
                key={c.id}
                href={`/learning/subject/${c.id}`}
                className="group c-card c-elev-md p-5 flex items-center gap-4 hover:border-[var(--color-primary)] transition-colors"
              >
                <span className="w-11 h-11 rounded-xl grid place-content-center flex-none bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                  {c.childFolderCount > 0 ? <Layers size={20} /> : <Folder size={20} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold truncate">{c.name}</span>
                  <span className="block c-stat-label">
                    {/* Con còn con nữa thì đếm nhánh; hết con thì đếm tài liệu.
                        Không gọi tên "lớp" hay "môn" vì cây mỗi nhóm một khác. */}
                    {c.childFolderCount > 0
                      ? t(`${c.childFolderCount} inside`, `${c.childFolderCount} mục bên trong`)
                      : t(`${c.documentCount} documents`, `${c.documentCount} tài liệu`)}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="text-[var(--color-text-faint)] group-hover:text-[var(--color-primary)] transition-colors flex-none"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Phần học. Ở nhánh còn con thì đây là tổng hợp; ở lá thì đây là chỗ ngồi học. */}
      <section className="c-card c-elev-md p-6 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[180px]">
          <p className="c-card-kicker">{t("Today", "Hôm nay")}</p>
          {due > 0 ? (
            <>
              <p className="c-stat-value">{due}</p>
              <p className="c-stat-label">{t("cards due", "thẻ tới hạn")}</p>
            </>
          ) : (
            <p className="c-h3 flex items-center gap-2 text-[var(--color-success)] mt-1">
              <CheckCircle2 size={20} />
              {t("All caught up", "Xong hết rồi")}
            </p>
          )}
        </div>

        <div className="flex gap-8">
          <div>
            <p className="c-stat-value">{stat?.termCount ?? 0}</p>
            <p className="c-stat-label">{t("terms", "thuật ngữ")}</p>
          </div>
          <div>
            <p className="c-stat-value">{documentCount}</p>
            <p className="c-stat-label inline-flex items-center gap-1">
              <FileText size={11} />
              {t("here", "tài liệu ở đây")}
            </p>
          </div>
        </div>

        <Link
          href={`/learning/flashcards?domain=${q}`}
          className={`c-btn c-btn-lg ${due > 0 ? "c-btn-primary" : "c-btn-secondary"}`}
        >
          {due > 0 ? t("Start review", "Bắt đầu ôn") : t("Review anyway", "Ôn thêm")}
          <ArrowRight size={18} />
        </Link>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map(({ href, icon: Icon, label, note, primary }) => (
          <Link
            key={href}
            href={href}
            className={`c-card p-5 flex flex-col gap-2 transition-colors ${
              primary ? "border-[var(--color-primary)]" : "hover:border-[var(--color-border-strong)]"
            }`}
          >
            <Icon
              size={22}
              className={primary ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}
            />
            <p className="font-bold">{label}</p>
            <p className="c-stat-label">{note}</p>
          </Link>
        ))}
      </section>

      {/* Bộ thẻ chỉ có nghĩa ở nơi thật sự ngồi học, không phải ở tầng danh mục. */}
      {isLeaf && <DeckManager domain={folder.name} />}
    </div>
  );
}
