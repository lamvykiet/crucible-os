# Bot ghi chi tiêu: Telegram + Shortcut iPhone

Ghi chi tiêu không cần mở app. Bạn nhắn tin, gửi tin thoại, gửi ảnh, hoặc chụp hoá đơn bằng Shortcut. Bot gửi lại bản nháp kèm nút **✅ Ghi sổ · ✏️ Sửa · ❌ Huỷ**.

Luồng xử lý vẫn là **nháp rồi mới duyệt**, giống OCR trong app:
- Chưa bấm ✅ thì chưa có gì vào sổ.
- Bản nháp nào chưa bấm vẫn nằm trong hàng chờ "Duyệt hoá đơn" của app.

## Ảnh nằm ở đâu

| Bước | Nơi lưu |
|---|---|
| Shortcut chụp xong | Album **"Hoá đơn Crucible"** trong Ảnh của iPhone (iCloud sao lưu). Shortcut lưu vào đây **trước khi** tải lên |
| Máy chủ nhận ảnh | Google Drive `/Incoming_Invoices`, kèm một bản nháp trong hàng chờ. Chỉ khi xong bước này máy chủ mới trả "✅ Đã lưu ảnh lên Drive" |
| Gửi qua Telegram | Thêm một bản trong lịch sử chat |
| Bấm ✅ | Ảnh chuyển sang `Approved_Invoices` |
| Bấm ❌ | Ảnh chuyển sang `Trash_Invoices`. Không xoá vĩnh viễn gì |

**Chỉ vứt hoá đơn giấy khi đã thấy dòng "Đã lưu ảnh lên Drive".** Đọc hoá đơn (OCR) có hỏng cũng không mất gì: ảnh vẫn ở Drive, còn bản nháp nằm trong hàng chờ để quét lại hoặc điền tay.

## Cài đặt (một lần)

### 1. Tạo bot

Trên Telegram:
1. Nhắn **@BotFather**, gõ `/newbot`.
2. Đặt tên hiển thị, ví dụ "Crucible chi tiêu".
3. Đặt username, phải kết thúc bằng `bot`.
4. BotFather trả về một **token**, dạng `123456:ABC…`. Đừng gửi token này cho ai, kể cả qua chat với Claude.

### 2. Đặt biến môi trường trên Vercel

Vào Vercel → project **crucible-os** → Settings → Environment Variables. Thêm cho môi trường Production:

| Tên | Giá trị |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token ở bước 1 |
| `BOT_USER_ID` | `f92c8bbc-418a-4b48-9a13-8e8118c92f78` (tài khoản Crucible của bạn) |
| `RECEIPT_UPLOAD_TOKEN` | một chuỗi ngẫu nhiên dài, tự đặt. Shortcut sẽ gửi kèm chuỗi này |
| `CRON_SECRET` | một chuỗi ngẫu nhiên khác. Vercel dùng nó để gọi lịch nhắc 12h, 17h, 22h |
| `TELEGRAM_CHAT_ID` | để trống lúc này, lấy ở bước 4 |

Để tạo chuỗi ngẫu nhiên, chạy `openssl rand -hex 24` trong Terminal.

Sau đó vào Deployments, bấm **Redeploy** bản mới nhất.

### 3. Nối webhook

Mở `https://crucible-os-zeta.vercel.app/api/bot/setup` trên trình duyệt **đang đăng nhập Crucible**. Trang trả về JSON, trong đó mục `checklist` liệt kê biến nào còn thiếu. Chạy lại trang này bao nhiêu lần cũng được.

### 4. Lấy chat id

1. Nhắn `/start` cho bot. Bot trả lời "Chat ID của bạn là …".
2. Đặt `TELEGRAM_CHAT_ID` bằng số đó trên Vercel.
3. Bấm **Redeploy**.

Từ lúc này bot chỉ nghe đúng bạn; người lạ nhắn vào bị lờ đi.

Mở lại `/api/bot/setup` để kiểm. Mọi dòng trong `checklist` phải ghi "đã đặt".

## Dùng hằng ngày

- **Tin nhắn**, ví dụ:
  - *"cafe Highlands 45k thẻ"*
  - *"hôm qua đổ xăng 500k thẻ VPBank, gửi xe 5k tiền mặt"*. Một tin có nhiều khoản thì bot tách thành nhiều bản nháp.
- **Tin thoại**: nói giống như trên.
- **Ảnh**: chụp thẳng trong Telegram. Có thể thêm chú thích như *"thẻ UOB"* hay *"du lịch Đà Lạt"*.
- **Sửa một bản nháp**: *trả lời (reply)* vào bản nháp đó, ví dụ *"số tiền 450k, nhóm ăn uống"*, hoặc bấm ✏️.
- **Xem bản nháp đang chờ**: gõ `/cho`.
- **Nhắc lúc 12h, 17h và 22h**:
  - Chưa có giao dịch nào trong ngày: bot nhắc nhập.
  - Đã có giao dịch: bot báo hôm nay đã chi bao nhiêu và hỏi còn khoản nào không.
  - Gói Vercel Hobby chỉ giữ đúng giờ, không giữ phút. Vì vậy lịch được đặt sớm một giờ (11:01, 16:01, 21:01) để lời nhắc luôn đến trước mốc. Ví dụ mốc 12h sẽ đến trong khoảng 11:00–11:59.

Bot chỉ gán **thẻ** khi bạn nói rõ tên thẻ, tên ngân hàng hoặc 4 số cuối. Nói "quẹt thẻ" thôi thì bản nháp ghi "Thẻ · chưa chọn thẻ nào". Lúc đó trả lời *"thẻ Timo"* để chọn.

## Shortcut trên iPhone

Mở app **Phím tắt** (Shortcuts) → **+**, rồi thêm các tác vụ theo thứ tự dưới đây. Ba Shortcut dưới đều dùng chung tác vụ **Lấy nội dung của URL** (Get Contents of URL) với cấu hình này:

- URL: `https://crucible-os-zeta.vercel.app/api/receipt/upload`
- Phương thức: **POST**
- Tiêu đề (Headers): `x-upload-token` = giá trị `RECEIPT_UPLOAD_TOKEN`
- Nội dung yêu cầu: **Biểu mẫu** (Form)

### "Chụp hoá đơn"

1. **Chụp ảnh** (Take Photo), bật *Hiện bản xem trước camera*.
2. **Lưu vào album ảnh**, album **Hoá đơn Crucible** (tạo album trước trong app Ảnh). Bước này phải đứng TRƯỚC bước tải lên.
3. **Lấy nội dung của URL**, trường biểu mẫu: `file` kiểu **Tệp** = *Ảnh* (kết quả của bước 1).
4. **Lấy giá trị từ điển** (Get Dictionary Value): khoá `message`.
5. **Hiện thông báo** với *Giá trị từ điển*.

Gọi bằng giọng nói: *"Hey Siri, chụp hoá đơn"*.

Hoá đơn dài cần nhiều ảnh: ở bước 1 bật chụp nhiều ảnh, tối đa 3 ảnh cho một hoá đơn.

### "Tải lại hoá đơn" (khi lần trước báo lỗi)

1. **Tìm ảnh** (Find Photos): album là *Hoá đơn Crucible*, sắp xếp mới nhất trước, giới hạn 20.
2. **Chọn từ danh sách** (Choose from List).
3. **Lấy nội dung của URL**, trường biểu mẫu: `file` = *Mục đã chọn*.
4. **Lấy giá trị từ điển** `message`, rồi **Hiện thông báo**.

### "Ghi chi tiêu" (đọc chính tả)

1. **Đọc chính tả văn bản** (Dictate Text), ngôn ngữ Tiếng Việt.
2. **Lấy nội dung của URL**, trường biểu mẫu: `text` kiểu **Văn bản** = *Văn bản đã đọc chính tả*.
3. **Lấy giá trị từ điển** `message`, rồi **Hiện kết quả**.

Gọi bằng giọng nói: *"Hey Siri, ghi chi tiêu"*. Bản nháp được gửi sang Telegram để bấm ✅.

## Giới hạn

- Gemini gói miễn phí cho khoảng 20 lượt mỗi ngày cho mỗi model; có chuỗi model dự phòng.
- Mỗi tin nhắn tốn một lượt, mỗi ảnh tốn một lượt, mỗi lần sửa tốn thêm một lượt.
- Hết hạn mức thì bot vẫn giữ tin nhắn hoặc ảnh thành bản nháp và báo lỗi, không mất dữ liệu.

## Cho người sửa code

- Quy tắc chung nằm ở AGENTS.md, mục **Bot ghi chi tiêu**.
- Các route:
  - `api/bot/telegram`: webhook.
  - `api/bot/setup`: nối webhook, phải đăng nhập.
  - `api/receipt/upload`: Shortcut.
  - `api/bot/remind`: cron.
- Phần xử lý nằm ở `src/lib/{telegram,botParse,botDraft,botHandler,approveDraft,receiptOcr}.ts`.
