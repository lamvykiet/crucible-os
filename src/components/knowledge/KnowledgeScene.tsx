"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { ddmm } from "@/components/SceneSummary";
import PageIntro from "@/components/PageIntro";
import { en } from "@/lib/plural";

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

  // Câu kết luận tính từ số liệu thật; Drive lỗi thì nói thẳng là chưa đọc được.
  let lede = "";
  if (data) {
    if (data.driveError) lede = t("Drive could not be read, so the library is not counted yet.", "Chưa đọc được Drive nên chưa đếm được kho kiến thức.");
    else if (data.totalDocuments === 0) lede = t("No documents yet — add a file to the Knowledge folder on Drive.", "Chưa có tài liệu nào — thêm một tệp vào thư mục Knowledge trên Drive.");
    else if (data.staleDocuments > 0)
      lede = t(
        `${en(data.totalDocuments, "document")}, ${data.staleDocuments} untouched for ${days}+ days${newest?.modifiedTime ? `; newest edit ${ddmm(newest.modifiedTime)}` : ""}.`,
        `${data.totalDocuments} tài liệu, ${data.staleDocuments} cái trên ${days} ngày chưa sửa${newest?.modifiedTime ? `; sửa gần nhất ${ddmm(newest.modifiedTime)}` : ""}.`
      );
    else if (data.staleIdeas > 0)
      lede = t(
        `${en(data.totalDocuments, "document")} up to date; ${en(data.staleIdeas, "idea")} of ${data.totalIdeas} gone quiet for ${days}+ days.`,
        `${data.totalDocuments} tài liệu còn mới; ${data.staleIdeas}/${data.totalIdeas} ý tưởng trên ${days} ngày chưa động tới.`
      );
    else lede = t(`${en(data.totalDocuments, "document")} and ${en(data.totalIdeas, "idea")}, all fresh.`, `${data.totalDocuments} tài liệu và ${data.totalIdeas} ý tưởng, đều còn mới.`);
  }

  return <PageIntro title={t("Knowledge", "Kiến thức")} kicker={t("Library on Drive", "Thư viện trên Drive")} lede={lede} />;
}
