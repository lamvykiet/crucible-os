// "Hôm nay" theo lịch của NGƯỜI DÙNG, không phải theo UTC.
//
// `new Date().toISOString().slice(0, 10)` trả về ngày UTC. Việt Nam là UTC+7,
// nên từ 00:00 đến 07:00 mỗi đêm nó trả về ngày HÔM TRƯỚC. Hệ quả đã đo được:
// thẻ "Hôm nay" trên Dashboard hiện giao dịch của hôm qua, và modal thêm giao
// dịch mặc định sai ngày — khoản ghi lúc nửa đêm rơi vào ngày hôm trước.
//
// Cột `Transaction.date` lưu ngày dạng lịch (mốc 00:00 UTC), không có phần giờ,
// nên đối chiếu với ngày lịch của người dùng mới là đúng. Phần tính toán bên
// route handler vẫn dùng UTC như cũ — chỗ đó là cửa sổ truy vấn, không phải
// khái niệm "hôm nay" của người dùng.

const pad = (n: number) => String(n).padStart(2, "0");

/** Hôm nay theo giờ máy người dùng, dạng YYYY-MM-DD. */
export function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Tháng này theo giờ máy người dùng, dạng YYYY-MM. */
export function thisMonthLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
