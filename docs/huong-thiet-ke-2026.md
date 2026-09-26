# Hướng thiết kế — rà soát 26/09/2026

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
| Spatial UI / lớp chiều sâu bằng bóng đổ | Cố ý cấm bóng | **Không theo.** Xem lý do dưới. |
| Neumorphism / Soft UI 2.0 | Xung đột với luật trên | **Không theo.** |

## Vì sao không theo bóng đổ và neumorphism

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

## Việc còn lại

- [ ] Surface "tiếp tục chỗ đang dở" ở Learning Hub — hiện chưa có lối vào nhanh
      nào cho việc đang làm dở.
- [ ] Soát lại toàn bộ trạng thái rỗng của Knowledge và Finance theo mục
      hyper-clarity ở trên.
- [ ] Vùng chạm: đã bắt được một nút 31px trên thẻ ngôn ngữ. Nên soát cả dự án,
      chuẩn là 44px.
