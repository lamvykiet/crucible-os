# Hướng thiết kế — rà soát 26/09/2026

> **Cập nhật 17/11/2026 — hệ "Kính" (một lớp) thay v3.** Quyết định của chủ dự án,
> nguồn sự thật DUY NHẤT: `1991-new-design/demo/clean/demo.html` (commit 55a9223)
> cùng các ảnh cạnh nó. Hai ghi chú bên dưới (v3 19/10 và rà soát 26/09) giữ lại
> để biết vì sao từng chọn khác; khi lệch nhau thì ghi chú này và demo đúng.
>
> | v3 "Mật ong & Bạch đàn" (19/10) | Hệ Kính (17/11) |
> |---|---|
> | Hai tầng: phông cảnh hoàng hôn + tấm nền kem soft UI | MỘT lớp: gradient ấm cố định (đất nung, mật ong, rêu), không ảnh; mọi thứ nằm thẳng trên nền |
> | Soft UI trên tấm nền (bóng kép, ô nhập lõm) | Thẻ là KÍNH trong (trắng ~35% sáng / ~7% tối, blur ở `::before`, viền sáng); khối con là tint phẳng; điều khiển nhỏ là Liquid Glass |
> | Mật ong `#542a08` hành động + Bạch đàn pastel | Một màu nhấn xanh ô-liu `#3d6b2e`; nút chính và tab đang chọn là viên mực `#1c1b19` |
> | Bricolage Grotesque viết hoa + Playfair | MỘT family Be Vietnam Pro (số mượn Inter để có tabular-nums); không serif, không viết hoa giãn chữ |
> | Sidebar kính cao hết màn, tab con nằm trong sidebar | Sidebar nổi dạng rail 64px (rê bung, ghim, ô tìm, cây hoá đơn chờ duyệt); tab con lên đầu nội dung; thanh trên có ô "Hỏi Crucible…" |
> | KHÔNG dock dưới (gỡ 23/10/2026) | CÓ dock thao tác nhanh giữa đáy (điện thoại tự ẩn khi lướt) + menu "+" nối modal thật |
> | Tốt = xanh lá, xấu = đỏ | Giữ; thêm bản chữ đậm `--good-t`/`--bad-t` cho chữ trên kính |
> | Cấm biểu đồ tròn | Bỏ luật cấm (17/11): vòng cung rời, vòng tiến độ, cánh hoa, cột "Heart rate" — xem `docs/bieu-do.md` mục 8 |
>
> Việc nằm lại cho đợt B: dựng lại Tổng quan, Tài chính (thẻ số có `GlassIcon`,
> các biểu đồ mới, đưa nút Quét/Thêm giao dịch của `DashboardTab` lên dải tab qua
> `<PageActions>`); các function còn lại tự ăn token nhưng chưa dựng lại bố cục.

> **Đã thay bằng v3 "Mật ong & Bạch đàn" — quyết định của chủ dự án ngày
> 19/10/2026**, sau 3 vòng demo. Nguồn sự thật: skill `1991-new-design/SKILL.md`
> (demo `1991-new-design/demo/index.html`, công thức `crucible-v3.css`).
>
> Những gì v3 đảo ngược so với bản rà soát dưới đây:
>
> | Trước | v3 |
> |---|---|
> | Kính trong 17% trên nền ambient (08/10) | Hai tầng: phông cảnh hoàng hôn + widget kính ở đầu trang; tấm nền kem soft UI bên dưới |
> | Neumorphism / Soft UI 2.0 — "Không theo" | **Theo**, nhẹ tay: thẻ cùng màu nền, bóng kép; ô nhập và rãnh tab lõm |
> | Một màu đất nung `#b05a36` | Mật ong (`#542a08` hành động) + Bạch đàn (ô pastel theo mảng) |
> | Serif Newsreader + chữ nghiêng, sans Inter | Bricolage Grotesque 800 viết hoa cho tiêu đề lớn, Playfair cho mọi chữ và số; không nghiêng |
> | Màu ngữ nghĩa họ đất (rêu, đất nung) | Tốt = xanh lá, xấu = đỏ, luôn kèm ▲/▼ |
>
> Phần còn lại của file giữ để biết vì sao từng chọn khác — các mục
> "Hyper-clarity", chuyển động, micro-personalization vẫn đúng.

Tra Pinterest ngày 26/09/2026 với các truy vấn "ui design trends 2026",
"warm minimal app ui 2026 soft ui". Đây là bản đối chiếu giữa những gì đang
thịnh hành và những gì Crucible đang làm — kèm quyết định giữ, sửa, hay cố ý
không theo.

## Kết luận ngắn

**Ngôn ngữ thị giác của Crucible KHÔNG lạc hậu.** Nó đang đi đúng hai xu hướng
lớn nhất của 2026. Chỗ thật sự cũ là **lối tương tác**, không phải màu sắc hay
kiểu chữ.

## Đối chiếu từng xu hướng

| Xu hướng 2026 | Crucible | Quyết định |
|---|---|---|
| Warm UI & giao diện mang cảm xúc người | Đã có: giấy kem `#fef9ef`, đất nung `#b05a36` | **Giữ nguyên.** Đây đang là hướng thịnh, không phải hướng cũ. |
| Fluid typography | Đã có: cả thang chữ dùng `clamp()` | **Giữ nguyên.** |
| Hyper-clarity (thời của "không mập mờ") | Còn chỗ hở | **Sửa dần.** Xem mục dưới. |
| Motion-driven interfaces | Chỉ có 2 keyframe, đổi trạng thái không có phản hồi | **Bổ sung.** Đây là khoảng trống thật. |
| Micro-personalization | Chưa có "tiếp tục chỗ đang dở" | **Bổ sung.** |
| Spatial UI / lớp chiều sâu bằng bóng đổ | Cố ý cấm bóng | ~~Không theo.~~ **Đã đổi 08/10/2026** — xem mục "Lớp kính" cuối file. |
| Neumorphism / Soft UI 2.0 | Xung đột với luật trên | **Không theo.** |

## Vì sao không theo bóng đổ và neumorphism (quyết định cũ, đã thay 08/10/2026)

`AGENTS.md` quy định: *"độ nổi đến từ bậc màu chứ không từ bóng"*. Đây là một
lựa chọn có chủ đích, không phải thiếu sót. Hệ thiết kế của dự án dựng trên ẩn dụ
**giấy** — thẻ giấy cũ nằm trên nền giấy kem. Giấy không phát sáng và không nổi
lơ lửng; nó chỉ khác sắc. Đắp bóng đổ hay neumorphism lên đó là trộn hai ẩn dụ
không hợp nhau, và sẽ làm hỏng chính thứ khiến hệ này có bản sắc.

Chiều sâu trong hệ này đến từ ba bậc màu: nền `#fef9ef` → thẻ `#f5eee1` → viền
taupe `#d1c9bf`. Ngoại lệ duy nhất vẫn giữ: modal và ô nhập đang gõ được phép có
bóng, vì chúng thật sự nổi lên trên mặt phẳng.

## "Hyper-clarity" — nghĩa là gì ở dự án này

Mọi thứ trên màn phải nói đúng việc nó làm. Ba lỗi đã bắt được, dùng làm mẫu:

1. **Nhãn nói dối.** Nút "Mở bộ thẻ" trên thẻ ngôn ngữ, bấm vào lại ra bảng kỹ
   năng. Đã bỏ hẳn nút; giờ bấm cả thẻ.
2. **Số 0 thay cho hướng dẫn.** Thẻ hiện "0 bộ thẻ · 0 từ" cho người mới — vừa
   vô nghĩa vừa làm nản. Đã đổi thành "Chưa bắt đầu — bấm vào để mở".
3. **Nút thừa cạnh hành động chính.** Thẻ chỉ có một việc để làm thì không cần
   nút riêng; bấm cả thẻ.

Khi làm màn mới, soát ba câu hỏi: *nhãn này có đúng đích đến không? người mới
nhìn thấy gì? có nút nào thừa không?*

## Chuyển động — khoảng trống thật, và giới hạn của nó

Trước rà soát này chỉ có hai keyframe: `c-enter` (vào màn) và `c-tick` (số đổi).
Đổi trạng thái — chấm đúng, chấm sai, tiến độ nhích lên — không có phản hồi nào.

Bổ sung `c-pop` và `c-nudge`, nhưng có ba ràng buộc:

- **Phải dùng `backwards`, không dùng `both`.** Keyframe giữ lại `transform` ở
  khung cuối sẽ biến phần tử thành khối chứa của `position: fixed`, làm lớp phủ
  modal co vừa khung nội dung và nút lưu rớt ra ngoài. Bẫy này đã ghi trong
  `AGENTS.md` và từng xảy ra thật.
- **Khung cuối phải bằng giá trị mặc định** (`transform: none`), để không nhảy
  hình khi animation kết thúc.
- **Tôn trọng `prefers-reduced-motion`.** Người bật giảm chuyển động thì tắt hết.

Chuyển động ở đây để **xác nhận một việc vừa xảy ra**, không phải để trang trí.
Không animate thứ người dùng không vừa tác động vào.


## Rà soát lượt hai — đối chiếu với một style guide (26/09/2026)

Tham chiếu: pin "Style guides AI design" (ReadyMade Interfaces), pin app đặt cà
phê tông kem, và pin app dựng nhịp trống.

**Xác nhận lại:** cả hai app tham chiếu đều dùng tông kem/nâu ấm, chữ display
thanh, ít chrome — cùng hướng với Crucible. Lưới ô trạng thái của app nhịp trống
trùng đúng lối dải ô câu đã dùng ở phần chép chính tả.

**Lấy được từ style guide:** bảng thành phần của nó liệt kê đủ những thứ một hệ
thiết kế cần có, và đối chiếu ra ba chỗ Crucible còn thiếu:

| Thành phần | Crucible |
|---|---|
| Modal xác nhận hành động nguy hiểm | Chỉ có `window.confirm` của trình duyệt |
| Toast stack | Chưa có — lỗi và thành công đều báo bằng `c-alert` tại chỗ |
| Skeleton rows | Chưa có — mọi chỗ chờ đều là vòng xoay |

**Đã xử lý — nút xoá thứ tiếng.** Bỏ hẳn nút Xoá khỏi thẻ ngôn ngữ. Thẻ là lối
vào môn học, bị chạm rất nhiều lần mỗi ngày; đặt một hành động không hoàn tác
được ngay cạnh đó thì sớm muộn cũng có lần bấm nhầm, và `window.confirm` trên
điện thoại quá dễ gạt qua.

Thay bằng chế độ **Sửa danh sách** phải bật rõ ràng. Trong chế độ đó thẻ KHÔNG
còn dẫn đi đâu nữa — nếu thẻ vừa xoá được vừa mở được thì lại sinh ra một kiểu
bấm nhầm khác.

Quy tắc rút ra, áp cho cả dự án: **hành động không hoàn tác được thì không đứng
chung chỗ với hành động dùng hằng ngày.** Phải qua một chế độ, hoặc một lớp xác
nhận thật, không phải một hộp thoại gạt một cái là xong.

## Việc còn lại

- [ ] Surface "tiếp tục chỗ đang dở" ở Learning Hub — hiện chưa có lối vào nhanh
      nào cho việc đang làm dở.
- [ ] Soát lại toàn bộ trạng thái rỗng của Knowledge và Finance theo mục
      hyper-clarity ở trên.
- [ ] Vùng chạm: đã bắt được một nút 31px trên thẻ ngôn ngữ. Nên soát cả dự án,
      chuẩn là 44px.
- [ ] Dựng `c-toast` — hiện mọi thông báo đều là `c-alert` chèn tại chỗ, nên
      thao tác thành công ở cuối trang thì người dùng không thấy gì.
- [ ] Dựng skeleton thay vòng xoay ở những chỗ biết trước hình dạng nội dung.
- [ ] Soát cả dự án: còn chỗ nào đặt nút xoá cạnh hành động dùng hằng ngày.

## Lớp kính — đổi hướng 08/10/2026

Người dùng gửi một loạt pin Pinterest kiểu visionOS / spatial UI (bảng điều
khiển kính mờ nổi trên ảnh nội thất mờ) và yêu cầu chỉnh độ trong suốt giống
vậy. Đây là quyết định của chủ dự án, thay cho mục "không theo" ở trên.

Cách làm — giữ bản sắc, chỉ đổi vật liệu:

- **Nền "phòng"** `--ambient`: vài quầng màu rất rộng — đất nung góc trên
  trái, xanh tro góc trên phải, rêu góc dưới — trên nền đá ấm. Thay cho ảnh
  nội thất mờ của bản tham chiếu: không tải ảnh, không vướng bản quyền, và
  vẫn cùng họ màu đất của hệ. Bảng tối là cùng các quầng đó hạ xuống đêm.
- **Kính**: mọi bậc mặt phẳng là trắng ấm trong suốt; viền là đường sáng
  `--glass-edge` chứ không còn viền taupe; một ánh sáng chéo nhạt
  (`--card-sheen`) và một bóng rộng mềm.
- **Đang chọn**: viên kính trắng đục, chữ mực — đúng cách của bản tham chiếu.
  Đất nung rút về nút chính, nhãn mắt, điểm nhấn dữ liệu.
- **Giữ nguyên**: serif biên tập, thang chữ, màu ngữ nghĩa họ đất, quy tắc
  biểu đồ (`docs/bieu-do.md`).

Hai ràng buộc kỹ thuật:

1. **Không `backdrop-filter` trên thẻ hay tấm modal** — nó thành khối chứa của
   `position: fixed` (cùng cái bẫy với `transform`, xem `AGENTS.md`). Phía sau
   thẻ chỉ có nền ambient vốn đã mờ, nên không mất gì.
2. **Thứ đè lên nội dung khác thì gần đục** (`--glass-solid`): modal, menu thả,
   tooltip biểu đồ, cột dính của bảng. Kính trong suốt ở đó làm chữ hai lớp
   đọc lẫn vào nhau.
