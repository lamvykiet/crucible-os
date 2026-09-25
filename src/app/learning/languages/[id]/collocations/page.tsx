"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import CollocationPractice from "@/components/learning/CollocationPractice";
import SkillShell from "@/components/learning/SkillShell";
import { useLanguage } from "@/lib/LanguageContext";

export default function CollocationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();

  const [langCode, setLangCode] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/languages", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        const found = (json?.languages ?? []).find((l: { id: string }) => l.id === id);
        setLangCode(found?.code ?? "en");
      })
      .catch(() => setLangCode("en"));
    return () => controller.abort();
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-6">
      <Link href={`/learning/languages/${id}`} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Back to skills", "Về bảng kỹ năng")}
      </Link>
      <h1 className="c-h1">{t("Collocations", "Kết hợp từ")}</h1>

      {!langCode ? (
        <div className="flex items-center gap-2 c-help">
          <Loader2 size={16} className="animate-spin" />
          {t("Loading…", "Đang tải…")}
        </div>
      ) : (
        <SkillShell langCode={langCode} skill="collocations">
          <CollocationPractice languageId={id} />
        </SkillShell>
      )}
    </div>
  );
}
