# Kế hoạch thiết kế lại Crucible OS — "Sương sớm" (v4)

Lập ngày 16/11/2026 từ: ảnh chụp màn Home và Tài chính (bản deploy
`crucible-os-zeta.vercel.app`, chế độ EN), mã nguồn nhánh `main` (`2a9e37c`, 14/11/2026),
các gợi ý xu hướng đã bàn với chủ dự án, và bảng màu "Sương sớm" chủ dự án
chọn. Design system: `.claude/skills/suong-som-design/SKILL.md`. Người thực hiện:
subagent `crucible-ui-redesigner`.

**Cách dùng:** mỗi lần giao cho agent ĐÚNG MỘT mục (ví dụ "làm P2"). Agent làm
demo → chủ dự án duyệt → agent sửa code → đánh dấu `[x]` và ghi hash commit.

## Quyết định đã chốt (đừng hỏi lại)

- Bảng màu nhận diện và phông cảnh: **Sương sớm** (16/11/2026).
- Màu số liệu: **giữ nguyên** `--good` xanh lá / `--bad` đỏ, kèm ▲/▼.
- Giữ cấu trúc hai tầng, sidebar kính (13/11/2026), không dock đáy điện thoại,
  font Bricolage + Playfair.
- Mọi đổi giao diện: demo trước, sửa code sau.
- **17/11/2026:** giữ cả 6 pattern từ pin (sidebar cây tab con, widget ngữ cảnh,
  tab nở chip, đồng hồ điểm, toggle kính lỏng, mặt đồng hồ bấm giờ, vòng chia đoạn
  cho tiến độ). Demo đã duyệt: `1991-new-design/demo/suong-som/pins-17-11.html`;
  đặc tả: skill mục 7. Các mục P1b, P1c, P11, P12 **không cần demo lại**.

## Cần chủ dự án quyết trước khi làm mục liên quan

| # | Câu hỏi | Ảnh hưởng | Đề xuất |
|---|---|---|---|
| Q1 | Ảnh phông cảnh: dùng ảnh nào? (ảnh Pinterest có watermark, không đưa vào repo) | P0 | Chủ dự án tự chụp hoặc lấy ảnh có giấy phép (Unsplash) cùng không khí; chưa có thì chạy gradient dự phòng |
| Q2 | Ngôn ngữ mặc định | P1 | Mặc định `vi`, nút EN vẫn giữ |
| Q3 | Số trong widget kính vẫn dùng serif Playfair? | P1 | Giữ Playfair cho chữ, cân nhắc thử số bằng Bricolage ở widget kính trong demo P1 để so |


---

## P0 · Nền móng: token + phông cảnh — `[x]` (`d7129f6`)

**Trạng thái 17/11/2026:** xong. Demo token `afd9477` được duyệt ("duyệt, sửa
code"); ảnh phông `373989e`; token vào `globals.css` ở `d7129f6` (nhánh
`ui/suong-som-p0`). Câu hỏi mở đã quyết: Q1 dùng `public/scene/suong-som.jpg`,
Q2 giữ ngôn ngữ như cũ, Q3 số trên widget kính là Playfair (A), Q4 giữ
Bricolage + Playfair, Q5/Q7/Q8 được chỉnh token để đạt tương phản (đo trên pixel
thật của ảnh — mọi giá trị lệch ghi trong skill, "chỉnh 17/11/2026"), Q6 nhận
giá trị SUY RA của theme tối với `--glass-edge` tối `.22`. Không sửa file JSX
nào. Còn lại cho các mục sau: `themeColor` `#cfc9d6` (màu trời v3) trong
`src/app/layout.tsx` — P1; delta tốt trên ô Tài chính/Thói quen 3.98–4.26:1
(`.c-tile` chưa dùng trong JSX) — P2; trang đăng nhập — P9.

**Việc:**
1. Demo `1991-new-design/demo/suong-som/tokens.html`: bảng màu, 4 ô pastel,
   nút, tab, switch, thẻ soft UI, widget kính trên phông, delta tốt/xấu, một
   biểu đồ cột — cả sáng và tối.
2. Sau duyệt: đổi token trong `src/app/globals.css` theo mục 2–3 của skill.
   Không đổi tên token, không đụng phần còn lại của file.
3. Đặt ảnh vào `public/scene/suong-som.jpg` (nếu Q1 đã có ảnh).
4. Cập nhật `AGENTS.md` mục "Trước khi đổi giao diện" và "Design system v3":
   ghi v4 Sương sớm thay phần màu/phông, trỏ tới skill mới; cập nhật bảng đầu
   `docs/huong-thiet-ke-2026.md`.

**Xong khi:** mọi trang đổi màu mà không sửa file JSX nào; checklist QA của
skill đạt ở sáng/tối; `git diff --stat` chỉ có `globals.css`, `public/scene/`,
tài liệu.

## P1 · Vỏ giao diện: SceneHero, Sidebar, MobileTopBar — `[ ]`

File: `src/components/Scene.tsx`, `SceneSummary.tsx`, `Sidebar.tsx`,
`MobileTopBar.tsx`, `MainLayoutWrapper.tsx`, `globals.css` (phần `.c-scene`, `.c-side`).

Vấn đề thấy trên ảnh:
- Tên function cỡ display ("HOME", "FINANCE") cộng câu tiêu đề chiếm ~1/3 màn
  đầu; thẻ thứ hai trở đi bị đẩy xuống dưới màn.
- Quả cầu vàng trong widget lớn là trang trí, không mang thông tin.
- Đơn vị số dạng chỉ số trên (`530.8ᵐ`, `15ᵏ`, `0ᵈ`) khó đọc; số và đơn vị nên
  cùng dòng theo vi-VN (`530,8 tr ₫`).
- Vạch ngang "——" thay số khi chưa có dữ liệu (Cash flow, góc widget).
- Chuyển từ phông sang tấm nền là một dải nâu đậm cứng — với ảnh sương sớm
  dải này phải là veil mềm.
- Avatar "C" ở đáy sidebar trùng logo "C" ở đầu → dùng ảnh/chữ cái tên người dùng.

**Xong khi:** phông ≤ 46vh ở 1280px; thẻ đầu tiên của tấm nền lọt màn đầu ở
1280×800; không còn đơn vị chỉ số trên; widget kính không còn phần tử trang trí
không nghĩa; demo được duyệt.

## P1b · Sidebar: cây tab con + widget ngữ cảnh — `[ ]` (demo đã duyệt)

File: `Sidebar.tsx`, `ModuleTabs.tsx` (side), component mới `SidebarContextWidget.tsx`.
Đặc tả: skill 7.1, 7.2.
**Xong khi:** giống demo ở 1280px; rail thu gọn có vòng + số; widget Tài chính
mở được hàng duyệt hoá đơn; function chưa có API thì widget ẩn và có ghi chú
trong báo cáo; lint/tsc sạch.

## P1c · Dải tab nở chip theo màu mảng — `[ ]` (demo đã duyệt)

File: `ModuleTabs.tsx` (rail), `MobileTopBar.tsx`, `globals.css` (thêm token
màu ô của Knowledge nếu chưa có). Đặc tả: skill 7.3.
**Xong khi:** đúng màu mảng ở cả 5 function, sáng và tối; 375px không tràn;
không có dock đáy.

## P2 · Tổng quan (`src/app/page.tsx`) — `[ ]`

Vấn đề:
- Câu tiêu đề "Nothing left for today" đúng nhưng chiếm chỗ lớn trong khi cả
  màn chỉ toàn số 0.
- Lặp: Cash flow ở widget kính và ở thẻ Finance OS; Documents ở 3 nơi
  (Today, Forgotten documents, Knowledge Hub).
- Thẻ "Finance OS · Unavailable" — chữ "Unavailable" không nói lý do và không có
  việc để làm.
- 8 số 0 làm nội dung chính.

Hướng sửa: bento một mảng một ô (Tài chính · Học tập · Thói quen · Sức khoẻ ·
Knowledge). Mỗi ô: một chỉ số chính + so kỳ trước + một hành động. Ô không có
dữ liệu thu thành một dòng hướng dẫn. Widget kính trên phông chỉ giữ 3 thứ cần
nhìn trong ngày: việc hôm nay (% xong), dòng tiền tháng, thẻ ôn đến hạn.

**Xong khi:** không con số nào lặp; không còn "Unavailable"/"—"; mỗi ô có một
hành động; demo được duyệt.

## P3 · Tài chính › Tổng quan (`FinanceScene`, `DashboardTab`, `WeekPanel`, `TodaySpendingShare`, `PeriodComparison`, `MonthBreakdown`) — `[ ]`

Vấn đề thấy trên ảnh (ghi kèm chỗ trong code khi đã tra):
1. **Câu tiêu đề sai khi ít dữ liệu.** "On track to spend 99% less" từ 15k chi
   sau 16 ngày (`FinanceScene.tsx` dòng ~74–84: `pct` tính từ `eomForecast` mà
   không kiểm đủ dữ liệu). Thêm điều kiện đủ dữ liệu (skill mục 6); không đủ thì
   nói "Mới ghi N khoản tháng này".
2. **Việc thật sự cần làm bị chìm:** "Review receipts (28)" nằm cuối hàng nút
   trong khi chính 28 hoá đơn chờ duyệt là lý do số liệu tháng gần 0. Đưa lên
   câu tiêu đề/widget: "28 hoá đơn chờ duyệt — duyệt để số liệu tháng 11 đủ".
3. **Một số liệu xuất hiện 3 lần:** chi tháng 15.000 ₫ ở widget Spending, thẻ
   Spending/Cash out của "This month", và "Nov 2026" trong "Where it goes".
   Thu nhập 0 ₫ lặp 2 lần. Giữ một nơi, nơi khác chỉ còn liên kết.
4. **Tiêu đề lặp:** "FINANCE" trên phông + "OVERVIEW" cỡ display trên tấm nền
   (tab con đã có trong sidebar). Bỏ "OVERVIEW" to; hàng nút hành động đứng một mình.
5. **Hàng 5 nút ngang hàng** (Nov 2026, Add expense, Add income, Scan a receipt,
   Review receipts): giữ 1 nút chính "Thêm khoản chi", gom còn lại vào nút
   phụ/menu; bộ chọn tháng tách sang trái.
6. **Thẻ trống quá to:** Today / Spending share · Today / Today in detail /
   Yesterday in detail / Where this week went — 5 khối cùng nói "chưa có gì".
   Gộp thành một khối "Hôm nay & hôm qua" có empty state một dòng.
7. **Biểu đồ tuần trống vẫn vẽ trục 0–15k** và vạch ngắn lơ lửng ở thứ Sáu →
   không có dữ liệu thì không vẽ trục.
8. **"1 day(s)"** → viết đúng số ít/số nhiều; bản `vi` không cần "(s)".
9. **Thẻ "Budget used 0%"** có hai vạch đánh dấu khó hiểu; "Savings rate —" khi
   chưa có thu nhập → nói lý do một dòng.
10. **Danh sách "By place"** hiện cả dòng 0 ₫ với ▼100% xanh → ẩn dòng 0 của kỳ
    này sau nút "Hiện cả khoản 0"; nhãn chữ hoa toàn bộ (CHI NHÁNH TỔNG CÔNG…,
    BÁCH HÓA XANH) → chuẩn hoá hiển thị dạng tiêu đề, giữ dữ liệu gốc.
11. **Dấu âm** "-15.000 ₫" ở Net cash flow dùng gạch nối → `−`.
12. Biểu đồ "Tue costs most — 252k on average" và "0 so far this week — under a
    typical week of 986k": tiêu đề kết luận đúng chuẩn `docs/bieu-do.md` — **giữ**,
    chỉ đổi màu theo token mới.

**Xong khi:** 12 mục trên xử lý hoặc ghi rõ lý do giữ; không số nào lặp trên
màn; demo được duyệt; lint/tsc sạch.

## P11 · `ScoreGauge` — đồng hồ điểm có câu trạng thái — `[ ]` (demo đã duyệt)

File mới `src/components/charts/ScoreGauge.tsx`; áp vào `DashboardTab` (thẻ
"Budget used"), widget phục hồi Sức khoẻ, tiến độ Học tập. Đặc tả: skill 7.4.
**Xong khi:** ba trạng thái (bình thường, có ngưỡng/delta, chưa đủ dữ liệu)
hiện đúng như demo; câu trạng thái tính từ dữ liệu có ngưỡng ghi trong code.

## P12 · Toggle kính lỏng, mặt đồng hồ bấm giờ, vòng chia đoạn — `[ ]` (demo đã duyệt)

File: nút sáng/tối trong `Sidebar.tsx` + `MobileTopBar.tsx`; `src/app/habits/timer`,
`src/app/learning/focus`; vòng 7 ngày ở Thói quen. Đặc tả: skill 7.5–7.7.
Ghi ngoại lệ vòng chia đoạn vào `docs/bieu-do.md`.
**Xong khi:** toggle đạt tương phản ≥ 3:1 ở cả hai theme; đồng hồ nằm trên phông
cảnh; vòng chia đoạn chỉ dùng cho tiến độ.

## P4 · Tài chính › các tab còn lại — `[ ]`

Thu nhập, Chi tiêu, Nợ, Tài sản, Tài khoản, Dự án, Lịch sử (`src/components/finance/*Tab.tsx`).
Agent soát từ code bằng checklist 6 câu hỏi, liệt kê vấn đề vào đây trước khi
làm demo. Chủ dự án bổ sung ảnh chụp nếu cần.

## P5 · Học tập — `[ ]`

`src/app/learning/**`, `src/components/learning/` (Tổng quan, Ngôn ngữ, Kho thẻ,
Lịch sử, Tiến độ, Tập trung, Không gian). Ưu tiên: thẻ ôn đến hạn + đếm ngược
ngày thi + streak heatmap dùng `--heat-rgb` mới.

## P6 · Thói quen — `[ ]`

`src/app/habits/**`, `src/components/habits/` (Hôm nay, Báo cáo, Lịch tuần,
Nhật ký, Bấm giờ). Ưu tiên: hàng thói quen tự tô theo % (nền hàng là thanh
tiến độ), empty state "chưa có thói quen hôm nay" có nút tạo.

## P7 · Sức khoẻ — `[ ]`

`src/app/health/**`, `src/components/health/` (Tổng quan, Cơ thể, Buổi tập).
Giữ luật sai số `METRICS[k].noise` trong `AGENTS.md`. Có dòng "Không thay thế
tư vấn y khoa" ở nơi hiện chỉ số.

## P8 · Knowledge — `[ ]`

`src/app/knowledge/**`, `src/components/knowledge/`, `src/components/workspace/`
(Tổng quan, Tài liệu, Ý tưởng, Video).

## P9 · Cài đặt, Đăng nhập, Chia sẻ video — `[ ]`

`src/app/settings/`, `src/app/login/`, `src/app/video-share/`.
Đăng nhập (đã xem ảnh 16/11): chữ phụ và placeholder quá nhạt/nhỏ; quầng
gradient bị cắt cứng ở mép thẻ; dòng "Please consume responsibly!" lệch giọng →
bỏ; thẻ "New in" nâu đặc nặng hơn form → hạ xuống.

## P10 · Rà soát cuối — `[ ]`

Chạy lại checklist QA của skill trên mọi trang, sáng/tối, 375/768/1280. Cập
nhật `1991-new-design/` thành tài liệu lịch sử (giữ, ghi "thay bằng v4").
