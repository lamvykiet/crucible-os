// Rút gọn số tiền cho nhãn trục biểu đồ.
//
// Trước đây mỗi biểu đồ tự viết một kiểu: chỗ `${v/1000}k`, chỗ
// `${v/1_000_000}m`. Hai chỗ cạnh nhau trên cùng một màn hình mà một bên đọc là
// "nghìn" còn bên kia là "million" — và "m" thì người Việt đọc là gì cũng được.
//
// Một hàm, hai thứ tiếng, dùng chung một mốc: nghìn → k, triệu → tr/m,
// tỷ → tỷ/bn. Số lẻ giữ một chữ số và dùng dấu phẩy thập phân kiểu Việt.

export function compactMoney(n: number, vietnamese: boolean): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const trim = (v: number) => v.toFixed(1).replace(".0", "").replace(".", vietnamese ? "," : ".");

  if (a >= 1_000_000_000) return `${sign}${trim(a / 1_000_000_000)}${vietnamese ? " tỷ" : "bn"}`;
  if (a >= 1_000_000) return `${sign}${trim(a / 1_000_000)}${vietnamese ? "tr" : "m"}`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)}k`;
  return `${sign}${Math.round(a)}`;
}
