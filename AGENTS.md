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
| Thói quen | `src/app/habits/`, `src/components/habits/`, `api/habits/`, `src/lib/habits.ts` |
| Vỏ giao diện | `MainLayoutWrapper`, `TopNav`, `MobileNav`, `MobileTopBar`, `src/app/globals.css` |

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

**Design system là "Function"** → giấy kem `#fef9ef`, thẻ giấy cũ `#f5eee1`,
viền taupe `#d1c9bf`, chữ mực `#2a2b2f`, và **một** màu đất nung `#b05a36`.
Năm luật: không dùng trắng tinh làm nền; độ nổi đến từ bậc màu chứ không từ
bóng (chỉ modal và ô nhập đang gõ được phép có bóng); đất nung chỉ cho ba việc
— nút chính, nhãn mắt, trạng thái đang chọn; serif chỉ cho tiêu đề biên tập,
còn thân bài/nhãn/nút đều là sans bó chữ `-0.023em`; hình khối là thẻ 24px,
nút 40px, ô nhập và tag bo tròn hẳn, mục điều hướng 12px.

Chữ nghiêng serif (`.c-italic`) là nước cờ đặc trưng nhất của hệ — roman xen
nghiêng trong cùng một dòng tiêu đề. Chỉ cho serif từ 34px trở lên, không bao
giờ cho nhãn hay thân bài.

Màu ngữ nghĩa (`--color-success/warning/error/info`) là chỗ **cố ý lệch** khỏi
bản tham chiếu; cả bốn đều trong họ đất (rêu, thổ hoàng, đất nung, tro). Chỉ
được xuất hiện trên **con số, icon và nền tint** — không bao giờ trên nền thẻ,
nút hay thanh điều hướng.

**Animation có `transform` biến phần tử thành KHỐI CHỨA của `position: fixed`.**
`animate-in` nằm trên chính div bọc nội dung tab, mà modal render bên trong div
đó. Nếu keyframe giữ lại trạng thái cuối (`fill-mode: both`) thì lớp phủ modal
thôi tính theo màn hình, co vừa khung nội dung và nút lưu rớt ra ngoài. Mọi
animation trong `globals.css` vì thế dùng **`backwards`**, không dùng `both` —
khung cuối của chúng đúng bằng giá trị mặc định nên không nhảy hình.

**`animate-in` / `fade-in` / `zoom-in-95` là class của dự án, không phải của
Tailwind.** Plugin `tailwindcss-animate` không được cài; 53 chỗ trong JSX dùng
chúng chỉ chạy được nhờ phần `@keyframes c-enter` cuối `globals.css`. Gỡ phần
đó là 53 chỗ đứng im trở lại.

**`space-y-*` gán margin cho CẢ modal.** Modal được render như phần tử anh em
ngay trong khối `space-y-*` của trang, nên quy tắc nhịp trang trong
`globals.css` từng gán `margin-top` lên lớp phủ `fixed inset-0` — ở khổ 375px
modal bị đẩy xuống 48px và nút lưu rớt khỏi đáy màn hình. Quy tắc nhịp phải
luôn có `:not(.fixed)`, và có thêm `.c-main .fixed.inset-0 { margin: 0 }` chặn
lần cuối. Đừng bỏ hai thứ đó.

**Sáng là mặc định, không theo hệ điều hành.** Bảng sáng nằm thẳng trên
`:root`; bảng tối chỉ áp khi người dùng bấm nút (`[data-theme="dark"]`). Bản cũ phải
viết bảng tối hai lần và bắt hai khối giống hệt nhau — cái bẫy đó không còn.

**Không có sidebar.** Toàn bộ điều hướng nằm trên `TopNav` (thanh ngang dính
đỉnh, từ 768px). Điện thoại dùng `MobileTopBar` + `MobileNav`.

**Bán kính `--radius-sm/md/lg/xl/2xl` TRÙNG TÊN với thang của Tailwind v4** ⇒
đổi chúng là đổi luôn mọi `rounded-*` trong JSX. Giữ thang này ở cỡ "thẻ"; bán
kính viên thuốc đặt riêng trong `.c-btn` / `.c-input`. Đã có tiền lệ: đặt
`--radius-md: 16px` cho ô nhập làm mọi ô `rounded-md` 31px của bản đồ nhiệt
biến thành hình tròn.

**Nhịp trang do `.c-main` quy định**, không phải từng trang tự đặt: khung
1200px, 96px giữa các khối lớn, 24px đệm thẻ. Đừng chồng `max-w-*` hay
`py-*` lên `<main>`.

**Đặt cỡ chữ** → dùng thang `.c-display / .c-h1….c-h5`, đừng dùng `text-*` của
Tailwind cho heading. Mặc định thẻ nằm trong `@layer base`, thang chữ nằm trong
`@layer components`. Viết mặc định thẻ **ngoài** mọi `@layer` sẽ nuốt sạch utility
— đã từng làm 83 heading và 58 thẻ `<p>` mất tác dụng, không linter nào báo.
Ngoại lệ có chủ ý: `.c-topnav`, `.c-bottomnav` và khối nhịp trang (`.c-main`)
cố tình nằm ngoài mọi layer để thắng utility viết thẳng trong JSX —
`hidden md:flex`, `space-y-8`, `p-5`, `gap-6`. Có media query ở cuối
`globals.css` lo phần ẩn/hiện theo bề ngang; bỏ nó đi là thanh điều hướng dưới
của điện thoại hiện nguyên trên máy tính.

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

**Thêm mục vào thanh dưới (`MobileNav`)** → thanh này **chỉ chứa năm mục**.
Ở khổ 375px mục thứ sáu làm nhãn bị bóp và vùng chạm tụt dưới 44px. Khi module
Thói quen vào, Cài đặt đã dời lên `MobileTopBar` — đó là đường duy nhất vào
`/settings` trên điện thoại, đừng gỡ.

**Đụng `ReviewLog`, `FocusSession` hay `Transaction`** → thói quen có
`autoSource` đọc thẳng ba bảng này để tự đếm tiến độ (`review`, `focus`,
`noSpend`), ở cả `api/habits/route.ts` lẫn `api/habits/reports/route.ts`. Đổi ý
nghĩa một dòng trong ba bảng đó là đổi luôn số liệu và chuỗi ngày bên Thói quen,
mà không có gì báo.

**Tính chuỗi ngày / tỷ lệ hoàn thành** → chỉ có một chỗ: `src/lib/habits.ts`.
Ba quy tắc cố ý và đã có test: ngày ngoài lịch bị bỏ qua, ngày đánh dấu nghỉ
không phá chuỗi, kỳ hiện tại chưa đủ chỉ tiêu thì chưa tính là đứt. Đừng tính
lại ở component — hai công thức là hai con số khác nhau trên cùng màn hình.

**Không bao giờ dùng dữ liệu giả.** Màn hình trống thì để trống, đừng bịa số.

## Kiểm trước khi báo xong

```
node_modules/.bin/tsc --noEmit    # phải sạch
node_modules/.bin/eslint src      # 43 vấn đề có sẵn — không được thêm cái nào
```
