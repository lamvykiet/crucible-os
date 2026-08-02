"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import ThreePanelWorkspace from "@/components/workspace/ThreePanelWorkspace";

// Tham số [id] là Google Drive file id — DocumentsTab.tsx điều hướng tới
// /knowledge/{file.id}. Truyền vào làm tài liệu mở sẵn.
export default function DocumentViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <ThreePanelWorkspace
      title="Knowledge Hub"
      onBack={() => router.push("/knowledge")}
      initialDocumentId={id}
      chatGreeting="Chào bạn, tôi là Crucible AI. Bạn có câu hỏi gì về tài liệu này không?"
    />
  );
}
