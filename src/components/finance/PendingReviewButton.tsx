"use client";

import { useState, useEffect } from "react";
import { ListTodo } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import ReviewQueueModal from "./ReviewQueueModal";

interface PendingReviewButtonProps {
  /** Đổi giá trị này để đếm lại hàng đợi (ví dụ sau khi quét xong một hoá đơn). */
  refreshKey?: number;
  /** Gọi khi hàng đợi vừa được xử lý xong, để màn hình cha tải lại số liệu. */
  onProcessed?: () => void;
}

/**
 * Nút "Duyệt hóa đơn (n)" — bước 2 của luồng OCR.
 *
 * Tách thành component riêng vì trước đây chỉ Dashboard mới có nút này: quét
 * hoá đơn từ tab Chi tiêu xong là không còn đường nào đi tiếp, bản nháp nằm lại
 * trong hàng đợi mà người dùng không nhìn thấy ở đâu cả.
 */
export default function PendingReviewButton({ refreshKey = 0, onProcessed }: PendingReviewButtonProps) {
  const { t } = useLanguage();
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/drive/pending-count", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setCount(data.count);
      })
      .catch(() => {
        // Badge không phải dữ liệu quan trọng — hỏng thì ẩn nút, không báo lỗi.
      });

    return () => controller.abort();
  }, [refreshKey, isOpen]);

  if (count === 0 && !isOpen) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="c-btn c-btn-warning shadow-sm"
      >
        <ListTodo size={16} /> {t(`Duyệt hóa đơn (${count})`, `Review invoices (${count})`)}
      </button>

      <ReviewQueueModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          onProcessed?.();
        }}
      />
    </>
  );
}
