"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WritingPractice from "@/components/learning/WritingPractice";
import SkillShell from "@/components/learning/SkillShell";
import { useLanguage } from "@/lib/LanguageContext";

export default function WritingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();

  // Bài hướng dẫn khác nhau theo thứ tiếng, nên phải biết mã tiếng trước.
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
    <div className="max-w-4xl mx-auto pb-24 space-y-6">
      <Link href={`/learning/languages/${id}`} className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Back to skills", "Về bảng kỹ năng")}
      </Link>
      <h1 className="c-h1">{t("Writing", "Luyện viết")}</h1>
      {langCode ? (
        <SkillShell langCode={langCode} skill="writing">
          <WritingPractice languageId={id} />
        </SkillShell>
      ) : (
        <WritingPractice languageId={id} />
      )}
    </div>
  );
}
