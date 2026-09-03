import LearningHome from "@/components/learning/LearningHome";

/**
 * Learning Hub.
 *
 * Bản cũ là một dải ba tab (Lĩnh vực / Từ điển / Thi thử) giữ toàn bộ khu vực
 * học trong đúng một URL: không mở riêng được tab nào, bấm Back là văng khỏi
 * Hub, và mở trang ra thì không biết hôm nay cần học gì.
 *
 * Giờ mỗi việc là một địa chỉ riêng — /learning/flashcards, /learning/dictionary,
 * /learning/exam — còn /learning là trang chủ chỉ đường. Thanh điều hướng vẫn
 * trỏ về /learning nên Sidebar và MobileNav không phải sửa.
 */
export default function LearningHubPage() {
  return <LearningHome />;
}
