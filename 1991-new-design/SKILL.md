---
name: 1991-new-design
description: Dùng khi thiết kế, code hoặc soát giao diện cho Crucible OS (Tài chính, Học tập, Thói quen, Sức khoẻ, Knowledge) — hướng v3 "Mật ong & Bạch đàn": widget kính trên phông hoàng hôn, nền soft UI, ô pastel, tiêu đề grotesk đậm + chữ/số serif Playfair, số tốt xanh lá / số xấu đỏ.
---

# 1991 New Design v3 — "Mật ong & Bạch đàn"

Ngôn ngữ thiết kế cho Crucible OS do chủ dự án chốt ngày 19/10/2026 sau 3 vòng demo. **Thay hoàn toàn** hướng cũ (kính trong 17% trên nền ambient, serif nghiêng, đất nung một màu). File tham chiếu đi kèm:

- `demo/index.html` — demo chạy được (font nhúng sẵn), nút mặt trăng đổi sáng/tối, thu hẹp < 560px để xem bản điện thoại.
- `demo/*.png` — ảnh chụp desktop sáng/tối và điện thoại.
- `crucible-v3.css` — toàn bộ token + công thức thành phần của demo (class demo, dùng làm bản mẫu khi chuyển sang `c-*` của dự án).

Khi demo và skill lệch nhau, **demo đúng**. Khi đổi bất cứ gì về giao diện: làm demo cho chủ dự án xem TRƯỚC, chỉ sửa code/skill sau khi được duyệt.

## 1. Năm ý chính

1. **Hai tầng.** Đầu trang là "phông cảnh" hoàng hôn ấm với **widget kính** (kiểu visionOS weather): số lớn, chữ trắng. Phần dưới là **tấm nền kem** bo 36px trườn lên che phông (margin-top −80px), mọi nội dung chi tiết nằm ở đây.
2. **Soft UI trên tấm nền:** thẻ cùng màu nền, nổi bằng bóng kép sáng–tối; ô nhập, rãnh tab, rãnh cột biểu đồ **lõm** vào. Nhẹ tay — không viền, không gradient trên thẻ.
3. **Ô pastel theo mảng:** mỗi mảng một ô màu Bạch đàn/Mật ong; một ô tối (nâu espresso) làm điểm nhấn duy nhất của hàng.
4. **Chữ hai giọng:** tiêu đề lớn grotesk cực đậm VIẾT HOA; còn lại (chữ, nhãn, **số**) là serif tương phản cao.
5. **Màu số liệu:** tốt = xanh lá, xấu = đỏ, luôn kèm ▲/▼ hoặc +/−. Các màu khác không bao giờ mang nghĩa tốt/xấu.

## 2. Màu

### Bảng gốc (chính xác theo 2 pin chủ dự án chọn)

| Nhóm | Tên | Hex | Vai trò |
|---|---|---|---|
| Mật ong | honey-200 | `#ECC494` | ô Ngân sách/Tài chính, fill cột thường, nút chính ở theme tối |
| | honey-300 | `#D6A34F` | vòng tiến độ, đầu gradient cột nhấn |
| | honey-500 | `#9F6A20` | heatmap, icon nét |
| | honey-700 | `#733E0E` | (dự phòng) |
| | honey-900 | `#542A08` | **màu hành động**: nút chính, tab đang chọn, switch, ô tối, cột nhấn |
| Bạch đàn | Eucalyptus | `#CDD4B1` | ô Thói quen, dải nền biểu đồ |
| | Pistachio | `#EBECCC` | ô Học tập, dải nền biểu đồ |
| | Peach | `#FEECD0` | ô Sức khoẻ / chi tiêu |
| | Ivory | `#FFF9E2` | chữ trên nền nâu (`--on-action`) |
| | Clay | `#DCA278` | icon kính mảng Sức khoẻ, điểm nhấn ấm |

### Token (sáng / tối)

| Token | Sáng | Tối | Ghi chú |
|---|---|---|---|
| `--sheet` | `#F4EFE6` | `#1D1712` | tấm nền + mặt thẻ soft UI |
| `--neu-hi` / `--neu-lo` | `#FFFFFF` / `#DDD2C2` | `#2A221B` / `#120D0A` | hai bóng của soft UI |
| `--ink` / `--ink-2` / `--ink-3` | `#2B1F14` / `#5E4D3D` / `#7A6857` | `#F6EEE2` / `#CBBBA8` / `#A8977F` | ink-3 4.65:1 trên sheet |
| `--line` | `rgba(84,42,8,.10)` | `rgba(255,236,210,.08)` | đường kẻ giữa hàng |
| `--action` / `--on-action` | `#542A08` / `#FFF9E2` | `#ECC494` / `#2B1F14` | đảo ở theme tối |
| `--good` / `--good-bg` | `#2F6B34` / 12% | `#86CF8F` / 14% | 5.6:1 |
| `--bad` / `--bad-bg` | `#B0281F` / 10% | `#FF8A7D` / 14% | 5.8:1 |
| `--glass` / `--glass-2` | `rgba(92,64,48,.30)` / `rgba(120,78,58,.24)` | `rgba(40,28,22,.42)` / `rgba(60,40,30,.36)` | widget kính |
| `--on-glass` / `--on-glass-2` | `#FFF` / `rgba(255,255,255,.78)` | như sáng | chữ trên kính |
| `--sky` | gradient tím khói → hồng đào → đất nung → nâu (xem CSS) | bản đêm | phông cảnh |

Ở theme tối, các ô pastel đổi sang bản trầm: peach `#3A2A20`, pistachio `#2C3022`, eucalyptus `#33382A`, honey-200 `#4A3620`.

Tối chỉ bật bằng nút (`[data-theme="dark"]`), không theo `prefers-color-scheme`.

### Quy ước tốt / xấu

- Thu, tiết kiệm, tài sản, ngày học, streak tăng → xanh lá ▲. Chi, nợ, vượt ngân sách tăng → đỏ ▲; chi **giảm** → xanh lá ▼.
- Chênh lệch trong sai số (sức khoẻ: `METRICS[k].noise`) → xám, ghi "trong sai số".
- Delta là viên `.d` (chữ màu + nền tint 10–14%), trên kính dùng `.pill` (nền trắng/xanh/đỏ mờ, chữ trắng).
- Danh sách giao dịch: thu `+…` xanh lá; chi để màu chữ; chỉ tô đỏ khoản "xấu" (vượt ngân sách, bất thường).

## 3. Chữ

| Vai | Font | Thông số |
|---|---|---|
| **Tiêu đề lớn** (h1 trang, tên trang trên thanh điện thoại, logo) | **Bricolage Grotesque** | 800, `font-stretch: 85%`, VIẾT HOA, `line-height: .92`, `letter-spacing: -.01em`, cỡ `clamp(34px, 4.8vw, 66px)`, tối đa ~16 ký tự/dòng |
| **Nhãn kỳ** trên tiêu đề ("19 · 10 · 2026 ——") | Bricolage Grotesque | 500, 11–12px, VIẾT HOA, `letter-spacing: .28–.32em`, gạch ngang 56px phía sau |
| **Chữ & số trong trang** (thân, nhãn, nút, tab, số liệu) | **Playfair** (2.0, có optical size) | `font-optical-sizing: auto`, `font-variant-numeric: lining-nums` (+ `tabular-nums` ở cột số) |
| Số lớn trên widget | Playfair 400 | `clamp(60px, 6.4vw, 92px)`, `letter-spacing: -.02em`, đơn vị (`tỷ ₫`, `tr`) viết nhỏ dạng `sup` 0.32–0.36em |
| Tiêu đề thẻ | Playfair 600 | 18–19px |
| Chữ phụ | Playfair 450 | 14px (không nhỏ hơn 13px — serif mảnh dễ nhạt) |
| Nút / tab | Playfair 500 | 15px |

Cả hai font miễn phí trên Google Fonts, **có bộ chữ tiếng Việt**. Nạp bằng `next/font` (không `@import`):

```ts
// src/app/layout.tsx
import { Bricolage_Grotesque, Playfair } from "next/font/google";
const display = Bricolage_Grotesque({ subsets: ["latin", "vietnamese"], weight: ["500", "700", "800"], axes: ["wdth"], variable: "--font-display-src" });
const text = Playfair({ subsets: ["latin", "vietnamese"], axes: ["opsz"], variable: "--font-body-src" });
// Nếu bản Next đang dùng chưa có `Playfair`, dùng `Playfair_Display` (cũng có tiếng Việt) và bỏ `axes: ["opsz"]`.
```

Không dùng chữ nghiêng. Không dùng serif cho tiêu đề lớn, không dùng grotesk cho thân bài.

## 4. Vật liệu & thành phần

### 4.1 Phông cảnh (`.scene`)
- Nền `var(--sky)` + 2 khối "đồi" mờ (`filter: blur(30px)`) ở đáy + 1 quầng "mặt trời" sáng. Có thể thay bằng ảnh phong cảnh thật của chủ dự án (ảnh mờ, tông ấm).
- Đệm đáy 110–120px để tấm nền (`.sheet`, margin-top −80px, bo `36px 36px 0 0`) trườn lên.
- Chữ trên phông (lời chào, tiêu đề) màu nâu đậm `#3A2418` ở theme sáng, kem `#FFF4E6` ở theme tối.

### 4.2 Kính (`.glass`) — **mờ đặt trên `::before`**
```css
.glass { position:relative; isolation:isolate; color:var(--on-glass); border-radius:28px; }
.glass::before { content:""; position:absolute; inset:0; z-index:-1; border-radius:inherit; background:var(--glass);
  backdrop-filter:blur(24px) saturate(1.3); -webkit-backdrop-filter:blur(24px) saturate(1.3);
  box-shadow:inset 0 1px 0 var(--glass-edge), 0 20px 40px -24px rgba(40,20,10,.5); }
```
- **Không** gắn `backdrop-filter`/`transform` trực tiếp lên thẻ chứa modal (khối chứa `position: fixed` — bẫy đã ghi trong AGENTS.md). Đặt ở `::before` thì modal con vẫn phủ đúng màn hình.
- Kính CHỈ dùng trên phông cảnh: thanh điều hướng, widget đầu trang, dock điện thoại, tooltip/menu nổi. Không dùng kính trên tấm nền kem.
- Widget chính (`.w-main`): tiêu đề + dòng phụ trái, đồng xu trang trí phải, 4 chỉ số nhỏ (icon + số) dưới trái, **số lớn** dưới phải. Widget phụ (`.w-row`, `.glass.alt`): tên + kỳ + viên delta trái, số lớn phải. Xếp chồng cách 10px như ảnh weather.

### 4.3 Soft UI trên tấm nền
- Thẻ `.neu`: nền `--sheet`, bo 28px, đệm 24px (18px ở điện thoại), bóng `9px 9px 20px var(--neu-lo), -9px -9px 20px var(--neu-hi)`.
- Lõm (ô nhập, rãnh tab, rãnh cột): `inset 3px 3px 7px var(--neu-lo), inset -3px -3px 7px var(--neu-hi)`.
- Nút: `.btn.solid` nền `--action` chữ `--on-action` (1 nút chính/màn); `.btn.soft` nổi nhẹ (`4px 4px 10px`), bấm thì lõm. Bo 16px, cao ~44px.
- Không viền 1px quanh thẻ, không gradient trên thẻ, không lồng thẻ nổi trong thẻ nổi (bên trong dùng lõm hoặc dải màu).

### 4.4 Ô pastel (`.tile`)
- Bo 26px, đệm 18px, cao tối thiểu 150px (132px điện thoại). Nội dung: nhãn + icon kính (trên), số lớn Playfair 400 + đơn vị nhỏ, dòng meta có delta (dưới).
- Màu theo mảng: Ngân sách/Tài chính = ô tối `--action` (nhấn) hoặc honey-200 · Sức khoẻ/Chi tiêu = Peach · Học tập = Pistachio · Thói quen = Eucalyptus. Mỗi hàng chỉ **một** ô tối.
- Lưới 4 cột desktop, 2 cột ≤ 900px.

### 4.5 Icon kính nhiều lớp (`.gi`)
Khối gradient 30px phía sau-phải + tấm kính mờ trắng 40% phía trước, icon nét lucide 18px màu đậm của khối. Biến thể: `honey`, `clay`, `euca`, `rose`. Dùng cho ô pastel và hàng giao dịch. Theme tối: kính 12%, icon kem.

### 4.6 Biểu đồ
- Cột dọc là **thanh tròn lõm** (rãnh `border-radius: 999px`, fill bo tròn bên trong), đặt trên **dải gradient mềm** Pistachio → Eucalyptus bo 22px.
- Xám/nhạt là mặc định (`rgba(84,42,8,.22)`), **một** cột nhấn tô `--action`. Số ghi trên đầu cột, nhãn dưới.
- Tiêu đề thẻ = câu kết luận ("Ăn uống tăng mạnh nhất") + viên delta góc phải; dòng phụ = kỳ; chân = đơn vị + nguồn.
- Vòng tiến độ (mục tiêu) và heatmap dùng thang Mật ong (`color-mix(var(--honey-500) 20–100%, var(--sheet))`); ô trống là ô lõm.
- Vẫn theo `docs/bieu-do.md`: không pie, không hai trục Y, không `<Legend>` dưới đáy, giá trị nhỏ vẽ đúng tỷ lệ (không `min-height` giả), quá 4 nhóm → "Khác".

### 4.7 Danh sách giao dịch
Hàng 44px icon kính | tên (16px/550) + dòng phụ (danh mục · tài khoản) | số tiền căn phải tabular. Đường kẻ `--line` giữa hàng.

## 5. Điều hướng & bố cục

- **Desktop:** thanh kính nổi trên phông (bo 22px): logo vuông trắng · các mục **icon 16px + chữ** · nút sáng/tối. Mục đang chọn = viên trắng 92% chữ nâu. Không sidebar.
- **Điện thoại (< 560px):**
  - Thanh trên: logo + **tên trang** (Bricolage, VIẾT HOA) + nút sáng/tối; ẩn danh sách mục.
  - **Dock kính đáy** cố định (cách mép 12px, bo 26px, nền nâu kính 66%): 5 mục **icon 22px + chữ 11px**; mục chọn nền trắng 18%. Thanh này thay `MobileNav` (giữ luật 5 mục; Cài đặt/Knowledge vào từ thanh trên).
  - **Tab trong trang** (`.seg`): chỉ icon 20px, tab đang chọn hiện thêm chữ; rãnh lõm full-width.
  - Widget tài sản xếp lại: số lớn lên trên, 4 chỉ số xuống dưới. Hai nút hành động chia đôi bề ngang.
  - Chừa `padding-bottom: 110px` cho dock; modal Finance vẫn thiết kế ở 375px, nút lưu luôn thấy.
- Khung nội dung tối đa 1180px; khoảng giữa khối 22px.

## 6. Áp vào code Crucible

- Đọc `AGENTS.md` trước; mọi bẫy kỹ thuật vẫn đúng (`backdrop-filter`/`transform` tạo khối chứa, animation `backwards`, `space-y` + `:not(.fixed)`, mặc định thẻ trong `@layer base`, `--radius-sm…2xl` trùng Tailwind v4 — bo mới đặt tên riêng như `--radius-card: 28px`, `--radius-tile: 26px`).
- Ánh xạ token cũ → mới: `--color-surface` → `--sheet`; `--color-primary` → `--action`; `--color-on-primary` → `--on-action`; `--color-text/-muted/-faint` → `--ink/-2/-3`; `--color-success/error` → `--good/--bad`; `--viz-accent` → `--action`; `--viz-muted` → `rgba(84,42,8,.22)`; `--heat-rgb` → `159,106,32`; `--ambient` → màu phẳng `--sheet` (phông cảnh chỉ nằm trong `.scene` đầu trang).
- Thêm class mới tiền tố `c-` theo công thức ở `crucible-v3.css`: `c-scene`, `c-glass`, `c-widget`, `c-sheet`, `c-neu`, `c-tile`, `c-gi`, `c-band`, `c-dock`. Các `c-btn`, `c-seg`, `c-chip`, `c-input`, `c-card` đổi theo mục 4.3.
- Cập nhật `AGENTS.md` và `docs/huong-thiet-ke-2026.md` sang hướng v3 **trong cùng commit**, ghi rõ là quyết định 19/10/2026 của chủ dự án, để các phiên khác không trả lại hướng cũ.
- Kiểm: `tsc --noEmit` sạch; `eslint src` không thêm lỗi (mốc 43); chụp 1440 + 375, sáng + tối.

## 7. Nội dung

- Mọi chuỗi qua `t("tiếng Việt", "English")`. Định dạng vi-VN: `12.400.000 ₫`, rút gọn trên widget/ô `48,2 tr` · `2,47 tỷ ₫`, `48,2%`, `19/10/2026`, dấu âm `−`.
- Tiêu đề trang là câu kết luận ngắn, viết hoa bằng CSS (`text-transform`), không viết hoa trong dữ liệu.
- Không emoji, không dữ liệu giả; trạng thái rỗng nói việc cần làm.

## 8. Checklist trước khi báo xong

- [ ] Có demo cho chủ dự án duyệt trước khi sửa code.
- [ ] Hai tầng đúng: kính chỉ trên phông cảnh; tấm nền kem dùng soft UI.
- [ ] Không `backdrop-filter` trực tiếp trên thẻ có thể chứa modal (dùng `::before`).
- [ ] Tiêu đề lớn Bricolage 800 viết hoa; còn lại Playfair; không chữ nghiêng; chữ phụ ≥ 13px.
- [ ] ≤ 1 nút chính và ≤ 1 ô tối mỗi màn/hàng; một cột nhấn mỗi biểu đồ.
- [ ] Xanh lá/đỏ chỉ cho tốt/xấu và luôn kèm mũi tên/dấu.
- [ ] Điện thoại: dock icon 5 mục, tab trong trang chỉ icon (tab chọn có chữ), không tràn ngang.
- [ ] Theme tối bật bằng nút và đã chụp kiểm tra.
