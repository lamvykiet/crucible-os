"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LanguagesManager from "@/components/learning/LanguagesManager";
import { useLanguage } from "@/lib/LanguageContext";

/** Chọn và quản lý các thứ tiếng đang học. */
export default function LanguagesPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      <Link href="/learning" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Learning Hub", "Learning Hub")}
      </Link>
      <LanguagesManager />
    </div>
  );
}
