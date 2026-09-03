"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MockExamTab from "@/components/learning/MockExamTab";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Thi thử.
 *
 * Trước đây chỉ tồn tại như một tab trong /learning. Tách thành trang riêng để
 * đang làm dở một đề mà lỡ bấm Back thì không mất luôn cả bài.
 */
export default function ExamPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      <Link href="/learning" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Learning Hub", "Learning Hub")}
      </Link>
      <MockExamTab />
    </div>
  );
}
