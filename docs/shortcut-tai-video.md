# Shortcut tải video

Có **hai** shortcut, làm hai việc khác nhau:

| Shortcut | Chạy ở đâu | Làm gì |
| --- | --- | --- |
| **Gửi vào Crucible** | Nút **Chia sẻ** trong TikTok / Facebook | Mở form "Lưu một video" ngay trên TikTok → ghi link vào hàng đợi → server tự tải về Drive |
| **Crucible** | Mở tay | Tải những video server không tự tải được (quá 150MB, quá 60 giây) |

Hằng ngày chỉ cần cái thứ nhất.

## Gửi vào Crucible — từ nút Chia sẻ

```
Lướt TikTok/Facebook → Chia sẻ → Khác/Thêm → "Gửi vào Crucible"
   ├─> POST /api/video/share/prepare  đổi VIDEO_UPLOAD_TOKEN lấy formUrl (kèm vé); KHÔNG ghi gì
   └─  Show Web Page: trang /video-share nổi ngay trên TikTok
          ├─> GET  /api/video/share/form   đề tài (thư mục Drive) + nhãn con theo từng đề tài
          ├─> GET  /api/video/share/title  mô tả video đã bỏ #hashtag (3–5 giây, không chặn form)
          └─> POST /api/video/share        nút "Thêm vào thư viện": ghi hàng đợi, tải về Drive ở nền
```

Form giống hệt ô "Lưu một video" trên web: chọn đề tài, nhãn con hiện thành chip
theo đề tài vừa chọn (hoặc gõ nhãn mới), tiêu đề tự điền từ phần mô tả dưới
video — `We don't know if we wake up tomorrow #LearnOnTikTok #learnenglish` thành
`We don't know if we wake up tomorrow`. Đề tài mặc định là đề tài của lần lưu
gần nhất. Lưu xong bấm **Xong** ở góc trên là quay lại video.

Đóng trang mà chưa bấm lưu thì không có gì được ghi. Chia sẻ lại một video đã có
thì cập nhật đề tài/nhãn chứ không nhân bản — cùng hàm `enqueueVideo` với web.
Tham số theo dõi (`_t`, `mibextid`, `utm_*`…) bị cắt khỏi link trước khi so, vì
TikTok/Facebook đổi chúng sau mỗi lần bấm chia sẻ.

**Vì sao là trang web có vé, không phải đăng nhập:** "Show Web Page" mở
SFSafariViewController, thứ không dùng chung cookie với Safari — đăng nhập kiểu
thường thì lần chia sẻ nào cũng gặp trang đăng nhập. Vé (`signShareTicket` trong
`src/lib/videoShare.ts`) ký bằng `VIDEO_UPLOAD_TOKEN`, chỉ lưu được đúng một
link, hết hạn sau một giờ.

**Vì sao không dùng popup gốc của Shortcuts:** bản đầu (20/10/2026) dùng ba popup
"Choose from List" + khối "If". Không có chip gợi ý nhãn con như web, và một
action sai mã định danh là iOS từ chối chạy CẢ shortcut ("Tác vụ không xác
định"). Bản này không có khối "If" nào: lỗi cũng trả `formUrl`, trỏ tới trang
báo lỗi.

Tải nền hỏng (video riêng tư, quá cỡ, fdown.vn trục trặc) thì video vẫn nằm ở
mục chờ trên web: bấm tải lại ở đó, hoặc chạy shortcut "Crucible" bên dưới.

### Cài

```bash
python3 scripts/build-share-shortcut.py "https://crucible-os-zeta.vercel.app" "$VIDEO_UPLOAD_TOKEN" "Gui vao Crucible.shortcut"
```

Script tự ký bằng `shortcuts sign` (chỉ có trên macOS) — iOS 15 trở đi KHÔNG
nhập được file chưa ký. File chứa token: AirDrop sang iPhone rồi xoá, đừng
commit (`*.shortcut` đã nằm trong `.gitignore`).

Lần đầu dùng: trong TikTok bấm **Chia sẻ → Khác** (Facebook: **Chia sẻ → Thêm
tuỳ chọn**), kéo xuống cuối bảng → **Sửa thao tác** → bật và kéo "Gửi vào
Crucible" lên mục Yêu thích để nó nằm ở hàng đầu.

### Dựng tay (khi script không ký được)

Tạo shortcut tên "Gửi vào Crucible", trong phần ⓘ bật **Hiện trong bảng Chia
sẻ**, kiểu nhận: **URL** và **Văn bản**.

| # | Action | Cấu hình |
| --- | --- | --- |
| 1 | Get URLs from Input | input = **Shortcut Input** → Set Variable `Link` |
| 2 | Get Contents of URL | `https://<domain>/api/video/share/prepare`, Method **POST**, Header `Authorization` = `Bearer <TOKEN>`, Request Body **JSON**: `url` = `Link` |
| 3 | Get Dictionary Value | Get **Value** for `formUrl` |
| 4 | Show Web Page | URL = kết quả bước 3 |

## Crucible — tải phần còn lại

Một shortcut duy nhất, lưu trên iPhone / iPad / MacBook (iCloud tự đồng bộ).
Dán link trên web ở thiết bị nào cũng được — shortcut đọc hàng đợi từ server
nên không cần nhận link qua Share Sheet.

### Luồng

```
Dán link trên web (thiết bị bất kỳ)
   └─> POST /api/video/queue      ghi VideoItem, status: pending

Chạy Shortcut (thiết bị bất kỳ)
   ├─> GET  /api/video/pending    trả mảng items, mỗi item có downloadUrl
   │                              (server giải link qua fdown.vn)
   ├─> tải file từ downloadUrl    máy bạn tải, không qua server
   └─> POST /api/video/upload     đẩy lên Drive, status: saved
```

Server chỉ giải link — vài KB. Việc tải mấy chục MB do thiết bị làm, nên Vercel
free vẫn chịu được.

### Vì sao cần `/api/video/pending`

`/api/video/queue` xác thực bằng phiên Supabase, mà Shortcut không đăng nhập
được. `/api/video/pending` dùng `VIDEO_UPLOAD_TOKEN` — đúng cơ chế
`/api/video/upload` đã dùng, nên shortcut chỉ giữ một bí mật duy nhất.

### Chuẩn bị

1. Deploy nhánh này. Shortcut gọi `/api/video/pending`, endpoint đó chưa có
   trên bản đang chạy.
2. `VIDEO_UPLOAD_TOKEN` phải có trong biến môi trường trên Vercel (không chỉ
   trong `.env` dưới máy).
3. Biết domain đã deploy.

### Cách 1 — dùng file có sẵn

```bash
python3 scripts/build-video-shortcut.py "https://domain-cua-ban" "TOKEN" "Crucible.shortcut"
```

AirDrop file sang iPhone, mở bằng Shortcuts. File **không có chữ ký Apple**, nên
lần đầu phải bật *Cài đặt → Phím tắt → Cho phép phím tắt không đáng tin cậy*
(mục này chỉ hiện ra sau khi bạn đã chạy ít nhất một shortcut bất kỳ).

Nếu import lỗi hoặc chạy sai, dựng tay theo cách 2 — chỉ 12 bước.

### Cách 2 — dựng tay

Tạo shortcut mới tên "Crucible", thêm lần lượt:

| # | Action | Cấu hình |
| --- | --- | --- |
| 1 | Get Contents of URL | `https://<domain>/api/video/pending`, Method **GET**, Headers: `Authorization` = `Bearer <TOKEN>` |
| 2 | Get Dictionary Value | Get **Value** for `items` |
| 3 | Repeat with Each | (bọc các bước 4–10) |
| 4 | Get Dictionary Value | Get **Value** for `downloadUrl`, input = **Repeat Item** |
| 5 | Set Variable | `VideoURL` |
| 6 | Get Dictionary Value | Get **Value** for `sourceUrl`, input = **Repeat Item** |
| 7 | Set Variable | `SourceURL` |
| 8 | Get Contents of URL | URL = biến `VideoURL`, Method **GET** |
| 9 | Set Variable | `VideoFile` |
| 10 | Get Contents of URL | `https://<domain>/api/video/upload`, Method **POST**, Headers: `Authorization` = `Bearer <TOKEN>`, Request Body **Form**, hai trường: `file` = biến `VideoFile`, `sourceUrl` = biến `SourceURL` |
| 11 | (hết Repeat) | |
| 12 | Show Notification | "Đã xử lý xong hàng đợi video." |

Không có khối `If` nào. Đó là chủ ý: `/api/video/pending` luôn trả mảng, và
"Repeat with Each" trên mảng rỗng thì không chạy lần nào — nên trường hợp hàng
đợi trống tự xử lý.

Đề tài không xuất hiện ở đâu trong shortcut: `/api/video/upload` tra `sourceUrl`
ra bản ghi rồi lấy đúng đề tài bạn đã chọn trên web.

### Giới hạn

- Mỗi lượt chạy xử lý tối đa **3 video** (`BATCH_SIZE` trong
  `src/app/api/video/pending/route.ts`). Link fdown.vn có hạn dùng, giải sẵn
  quá nhiều rồi tải tuần tự thì cái cuối có thể hết hạn. Còn video thì chạy lại.
- Chỉ Facebook và TikTok. YouTube/Instagram trong hàng đợi bị bỏ qua và liệt kê
  ở `skipped` — phải lưu tay.
- `/api/video/upload` giới hạn 200MB mỗi file.

### Kiểm tra nhanh

```bash
curl -s -H "Authorization: Bearer $VIDEO_UPLOAD_TOKEN" https://<domain>/api/video/pending | python3 -m json.tool
```

`items` rỗng nghĩa là không còn gì chờ; xem `skipped` để biết mục nào bị bỏ qua
và vì sao.
