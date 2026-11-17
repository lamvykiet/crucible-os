# Biểu đồ trong Crucible — quy tắc

Rút từ *Storytelling with Data* (Cole Nussbaumer Knaflic) và bộ kiểm dataviz,
áp vào hệ **Kính** (quyết định 17/11/2026 của chủ dự án — nguồn
`1991-new-design/demo/clean/demo.html`): biểu đồ nằm trong thẻ kính trong, một màu
nhấn xanh ô-liu `--acc`. Đọc hết trước khi vẽ hay sửa biểu đồ; mục 8 là các kiểu
biểu đồ mới của demo.

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
| So sánh nhiều mục (nơi chi, nhóm) | **cột ngang xếp hạng**, nhãn số ở đầu cột | cột đứng với nhãn xoay |
| Phần trong tổng (chi theo nhóm theo tuần/tháng/năm) | **vòng cung rời**: cung dày đầu bo tròn, màu theo nhóm, bong bóng icon ở mỗi cung, tổng lớn ở giữa, ≤ 5 nhóm + "Khác", kèm danh sách số tiền và % cạnh vòng | pie đặc, 3D |
| Hai kỳ cho từng mục | cột kỳ này + **vạch mốc** kỳ trước (kiểu bullet) | hai thanh dài song song |
| Một mục là trọng tâm | **nhấn**: mục đó màu nhấn, còn lại xám | mỗi mục một màu |

Không bao giờ: biểu đồ hai trục Y, 3D, pie đặc, đổ bóng trong biểu đồ.

Ngày 17/11/2026 chủ dự án bỏ luật cấm biểu đồ tròn: cơ cấu theo nhóm vẽ bằng vòng cung rời như bảng trên; tiến độ một đại lượng (đã chi / ngân sách) dùng vòng nhỏ có %.

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

- `VIZ.muted` (xám ấm) cho mọi dữ liệu nền. `VIZ.accent` (xanh ô-liu `--acc`
  `#3d6b2e`; giao diện tối `#a3c47f`) cho ĐÚNG
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
  chi tiêu không tự nó "cam". Màu nhấn (`--acc`) KHÔNG phải màu tốt (`--good`):
  nhấn chỉ chỉ điểm câu chuyện, không bao giờ tô số tốt/xấu. Hai đường cần phân
  biệt: một đường `VIZ.muted`, một đường `VIZ.accent`, ghi nhãn ở điểm cuối.
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
  `.c-chart-multi`/`.c-series-*` (đã gỡ khỏi globals.css).
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
`uppercase` của JSX nay là chữ thường (hệ Kính không viết hoa giãn chữ). Viết chữ phụ mới thì dùng `text-xs`, đừng viết
`text-[10px]`/`text-[11px]`. Chỗ thật sự phải giữ cỡ gốc (số trong ô tròn 16px)
thêm class `c-micro`.

## 8. Kiểu biểu đồ của hệ Kính (từ demo 17/11/2026)

Bốn kiểu dưới đây lấy nguyên từ `demo/clean/demo.html` (CSS ở các khối "BIỂU ĐỒ CỘT
KIỂU VIÊN SỐ", "Vòng ngân sách", "So với ngân sách", "cánh hoa"). Token đã nằm sẵn
trong `globals.css`: `--rg-1..6` (bảng màu mảng/nhóm — mật ong, be đá, xô thơm,
hồng đất, đất nung, xanh tro; tối hạ sáng), `--ref`/`--ref-ink` (đường tham chiếu),
`--vb-fill/-hatch/-acc`, `--vp-bg/-line` (viên số), `--pt-mix/-tint`, `--on-bad/--on-good`.
Số trong biểu đồ dùng `--font-fig` (Inter, tabular-nums). Demo vẽ bằng div/SVG;
sang recharts thì dùng `shape` tuỳ biến, đừng bắt recharts vẽ thứ nó không giỏi.

**Cột "Heart rate" (viên số).** Cột rộng bo 14px, sát nhau (khe 6px). Cột thường
nền `--vb-fill` + gạch chéo 135° `--vb-hatch`; ĐÚNG MỘT cột nhấn tô `--vb-acc`.
Trên đỉnh mỗi cột có **viên số** nổi (`--vp-bg`, cao 28px, bo 14px, số đậm 600,
đơn vị nhạt) chồng lên đỉnh; viên của cột nhấn đặc `--acc` chữ `--acc-ink`. Đường
tham chiếu (ngân sách ngày, trung bình): nét đứt 1,5px `--ref`, viên nhãn đặc
`--ref` chữ `--ref-ink` nằm ở mép trái NGOÀI vùng cột để không đè viên số. Không
kẻ lưới; nhãn trục 13px. Cột kỳ chưa trọn: không tô, chỉ viền đứt `--dash`. Từ
767px trở xuống cuộn ngang trong thẻ, mỗi cột ≥ 60px.

**Vòng cung rời (cơ cấu).** 100% vòng = ngân sách (hoặc tổng) của kỳ; mỗi cung =
phần của một nhóm, đầu bo tròn, có khe; phần chưa dùng chỉ còn rãnh `--bar2`. Màu
cung theo `--rg-*` (≤ 5 nhóm + "Khác"), bong bóng icon ở mỗi cung, số % lớn ở giữa
(`28cqw`, Inter). Cạnh hoặc dưới vòng là danh sách: chấm màu · tên · số tiền · %.

**Vòng tiến độ nhỏ (So với ngân sách).** Vòng 32px = tiến độ MỘT đại lượng (đã chi
/ ngân sách của nhóm), không phải cơ cấu. Rãnh `--bar`, phần đạt tô màu nhóm, vạch
mực = nhịp ngày. Bên cạnh là `%` đậm và trạng thái có chấm 6px: bình thường xám,
gần ngưỡng `--warn-t`, vượt `--bad-t` đậm kèm chữ "vượt" (không dựa riêng vào màu).

**Cánh hoa (ngân sách / mục tiêu theo nhóm).** Mỗi nhóm một cánh quạt góc bằng nhau.
Lớp ngoài mờ (`opacity: var(--pt-tint)`) = 100% ngân sách/mục tiêu; lớp trong đậm
mọc từ tâm với bán kính `r = r0 + (R − r0)·√f`, nên DIỆN TÍCH tỷ lệ với %, không
phải bán kính. Chữ luôn `--ink` (≥ 4.5:1 trên cả lớp mờ và lớp đậm); riêng cánh
vượt ngân sách chi tô `--bad`, vượt mục tiêu thu tô `--good`, chữ lúc đó là
`--on-bad` / `--on-good`. Có công tắc Chi phí / Doanh thu. Chưa có số liệu: cánh mờ
+ một câu nói việc tiếp theo + một nút — không số 0 làm nội dung chính.
