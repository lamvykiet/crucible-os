"use client";

import { use, useEffect, useState } from "react";
import { GraduationCap, BookmarkCheck } from "lucide-react";
import VocabCourse from "@/components/learning/VocabCourse";
import MarkedWords from "@/components/learning/MarkedWords";
import SkillShell from "@/components/learning/SkillShell";
import Crumbs from "@/components/learning/Crumbs";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Ngân hàng từ vựng có HAI đường vào, và chúng đếm ngày từ hai mốc khác nhau:
 *
 * - Giáo trình: mỗi ngày một bộ mười từ, bộ nào mở ngày nào thì đếm từ ngày đó.
 * - Từ đánh dấu: từng từ lẻ bắt gặp khi đọc sách, đếm từ ngày bấm bắt đầu học.
 *
 * Để chung một màn mà không tách thì người học không biết hôm nay phải làm gì
 * trước; tách thành hai trang thì phải nhớ hai đường. Nên một trang, hai tab.
 */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();

  const [tab, setTab] = useState<"course" | "marked">("course");

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
      <Crumbs
        items={[
          { label: t("Skills", "Bảng kỹ năng"), href: `/learning/languages/${id}` },
          { label: t("Vocabulary", "Từ vựng") },
        ]}
      />
      <div>
        <h1 className="c-h1">{t("Vocabulary", "Từ vựng")}</h1>
        <p className="c-card-body mt-2 max-w-2xl">
          {t(
            "10 words a day. Each set returns every 10 days, five times over — and a word you mark while reading runs the same cycle, counted from the day you start it. This is a fixed schedule, separate from the flashcard system.",
            "Mỗi ngày 10 từ. Mỗi bộ quay lại sau 10 ngày, tất cả 5 vòng — và từ bạn đánh dấu khi đọc sách chạy đúng vòng đó, tính từ ngày bạn bắt đầu học nó. Đây là lịch cố định, chạy riêng với phần thẻ ghi nhớ."
          )}
        </p>
      </div>

      <div className="c-seg w-fit">
        <button
          className={`c-seg-opt ${tab === "course" ? "active" : ""}`}
          onClick={() => setTab("course")}
        >
          <GraduationCap size={15} />
          {t("Course", "Giáo trình")}
        </button>
        <button
          className={`c-seg-opt ${tab === "marked" ? "active" : ""}`}
          onClick={() => setTab("marked")}
        >
          <BookmarkCheck size={15} />
          {t("Marked words", "Từ đánh dấu")}
        </button>
      </div>

      {tab === "marked" ? (
        <MarkedWords languageId={id} langCode={langCode ?? "en"} />
      ) : langCode ? (
        <SkillShell langCode={langCode} skill="vocabulary">
          <VocabCourse languageId={id} />
        </SkillShell>
      ) : (
        <VocabCourse languageId={id} />
      )}
    </div>
  );
}
