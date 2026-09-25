"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import VocabCourse from "@/components/learning/VocabCourse";
import SkillShell from "@/components/learning/SkillShell";
import { useLanguage } from "@/lib/LanguageContext";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
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
      <div>
        <h1 className="c-h1">{t("Vocabulary course", "Giáo trình từ vựng")}</h1>
        <p className="c-card-body mt-2 max-w-2xl">
          {t(
            "10 words a day. Each day's set returns every 10 days, five times over. This is a fixed schedule — separate from the flashcard system, which spaces cards by how well you know each one.",
            "Mỗi ngày 10 từ. Mỗi bộ quay lại sau 10 ngày, tất cả 5 vòng. Đây là lịch cố định — chạy riêng với phần thẻ ghi nhớ, nơi khoảng cách co giãn theo mức độ bạn nhớ từng thẻ."
          )}
        </p>
      </div>
      {langCode ? (
        <SkillShell langCode={langCode} skill="vocabulary">
          <VocabCourse languageId={id} />
        </SkillShell>
      ) : (
        <VocabCourse languageId={id} />
      )}
    </div>
  );
}
