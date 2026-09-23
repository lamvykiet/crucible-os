"use client";

import { use } from "react";
import SubjectDesk from "@/components/learning/SubjectDesk";

/** Bàn học của một môn. Tài liệu nằm ở `/learning/subject/[id]/documents`. */
export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SubjectDesk subjectId={id} />;
}
