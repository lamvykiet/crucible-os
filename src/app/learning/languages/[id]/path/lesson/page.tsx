"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import LanguagePage from "@/components/learning/LanguagePage";
import PathLesson from "@/components/learning/path/PathLesson";

export default function PathLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <Inner id={id} />
    </Suspense>
  );
}

function Inner({ id }: { id: string }) {
  const search = useSearchParams();
  const point = search.get("point") ?? "";
  const kind = search.get("kind") === "translate" ? "translate" : "typing";
  return (
    <LanguagePage
      id={id}
      title={kind === "translate" ? ["Translation", "Dịch câu"] : ["Sentence typing", "Gõ câu"]}
      backHref={`/learning/languages/${id}/path`}
      backLabel={["Back to the path", "Về lộ trình"]}
    >
      {(lang) => <PathLesson key={`${point}:${kind}`} languageId={lang.id} langCode={lang.code} pointId={point} kind={kind} />}
    </LanguagePage>
  );
}
