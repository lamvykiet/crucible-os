"use client";

import { use } from "react";
import LanguagePage from "@/components/learning/LanguagePage";
import ReadTranslate from "@/components/learning/ReadTranslate";

export default function ReadTranslatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <LanguagePage id={id} title={["Read & translate", "Đọc & dịch"]}>
      {(lang) => <ReadTranslate languageId={lang.id} langCode={lang.code} />}
    </LanguagePage>
  );
}
