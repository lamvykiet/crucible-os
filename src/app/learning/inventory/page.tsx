"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import Inventory from "@/components/learning/Inventory";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * `useSearchParams` bên trong Inventory buộc phần cây dưới nó phải render ở
 * trình duyệt. Không bọc Suspense thì Next 16 báo lỗi lúc build.
 */
export default function Page() {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      <Link href="/learning" className="c-btn c-btn-tertiary c-btn-sm -ml-3">
        <ArrowLeft size={16} />
        {t("Learning Hub", "Learning Hub")}
      </Link>
      <h1 className="c-h1">{t("Card inventory", "Kho thẻ")}</h1>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[40vh] text-[var(--color-text-muted)]">
            <Loader2 size={22} className="animate-spin" />
          </div>
        }
      >
        <Inventory />
      </Suspense>
    </div>
  );
}
