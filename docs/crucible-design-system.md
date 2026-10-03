# Crucible OS — hệ thiết kế "Function"

Tài liệu tự đứng được: đọc file này là dựng được giao diện đúng hệ, không cần
mở repo. Mọi giá trị dưới đây trích thẳng từ `src/app/globals.css` — nếu hai bên
lệch nhau thì **`globals.css` mới đúng**, file này sai và cần sửa lại.

Cập nhật: 03/10/2026.

---

## 1. Ẩn dụ

Nhật ký hiệu thuốc trên giấy kem. Nền không bao giờ trắng tinh mà nằm trong dải
giấy ấm; tiêu đề đặt bằng serif biên tập; thân bài bằng sans nhân văn bó chữ; và
**một** màu đất nung duy nhất đóng vai con dấu sáp.

### Năm luật, đừng phá

1. **Không dùng `#ffffff` làm nền.** Mặt phẳng đi theo bậc giấy kem → giấy cũ →
   viền taupe.
2. **Độ nổi đến từ bậc màu, không từ bóng.** Chỉ hai công thức bóng được phép,
   và chỉ cho modal / ô nhập đang gõ.
3. **Đất nung `#b05a36` chỉ cho ba việc:** nút chính, nhãn mắt, trạng thái đang
   chọn. Không tô lên mảng lớn, không tô chữ trên 24px.
4. **Serif chỉ cho tiêu đề biên tập.** Thân bài, nhãn, nút — tất cả là sans.
5. **Hình khối:** thẻ 24px, nút 40px, ô nhập và tag bo tròn hẳn, mục điều hướng
   12px. Góc vuông phá hỏng bản sắc của hệ.

### Hai chỗ cố ý lệch khỏi bản tham chiếu

- **Màu ngữ nghĩa.** Hệ gốc cấm thêm màu thứ hai, nhưng sổ thu chi phải phân
  biệt thu/chi trong một nháy mắt. Bốn màu bổ sung đều nằm trong họ đất (rêu,
  thổ hoàng, đất nung đậm, tro) và **chỉ được xuất hiện trên con số, icon và nền
  tint** — không bao giờ trên nền thẻ, nút hay thanh điều hướng.
- **Bảng tối.** Không đổi sang xanh lạnh mà hạ chính dải giấy đó xuống đêm: nền
  nâu đen ấm, chữ kem, vẫn đúng một màu đất nung.

---

## 2. Bảng màu

Sáng là mặc định, nằm thẳng trên `:root`. Bảng tối chỉ áp khi người dùng bấm nút
(`[data-theme="dark"]`) — **không** theo `prefers-color-scheme`.

### Màu gốc (chỉ bảng sáng)

| Biến | Giá trị |
|---|---|
| `--parchment` | `#fef9ef` |
| `--aged-paper` | `#f5eee1` |
| `--warm-taupe` | `#d1c9bf` |
| `--ink` | `#2a2b2f` |
| `--terracotta` | `#b05a36` |

### Token dùng hằng ngày

| Token | Sáng | Tối |
|---|---|---|
| `--color-bg` | `#fef9ef` | `#17140f` |
| `--color-surface` | `#f5eee1` | `#211d17` |
| `--color-surface-2` | `#ede4d3` | `#2b261e` |
| `--color-surface-3` | `#e2d7c2` | `#383125` |
| `--color-text` | `#2a2b2f` | `#f3ead9` |
| `--color-text-muted` | `#4d4a45` | `#c2b7a4` |
| `--color-text-faint` | `#7d766c` | `#8d8474` |
| `--color-border` | `#d1c9bf` | `#3a332a` |
| `--color-border-strong` | `#b9b0a3` | `#544a3c` |
| `--color-primary` | `#b05a36` | `#c56a42` |
| `--color-primary-hover` | `#9c4d2c` | `#d47a52` |
| `--color-primary-active` | `#8a4224` | `#b05a36` |
| `--color-on-primary` | `#fef9ef` | `#17140f` |
| `--color-accent` | `#b05a36` | `#d68a63` |
| `--color-accent-tint` | `rgba(176,90,54,.1)` | `rgba(197,106,66,.14)` |
| `--color-focus` | `#b05a36` | `#d68a63` |

### Màu ngữ nghĩa

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--color-success` | `#4f6b42` | `#8fae72` | rêu — thu nhập, đạt mục tiêu |
| `--color-warning` | `#9a7420` | `#d3a850` | thổ hoàng — chờ xử lý, gần vượt mức |
| `--color-error` | `#a8462a` | `#de8360` | đất nung đậm — chi, vượt mức |
| `--color-info` | `#5f6b6a` | `#a89c8a` | tro — thông tin trung tính |

Mỗi màu có bản `-tint` tương ứng (`--color-success-tint`…), dùng làm nền nhạt.

### Màu biểu đồ

Một dải đất, đất nung dẫn đầu. **Không phải bảng màu phân loại** — bậc 5 và 6
gần như trùng nền thẻ, nên quá 4 nhóm thì gộp phần đuôi thành "Khác" chứ đừng
xoay vòng màu.

| Token | Sáng | Tối |
|---|---|---|
| `--chart-1` | `#b05a36` | `#d4794f` |
| `--chart-2` | `#2a2b2f` | `#f3ead9` |
| `--chart-3` | `#8a7a63` | `#a89479` |
| `--chart-4` | `#c2a184` | `#7d6e58` |
| `--chart-5` | `#d1c9bf` | `#544a3c` |
| `--chart-6` | `#e6ddcd` | `#3a332a` |

---

## 3. Chữ

Font nạp qua `next/font` (biến `--font-*-src`), **không** qua
`@import url(fonts.googleapis.com)` — cách đó chặn render vì phải tải xong
stylesheet của Google rồi trình duyệt mới vẽ.

| Biến | Font | Dùng cho |
|---|---|---|
| `--font-display` | **Newsreader** | tiêu đề biên tập |
| `--font-body` | **Inter** | thân bài, nhãn, nút — mọi thứ còn lại |
| `--font-mono` | **JetBrains Mono** | mã, số cần canh cột |

Newsreader được chọn vì nó là serif biên tập tương phản cao gần nhất trên Google
Fonts **và có chữ nghiêng** — thứ mà `.c-italic` cần.

### Thang chữ

| Class | Giá trị |
|---|---|
| `.c-display` | `400 clamp(44px, 6vw, 80px)/0.98` serif |
| `.c-h1` | `400 clamp(34px, 4.4vw, 64px)/1.02` serif |
| `.c-h2` | `400 clamp(28px, 3.2vw, 45px)/1.1` serif |
| `.c-h3` | `400 clamp(21px, 2vw, 26px)/1.2` serif |
| `.c-h4` | `600 17px/1.4` sans |
| `.c-h5` | `600 15px/1.4` sans — nhãn mục trong thẻ |
| `.c-overline` | `600 12px/1.4` sans, VIẾT HOA |
| `--text-body` | `400 16px/1.5` sans |
| `--text-body-sm` | `400 14px/1.5` sans |
| `--text-caption` | `400 13px/1.4` sans |
| `--text-stat` | `400 clamp(30px, 3.4vw, 45px)/1.05` serif |

**Quy tắc chữ:**

- Serif ở trọng lượng 400 cho roman, 300 cho nghiêng — **không bao giờ đậm hơn**.
- Sans bó chữ `-0.023em` ở mọi cỡ (`--tracking-ui`). Serif **không** lấy bó chữ đó.
- `font-bold` của Tailwind đã bị hạ xuống 600, vì 700 dành cho nhấn mạnh hiếm hoi.
- Dùng thang `.c-*` cho tiêu đề. **Đừng** dùng `text-*` của Tailwind cho heading.
- `.c-italic` (serif nghiêng, chỉ từ 34px trở lên) là nước cờ đặc trưng nhất của
  hệ: roman xen nghiêng trong cùng một dòng tiêu đề. Không bao giờ cho nhãn hay
  thân bài.

---

## 4. Khoảng cách, bán kính, bóng

Khoảng cách: `--space-1` 8px → `--space-16` 96px (8, 16, 24, 32, 40, 48, 56, 64,
80, 96).

| Bán kính | Giá trị | Dùng cho |
|---|---|---|
| `--radius-sm` | 4px | |
| `--radius-md` | 12px | mục điều hướng |
| `--radius-lg` | 16px | |
| `--radius-xl` | 20px | ô nhập nhiều dòng |
| `--radius-2xl` | 24px | **thẻ** (`rounded-2xl` trong JSX) |
| `--radius-3xl` | 32px | modal |
| `--radius-btn` | 40px | nút |
| `--radius-full` | 9999px | tag, ô nhập, nút pill |

Bóng: `--shadow-sm/md/lg` đều là `none` — cố ý. Chỉ có hai công thức được phép:

- `--shadow-float` — modal
- `--shadow-input-glow` — ô nhập đang gõ
- `--focus-ring` — `0 0 0 3px rgba(176,90,54,.2)`

Thẻ có độ sâu riêng qua `--shadow-card` (rất rộng, rất nhạt, ám ấm) cộng
`--card-edge` (đường sáng 1px ở mép trên) để đọc ra "tờ giấy đặt trên tờ giấy".
Toàn trang phủ một lớp vân giấy rất nhạt (`--grain-opacity: .045`).

---

## 5. Component có sẵn

Dùng lại, **đừng dựng component song song** khi đã có class tương ứng.

| Class | Việc |
|---|---|
| `.c-btn` + `.c-btn-primary/secondary/tertiary/success/warning/danger/accent` | nút; thêm `.c-btn-sm/-lg/-icon/-pill` |
| `.c-field`, `.c-input`, `.c-select`, `.c-textarea`, `.c-help` | ô nhập và nhãn |
| `.c-switch`, `.c-check` | công tắc, ô tích |
| `.c-card`, `.c-elev-md`, `.c-elev-lg` | thẻ |
| `.c-chip` + `-solid/-outline/-success/-warning/-error` | nhãn trạng thái |
| `.c-tabs`, `.c-tab` | tab gạch chân |
| `.c-seg`, `.c-seg-opt` | nhóm nút phân đoạn |
| `.c-alert` + `-success/-warning/-error` | thông báo tại chỗ |
| `.c-table` | bảng |
| `.c-progress` | thanh tiến độ |
| `.c-delta-up`, `.c-delta-down` | số tăng/giảm |
| `.c-badge` | huy hiệu đếm |
| `.c-topnav`, `.c-topnav-item`, `.c-logo-mark`, `.c-logo-word` | thanh trên (từ 768px) |
| `.c-bottomnav`, `.c-bottomnav-item` | thanh dưới (điện thoại) |
| `.c-shell`, `.c-main` | khung trang |

**Icon:** Lucide, nét 2. Không emoji, không SVG tự vẽ.

**Nhịp trang do `.c-main` quy định** — khung 1280px, 96px giữa các khối lớn,
24px đệm thẻ. Đừng chồng `max-w-*` hay `py-*` lên `<main>`.

**Không có sidebar.** Điều hướng nằm trên thanh ngang dính đỉnh từ 768px; điện
thoại dùng thanh trên + thanh dưới. Thanh dưới **chỉ chứa năm mục** — mục thứ
sáu làm nhãn bị bóp và vùng chạm tụt dưới 44px ở khổ 375px.

---

## 6. Chuyển động

Bốn keyframe: `c-enter` (vào màn), `c-tick` (số đổi), `c-pop` (xác nhận), 
`c-nudge` (nhắc nhẹ). Lớp dùng trong JSX: `animate-in`, `fade-in`,
`zoom-in-95`, `slide-in-from-*`, `duration-200/300/500`.

Ba ràng buộc:

1. **Luôn dùng `backwards`, không bao giờ `both`.** Lý do ở mục 7.
2. Khung cuối phải bằng giá trị mặc định (`transform: none`), để không nhảy hình.
3. Tôn trọng `prefers-reduced-motion`.

Chuyển động ở đây để **xác nhận một việc vừa xảy ra**, không phải để trang trí.
Không animate thứ người dùng không vừa tác động vào.

---

## 7. Bẫy đã vấp — phần quan trọng nhất

Đây là những lỗi đã xảy ra thật, mỗi lỗi mất hàng giờ để tìm ra. Không cái nào
bị trình biên dịch hay linter bắt.

### `.c-btn` nằm NGOÀI mọi `@layer` ⇒ utility của Tailwind thua

Viết `p-0` lên một `.c-btn` thì **không có tác dụng** và không có cảnh báo nào.
Phải viết `p-0!`. Lần vấp: nút thu gọn thành icon 44px trên mobile, padding
20px của `.c-btn` giữ nguyên nên ô chứa icon còn 4px, icon bị bóp còn **2px** —
nút thành một chấm mờ.

### `animate-in` có `transform` ⇒ phần tử thành khối chứa của `position: fixed`

Modal đặt bên trong một thẻ đang chạy `c-enter` sẽ **thôi tính theo màn hình**:
nó co vừa khung thẻ và bị `overflow-hidden` cắt cụt. Đo được: lớp phủ 1278×310
thay vì 1440×900. **Cách chữa: render modal qua portal thẳng vào `<body>`.**
Đây cũng là lý do mọi animation phải dùng `backwards` chứ không `both` — `both`
giữ `transform` ở khung cuối và biến lỗi này thành vĩnh viễn.

### Mặc định thẻ HTML viết ngoài `@layer base` ⇒ nuốt sạch utility

Đã từng làm 83 heading và 58 thẻ `<p>` mất tác dụng. Mặc định thẻ phải nằm
trong `@layer base`, thang chữ nằm trong `@layer components`.

### `--radius-sm/md/lg/xl/2xl` TRÙNG TÊN với thang của Tailwind v4

Đổi chúng là đổi luôn mọi `rounded-*` trong JSX. Tiền lệ: đặt
`--radius-md: 16px` cho ô nhập làm mọi ô `rounded-md` 31px của bản đồ nhiệt
biến thành hình tròn. Bán kính nút và ô nhập đặt riêng trong `.c-btn` /
`.c-input`.

### `space-y-*` gán margin cho cả modal

Modal là phần tử anh em trong khối `space-y-*` của trang, nên quy tắc nhịp trang
từng gán `margin-top` lên lớp phủ `fixed inset-0`: ở khổ 375px modal bị đẩy
xuống 48px và nút lưu rớt khỏi đáy màn hình. Quy tắc nhịp phải luôn có
`:not(.fixed)`.

### `flex-1` trong cột flex cao tự động co phần tử về 0

`flex-1` đặt `flex-basis: 0` và **thắng** `h-64`. Trên mobile thẻ biểu đồ co về
0 và trống trơn; desktop không lộ vì lưới kéo giãn thẻ theo cột cao nhất.

### Luật recharts toàn cục ghi đè màu tự đặt

`globals.css` tô mọi `.recharts-bar-rectangle path` bằng `--chart-1` và mọi
`.recharts-area-area` cũng vậy. Hệ quả: code ghi một màu, màn hình vẽ màu khác
(đã có ~20 mã màu chết nằm trong JSX), và hai vùng của biểu đồ luỹ kế **cùng
một màu nền** chỉ khác viền. Biểu đồ cần nhiều màu phải tự nhận lớp
`.c-chart-multi` và mỗi series một lớp `.c-series-N`.

---

## 8. Do / Don't

**Do**

- Chỉ dùng biến `var(--*)` và class `.c-*` có sẵn.
- Khổ chính khi kiểm giao diện là **375px**, không phải desktop. Modal phải cuộn
  được tới trường cuối và nút lưu luôn thấy.
- Vùng chạm chuẩn **44px**.
- Nhãn phải nói đúng việc nó làm. Soát ba câu khi làm màn mới: *nhãn này có đúng
  đích đến không? người mới nhìn thấy gì? có nút nào thừa không?*
- Trạng thái rỗng phải nói phải làm gì tiếp, đừng ghi "Chưa có dữ liệu".
- Hành động không hoàn tác được **không đứng chung chỗ** với hành động dùng hằng
  ngày — phải qua một chế độ riêng hoặc một lớp xác nhận thật.

**Don't**

- Không hard-code màu hay px khi đã có token.
- Không thêm font khác.
- Không thêm bóng đổ, không neumorphism — xem luật 2. Đây là lựa chọn có chủ
  đích theo ẩn dụ giấy, không phải thiếu sót.
- Không dùng màu ngữ nghĩa trên nền thẻ, nút hay thanh điều hướng.
- Không bịa số. Màn hình trống thì để trống.

---

## 9. Dùng lại hệ này cho dự án khác

Chép file này vào repo mới (ví dụ `docs/` hoặc `.agent/rules/`) và trỏ
`AGENTS.md` / `CLAUDE.md` tới nó: *"Khi làm UI, tuân theo
docs/crucible-design-system.md"*. Nội dung không phụ thuộc công cụ nào.

Phần CSS thật nằm ở `src/app/globals.css` của Crucible OS — chép nguyên khối
`:root`, khối `[data-theme="dark"]`, `@layer base`, `@layer components` là có
đủ hệ. Giữ nguyên thứ tự layer, đó là thứ quyết định utility có thắng được hay
không.
