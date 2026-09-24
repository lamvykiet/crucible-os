"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WritingPractice from "@/components/learning/WritingPractice";
import { useLanguage } from "@/lib/LanguageContext";

export default function WritingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      <Link href={`/learning/languages/${id}`} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Back to skills", "Về bảng kỹ năng")}
      </Link>
      <h1 className="c-h1">{t("Writing", "Luyện viết")}</h1>
      <WritingPractice languageId={id} />
    </div>
  );
}
