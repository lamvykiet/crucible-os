---
name: suong-som-design
description: Design system "Sương sớm" (v4) cho Crucible OS — bảng màu slate · trắng sương · vàng nắng · đất đỏ rút từ ảnh làng quê sương sớm, phông ảnh + kính sương. Dùng khi thiết kế, code hoặc soát bất kỳ giao diện nào của Crucible OS.
---

# Sương sớm — design system v4 của Crucible OS

**v4 = cấu trúc v3 "Mật ong & Bạch đàn" + bảng màu và phông cảnh mới.**
Giữ nguyên: hai tầng (phông cảnh + tấm nền kem), soft UI trên tấm nền, kính chỉ
ở phông/sidebar/thanh điều hướng/lớp nổi, ô pastel theo mảng, font Bricolage
Grotesque (tiêu đề lớn) + Playfair (chữ và số), màu tốt/xấu `--good`/`--bad`,
mọi luật kỹ thuật trong `AGENTS.md`.
Đổi: giá trị token màu, phông cảnh (ảnh thay gradient hoàng hôn), kính sáng
kiểu sương mù với chữ tối.

Trạng thái: bảng màu Sương sớm và 6 pattern ở mục 7 **đã duyệt** (16–17/11/2026,
demo `1991-new-design/demo/suong-som/pins-17-11.html`). Bảng token **đã duyệt và
đã vào `src/app/globals.css`** (P0, 17/11/2026 — demo
`1991-new-design/demo/suong-som/tokens.html`). Các ô ghi **"chỉnh 17/11/2026 để
đạt tương phản"** là giá trị lệch khỏi bản đầu của skill, đo trên pixel thật của
ảnh phông (xem mục 3, "Cách đo"). Bản đầu ghi trong ngoặc để còn đối chiếu.

## 1. Bảng gốc (rút từ ảnh)

| Nhóm | Token mới | Hex | Lấy từ ảnh |
|---|---|---|---|
| Sương | `--mist-50` | `#F4F1EA` | vệt nắng xuyên sương |
| | `--mist-100` | `#E6E1D6` | mép sương |
| Rêu xám | `--sage-300` | `#A9ABA0` | tán cây trong sương |
| | `--sage-500` | `#7E8279` | lá xa |
| | `--khaki-500` | `#7E7B68` | lá gần, mái tôn |
| | `--moss-700` | `#595B52` | bóng lá |
| Slate | `--slate-800` | `#313A3B` | bóng rừng |
| | `--slate-900` | `#253035` | **màu hành động** (thay `#542a08`) |
| | `--night-950` | `#1A242B` | chữ chính |
| Nắng | `--sun-200` | `#EAD9B4` | quầng nắng nhạt |
| | `--sun-300` | `#D4B27A` | quầng nắng — hành động ở theme tối |
| | `--sun-500` | `#B08A48` | vòng tiến độ, icon nét |
| | `--sun-700` | `#7D5F27` | chữ cảnh báo trên tấm nền |
| Đất đỏ | `--earth-300` | `#D7B49B` | con đường |
| | `--earth-500` | `#B98260` | điểm nhấn ấm, icon Sức khoẻ |
| | `--earth-700` | `#8A5A3E` | mái nhà gỗ |

Xanh lá trong ảnh chỉ dùng ở dạng đã ngả xám (`sage`, `khaki`, `moss`). Không
thêm xanh lá bão hoà vào màu nhận diện; `--good` là ngoại lệ duy nhất, chỉ cho
số liệu.

## 2. Ánh xạ token trong `src/app/globals.css`

Thêm bảng gốc ở mục 1 vào `:root`, rồi đổi giá trị các token NGỮ NGHĨA (tên giữ
nguyên để JSX không phải sửa). JSX hiện không tham chiếu `--honey-*` trực tiếp
(đã soát 16/11/2026) — chỉ `globals.css` dùng chúng, nên đổi các token ngữ
nghĩa sang bảng mới rồi giữ `--honey-*` làm bí danh trỏ vào token mới cho
đến khi `grep -rn "honey-" src/app/globals.css` chỉ còn dòng bí danh.

### Theme sáng (`:root`)

| Token | v3 | v4 Sương sớm |
|---|---|---|
| `--sheet` | `#f4efe6` | `#F1EEE7` |
| `--neu-hi` / `--neu-lo` | `#fff` / `#ddd2c2` | `#FFFFFF` / `#D4CFC4` |
| `--ink` / `--ink-2` / `--ink-3` | `#2b1f14` / `#5e4d3d` / `#7a6857` | `#1A242B` / `#43504E` / `#5F6863` (4.96:1 trên sheet) |
| `--line` | `rgba(84,42,8,.10)` | `rgba(26,36,43,.10)` |
| `--action` / `--on-action` | `#542a08` / `#fff9e2` | `#253035` / `#F4F1EA` |
| `--color-primary-hover` / `-active` | `#6a3810` / `#3f1f05` | `#34423F` / `#1A242B` |
| `--color-accent` | honey-500 | `--sun-700` — **chỉnh 17/11/2026 để đạt tương phản** (bản đầu `--sun-500`: 2.76:1 trên sheet, không đủ cho 16 chỗ chữ `text-[var(--color-accent)]` lẫn icon; `--sun-700` 5.12:1). Thanh `.c-progress` cũng dùng token này |
| `--color-accent-tint` / `--color-warning-tint` | honey 12% | `rgba(125,95,39,.08)` — **chỉnh 17/11/2026 để đạt tương phản** (12% làm chữ cảnh báo trên tint còn 4.38:1; 8% → 4.62:1) |
| `--accent-on-glass` (mới) | — | `#654B1D` — vòng tiến độ / icon nét **trên kính** (P1b, P11). **Chỉnh 17/11/2026 để đạt tương phản**: `--sun-700` trên kính chỉ 2.4:1 khi sau kính là lũy tre tối; giá trị này ≥ 3.34:1 |
| `--color-warning` (chữ) | honey-500 | `--sun-700` |
| `--color-focus` / `--focus-ring` | honey | `#3F4A48` / `0 0 0 3px rgba(37,48,53,.35)` |
| Ô Tài chính (`--honey-200`) | `#ecc494` | `#EFE2C4` (nắng nhạt) |
| Ô Sức khoẻ (`--peach`) | `#feecd0` | `#F0DFD2` (đất nhạt) |
| Ô Học tập (`--pista`) | `#ebeccc` | `#E3E5DC` (sương rêu) |
| Ô Thói quen (`--euca`) | `#cdd4b1` | `#DCDCCD` (khaki nhạt) |
| `--clay` | `#dca278` | `--earth-300` |
| `--glass` / `--glass-2` | nâu 30% / 24% | `rgba(244,241,234,.70)` / `rgba(244,241,234,.66)` — **chỉnh 17/11/2026 để đạt tương phản** (bản đầu .50 / .36: sau lũy tre tối chữ phụ chỉ 2.0–3.0:1) |
| `--glass-edge` | `rgba(255,255,255,.22)` | `rgba(255,255,255,.55)`; `.c-glass::before` vẽ nó thành viền 1px quanh cả kính (`inset 0 0 0 1px`), như demo |
| `--on-glass` / `--on-glass-2` | `#fff` / trắng 78% | `#1A242B` / `rgba(26,36,43,.82)` — **chỉnh 17/11/2026 để đạt tương phản** (bản đầu .72) |
| `--glass-nav` | `rgba(58,38,26,.66)` | `rgba(244,241,234,.78)` — **chỉnh 17/11/2026 để đạt tương phản** (bản đầu .62) |
| `--side-glass` (sidebar) | `rgba(255,250,244,.62)` | `rgba(247,245,240,.80)` — **chỉnh 17/11/2026 để đạt tương phản**: sidebar nằm trên lũy tre tối bên trái ảnh. Chữ nhỏ trong sidebar (nhãn nhóm, `small`, meta) đổi `--ink-3` → `--ink-2` vì `--ink-3` chỉ đạt 3.48:1 |
| `--pill-bg` (mới) | — | `rgba(247,245,240,.90)` — nền viên delta trên kính `.c-pill`; `.c-pill.good/.bad` chồng `--good-bg`/`--bad-bg` lên nó, chữ `--good`/`--bad`. **Chỉnh 17/11/2026 để đạt tương phản**: tint 12% thẳng trên kính chỉ 1.7:1 |
| `--glass-solid` | `#faf6ee` | `#F7F5F0` |
| `--scene-ink` / `--scene-ink-2` | nâu | `#F7F5EF` / `rgba(247,245,239,.90)` (**chỉnh 17/11/2026 để đạt tương phản**, bản đầu .82) + `--scene-shadow: 0 2px 18px rgba(26,36,43,.45)` gắn lên `.c-hello` |
| `--scene-sun` (mới) | quầng trắng 90% | `rgba(234,217,180,.30)` — quầng nắng `.c-scene-sun` |
| `--scene-haze` / `--scene-haze-2` (mới) | dải nâu `rgba(90,58,44,.75)` / `rgba(120,80,60,.6)` | `rgba(241,238,231,.40)` / `.30` — hai quầng mờ ở đáy phông thành lớp sương cùng tông tấm nền |
| `--tile-knowledge` (mới) | — | `var(--mist-100)`; class `.c-tile-know` |
| `--honey-100/300/500/700/900` | bảng gốc v3 | bí danh trỏ vào `--mist-50`/`--sun-300`/`--sun-500`/`--sun-700`/`--slate-900`; `--honey-200` là màu ô Tài chính |
| `--shadow-float`, `--shadow-nav` | nâu | cùng công thức, màu `rgba(26,36,43,…)` |
| `--chart-1…6` | họ mật ong | `#253035 #595B52 #7E7B68 #B08A48 #A9ABA0 #D7B49B` |
| `--viz-accent` / `--viz-muted` / `--viz-other` | | `#253035` / `#C3C2B6` / `#D6D4CA` |
| `--viz-ghost` / `--viz-grid` | | `rgba(37,48,53,.10)` |
| `--viz-cat-1…4` | | **giữ nguyên** (đã kiểm mù màu) |
| `--heat-rgb` / `--heat-empty` / `--heat-fg-strong` | | `63,74,72` / `rgba(37,48,53,.06)` / `#F4F1EA` |
| `--viz-ink` | | `#1A242B` |
| `--good`, `--bad`, `--good-bg`, `--bad-bg` | | **giữ nguyên** |

`--viz-muted` sáng 1.55:1 / tối 2.17:1 trên tấm nền là **cố ý**: cột thường luôn
có nhãn số đi kèm (quyết định 17/11/2026).

### Theme tối (`[data-theme="dark"]`)

| Token | v4 |
|---|---|
| `--sheet` / `--neu-hi` / `--neu-lo` | `#161D21` / `#232C31` / `#0B0F11` |
| `--ink` / `--ink-2` / `--ink-3` | `#EEF0EA` / `#B9C0BB` / `#8F9893` |
| `--line` | `rgba(238,240,234,.08)` |
| `--action` / `--on-action` | `#D4B27A` / `#1A242B` |
| Ô Tài chính / Sức khoẻ / Học tập / Thói quen | `#3A3324` / `#3A2C25` / `#2A302D` / `#2F3029` |
| `--glass` / `--glass-2` / `--glass-nav` | `rgba(26,36,43,.48)` / `rgba(26,36,43,.38)` / `rgba(22,29,33,.70)` |
| `--glass-edge` | `rgba(255,255,255,.22)` (chủ dự án chốt 17/11/2026) |
| `--side-glass` | `rgba(22,29,33,.72)` |
| `--on-glass` / `--on-glass-2` | `#F4F1EA` / `rgba(244,241,234,.75)` |
| `--pill-bg` | `rgba(22,29,33,.80)` |
| `--scene-ink` / `--scene-ink-2` | như theme sáng: `#F7F5EF` / `rgba(247,245,239,.90)` |
| `--scene-sun` / `--scene-haze` / `--scene-haze-2` | `rgba(212,178,122,.12)` / `rgba(14,19,22,.55)` / `rgba(14,19,22,.45)` |
| `--glass-solid` | `#1E262A` |
| `--viz-accent` / `--viz-muted` | `#D4B27A` / `#4A5450` |
| `--good`, `--bad` | giữ nguyên bảng tối hiện có |

Các dòng dưới là giá trị demo token ghi "SUY RA" (skill chưa nói), **chủ dự án
chấp nhận 17/11/2026**, cùng vài token tối P0 phải tự suy ra theo cùng lối:

| Token | Tối |
|---|---|
| `--tile-knowledge` | `var(--neu-hi)` (slate nhạt của bảng tối) |
| `--color-warning` | `--sun-300` (`--sun-700` trên sheet tối chỉ ~2.9:1) |
| `--color-accent` / `--accent-on-glass` | `--sun-300` |
| `--color-focus` / `--focus-ring` | `--sun-300` / `0 0 0 3px rgba(212,178,122,.45)` |
| `--viz-ghost` / `--viz-grid` | `rgba(238,240,234,.10)` / `rgba(238,240,234,.08)` (theo `--line` tối) |
| `--shadow-float` / bóng `--shadow-nav` | `rgba(0,0,0,.7)` / `rgba(0,0,0,.6)` (như v3 tối) |
| `--color-surface-2/3`, `--glass-inset`, `--color-border-strong` | `rgba(238,240,234,.05/.10/.05/.16)` |
| `--color-primary-hover` / `-active` | `#DEC291` / `--sun-500` (suy ra P0) |
| `--chart-1…6` | `#D4B27A #A9ABA0 #B08A48 #7E8279 #595B52 #3F4A48` (suy ra P0) |
| `--viz-other` / `--viz-ink` | `#3A4340` / `#EEF0EA` (suy ra P0) |
| `--heat-rgb` / `--heat-empty` / `--heat-fg-strong` | `212,178,122` / `rgba(238,240,234,.05)` / `#1A242B` (suy ra P0) |

## 3. Phông cảnh

`.c-shell::before` vẫn vẽ `background: var(--sky)`; chỉ đổi giá trị `--sky`
thành ba lớp: lớp phủ (veil) để chữ đọc được → ảnh → gradient dự phòng.

```css
:root {
  --scene-photo: url("/scene/suong-som.jpg");
  /* veil chỉnh 17/11/2026 để đạt tương phản — bản đầu .10 → .38 (nhạt ở đỉnh) */
  --sky:
    linear-gradient(180deg, rgba(26,36,43,.58) 0%, rgba(26,36,43,.54) 30%, rgba(26,36,43,.30) 50%, rgba(26,36,43,.40) 100%),
    var(--scene-photo) center 40% / cover no-repeat,
    linear-gradient(180deg, #D9D6CC 0%, #B9BCB1 35%, #7E8279 60%, #3F4A48 85%, #253035 100%);
}
[data-theme="dark"] {
  --sky:
    linear-gradient(180deg, rgba(14,19,22,.55) 0%, rgba(14,19,22,.78) 100%),
    var(--scene-photo) center 40% / cover no-repeat,
    linear-gradient(180deg, #2A3236 0%, #1E262A 60%, #12181B 100%);
}
```

- Ảnh do **chủ dự án cung cấp** (ảnh của mình hoặc có giấy phép, không
  watermark): ngang ≥ 2400px, JPG ≤ 400 KB, đặt ở `public/scene/suong-som.jpg`.
  Chưa có ảnh thì để `--scene-photo: none` — gradient dự phòng tự hiện.
  Ảnh hiện tại (17/11/2026, commit `373989e`): làng quê, lũy tre tối hai bên,
  ruộng lúa xanh–vàng sáng ở giữa, nhà và sương ở xa; 3840×2160, 486 KB. Ảnh
  bão hoà hơn bảng màu — **không chỉnh ảnh**, veil slate kéo nó về tông sương.
- **Veil đậm ở vùng chữ, nhạt ở vùng kính** (chỉnh 17/11/2026 để đạt tương
  phản): tên function, nhãn ngày, câu kết luận nằm ở 5–28% chiều cao viewport
  (cả 1280×800 lẫn 375×812) nên veil .58 → .54 tới 30%; vùng widget kính tự
  lo chữ của nó nên veil nhạt .30 ở 50%; đáy .40.
- **Cách đo (đổi ảnh là phải đo lại):** resample ảnh bằng
  `sips -s format bmp -z <H> <W>` về đúng cỡ `cover` của viewport (1422×800
  cho 1280×800, 1600×900 cho 1440×900, 1443×812 cho 375×812), cắt giữa, chồng
  veil theo chiều cao, rồi: chữ trên phông so với pixel sáng thứ 95 phần trăm
  của vùng chữ (chữ ≥ 24px cần 3:1, chữ 12–17px cần 4.5:1); chữ trên kính so
  với kính chồng lên ảnh đã làm mờ (Gauss 24px, saturate 1.3) ở pixel TỐI nhất
  và SÁNG nhất của cột widget tính từ đỉnh viewport (widget trôi lên khi cuộn).
  Máy không có PIL — đọc BMP bằng Python thuần.
- Không đặt thêm nền nào lên `<body>` (luật trong `AGENTS.md`).
- Tiêu đề lớn trên phông dùng `--scene-ink` + `text-shadow: var(--scene-shadow)`.

## 4. Quy tắc dùng màu

1. **Ba lớp không chồng nhau:** nhận diện (sương, rêu, nắng, đất) · ngữ nghĩa
   số liệu (`--good` / `--bad`) · trung tính (ink, line). Màu nhận diện không bao
   giờ mang nghĩa tốt/xấu.
2. **Mỗi mảng một màu, ở mọi nơi:** Tài chính = nắng · Sức khoẻ = đất ·
   Học tập = sương rêu · Thói quen = khaki · Knowledge = slate nhạt (`--mist-100`).
3. **Màu hành động duy nhất** là `--action` (slate ở sáng, nắng ở tối): nút
   chính, tab đang chọn, switch, cột nhấn, ô tối duy nhất mỗi hàng.
4. **Biểu đồ:** xám là mặc định (`--viz-muted`), `--viz-accent` chỉ cho điểm câu
   chuyện nói tới. Không dùng `--earth-500` trong biểu đồ tài chính (dễ lẫn với `--bad`).
5. **Số liệu tốt/xấu** luôn kèm ▲/▼ hoặc +/−, dấu âm là `−` (U+2212), chênh
   lệch trong sai số thì xám "trong sai số".

## 5. Chữ và số

- Giữ thang `.c-display / .c-h1…c-h5`, chữ phụ ≥ 13px.
- Số tiền theo vi-VN: `15.000 ₫`, `530,8 tr ₫`, `1,6 tỷ ₫`, `48,2%`. Đơn vị
  viết cùng dòng, cùng cỡ nhỏ hơn số một bậc; **không** đặt đơn vị kiểu chỉ số
  trên (`530.8ᵐ`), vì chữ serif nhỏ trên kính khó đọc.
- Nhãn overline giãn chữ tối đa `.12em` (hiện có chỗ giãn ~.4em).
- Giao diện mặc định tiếng Việt; mọi chuỗi mới phải có bản `vi`.

## 6. Thành phần — thay đổi so với v3

| Thành phần | Quy tắc v4 |
|---|---|
| `SceneHero` | Tên function (VIẾT HOA) + **một câu kết luận đúng với dữ liệu**. Tối đa 3 widget kính. Chiều cao phông ≤ 46vh ở desktop để thẻ đầu tiên lọt màn đầu. |
| Widget kính | Kính sương sáng, chữ `--on-glass`. Số chính một dòng, nhãn trên, so sánh dưới. Không quả cầu trang trí: nếu cần điểm nhấn thì dùng vòng tiến độ có nghĩa. |
| Tiêu đề trên tấm nền | Không lặp tên trang đã có trên phông. Dùng `SectionHeader` cho từng khối. |
| Empty state | Một câu nói việc cần làm + một nút `--action`. Không hiện "0 đ", "—", "Unavailable". Khối nào cả kỳ không có dữ liệu thì thu thành một dòng. |
| Danh sách xếp hạng | Ẩn dòng có giá trị kỳ này = 0 (để sau nút "Hiện cả khoản 0"), sắp theo kỳ này. |
| Dự báo | Chỉ hiện khi có đủ dữ liệu (≥ 7 ngày có ghi và ≥ 5 giao dịch); không đủ thì nói rõ "chưa đủ dữ liệu để dự báo". |

## 7. Pattern đã duyệt ngày 17/11/2026

Chủ dự án đã xem và **giữ cả 6 pattern** trong demo
`1991-new-design/demo/suong-som/pins-17-11.html` (nguồn: 8 pin, báo cáo
`docs/trends/2026-11-17-pin-chu-du-an.md`). Demo này là bản mẫu thị giác — khi
code lệch demo, **demo đúng**. Với các pattern này agent KHÔNG cần làm demo lại,
chỉ cần làm đúng như demo rồi chụp so sánh.

### 7.1 Sidebar hai tầng có cây tab con — `ModuleTabs` (side), `Sidebar.tsx`
- Function đang mở: dòng nền `rgba(255,255,255,.55)`, bên dưới là tab con thụt
  22px + 16px, nối bằng đường dọc 1.5px màu `--line` đậm hơn (`rgba(26,36,43,.16)`).
- Tab con đang chọn: viên `--action`, chữ `--on-action`, cao 36px, bo 12px.
- Badge số trên dòng function: nền ô Tài chính (`#EFE2C4` sáng), chữ số Playfair 12px (font giữ Bricolage + Playfair — chốt 17/11/2026).
- Danh sách vẫn đọc từ `src/lib/modules.tsx`.

### 7.2 Widget ngữ cảnh ở đáy sidebar — component mới `SidebarContextWidget`
- Nằm trên thẻ người dùng, nền `rgba(255,255,255,.62)`, viền trắng 80%, bo 20px, đệm 14px.
- Nội dung theo function đang mở (một widget tại một thời điểm):
  | Function | Vòng | Dòng chính | Dòng phụ | Nút |
  |---|---|---|---|---|
  | Tài chính | % hoá đơn chưa duyệt | "N hoá đơn chờ duyệt" | "Số liệu tháng M đang thiếu" | Duyệt ngay → mở `ReviewQueueModal` |
  | Học tập | % thẻ đến hạn đã ôn | "N thẻ đến hạn" | "Ước tính X phút" | Ôn ngay |
  | Thói quen | % việc hôm nay | "N/M việc hôm nay" | việc kế tiếp | Mở hôm nay |
  | Khác / không có việc | — | ẩn widget | | |
- Vòng 48px, nét 6px, nền `--viz-ghost`, phần đạt `--color-accent` (`--sun-700` ở sáng — **chỉnh 17/11/2026 để đạt tương phản**, bản đầu `--sun-500` chỉ 2.76:1), đầu tròn, `role="img"` + `aria-label`. Vòng đặt trên kính thì dùng `--accent-on-glass`.
- Rail thu gọn: chỉ vòng 36px + số; mục function có việc chờ hiện chấm 8px `--earth-500` viền sáng.
- Số lấy từ API sẵn có (`PendingReviewButton` cho hoá đơn). Chưa có API cho Học tập/Thói quen thì để
  widget ẩn ở function đó và ghi vào báo cáo, không tự viết API.

### 7.3 Dải tab nở chip theo màu mảng — `ModuleTabs` (rail), `MobileTopBar`
- Rãnh lõm `--neu-inset`, bo 22px, đệm 6px. Tab thường: icon 20px, ô 42×42.
- Tab chọn: nở thành viên có icon + chữ 13px/600, nền = màu ô của mảng
  (Tài chính `#EFE2C4` · Học tập `#E3E5DC` · Thói quen `#DCDCCD` · Sức khoẻ `#F0DFD2` ·
  Knowledge `--mist-100`), chữ `--ink`. Theme tối dùng màu ô tối ở mục 2.
- Chuyển động bề ngang `240ms`, tắt khi `prefers-reduced-motion`.
- **Ở trên** (thanh trên điện thoại, rail sidebar). Không thêm dock đáy.

### 7.4 Đồng hồ điểm có câu trạng thái — component mới `src/components/charts/ScoreGauge.tsx`
- Props: `value`, `max`, `label` (overline), `state` (câu 2–4 chữ), `hint` (một dòng có số),
  `delta?` ({text, tone: good|bad|flat}), `insufficient?` (boolean), `action?` ({label, href|onClick}).
- Nửa vòng: viewBox 200×110, bán kính 82, nét 16px đầu tròn. Rãnh `--viz-ghost`, phần đạt `--viz-accent`.
  Có ngưỡng (ví dụ ngân sách theo nhịp ngày) thì vạch ngưỡng 3px màu `--bad`.
- Số giữa vòng 40px Playfair (Q3 chốt 17/11/2026: phương án A, Playfair); dưới là `state` 16px/700, rồi `hint` 13px.
- `insufficient`: rãnh nét đứt `2 10`, số là "?", state "Chưa đủ dữ liệu", hint nói cần thêm gì + link hành động.
- Delta góc phải: `.c-delta.good/.bad` (▲/▼ bắt buộc), `flat` xám.
- Áp dụng: thẻ "Budget used" (`DashboardTab`), widget phục hồi Sức khoẻ, tiến độ Học tập.
- Câu `state` tính từ dữ liệu với ngưỡng rõ ràng, ghi ngưỡng trong code ngay cạnh hàm tính.

### 7.5 Toggle kính lỏng (Liquid Glass) — nút sáng/tối
- Rãnh 132×56 bo tròn, nền `rgba(26,36,43,.18)`, bóng lõm hai lớp, **viền 1px
  `rgba(26,36,43,.62)`**; nhãn "Sáng" màu `--on-glass` (`#1A242B`). Theme tối: rãnh
  `rgba(244,241,234,.16)`, viền `rgba(244,241,234,.45)`, nhãn `#F4F1EA`.
  **Chỉnh 17/11/2026 để đạt tương phản** — bản đầu (rãnh .18 / tối .55, nhãn
  `#F4F1EA` ở cả hai theme) cho nhãn 1.65:1 và rãnh lẫn vào kính 1.04–1.41:1;
  giá trị mới: nhãn ≥ 5.59:1, viền rãnh ≥ 3.34:1 so với kính quanh nó.
- Núm 46px: `radial-gradient` trắng → trong suốt (điểm sáng 32% 28%), viền trắng 85%,
  bóng ngoài `0 8px 18px rgba(26,36,43,.35)`, bóng trong hai lớp. Icon mặt trời `--sun-700` / mặt trăng `--slate-900`.
- `role="switch"` + `aria-checked`. **Chỉ dùng cho nút sáng/tối** (và tối đa một control nổi bật khác).

### 7.6 Mặt đồng hồ bấm giờ — `src/app/habits/timer`, `src/app/learning/focus`
- Đặt trong `SceneHero` (phông cảnh), không trên tấm nền kem.
- Vòng ngoài r82 nét 8px (`--action` phần đã chạy), lõi r62 nền `rgba(37,48,53,.82)`, 8 vạch chia,
  giờ `32:08` 30px chữ `--mist-50`, dòng "/ 50 PHÚT". Nút tạm dừng/kết thúc tròn 56px.

### 7.7 Vòng chia đoạn cho tiến độ — ngoại lệ của luật "không pie/donut"
- **Chỉ** cho tiến độ của MỘT đại lượng có đơn vị đếm được: 7 đoạn = 7 ngày, 4 đoạn = 4 kỹ năng.
  Không bao giờ cho cơ cấu (chi tiêu theo danh mục vẫn dùng thanh xếp hạng).
- Mỗi đoạn nét 20px đầu tròn, khe đều; đoạn xong `--action`, đoạn chưa xong `rgba(37,48,53,.18)`.
- Khi áp lần đầu, ghi ngoại lệ này vào `docs/bieu-do.md`.

## 8. Checklist QA

- [ ] Chỉ token, không hex mới trong JSX; `--honey-*` chỉ còn là bí danh trong `globals.css`.
- [ ] Chữ ≥ 4.5:1 (chữ ≥ 24px và icon ≥ 3:1) ở sáng và tối, cả trên kính với vùng ảnh sáng nhất.
- [ ] Kính chỉ ở phông/sidebar/thanh điều hướng/lớp nổi; lớp nổi dùng `--glass-solid`.
- [ ] Mỗi hàng ≤ 1 ô tối; mỗi màn ≤ 1 nút `--action` nổi bật trong mỗi khối.
- [ ] Số tốt/xấu có ▲/▼ hoặc +/−; dấu âm là `−`.
- [ ] Không lặp số, không lặp tiêu đề; empty state có hành động.
- [ ] 375px và 1280px không cuộn ngang; modal không bị co (luật `fixed`/`space-y`).
- [ ] `npm run lint` và `npx tsc --noEmit` sạch.
