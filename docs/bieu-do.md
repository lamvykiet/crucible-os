# Biểu đồ trong Crucible — quy tắc

Rút từ *Storytelling with Data* (Cole Nussbaumer Knaflic) và bộ kiểm dataviz,
áp vào hệ v3 "Mật ong & Bạch đàn" (tấm nền kem, một màu hành động nâu mật ong
`--action`). Đọc hết trước khi vẽ hay sửa biểu đồ.

Bộ công cụ: `src/lib/viz.tsx` (màu, trục, lưới, cột, đường, tooltip, nhãn một
điểm), `src/components/charts/ChartCard.tsx` (khung thẻ, chú giải, `Delta`,
`StatTile`), `src/components/charts/{MetricCard,SectionHeader,RankBar}.tsx`
(xem mục 7), `src/components/finance/MonthAxisTick.tsx` (`monthAxis` cho trục
tháng). Mẫu chuẩn: `src/components/finance/MonthBreakdown.tsx`.

## 1. Bắt đầu từ câu muốn nói, không từ loại biểu đồ

Trước khi vẽ, viết được một câu: *"Tháng này chi ít hơn tháng trước 30%, chủ
yếu nhờ ăn uống giảm."* Câu đó là **tiêu đề** của thẻ (`ChartCard title`) — tính
từ dữ liệu, không viết cứng. Tên biểu đồ ("Chi tiêu 12 tháng, VND") xuống
`subtitle`. Không tính được câu kết luận (dữ liệu trống) thì tiêu đề mô tả
bình thường, đừng bịa.

## 2. Chọn dạng theo việc người đọc phải làm

| Việc | Dạng | Đừng |
|---|---|---|
| 1–4 con số chính | `StatTile` (số + so sánh có mũi tên + kỳ so) | biểu đồ một cột |
| Xu hướng theo thời gian | đường (1–3 chuỗi) hoặc cột cho từng tháng | vùng tô đậm, nhiều đường chồng |
| So sánh nhiều mục (nơi chi, nhóm) | **cột ngang xếp hạng**, nhãn số ở đầu cột | cột đứng với nhãn xoay, tròn/donut |
| Phần trong tổng | cột chồng ngang, ≤ 5 khúc + "Khác" | **pie/donut** (cấm) |
| Hai kỳ cho từng mục | cột kỳ này + **vạch mốc** kỳ trước (kiểu bullet) | hai thanh dài song song |
| Một mục là trọng tâm | **nhấn**: mục đó màu nhấn, còn lại xám | mỗi mục một màu |

Không bao giờ: biểu đồ hai trục Y, 3D, pie/donut, đổ bóng trong biểu đồ.

**Ngoại lệ có chủ ý (hệ "Sương sớm", 17/11/2026 — skill `suong-som-design`
7.4, 7.6, 7.7).** Vòng chỉ được dùng cho **tiến độ của MỘT đại lượng đếm được**
so với đích của chính nó — không bao giờ cho cơ cấu "phần trong tổng":

- **Vòng chia đoạn**: mỗi đoạn là một đơn vị đếm được (7 đoạn = 7 ngày,
  4 đoạn = 4 kỹ năng); đoạn xong `--action`, đoạn chưa xong xám. Không dùng
  khi các đoạn có nhiều hơn hai trạng thái (ví dụ ô thói quen "làm dở / nghỉ /
  ngoài lịch") — đó vẫn là lưới ô.
- **Nửa vòng `ScoreGauge`** (`src/components/charts/ScoreGauge.tsx`): một con
  số trên thang 0–max, kèm câu trạng thái tính từ dữ liệu, vạch ngưỡng `--bad`
  nếu có; ít dữ liệu thì trạng thái "Chưa đủ dữ liệu", không vẽ 0.
- **Mặt đồng hồ bấm giờ** (`src/components/FocusDial.tsx`): thời gian đã chạy
  trên tổng phiên.

Chi tiêu theo danh mục, cơ cấu tài sản, tỷ trọng bất kỳ: vẫn là cột ngang xếp
hạng / cột chồng ngang. Vòng không thay được biểu đồ.

## 3. Dọn rác — mọi thứ không phải dữ liệu đều phải tự chứng minh

- Lưới: chỉ ngang, `GRID` (nét mảnh, LIỀN). Nhiều biểu đồ không cần lưới vì
  đã có nhãn số — bỏ luôn.
- Trục: không đường trục, không vạch chia (`yAxis()`, `xAxis`, `monthAxis`).
  Trục Y chỉ 3–4 mốc tròn; bỏ hẳn nếu cột đã ghi số.
- Không viền quanh cột; khúc chồng tách bằng khe 2px màu nền (`STACK_GAP`).
- Không chấm ở mọi điểm của đường (`LINE` — chấm chỉ hiện khi rê chuột).
- Không ghi số lên mọi điểm. Ghi ở **một** chỗ: điểm cuối, điểm đang xem, cực
  trị (`labelAt`).
- Chú giải: một chuỗi thì không có; 2–4 chuỗi thì `keys` ngay dưới tiêu đề,
  hoặc ghi nhãn thẳng ở cuối đường. `<Legend>` dưới đáy của recharts: không
  dùng.

## 4. Màu: xám là mặc định, nhấn là ngoại lệ

- `VIZ.muted` (xám ấm) cho mọi dữ liệu nền. `VIZ.accent` (nâu mật ong `--action`;
  giao diện tối là mật ong nhạt) cho ĐÚNG
  điểm câu chuyện nói tới: tháng đang xem, hôm nay, mục tăng mạnh nhất.
  Một biểu đồ thường chỉ có MỘT chỗ màu nhấn.
- Kỳ so sánh (tháng trước, năm trước): `VIZ.ghost` hoặc vạch mốc `VIZ.ink`.
- `VIZ.cat[0..3]` chỉ khi các chuỗi CHÍNH LÀ đối tượng so sánh (công ty trả
  lương, khoản vay). Màu đi theo đối tượng, không theo thứ hạng; quá 4 → gộp
  "Khác" (`VIZ.other`). Bảng này đã qua kiểm mù màu — đừng tự thêm màu.
- Khúc phụ của cùng một đối tượng (thưởng so với lương): `soft(color)`.
- Màu trạng thái (`--color-success/error`) chỉ cho tốt/xấu, và luôn đi kèm
  mũi tên hay chữ (`Delta` — viên `.c-delta`). Chi tăng là xấu, thu tăng là tốt.
  SỐ MỨC (thu, chi, dư nợ, giá trị) là màu mực: thu nhập không tự nó "xanh",
  chi tiêu không tự nó "cam". `VIZ.ink` và `VIZ.accent` gần cùng tông nâu trên
  nền v3 — đừng dùng cặp đó cho hai đường cần phân biệt; một đường `VIZ.muted`,
  một đường `VIZ.accent`, ghi nhãn ở điểm cuối.
- Chữ không bao giờ mang màu của chuỗi — chữ dùng màu chữ; ô màu bên cạnh
  mới mang danh tính.

## 5. Kích thước và nhịp

- Cột đứng ≤ 24px (`BAR`), cột ngang ≤ 18px (`BAR_H`), đầu bo 4px.
- Đường 2px. Đường tham chiếu (trung bình, kế hoạch): nét đứt `VIZ.muted`,
  ghi nhãn ở đầu mút thay vì chú giải.
- Chiều cao khung phải chứa cả dải nhãn trục (monthAxis cao 38px).
- Trong thẻ dùng `flex flex-col gap-*`, KHÔNG `space-y-6` — globals.css gán
  nhịp khối lớn của trang cho `.space-y-6` trong `.c-main`.
- Khổ chính là 375px: nhãn ngang không xoay, tên dài thì cắt `truncate`, số
  luôn thấy trọn.

## 6. Kiểm trước khi xong

- Không còn `strokeDasharray="3 3"` trên lưới, không `<Legend>`, không
  `PieChart`, không `.c-chart-multi`/`.c-series-*` (đã gỡ khỏi globals.css).
- Mọi `<Bar>`, `<Line>`, `<Area>` có `fill`/`stroke` bằng token `VIZ.*` —
  quên là recharts tô xanh tím mặc định (globals.css có lưới an toàn kéo về
  xám, nhưng đừng dựa vào nó).
- Chụp màn hình thật ở 1440px và 375px; nhìn nhãn chồng nhau, chữ bị cắt.

## 7. Ô số liệu, tiêu đề mục, thanh ngang — mỗi thứ MỘT bản

Ba thứ này từng được viết tay lại ở từng tab (khoảng 25 thẻ số liệu ba dáng, ba
kiểu tiêu đề mục, bốn bản thanh ngang). Nay dùng chung, đừng viết bản nữa:

| Cần | Dùng | Ghi chú |
|---|---|---|
| Ô số liệu đứng riêng trên tấm nền | `MetricCard` | icon trung tính, nhãn `.c-overline`, số `.c-metric-value`; `tone="good\|bad"` chỉ khi con số tự nó là tin tốt/xấu |
| Ô số liệu lồng trong một thẻ | `StatTile` | dải tint phẳng; một ô `emphasis`, các ô còn lại lùi |
| Chênh lệch so với kỳ khác | `Delta` | viên `.c-delta`; `plain` cho hàng dày |
| Tiêu đề một mục lớn trong tab | `SectionHeader` | `c-h3` + icon 20px + cụm nút bên phải; tiêu đề cả tab vẫn là `c-h2 c-page-title` |
| Một thanh trên thước chung | `RankBar` (`mark` = vạch mốc), `Bullet` | vẽ bằng div, không cần recharts |
| Danh sách xếp hạng tên · số · thanh | `RankList` | truyền `format` (`formatVND` / `money`) |

**Cỡ chữ trong Finance.** Div gốc của `FinancePage` mang class `c-fin`
(globals.css): `text-xs` bên trong là 13px, cỡ viết cứng 9–11px lên 12px, nhãn
VIẾT HOA lên 11px. Viết chữ phụ mới thì dùng `text-xs`, đừng viết
`text-[10px]`/`text-[11px]`. Chỗ thật sự phải giữ cỡ gốc (số trong ô tròn 16px)
thêm class `c-micro`.
