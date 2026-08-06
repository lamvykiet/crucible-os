"use client";

import DictionaryTab from "@/components/learning/DictionaryTab";

/**
 * Trang từ điển độc lập.
 *
 * Trước đây đây là bản sao thứ ba của cùng một màn hình, với dữ liệu giả riêng
 * và ghi chú "Dummy data for now, since we haven't built the CRUD APIs yet".
 * CRUD giờ đã có, nên trang này và tab trong Learning Hub dùng chung đúng một
 * component — sửa một chỗ là cả hai cùng đúng.
 */
export default function DictionaryPage() {
  return (
    <div className="max-w-7xl mx-auto pb-20">
      <DictionaryTab />
    </div>
  );
}
