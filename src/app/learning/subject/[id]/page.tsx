"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import ThreePanelWorkspace from "@/components/workspace/ThreePanelWorkspace";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Danh mục lĩnh vực học tập.
 *
 * Đây là cấu hình điều hướng, không phải dữ liệu giả — cùng bộ id với
 * SubjectsTab.tsx, nơi sinh ra các link tới trang này. Nếu sau này cần cho
 * người dùng tự tạo lĩnh vực thì mới phải thêm bảng Subject vào Prisma.
 *
 * Ngược lại, DANH SÁCH TÀI LIỆU thì lấy thật từ Google Drive. Bản cũ hardcode
 * 7 tên file (2025_CFA_L1V6_FI.pdf, "Reading 47 Fixed-Income.pdf"...) không hề
 * tồn tại, và bấm vào cũng chỉ mở ra một trình đọc PDF mô phỏng.
 */
const DOMAINS: Record<string, { title: string }> = {
  finance: { title: "Finance" },
  "3d-design": { title: "3D Design" },
  data: { title: "Data Analyst" },
  language: { title: "Language" },
};

export default function SubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLanguage();

  const domain = DOMAINS[id];

  if (!domain) {
    return (
      <div className="max-w-7xl mx-auto py-20 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-muted)]">
          {t("Subject not found", "Môn học không tồn tại")}
        </h1>
        <button
          onClick={() => router.push("/learning")}
          className="mt-4 text-[var(--color-accent)] font-bold"
        >
          {t("Go back", "Quay lại")}
        </button>
      </div>
    );
  }

  return (
    <ThreePanelWorkspace
      title={domain.title}
      onBack={() => router.push("/learning")}
      chatGreeting={`Chào bạn, tôi là Crucible AI. Tôi có thể giúp gì bạn với các tài liệu ${domain.title}?`}
    />
  );
}
