import { Suspense } from "react";
import FinancePage from "@/components/finance/FinancePage";

// `FinancePage` đọc `?tab=` bằng useSearchParams — cần ranh giới Suspense,
// thiếu nó Next bắt cả trang render phía client khi build.
export default function Page() {
  return (
    <Suspense>
      <FinancePage />
    </Suspense>
  );
}
