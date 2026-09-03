/**
 * Số liệu học tập của một lĩnh vực.
 *
 * Dùng chung giữa trang chủ Learning Hub (nơi gọi /api/learning/overview) và
 * lưới lĩnh vực (nơi hiển thị). Để kiểu ở đây thay vì export chéo giữa hai
 * component, tránh vòng import giữa chúng.
 */
export interface DomainStat {
  /** Tên lĩnh vực đúng như người dùng đã gõ. Chuỗi rỗng = chưa gắn lĩnh vực. */
  domain: string;
  termCount: number;
  cardCount: number;
  /** Số thẻ đã tới hạn ôn ngay bây giờ. */
  dueCount: number;
  newCount: number;
}
