# Shortcut tải video

Một shortcut duy nhất, lưu trên iPhone / iPad / MacBook (iCloud tự đồng bộ).
Dán link trên web ở thiết bị nào cũng được — shortcut đọc hàng đợi từ server
nên không cần nhận link qua Share Sheet.

## Luồng

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

## Vì sao cần `/api/video/pending`

`/api/video/queue` xác thực bằng phiên Supabase, mà Shortcut không đăng nhập
được. `/api/video/pending` dùng `VIDEO_UPLOAD_TOKEN` — đúng cơ chế
`/api/video/upload` đã dùng, nên shortcut chỉ giữ một bí mật duy nhất.

## Chuẩn bị

1. Deploy nhánh này. Shortcut gọi `/api/video/pending`, endpoint đó chưa có
   trên bản đang chạy.
2. `VIDEO_UPLOAD_TOKEN` phải có trong biến môi trường trên Vercel (không chỉ
   trong `.env` dưới máy).
3. Biết domain đã deploy.

## Cách 1 — dùng file có sẵn

```bash
python3 scripts/build-video-shortcut.py "https://domain-cua-ban" "TOKEN" "Crucible.shortcut"
```

AirDrop file sang iPhone, mở bằng Shortcuts. File **không có chữ ký Apple**, nên
lần đầu phải bật *Cài đặt → Phím tắt → Cho phép phím tắt không đáng tin cậy*
(mục này chỉ hiện ra sau khi bạn đã chạy ít nhất một shortcut bất kỳ).

Nếu import lỗi hoặc chạy sai, dựng tay theo cách 2 — chỉ 12 bước.

## Cách 2 — dựng tay

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

## Giới hạn

- Mỗi lượt chạy xử lý tối đa **3 video** (`BATCH_SIZE` trong
  `src/app/api/video/pending/route.ts`). Link fdown.vn có hạn dùng, giải sẵn
  quá nhiều rồi tải tuần tự thì cái cuối có thể hết hạn. Còn video thì chạy lại.
- Chỉ Facebook và TikTok. YouTube/Instagram trong hàng đợi bị bỏ qua và liệt kê
  ở `skipped` — phải lưu tay.
- `/api/video/upload` giới hạn 200MB mỗi file.

## Kiểm tra nhanh

```bash
curl -s -H "Authorization: Bearer $VIDEO_UPLOAD_TOKEN" https://<domain>/api/video/pending | python3 -m json.tool
```

`items` rỗng nghĩa là không còn gì chờ; xem `skipped` để biết mục nào bị bỏ qua
và vì sao.
