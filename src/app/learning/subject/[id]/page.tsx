"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThreePanelWorkspace from "@/components/workspace/ThreePanelWorkspace";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Không gian học của một lĩnh vực.
 *
 * `[id]` là id thư mục Drive của lĩnh vực, do SubjectsTab sinh ra. Bản cũ dùng
 * slug ("finance", "3d-design") tra vào một bảng viết cứng trong file, và — điểm
 * quan trọng — gọi ThreePanelWorkspace mà KHÔNG truyền `folderId`, nên mọi lĩnh
 * vực đều hiện đúng một danh sách tài liệu của thư mục gốc. Chọn lĩnh vực không
 * thay đổi được gì.
 */
export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLanguage();

  const [title, setTitle] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/learning/domains", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        const domain = (json?.domains ?? []).find((d: { id: string }) => d.id === id);
        if (domain) setTitle(domain.name);
        else setNotFound(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setNotFound(true);
      });

    return () => controller.abort();
  }, [id]);

  if (notFound) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-muted)]">
          {t("Subject not found", "Lĩnh vực không tồn tại")}
        </h1>
        <button onClick={() => router.push("/learning")} className="mt-4 text-[var(--color-accent)] font-bold">
          {t("Go back", "Quay lại")}
        </button>
      </div>
    );
  }

  return (
    <ThreePanelWorkspace
      title={title ?? t("Loading...", "Đang tải...")}
      onBack={() => router.push("/learning")}
      folderId={id}
      chatGreeting={
        title
          ? `Chào bạn, tôi là Crucible AI. Tôi có thể giúp gì bạn với các tài liệu ${title}?`
          : "Chào bạn, tôi là Crucible AI."
      }
    />
  );
}
