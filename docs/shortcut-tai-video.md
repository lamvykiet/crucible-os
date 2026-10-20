# Shortcut tải video

Có **hai** shortcut, làm hai việc khác nhau:

| Shortcut | Chạy ở đâu | Làm gì |
| --- | --- | --- |
| **Gửi vào Crucible** | Nút **Chia sẻ** trong TikTok / Facebook | Hỏi đề tài, nhãn con, tiêu đề → ghi link vào hàng đợi → server tự tải về Drive |
| **Crucible** | Mở tay | Tải những video server không tự tải được (quá 150MB, quá 60 giây) |

Hằng ngày chỉ cần cái thứ nhất.

## Gửi vào Crucible — từ nút Chia sẻ

```
Lướt TikTok/Facebook → Chia sẻ → Khác/Thêm → "Gửi vào Crucible"
   ├─> POST /api/video/share/prepare  tiêu đề (đã bỏ #) + danh sách đề tài; KHÔNG ghi gì
   ├─  popup 1: chọn đề tài
   ├─> POST /api/video/share/labels   nhãn con của đề tài đó, dùng gần nhất lên đầu
   ├─  popup 2: chọn nhãn con  (đầu: "— Không gắn nhãn —", cuối: "＋ Nhãn mới…" → ô gõ)
   ├─  popup 3: tiêu đề, điền sẵn
   └─> POST /api/video/share          ghi hàng đợi, trả lời ngay, rồi tải về Drive ở nền
```

Bấm Huỷ ở popup nào thì không có gì được ghi. Chia sẻ lại một video đã có thì
cập nhật đề tài/nhãn chứ không nhân bản — cùng hàm `enqueueVideo` với ô dán
link trên web. Tham số theo dõi (`_t`, `mibextid`, `utm_*`…) bị cắt khỏi link
trước khi so, vì TikTok/Facebook đổi chúng sau mỗi lần bấm chia sẻ.

Tiêu đề lấy từ fdown.vn (TikTok oEmbed không còn trả `title`), chờ tối đa 8
giây; không kịp thì ô tiêu đề để trống cho bạn gõ. Mọi `#hashtag` bị bỏ, emoji
và `@tên` giữ nguyên — `cleanVideoTitle` trong `src/lib/videoShare.ts`.

Tải nền hỏng (video riêng tư, quá cỡ, fdown.vn trục trặc) thì video vẫn nằm ở
mục chờ trên web: bấm tải lại ở đó, hoặc chạy shortcut "Crucible" bên dưới.

### Cài

```bash
python3 scripts/build-share-shortcut.py "https://crucible-os-zeta.vercel.app" "$VIDEO_UPLOAD_TOKEN" "Gui vao Crucible.shortcut"
```

Script tự ký bằng `shortcuts sign` (chỉ có trên macOS) — iOS 15 trở đi KHÔNG
nhập được file chưa ký. File chứa token: AirDrop sang iPhone rồi xoá, đừng
commit.

Lần đầu dùng: trong TikTok bấm **Chia sẻ → Khác** (Facebook: **Chia sẻ → Thêm
tuỳ chọn**), kéo xuống cuối bảng → **Sửa thao tác** → bật và kéo "Gửi vào
Crucible" lên mục Yêu thích để nó nằm ở hàng đầu.

### Dựng tay (khi script không ký được)

Tạo shortcut tên "Gửi vào Crucible", trong phần ⓘ bật **Hiện trong bảng Chia
sẻ**, kiểu nhận: **URL** và **Văn bản**. Mọi lệnh "Lấy nội dung URL" đều:
Method **POST**, Header `Authorization` = `Bearer <TOKEN>`, Request Body **JSON**.

| # | Action | Cấu hình |
| --- | --- | --- |
| 1 | Get URLs from Input | input = **Shortcut Input** → Set Variable `Link` |
| 2 | Get Contents of URL | `…/api/video/share/prepare`, JSON: `url` = `Link` → Set Variable `Info` |
| 3 | Get Dictionary Value | `error` từ `Info` → Set Variable `Err` |
| 4 | If `Err` **has any value** | Show Alert `Err` → Stop This Shortcut → End If |
| 5 | Get Dictionary Value | `topics` từ `Info` → **Choose from List** (prompt "Đề tài") → Set Variable `Topic` |
| 6 | Get Contents of URL | `…/api/video/share/labels`, JSON: `topic` = `Topic` → Set Variable `Labels` |
| 7 | Get Dictionary Value | `choices` từ `Labels` → **Choose from List** (prompt "Nhãn con") → Set Variable `Sub` |
| 8 | If `Sub` **is** `＋ Nhãn mới…` | Ask for Input (Text, "Tên nhãn mới") → Set Variable `Sub` → End If |
| 9 | Get Dictionary Value | `title` từ `Info` → **Ask for Input** (Text, "Tiêu đề", Default Answer = giá trị đó) → Set Variable `Title` |
| 10 | Get Dictionary Value | `sourceUrl` từ `Info` → Set Variable `Source` |
| 11 | Get Contents of URL | `…/api/video/share`, JSON: `sourceUrl` = `Source`, `topic` = `Topic`, `subTopic` = `Sub`, `title` = `Title` |
| 12 | Get Dictionary Value | `message` → **Show Notification** |

Chuỗi `＋ Nhãn mới…` ở bước 8 phải trùng từng ký tự với `NEW_LABEL` trong
`src/lib/videoShare.ts` (dấu ＋ toàn khổ, dấu … một ký tự) — chép từ JSON trả về
cho chắc.

Vì sao nhãn con là một lượt gọi riêng: "Get Dictionary Value" coi dấu chấm
trong khoá là đường dẫn lồng nhau, nên tra bảng `{đề tài: [nhãn]}` bằng tên đề
tài có dấu chấm sẽ ra rỗng, và "Choose from List" gặp danh sách rỗng là dừng
cả shortcut.

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
