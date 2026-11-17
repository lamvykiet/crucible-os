"use client";

import { use } from "react";
import LanguagePage from "@/components/learning/LanguagePage";
import LevelTest from "@/components/learning/path/LevelTest";

export default function LevelTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <LanguagePage
      id={id}
      title={["Level-up test", "Kiểm tra lên cấp"]}
      backHref={`/learning/languages/${id}/path`}
      backLabel={["Back to the path", "Về lộ trình"]}
    >
      {(lang) => <LevelTest languageId={lang.id} />}
    </LanguagePage>
  );
}
