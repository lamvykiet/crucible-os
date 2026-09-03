"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DictionaryTab from "@/components/learning/DictionaryTab";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Kho thuật ngữ.
 *
 * Trước đây đây là bản sao thứ ba của cùng một màn hình, với dữ liệu giả riêng
 * và ghi chú "Dummy data for now, since we haven't built the CRUD APIs yet".
 * CRUD giờ đã có, nên trang này và Learning Hub dùng chung đúng một component —
 * sửa một chỗ là cả hai cùng đúng.
 */
export default function DictionaryPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      <Link href="/learning" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Learning Hub", "Learning Hub")}
      </Link>
      <DictionaryTab />
    </div>
  );
}
