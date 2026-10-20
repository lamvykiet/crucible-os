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
| Video | `api/video/{fetch,queue,resolve}` (trình duyệt), `api/video/{upload,pending}` (Shortcut iOS) và `api/video/share/*` + trang `src/app/video-share/` (Shortcut ở nút Chia sẻ); logic chung ở `src/lib/{videoQueue,videoShare}.ts` |
| Thói quen | `src/app/habits/`, `src/components/habits/`, `api/habits/`, `src/lib/habits.ts` |
| Sức khoẻ | `src/app/health/`, `src/components/health/`, `api/health/`, `src/lib/{health,healthServer,healthImport,exercises}.ts` |
| Vỏ giao diện | `MainLayoutWrapper`, `Scene` (`SceneHero`), `TopNav`, `MobileNav`, `MobileTopBar`, `src/app/globals.css` |

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
Tạo danh mục NGAY TRONG một modal đang mở (như "+ Tạo nhóm phụ mới…" của
`SubGroupSelect`) thì phải `await reloadCategories()` — nó tải lại và báo cho
mọi hook đang mở; `invalidateCategories()` chỉ có tác dụng với modal mở sau.

**Trước khi đổi giao diện** → đọc skill `1991-new-design/SKILL.md` (kèm demo
`demo/index.html` và `crucible-v3.css`; demo và skill lệch nhau thì DEMO đúng)
rồi `docs/huong-thiet-ke-2026.md`. Ngày 19/10/2026 chủ dự án chốt hướng **v3
"Mật ong & Bạch đàn"** sau 3 vòng demo, thay HẲN hướng "Function · Kính" (kính
trong 17% trên nền ambient, serif nghiêng, một màu đất nung) — đừng trả lại
hướng cũ khi chưa hỏi. Đổi gì về giao diện: làm demo cho chủ dự án duyệt TRƯỚC.

**Design system v3 có hai tầng.** Đầu trang là PHÔNG CẢNH hoàng hôn
(`.c-scene`, `--sky`) với widget KÍNH chữ trắng; trang đặt tiêu đề + widget lên
phông bằng `<SceneHero>` (`src/components/Scene.tsx` — portal vào khe của
`MainLayoutWrapper`). Phần dưới là TẤM NỀN kem `.c-main` (`--sheet`) bo 36px
trườn lên 80px che phông. Trên tấm nền là **soft UI**: thẻ cùng màu nền, nổi
bằng bóng kép `--neu-raised`, không viền, không gradient; ô nhập, rãnh tab, rãnh
cột biểu đồ LÕM (`--neu-inset`); thẻ lồng trong thẻ chỉ là dải tint phẳng. Ô
pastel `.c-tile-{fin,health,learn,habit}`, mỗi hàng đúng MỘT ô tối
(`.c-tile.dark`). Màu hành động duy nhất là nâu mật ong `--action` `#542a08`
(đảo thành `#ecc494` ở theme tối): nút chính, tab đang chọn, switch, cột nhấn.
Kính CHỈ trên phông cảnh, thanh điều hướng, dock, tooltip/menu nổi — không bao
giờ trên tấm nền kem. Thứ gì đè lên nội dung khác (modal, lịch chọn ngày, menu
thả, tooltip, cột dính) dùng `--glass-solid` ĐẶC hẳn — globals.css tự bắt chúng
theo class vị trí (`fixed/absolute/md:absolute/sticky` hoặc `shadow-xl`) + nền
`--color-surface*`; lớp nổi viết kiểu khác thì phải tự đặt
`bg-[var(--glass-solid)]`, nếu không chữ hai lớp đọc chồng lên nhau.

**Kính đặt lớp mờ ở `::before`, không trên chính phần tử** (`.c-glass`,
`.c-topnav`, `.c-mtopbar`, `.c-bottomnav`). Giống `transform`,
`backdrop-filter` biến phần tử thành KHỐI CHỨA của `position: fixed` — modal
render bên trong sẽ co vào nó. Đừng gắn `backdrop-filter` thẳng lên thẻ hay tấm
modal.

**`.c-main` KHÔNG được có `z-index`.** Nó là tấm nền phủ lên phông nhờ
`position: relative` + đứng sau phông trong DOM. Thêm z-index là tạo stacking
context, mọi modal `z-50` bên trong rơi xuống DƯỚI thanh điều hướng `z-40`.

**Chữ hai giọng, không chữ nghiêng.** Tiêu đề lớn (`.c-display`,
`.c-page-title`, tên trang trên thanh điện thoại, logo) là Bricolage Grotesque
800 hẹp 85% VIẾT HOA bằng CSS; mọi chữ và SỐ còn lại là Playfair (`next/font`,
có trục opsz). `.c-italic` còn đó để JSX cũ không vỡ nhưng không nghiêng nữa.
Chữ phụ không nhỏ hơn 13px.

**Màu số liệu: tốt = xanh lá `--good`, xấu = đỏ `--bad`, luôn kèm ▲/▼ hoặc
+/−.** Thu, tiết kiệm, streak tăng → xanh ▲; chi, nợ, vượt ngân sách tăng → đỏ
▲; chi GIẢM → xanh ▼. Chênh lệch trong sai số → xám "trong sai số". Viên delta
là `.c-delta.good/.bad` trên tấm nền, `.c-pill.good/.bad` trên kính. Không màu
nào khác mang nghĩa tốt/xấu, và hai màu này không bao giờ tô nền thẻ hay nút.

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
`:root`; bảng tối chỉ áp khi người dùng bấm nút (`[data-theme="dark"]`).

**Không có sidebar.** Từ 768px: `TopNav` là tấm kính dính đỉnh, đứng TRƯỚC
phông cảnh với `margin-bottom` âm (nên vừa nằm trên phông lúc đầu trang, vừa
dính được khi cuộn); qua khỏi phông thì `data-scrolled` đậm kính lên để chữ
trắng không chìm trên nền kem. Điện thoại: `MobileTopBar` (kính, tên trang) +
dock kính `MobileNav` ở đáy.

**Bán kính `--radius-sm/md/lg/xl/2xl` TRÙNG TÊN với thang của Tailwind v4** ⇒
đổi chúng là đổi luôn mọi `rounded-*` trong JSX. Bo của hệ v3 đặt TÊN RIÊNG:
`--radius-card` 28px, `--radius-tile` 26px, `--radius-sheet` 36px,
`--radius-btn` 16px, `--radius-field` 18px. Đã có tiền lệ: đặt
`--radius-md: 16px` cho ô nhập làm mọi ô `rounded-md` 31px của bản đồ nhiệt
biến thành hình tròn.

**Nhịp trang do `.c-main` quy định**, không phải từng trang tự đặt: khung
1180px, 22px giữa các khối, 24px đệm thẻ (18px điện thoại). Đừng chồng
`max-w-*` hay `py-*` lên `<main>`.

**Vẽ hay sửa biểu đồ** → đọc `docs/bieu-do.md` trước (rút từ *Storytelling
with Data*). Tóm tắt: tiêu đề là câu kết luận tính từ dữ liệu; XÁM là mặc
định, màu nhấn `VIZ.accent` chỉ cho điểm câu chuyện nói tới; không pie/donut,
không hai trục Y, không `<Legend>` dưới đáy, lưới chỉ ngang và nét liền. Dùng
`src/lib/viz.tsx` + `src/components/charts/ChartCard.tsx`; mẫu chuẩn là
`MonthBreakdown.tsx`. globals.css KHÔNG còn ép màu dữ liệu — các class
`.c-chart-multi` / `.c-series-*` đã gỡ; mỗi `<Bar>/<Line>/<Area>` phải tự đặt
`fill`/`stroke` bằng token `--viz-*`. Bảng `--viz-cat-1..4` đã qua kiểm mù màu,
đừng tự thêm màu thứ năm — gộp vào "Khác".

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
`useAccounts()`, đừng viết lại cái thứ tư. Ô nhóm phụ cũng vậy: `SubGroupSelect` (một `<select>` thật — Safari iPhone KHÔNG hiện gợi ý của `<datalist>`, ở bước duyệt hoá đơn người dùng chỉ thấy ô trống). Ô phân bổ dự án cũng vậy:
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
hiện nguyên câu lỗi tiếng Anh của Google, trong khi model dự phòng vẫn chạy. `timeoutMs` phải LỚN HƠN thời gian
model thật sự cần — đo trước, đừng đoán: OCR hoá đơn từng đặt 20 s trong khi
hai model dự phòng mất 23 s, nên lượt nào chậm là hỏng (07/10, 10/10). Lượt bị
cắt vì quá giờ báo "Request aborted", `aiRetry.ts` coi đó là lỗi thoáng qua và
nhảy model; OCR có chuỗi dự phòng riêng xếp model NHANH lên trước
(`GEMINI_VISION_CHAIN`).

**Hàm Vercel phải ở CÙNG vùng với DB.** DB là Supabase Singapore
(`ap-southeast-1`), nên `vercel.json` ghim `regions: ["sin1"]`. Đừng gỡ: trước
11/10 hàm chạy ở Mỹ (`iad1`), mỗi truy vấn ~230 ms, mở danh sách nháp mất
2,6–4,6 s và duyệt hoá đơn (~15–20 truy vấn trong một `$transaction`) vượt
giới hạn 5 s của Prisma, báo "Transaction not found". Kiểm vùng đang chạy:
header `x-vercel-id` của một API đã đăng nhập, dạng `hkg1::sin1::…`.

**Thêm route API** → mặc định là phải đăng nhập (`requireUser()`). Công khai
chỉ có (danh sách trong `src/proxy.ts`), mỗi route TỰ kiểm khoá của nó:
`api/video/{upload,pending,share}` (`VIDEO_UPLOAD_TOKEN` hoặc vé ký từ nó, Shortcut iOS) và trang `/video-share` mà Shortcut mở (chỉ đọc/ghi qua route cần vé),
`api/receipt/upload` (`RECEIPT_UPLOAD_TOKEN`, Shortcut hoá đơn),
`api/bot/telegram` (header bí mật suy từ `TELEGRAM_BOT_TOKEN` + chỉ nhận
`TELEGRAM_CHAT_ID`), `api/bot/remind` (`CRON_SECRET`). `api/bot/setup` thì
KHÔNG được công khai — ai gọi được nó là trỏ được webhook đi nơi khác; vì
`isPublic` so tiền tố, đừng đặt nó dưới `api/bot/telegram/`.
Đừng nới `PUBLIC_PATHS` để tiện kiểm thử rồi quên hoàn nguyên.

**Bot ghi chi tiêu (Telegram + Shortcut)** → `docs/bot-ghi-chi-tieu.md`. Bot
KHÔNG ghi thẳng `Transaction`: mọi tin nhắn/ảnh thành `DraftReceipt` trước,
bấm ✅ mới ghi, qua `approveDraft()` (`src/lib/approveDraft.ts`) — CÙNG hàm
với route `process-ocr` của hộp thoại duyệt. Sửa luật ghi sổ (kiểm trùng,
`applyProjectSplits`, dời ảnh Drive, học quy tắc) là sửa ở đó, đừng viết
đường thứ hai. Ảnh phải lên Drive và có bản nháp TRƯỚC khi gọi OCR
(`saveReceiptImages`), báo "đã lưu" chỉ sau bước đó — người dùng vứt hoá đơn
giấy khi thấy chữ ấy. Đọc ảnh qua `readReceipt()` (`src/lib/receiptOcr.ts`),
chung với nút Quét trong app. Gemini đề xuất gì cũng phải qua `sanitize()`
(`src/lib/botParse.ts`): thẻ chỉ được gán khi người dùng GỌI TÊN nó — 18/10
Gemini từng tự gán thẻ Timo cho câu "quẹt thẻ" trơn. Lần sửa nháp chỉ lấy các
trường Gemini kê trong `changed`; bắt nó chép lại cả bản nháp là nó làm rơi
nhà cung cấp, nhóm, thẻ.

**Thêm mục vào dock dưới (`MobileNav`)** → dock **chỉ chứa năm mục**: Tổng
quan, Tài chính, Học tập, Thói quen, Sức khoẻ. Ở khổ 375px mục thứ sáu làm nhãn
bị bóp và vùng chạm tụt dưới 44px. Knowledge (từ 19/10/2026) và Cài đặt nằm ở
`MobileTopBar` — đó là đường duy nhất vào hai trang này trên điện thoại, đừng gỡ.

**Đụng `ReviewLog`, `FocusSession` hay `Transaction`** → thói quen có
`autoSource` đọc thẳng ba bảng này để tự đếm tiến độ (`review`, `focus`,
`noSpend`), ở cả `api/habits/route.ts` lẫn `api/habits/reports/route.ts`. Đổi ý
nghĩa một dòng trong ba bảng đó là đổi luôn số liệu và chuỗi ngày bên Thói quen,
mà không có gì báo.

**Tính chuỗi ngày / tỷ lệ hoàn thành** → chỉ có một chỗ: `src/lib/habits.ts`.
Ba quy tắc cố ý và đã có test: ngày ngoài lịch bị bỏ qua, ngày đánh dấu nghỉ
không phá chuỗi, kỳ hiện tại chưa đủ chỉ tiêu thì chưa tính là đứt. Đừng tính
lại ở component — hai công thức là hai con số khác nhau trên cùng màn hình.

**Sức khoẻ: một tài khoản, nhiều người.** Chồng và vợ là hai `HealthProfile`
dưới CÙNG một `User` — số đo và buổi tập gắn vào `profileId`, không phải
`userId`. Route nào nhận `profileId` phải hỏi `ownProfile()` trước
(`src/lib/healthServer.ts`). Nhập phiếu đo / ảnh Hevy qua `api/health/import`
CHỈ đọc, không ghi — form điền sẵn để người dùng soát rồi mới lưu, như luồng OCR.

**Tính kỷ lục, 1RM, số hiệp mỗi nhóm cơ, ngưỡng chỉ số** → chỉ ở
`src/lib/health.ts`. 1RM là Epley (khớp Hevy). Kỷ lục gom theo **tên bài tiếng
Anh nguyên văn** (`WorkoutExercise.name`) — đừng dịch tên bài, kể cả trong
`<datalist>` của `src/lib/exercises.ts`: dịch là một bài thành hai bộ kỷ lục.
Chênh lệch giữa hai lần đo nhỏ hơn `METRICS[k].noise` là sai số máy — giao diện
ghi "trong sai số", không tô xanh/đỏ.

**Lối vào /health trên điện thoại là mục thứ năm của dock `MobileNav`** (từ
19/10/2026; trước đó là nút trái tim ở `MobileTopBar`). Đừng gỡ.

**Không bao giờ dùng dữ liệu giả.** Màn hình trống thì để trống, đừng bịa số.

## Kiểm trước khi báo xong

```
node_modules/.bin/tsc --noEmit    # phải sạch
node_modules/.bin/eslint src      # 43 vấn đề có sẵn — không được thêm cái nào
```
