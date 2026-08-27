<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Crucible OS — bản đồ phụ thuộc

Dự án này được làm bởi nhiều phiên song song, mỗi phiên một function. File này
là thứ duy nhất cả năm phiên cùng đọc. Trước khi sửa bất cứ gì, tra bảng
"Đổi cái này thì kéo theo cái kia" bên dưới — phần lớn sợi dây trong dự án
**không** được trình biên dịch bắt.

## Làm việc song song

- **Mỗi function một worktree, tách từ `origin/main` mới nhất.** Không hai phiên
  nào ghi chung một thư mục. Đã có tiền lệ: 18/08 hai phiên cùng ghi
  `ScanInvoiceModal.tsx`, git báo `local changes would be overwritten` trong khi
  `git status` sạch, và một commit nằm chết 9 ngày.
- **Kiểm nhánh có lạc hậu không trước khi viết dòng code đầu tiên:**
  `git rev-list --left-right --count origin/main...HEAD`. Đã có tiền lệ một nhánh
  chậm 29 commit và làm lại từ đầu thứ `main` đã có.
- Xong việc thì commit ngay, kể cả chưa push. Việc chưa commit trên ổ này là việc
  sắp mất.

## Ổ làm việc là USB exFAT — ba hệ quả

1. macOS đẻ file `._*` (AppleDouble) cho mọi file có extended attribute.
   `.gitignore` đã chặn; nếu thấy chúng chặn merge thì
   `find . -name '._*' -type f -not -path './node_modules/*' -delete`.
2. exFAT không có ctime/inode ⇒ git đọc trạng thái file sai ⇒ `rebase` hay báo
   `local changes would be overwritten` dù cây sạch. **Cách vòng: `cherry-pick`
   từ một worktree đang đứng đúng `origin/main`, đừng `rebase` tại chỗ.**
3. `.gitattributes` ép `eol=lf`. Đừng bỏ: sửa file từ máy Windows từng làm 84 file
   báo "đã sửa" mà không đổi một dòng nội dung nào.

## Function nằm ở đâu

| Function | File chính |
|---|---|
| Finance — sổ, dashboard | `src/app/finance/`, `src/components/finance/`, `src/app/api/finance/` |
| Finance — OCR hoá đơn | `ScanInvoiceModal`, `ReviewQueueModal`, `PendingReviewButton`, `api/ocr/`, `api/finance/transaction/{draft,drafts,process-ocr,resolve-duplicate,check-duplicate}` |
| Danh mục | `api/finance/categories/route.ts`, `src/lib/useCategories.ts`, `settings/FinanceSettings.tsx` |
| Knowledge / Document | `src/app/knowledge/`, `src/components/knowledge/`, `src/components/workspace/`, `api/knowledge/` |
| Learning | `src/app/learning/`, `src/components/learning/`, `api/learning/`, `src/lib/fsrs.ts` |
| Video | `api/video/{fetch,queue,resolve}` (trình duyệt) và `api/video/{upload,pending}` (Shortcut iOS) |
| Vỏ giao diện | `MainLayoutWrapper`, `Sidebar`, `MobileNav`, `MobileTopBar`, `src/app/globals.css` |

## Đổi cái này thì kéo theo cái kia

**Đổi tên một `Category`** → bốn bảng khớp với nó bằng **chuỗi**, không phải khoá
ngoại: `Transaction.categoryGroup`, `Budget.categoryGroup`,
`Vendor.defaultCategoryGroup`, `ClassificationRule.categoryGroup`. Đổi mỗi bảng
`Category` thì giao dịch trỏ tới nhóm không tồn tại và dashboard **đếm thiếu mà
không báo lỗi gì**. Phải dời trong cùng một `$transaction` — xem
`api/finance/categories/route.ts:168`.

**Thêm/sửa/xoá danh mục** → gọi `invalidateCategories()` (`src/lib/useCategories.ts`).
Hook cache ở cấp module, không xoá thì mọi modal vẫn hiện danh sách cũ tới khi
tải lại trang.

**Đặt cỡ chữ** → dùng thang `.c-display / .c-h1….c-h5`, đừng dùng `text-*` của
Tailwind cho heading. Mặc định thẻ nằm trong `@layer base`, thang chữ nằm trong
`@layer components`. Viết mặc định thẻ **ngoài** mọi `@layer` sẽ nuốt sạch utility
— đã từng làm 83 heading và 58 thẻ `<p>` mất tác dụng, không linter nào báo.
Ngoại lệ có chủ ý: `.c-sidebar` cố tình nằm ngoài layer để thắng `hidden md:flex`.

**Sửa modal bất kỳ trong Finance** → khổ chính là **375px**, không phải desktop.
Modal phải cuộn được tới trường cuối và nút lưu luôn thấy. Ba lỗi mobile đã sửa:
chọn tháng, modal tràn màn hình, danh sách món hàng OCR bị cắt ở dòng thứ 3.

**Thêm chuỗi hiển thị** → dùng `t("tiếng Việt", "English")`. Nhưng **không dịch
`<datalist>`**: `value` ở đó được điền thẳng vào ô rồi lưu xuống DB, dịch là làm
số liệu tách đôi giữa hai ngôn ngữ. Chỉ `<select>` thật mới đổi phần chữ,
`value` giữ nguyên tên chuẩn tiếng Anh.

**Đụng luồng OCR** → ba bước cố định: **quét → lưu nháp (`DraftReceipt`) → duyệt
mới ghi `Transaction`**. Bước quét *không* ghi sổ; nhãn nút phải nói rõ điều đó,
nếu không người dùng tưởng đã xong. Ảnh nằm ở `Incoming` sau khi quét là đúng
thiết kế.

**Thêm route API** → mặc định là phải đăng nhập (`requireUser()`). Chỉ
`api/video/upload` và `api/video/pending` là công khai, xác thực bằng
`VIDEO_UPLOAD_TOKEN` cho Shortcut iOS — danh sách trong `src/proxy.ts`.
Đừng nới `PUBLIC_PATHS` để tiện kiểm thử rồi quên hoàn nguyên.

**Không bao giờ dùng dữ liệu giả.** Màn hình trống thì để trống, đừng bịa số.

## Kiểm trước khi báo xong

```
node_modules/.bin/tsc --noEmit    # phải sạch
node_modules/.bin/eslint src      # 43 vấn đề có sẵn — không được thêm cái nào
```
