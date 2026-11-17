"use client";

import { use } from "react";
import LanguagePage from "@/components/learning/LanguagePage";
import VideoStudy from "@/components/learning/video/VideoStudy";

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <LanguagePage id={id} title={["Video", "Video"]} wide>
      {(lang) => <VideoStudy languageId={lang.id} langCode={lang.code} />}
    </LanguagePage>
  );
}
