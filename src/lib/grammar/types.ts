/**
 * Kiểu chung cho mọi khung ngữ pháp.
 *
 * Khung là phần soạn tay, và cố ý như vậy: thứ tự học và cấp độ của từng điểm
 * cần phán đoán sư phạm, phải ổn định qua thời gian, và không được đổi mỗi lần
 * mở trang. Chỉ có *nội dung* từng bài (giải thích, cấu trúc, ví dụ, bài tập)
 * mới sinh bằng AI rồi lưu lại.
 *
 * Về nguồn: bản thân sự thật ngữ pháp thì không ai sở hữu — "phủ định mệnh
 * lệnh dùng Don't + động từ nguyên thể" là dữ kiện về tiếng Anh. Cái được bảo
 * hộ là cách diễn đạt của từng cuốn sách. Mỗi khung dưới đây là cách sắp xếp
 * của chính dự án; `references` ghi những sách đã tra để quyết thứ tự, không
 * phải nguồn chép nội dung.
 *
 * Mỗi thứ tiếng một thang riêng, không dùng chung: CEFR cho Anh và Pháp, HSK
 * cho Quan Thoại, TOPIK cho Hàn. Tiếng Quảng Đông không có kỳ thi chuẩn nào
 * được dùng rộng rãi, nên thang ở đó là thang tự đặt và phải nói rõ là tự đặt.
 */

export interface GrammarPoint {
  /** Định danh bền, dùng làm khoá lưu nội dung đã sinh. Đừng đổi sau khi phát hành. */
  id: string;
  title: string;
  /** Cấp độ theo thang của chính thứ tiếng đó. */
  level: string;
}

export interface GrammarGroup {
  id: string;
  title: string;
  points: GrammarPoint[];
}

export interface GrammarFamily {
  id: string;
  title: string;
  groups: GrammarGroup[];
}

export interface GrammarSyllabus {
  /** Mã thứ tiếng, khớp `Language.code`. */
  code: string;
  /** Tên thang cấp độ, hiện lên cạnh các chip lọc. */
  scale: string;
  /** Các cấp theo đúng thứ tự từ dễ tới khó. */
  levels: string[];
  families: GrammarFamily[];
  /**
   * Sách và khung đã tra để quyết thứ tự và cách chia.
   *
   * Ghi ra để sau này còn biết vì sao xếp như vậy, và để thấy rõ đây là tham
   * khảo cách sắp xếp chứ không phải chép nội dung.
   */
  references: string[];
}

/** Rút gọn khai báo một điểm: [id, tiêu đề, cấp độ]. */
export type P = [string, string, string];

export const group = (id: string, title: string, points: P[]): GrammarGroup => ({
  id,
  title,
  points: points.map(([pid, ptitle, level]) => ({ id: `${id}.${pid}`, title: ptitle, level })),
});
