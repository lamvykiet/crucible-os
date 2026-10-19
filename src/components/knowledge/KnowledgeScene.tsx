"use client";

import { useEffect, useState } from "react";
import { Clock, FileText, Lightbulb, Moon } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import SceneSummary, { ddmm } from "@/components/SceneSummary";

/**
 * Tóm tắt Knowledge trên phông cảnh, từ `/api/knowledge/summary` — cùng
 * nguồn với Trang chủ. Drive lỗi thì tiêu đề nói thẳng là chưa đọc được,
 * không hiện số 0 như thể kho trống.
 */
interface Summary {
  totalDocuments: number;
  staleDocuments: number;
  totalIdeas: number;
  staleIdeas: number;
  staleDays: number;
  driveError: string | null;
  recent: { name: string; modifiedTime: string | null }[];
}

export default function KnowledgeScene() {
  const { t } = useLanguage();
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/knowledge/summary", { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => { if (j?.success) setData(j.data); })
      .catch(() => { /* phông cảnh chỉ là phần tóm tắt — hỏng thì hiện "—" */ });
    return () => controller.abort();
  }, []);

  const days = data?.staleDays ?? 30;
  const newest = data?.recent?.[0];

  let title = "Knowledge Hub";
  if (data) {
    if (data.driveError) title = t("Drive could not be read", "Chưa đọc được Drive");
    else if (data.totalDocuments === 0) title = t("No documents yet", "Chưa có tài liệu nào");
    else if (data.staleDocuments > 0) title = t(`${data.staleDocuments} documents forgotten`, `${data.staleDocuments} tài liệu bỏ quên`);
    else if (data.staleIdeas > 0) title = t(`${data.staleIdeas} ideas gone quiet`, `${data.staleIdeas} ý tưởng chưa động tới`);
    else title = t("Library is up to date", "Kho kiến thức còn mới");
  }
  const v = (n: number | undefined) => (n === undefined ? "—" : String(n));

  return (
    <SceneSummary
      title={title}
      main={{
        title: t("Library", "Thư viện"),
        subtitle: data?.driveError ?? t("Knowledge folder on Drive", "Thư mục Knowledge trên Drive"),
        minis: [
          { label: t(`Untouched ${days}+ days`, `Trên ${days} ngày chưa sửa`), value: v(data?.staleDocuments), icon: Moon },
          { label: t("Ideas", "Ý tưởng"), value: v(data?.totalIdeas), icon: Lightbulb },
          { label: t("Quiet ideas", "Ý tưởng chưa động tới"), value: v(data?.staleIdeas), icon: Clock },
          {
            label: t("Last updated", "Sửa gần nhất"),
            value: newest?.modifiedTime ? ddmm(newest.modifiedTime) : "—",
            icon: FileText,
          },
        ],
        big: data && !data.driveError ? { value: String(data.totalDocuments), unit: t("docs", "tài liệu") } : null,
      }}
      rows={[
        {
          title: t("Ideas", "Ý tưởng"),
          subtitle: data ? t(`${data.staleIdeas} quiet for ${days}+ days`, `${data.staleIdeas} ý tưởng trên ${days} ngày chưa động tới`) : undefined,
          big: data ? { value: String(data.totalIdeas) } : null,
        },
        {
          title: t("Newest document", "Tài liệu mới nhất"),
          subtitle: newest?.name ?? t("No document yet", "Chưa có tài liệu nào"),
          big: newest?.modifiedTime ? { value: ddmm(newest.modifiedTime) } : null,
        },
      ]}
    />
  );
}
