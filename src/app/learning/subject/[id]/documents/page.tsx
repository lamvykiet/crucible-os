"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThreePanelWorkspace from "@/components/workspace/ThreePanelWorkspace";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Tài liệu của một môn.
 *
 * Trước đây đây chính là trang `/learning/subject/[id]` — nghĩa là "mở môn học"
 * đồng nghĩa với "mở đống tài liệu". Giờ tài liệu lùi về đúng vai trò một công
 * cụ trong bàn học, còn bàn học mới là thứ mở ra đầu tiên.
 */
export default function SubjectDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLanguage();

  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/learning/domains", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        const domain = (json?.domains ?? []).find((d: { id: string }) => d.id === id);
        if (domain) setTitle(domain.name);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [id]);

  return (
    <ThreePanelWorkspace
      title={title ?? t("Loading...", "Đang tải...")}
      onBack={() => router.push(`/learning/subject/${id}`)}
      folderId={id}
      chatGreeting={
        title
          ? `Chào bạn, tôi là Crucible AI. Tôi có thể giúp gì bạn với các tài liệu ${title}?`
          : "Chào bạn, tôi là Crucible AI."
      }
    />
  );
}
