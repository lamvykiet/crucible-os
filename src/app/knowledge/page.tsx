import { Suspense } from "react";
import KnowledgeHubPage from "@/components/knowledge/KnowledgePage";

// Trang đọc `?tab=` bằng useSearchParams — cần ranh giới Suspense.
export default function Page() {
  return (
    <Suspense>
      <KnowledgeHubPage />
    </Suspense>
  );
}
