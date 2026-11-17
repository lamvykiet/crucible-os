"use client";

import { use } from "react";
import LanguagePage from "@/components/learning/LanguagePage";
import PathView from "@/components/learning/path/PathView";

export default function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <LanguagePage id={id} title={null} wide>
      {(lang) => <PathView languageId={lang.id} />}
    </LanguagePage>
  );
}
