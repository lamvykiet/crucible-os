"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Pomodoro from "@/components/learning/Pomodoro";
import { useLanguage } from "@/lib/LanguageContext";

/** Đồng hồ tập trung và giấy nhớ. */
export default function Page() {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      <Link href="/learning" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Learning Hub", "Learning Hub")}
      </Link>
      <h1 className="c-h1">{t("Focus", "Tập trung")}</h1>
      <Pomodoro />
    </div>
  );
}
