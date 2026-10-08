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
| Finance — Dự án | `ProjectsTab`, `ProjectCostPanels`, `ProjectSplitEditor`, `src/lib/{projects,projectCost,projectLedger,projectData}.ts`, `api/finance/projects/` |
| Danh mục | `api/finance/categories/route.ts`, `src/lib/useCategories.ts`, `settings/FinanceSettings.tsx` |
| Knowledge / Document | `src/app/knowledge/`, `src/components/knowledge/`, `src/components/workspace/`, `api/knowledge/` |
| Learning | `src/app/learning/`, `src/components/learning/`, `api/learning/`, `src/lib/fsrs.ts` |
| Video | `api/video/{fetch,queue,resolve}` (trình duyệt) và `api/video/{upload,pending}` (Shortcut iOS) |
| Thói quen | `src/app/habits/`, `src/components/habits/`, `api/habits/`, `src/lib/habits.ts` |
| Vỏ giao diện | `MainLayoutWrapper`, `TopNav`, `MobileNav`, `MobileTopBar`, `src/app/globals.css` |

## Đổi cái này thì kéo theo cái kia

**Đổi tên hoặc gộp một `Category`** → **năm** bảng khớp với nó bằng **chuỗi**,
không phải khoá ngoại: `Transaction.categoryGroup`, `Budget.categoryGroup`,
`Vendor.defaultCategoryGroup`, `ClassificationRule.categoryGroup`, và
`DraftReceipt.categoryGroup` (hoá đơn quét đang chờ duyệt — bảng này bị sót
trong suốt một thời gian dài, phát hiện 02/10). Danh mục con thì nằm ở cột
`subGroup` của `Transaction` và `DraftReceipt`. Đổi mỗi bảng `Category` thì
giao dịch trỏ tới nhóm không tồn tại và dashboard **đếm thiếu mà không báo lỗi
gì**. Phải dời trong cùng một `$transaction` — xem
`api/finance/categories/route.ts` (đổi tên) và
`api/finance/categories/merge/route.ts` (gộp hai nhóm cùng bản chất).

**Thêm/sửa/xoá danh mục** → gọi `invalidateCategories()` (`src/lib/useCategories.ts`).
Hook cache ở cấp module, không xoá thì mọi modal vẫn hiện danh sách cũ tới khi
tải lại trang.

**Trước khi đổi giao diện** → đọc `docs/huong-thiet-ke-2026.md`. Đó là bản đối
chiếu giữa xu hướng thiết kế hiện hành và những gì dự án cố ý làm khác, kèm lý
do. Hai điều hay bị hiểu nhầm: bảng màu ấm và thang chữ `clamp()` của dự án
đang ĐÚNG hướng thịnh hành, không phải lạc hậu; còn việc cấm bóng đổ là lựa
chọn có chủ đích theo ẩn dụ giấy, đừng "hiện đại hoá" bằng cách thêm bóng.

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

**Trục thời gian theo tháng** → `<XAxis dataKey="name" {...monthAxis(series.map((d) => d.name))} />`
(`src/components/finance/MonthAxisTick.tsx`). Nhãn `YYYY-MM` viết đủ thì không
vừa, nên bản cũ xoay -45° — kéo theo trục cao 56px và recharts phải bỏ bớt tick,
biểu đồ 24 tháng chỉ hiện 12 nhãn. `monthAxis` tách năm xuống một hàng gom
nhóm, nhãn nằm ngang, `interval={0}`. Nó suy bề rộng một cột từ `width` và
`visibleTicksCount` mà recharts truyền vào tick — dưới 24px/cột thì rút tên
tháng về số, nên đừng truyền `tick` khác đè lên.

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

**Thêm một trường vào form ghi giao dịch** → có BA hộp thoại cùng ghi giao
dịch, không phải một: `TransactionModal` (nhập tay), `ScanInvoiceModal` (quét)
và `ReviewQueueModal` (duyệt). Trường chỉ thêm ở một chỗ là luồng kia ghi
thiếu mà không báo gì. Trường của bước quét còn phải đi qua `DraftReceipt`
nữa — nó nằm giữa quét và duyệt, quên nó thì giá trị người dùng chọn lúc quét
bốc hơi ở bước duyệt. Đã có tiền lệ: thêm `Account` xong chỉ gắn ô chọn vào
`TransactionModal`, nên mọi hoá đơn quét đều vào sổ với `accountId = null` và
dư nợ thẻ đứng im. Ô chọn tài khoản nay dùng chung `AccountSelect` +
`useAccounts()`, đừng viết lại cái thứ tư. Ô phân bổ dự án cũng vậy:
`ProjectSplitEditor` + `useProjects()`, đi qua `DraftReceipt.projectSplits`.

**Form sửa giao dịch phải nhận đủ khoá ngoại** (`accountId`, `toAccountId`,
`projectSplits`) từ API nguồn. `api/finance/history` từng bỏ sót `accountId`, nên
sửa một giao dịch ở tab History là nó lặng lẽ rời thẻ. `PUT
/api/finance/transaction` nay chỉ đụng ba cột đó khi body CÓ gửi khoá, nhưng
nguồn nào mở `TransactionModal` để sửa vẫn phải trả về đủ. (Phân bổ dự án
theo cùng luật: không gửi khoá `projectSplits` = giữ tỷ lệ cũ, tính lại tiền.)

**Dự án không có sổ thu chi riêng.** Chi/thu phân bổ cho dự án vẫn nằm trong
Chi tiêu/Thu nhập chung; tab Dự án chỉ gom lại. `Refund` phân bổ cho dự án trừ
vào vốn, không cộng vào doanh thu. Đừng tách khoản chi dự án ra khỏi sổ cá nhân
mà không hỏi — tiền đó vẫn thật sự rời ví.

**Tạo, sửa hay xoá một `Transaction` ở BẤT KỲ đâu** → gọi
`applyProjectSplits` / `syncProjectLedger` (`src/lib/projectLedger.ts`) trong
CÙNG `prisma.$transaction`. Nguồn sự thật về dự án là `ProjectAllocation` (một
giao dịch chia được % cho nhiều dự án × 5 nhóm chi phí); `ProjectLedgerEntry` là
sổ cái CHỈ GHI THÊM — không update/delete dòng nào, sửa/xoá giao dịch sinh bút
toán đảo. Quên gọi là sổ cái lệch phân bổ; tab Dự án có dòng "Sổ cái khớp với
phân bổ" để lộ ra chuyện đó. Đã nối ở: `transaction` (POST/PUT/DELETE),
`process-ocr`, `resolve-duplicate`, `debt-schedule` (xoá rồi tạo lại cùng id —
phải giữ phân bổ cũ), `projects/[id]/transactions`, `projects/allocations`.
`Transaction.projectId` / `DraftReceipt.projectId` là cột CŨ, không đọc không
ghi nữa — chỉ còn vì bản build cũ trên Vercel SELECT chúng.

**Gọi Gemini** → luôn `generateWithRetry(modelsWithFallback({...}), ...)`
(`src/lib/aiRetry.ts`, `src/lib/gemini.ts`) và trả lỗi qua `aiErrorMessage()`.
Đừng gọi thẳng `genAI.getGenerativeModel({ model: GEMINI_MODEL })`: Gemini hay
trả 503 "high demand" cho riêng một model, và gói miễn phí tính hạn mức theo
từng model. Đã có tiền lệ: OCR rồi tới nút tạo dàn ý ý tưởng chết hẳn, hộp thoại
hiện nguyên câu lỗi tiếng Anh của Google, trong khi model dự phòng vẫn chạy.

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
