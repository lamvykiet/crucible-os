# Xu hướng UI/UX — rà soát 17/11/2026 (từ 8 pin chủ dự án chọn)

Nguồn: 8 ảnh Pinterest chủ dự án gửi ngày 17/11/2026, đối chiếu với các tra cứu
xu hướng 2026 trước đó (Liquid Glass của Apple trên iOS 26, glassmorphism dùng
chọn lọc cho card/toggle/widget, bento grid). Chấm điểm theo thang của
`crucible-trend-scout`: Hợp vấn đề · Hợp hệ · Công sức · Độ chín (mỗi mục 1–3).

## Kết luận ngắn

Chủ dự án đang nghiêng về ba thứ: **điều hướng hai tầng thu gọn được**, **chỉ
số dạng vòng/đồng hồ có câu trạng thái**, và **vật liệu kính lỏng cho control
nhỏ**. Cả ba hợp hệ Sương sớm và Crucible đã có nền móng (sidebar rail + panel,
`ModuleTabs` rail chỉ hiện chữ ở tab đang chọn). Khoảng trống lớn nhất mà các pin
gợi ra: **con số chưa có "câu trạng thái"** và **việc cần làm (28 hoá đơn chờ
duyệt) chưa có chỗ thường trực**. Ba việc nên làm trước: (1) widget ngữ cảnh ở
đáy sidebar, (2) đồng hồ điểm có câu trạng thái, (3) tab rail nở chip theo màu mảng.

## Hiện trạng Crucible (liên quan tới các pin)

- Sidebar kính: rail 68px, rê chuột bung panel 248px đè nội dung, ghim thì đẩy
  nội dung; nhóm Function · tab con · Hệ thống · thẻ người dùng.
- Điện thoại: `MobileTopBar` hai hàng, hàng dưới là tab con chỉ icon, tab chọn
  hiện chữ. **Không có dock đáy** (gỡ 23/10/2026 theo yêu cầu chủ dự án).
- Biểu đồ: `docs/bieu-do.md` cấm pie/donut, xám mặc định, 4 màu danh mục đã kiểm mù màu.
- Màu tốt/xấu: xanh lá / đỏ, kèm ▲/▼. Bảng nhận diện Sương sớm tránh xanh lá bão hoà.
- Toggle sáng/tối hiện là một dòng trong nhóm Hệ thống của sidebar.

## Bảng xu hướng

| # | Pin | Xu hướng | Crucible hiện tại | Điểm (vấn đề/hệ/công/chín) | Kết luận |
|---|---|---|---|---|---|
| 1 | Statistics (All cards), nền tối | **Vòng đoạn bo tròn** (segmented pill ring): mỗi danh mục một đoạn dày bo tròn, có khe, tổng ở giữa | Cấm donut cho cơ cấu | Cơ cấu: 2/1/2/2 = 7 · Tiến độ một đại lượng: 2/3/2/2 = 9 | Cơ cấu: **Không theo** · Tiến độ: **Thử trong demo** |
| 2 | Time Tracker xanh | **Thẻ hero nền gradient mờ** (ảnh bokeh) + **đồng hồ tròn có vạch chia** + nút dừng/tạm dừng nổi | Bấm giờ ở Thói quen/Tập trung chưa có mặt đồng hồ | 2/2/2/2 = 8 | **Thử trong demo** (đổi xanh → sương rêu/nắng) |
| 3 | Toggle "Light" | **Liquid Glass cho control nhỏ**: núm kính khúc xạ, bóng mềm | Toggle sáng/tối là dòng chữ | 1/3/2/3 = 9 | **Thử trong demo** |
| 4 | Score UI 60 "Stable state" | **Đồng hồ nửa vòng + câu trạng thái + lời khuyên ngắn** | Số trần, không có câu trạng thái; empty state là số 0 | 3/3/2/3 = 11 | **Áp dụng** |
| 5 | Sidebar Menu hai cột | **Sidebar hai tầng**: rail icon ↔ panel có cây con (đường dẫn dọc), mục đang chọn là viên đặc | Đã có rail + panel; tab con chưa có đường cây | 2/3/2/3 = 10 | **Áp dụng** (phần cây con) |
| 6 | ReSync trên nền ảnh ấm | **Widget ngữ cảnh ở đáy sidebar** (vòng dung lượng, add-ons), sidebar kính trắng trên phông ảnh | Thẻ người dùng ở đáy; việc chờ xử lý chỉ là badge | 3/3/2/3 = 11 | **Áp dụng** |
| 7 | Finance sidebar + thẻ Upgrade | Sidebar thu gọn cơ bản + thẻ quảng cáo gói gradient xanh | Đã có phần thu gọn | 1/1/3/3 = 8 | **Không theo** — app cá nhân không có gói; gradient xanh lệch hệ |
| 8 | Bottom Menu (Syed Yaseen) | **Tab viên nở chip**: tab đang chọn nở ra có chữ và nền tint theo màu riêng | `ModuleTabs` rail đã hiện chữ ở tab chọn nhưng chưa có tint theo mảng | 2/2/3/3 = 10 | **Áp dụng** — trên rail ở trên cùng, KHÔNG làm dock đáy |

Xếp theo độ "nóng" hiện nay (mức xuất hiện trên sản phẩm thật 2026): #3 Liquid
Glass control > #4 điểm có câu trạng thái > #5/#6 sidebar hai tầng có widget >
#8 tab nở chip > #2 hero gradient mờ + đồng hồ tròn > #1 vòng đoạn bo tròn
(rất phổ biến trên Dribbble nhưng yếu về đọc số liệu) > #7 thẻ upgrade (phổ
thông, không còn tạo khác biệt).

## Gợi ý chi tiết

### #4 Đồng hồ điểm có câu trạng thái — Áp dụng
- Áp vào: widget kính `SceneSummary` của Sức khoẻ (phục hồi), Tài chính (ngân
  sách đã dùng), Học tập (tiến độ tới ngày thi); thẻ "Budget used" trong
  `DashboardTab`.
- Trông thế nào: nửa vòng nét dày, đầu tròn, số lớn ở giữa, **dưới số là câu
  trạng thái 2–4 chữ** ("Ổn định", "Sắp vượt ngân sách", "Chưa đủ dữ liệu") và
  một dòng lời khuyên ngắn có số.
- Màu: nền vòng `--viz-ghost`, phần đã đạt `--viz-accent`; chỉ khi điểm mang
  nghĩa tốt/xấu mới dùng `--good`/`--bad` và kèm ▲/▼. Không gradient xanh như pin.
- Rủi ro: câu trạng thái phải tính từ dữ liệu và có ngưỡng "chưa đủ dữ liệu"
  (xem mục Dự báo trong skill); vòng SVG đặt `role="img"` + `aria-label`.

### #6 Widget ngữ cảnh ở đáy sidebar — Áp dụng
- Áp vào: `src/components/Sidebar.tsx`, phía trên thẻ người dùng.
- Nội dung theo function đang mở: Tài chính → "28 hoá đơn chờ duyệt" + nút
  Duyệt; Học tập → "12 thẻ đến hạn"; Thói quen → vòng % hôm nay. Rail thu gọn
  chỉ hiện vòng nhỏ + số.
- Rủi ro: kính ở `::before`; số lấy từ API đã có (`PendingReviewButton`), không
  gọi thêm API mới khi chưa duyệt.

### #5 Cây tab con trong sidebar — Áp dụng
- Áp vào: `ModuleTabs` (biến thể `side`).
- Tab con thụt vào, có đường dọc mảnh `--line` nối các mục, mục đang chọn là
  viên `--action`. Giữ đọc danh sách từ `src/lib/modules.tsx`.

### #8 Tab rail nở chip theo màu mảng — Áp dụng
- Áp vào: `ModuleTabs` (biến thể `rail`) trên `MobileTopBar` và rail sidebar.
- Tab chọn: viên nền tint của mảng (ô Tài chính/Sức khoẻ/Học tập/Thói quen
  trong skill) + chữ `--ink`; chuyển động `duration-base`, tôn trọng
  `prefers-reduced-motion`. Vị trí giữ ở trên — không thêm dock đáy.

### #3 Liquid Glass cho toggle sáng/tối — Thử trong demo
- Áp vào: nút sáng/tối trong nhóm Hệ thống của sidebar và `MobileTopBar`.
- Núm kính tròn có viền sáng + bóng mềm, trượt trên rãnh lõm. Chỉ dùng cho
  1–2 control nổi bật, không trải khắp app (tốn GPU, rối mắt).
- Rủi ro: `backdrop-filter` đặt ở `::before`; tương phản icon ≥ 3:1 ở cả hai theme.

### #2 Hero gradient mờ + đồng hồ bấm giờ — Thử trong demo
- Áp vào: `src/app/habits/timer`, `src/app/learning/focus`.
- Nền thẻ là ảnh phông Sương sớm làm mờ (hoặc gradient sương rêu → nắng), vòng
  thời gian có vạch chia, nút dừng/tạm dừng là nút kính lớn ≥ 56px.
- Rủi ro: luật v3 "không gradient trên thẻ tấm nền" → đặt thẻ này trong
  `SceneHero` (phông cảnh), không trên tấm nền kem.

### #1 Vòng đoạn bo tròn — Thử trong demo (chỉ cho tiến độ)
- Chỉ dùng cho MỘT đại lượng chia đoạn có nghĩa: ví dụ 7 đoạn = 7 ngày thói
  quen trong tuần, 4 đoạn = 4 kỹ năng ngoại ngữ. Không dùng cho cơ cấu chi tiêu.

## Không theo — và vì sao

- **Vòng đoạn cho cơ cấu chi tiêu (#1):** 9 màu vượt 4 màu danh mục đã kiểm mù
  màu; khó so độ dài cung; chính pin cho thấy "Other" chiếm ~81% — biểu đồ đẹp
  nhưng không trả lời "tiền đi đâu". Giữ thanh xếp hạng (`RankBar`) theo `docs/bieu-do.md`.
- **Thẻ nâng cấp gói (#7):** app cá nhân không có gói trả phí; gradient xanh
  dương lệch bảng màu.
- **Dock dưới đáy (#8 nguyên bản):** chủ dự án đã gỡ ngày 23/10/2026; chỉ lấy
  kiểu "nở chip" áp lên rail ở trên.
- **Xanh lá bão hoà làm màu nhận diện (#2, #4):** bảng Sương sớm chỉ dùng xanh
  đã ngả xám; xanh lá chỉ cho `--good`.

## Đề xuất đưa vào kế hoạch — ĐÃ DUYỆT 17/11/2026 (giữ cả 6 pattern)

- [x] **P1b · Sidebar:** widget ngữ cảnh ở đáy (#6) + cây tab con (#5) — làm cùng P1
- [x] **P1c · Tab rail nở chip theo màu mảng (#8)** — làm cùng P1
- [x] **P11 · Đồng hồ điểm có câu trạng thái (#4)** — component dùng chung
      `src/components/charts/ScoreGauge.tsx`, áp cho Tài chính, Sức khoẻ, Học tập
- [x] **P12 · Thử nghiệm:** toggle Liquid Glass (#3), mặt đồng hồ bấm giờ (#2),
      vòng đoạn cho tiến độ (#1) — mỗi thứ một demo để so

Chủ dự án đã cho phép ngoại lệ "vòng chia đoạn cho tiến độ một đại lượng". Demo đã duyệt: `1991-new-design/demo/suong-som/pins-17-11.html`.

## Nguồn

- 8 pin chủ dự án gửi trong chat ngày 17/11/2026 (Pinterest; tác giả gồm Syed
  Yaseen trên Behance, webdesign.uiux, và các shot "Elements", "ReSync").
- Các nguồn xu hướng 2026 đã tra ngày 15/11/2026: DesignRush "Web Design
  Trends 2026", Setproduct "Glassmorphism, neumorphism, liquid glass: what to use
  in 2026", The Plus Addons "Web Design Trends 2026", Wildnet Edge "Top UI/UX Trends 2026".
