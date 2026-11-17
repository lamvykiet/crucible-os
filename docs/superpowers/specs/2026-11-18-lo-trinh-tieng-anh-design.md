# Lộ trình học tiếng Anh — thiết kế

Ngày: 18/11/2026 · Hướng đã chọn: **B** · Tham chiếu: `aioenglish.com/lo-trinh`

## Vì sao

Crucible đã có đủ màn luyện (ngữ pháp 230 điểm, Gõ câu, Dịch câu, nghe, đọc, nói,
viết, từ vựng 30 ngày, thi thử) nhưng người học phải tự chọn từng màn, nên phần
lớn kỹ năng vẫn "Chưa bắt đầu". Lộ trình ráp chúng thành **một đường đi theo cấp**:
mở ra là biết hôm nay học gì, bấm "Học tiếp" là vào đúng bài kế tiếp.

## Mục tiêu / không làm / thất bại

- **Làm:** lộ trình theo cấp A1→C1, chương → bài; nút Học tiếp; mục tiêu band +
  số phút mỗi ngày + ước lượng thời gian; kế hoạch hôm nay có xoay vòng một lượt
  nghe/đọc/nói/viết; bài kiểm tra lên cấp.
- **Không làm:** bạn bè, bảng xếp hạng, xu/cửa hàng, bảng tin (chỉ một người dùng).
  Không chép bài/câu của AIO — chỉ học khuôn.
- **Thất bại dù chạy được:** số liệu bịa (ước lượng phải nói rõ là ước lượng và
  tính từ số thật); bấm Học tiếp mà rơi vào màn trống; tốn hạn mức AI vô cớ.

## Ràng buộc

- Giữ phong cách "Kính" hiện tại (thẻ `.c-card`, chip, `c-seg`, màu đất nung một
  điểm nhấn). Chỉ **bố cục** giống AIO.
- Gemini gói miễn phí: nội dung AI soạn **một lần rồi lưu**, không sinh lại mỗi lượt.
- Schema chỉ thêm (bảng mới / cột nullable), soát `migrate diff` trước khi áp.
- Khổ 375px dùng được; thẻ không tự cuộn (xem AGENTS.md).

## Các hướng đã cân nhắc

- **A. Giống hệt AIO** — chương chỉ có ngữ pháp + gõ câu. Gọn nhưng bỏ trống bốn
  kỹ năng thi IELTS.
- **B. AIO + kỹ năng thi (ĐÃ CHỌN)** — chương: ngữ pháp → gõ câu → dịch câu theo
  từng điểm; kế hoạch hôm nay thêm một lượt nghe/đọc/nói/viết xoay vòng.
- **C. Lộ trình theo giáo trình sách** — đã có `BookPath`, nhưng phụ thuộc sách
  người dùng nạp vào; không phủ đủ A1→C1.

## Cấu trúc nội dung

- **Cấp** = CEFR của khung ngữ pháp. **Chương** = một họ ngữ pháp (family) có điểm
  ở cấp đó: A1 14 · A2 17 · B1 21 · B2 21 · C1 12 chương.
- **Bài trong chương**, theo từng điểm ngữ pháp của cấp, mỗi điểm 3 bài:
  1. *Ngữ pháp* — bài giảng có sẵn (AI soạn lần đầu, lưu ở `GrammarLesson`).
     Xong khi đã mở bài (`viewedAt`).
  2. *Gõ câu* — 8 câu luyện đúng điểm đó (khẳng định, phủ định, câu hỏi, tình
     huống), độ khó Cơ bản. Xong khi qua hết câu.
  3. *Dịch câu* — cùng 8 câu, Việt → Anh. Xong khi qua ≥ 6/8 câu.
  Ví dụ B1 có 73 điểm → 219 bài.
- **Câu cho Gõ/Dịch theo điểm ngữ pháp:** AI soạn lần đầu bấm vào bài, ràng buộc
  bằng `bookBand.ts` + tên điểm ngữ pháp, lưu vào `SentenceDeck` (thêm cột
  `pointId`). Mỗi điểm tốn đúng một lượt AI, một lần.
- **Từ vựng:** "Từ đã học x / N" lấy từ giáo trình 30 ngày cùng cấp (đã có).

## Dữ liệu mới

- `LearningPath` (mỗi user × thứ tiếng một dòng): `level` (cấp đang học),
  `targetBand`, `minutesPerDay`, `startedAt`.
- `SentenceDeck.pointId String?` — bộ câu gắn với một điểm ngữ pháp.
- `LevelTest`: `level`, `startedAt`, `submittedAt`, `questions` (JSON), `answers`
  (JSON), `score`, `sectionScores`, `passed`.
- Tiến độ bài **không có bảng riêng**: suy ra từ `GrammarLesson.viewedAt` và
  `SentenceLog` (đã có) — một nguồn sự thật, không lệch.

## Màn hình (bố cục theo AIO, phong cách Kính)

Trang mới `/learning/languages/[id]/path`, và một thẻ "Lộ trình · Học tiếp" đặt
**trên cùng** trang tiếng Anh (trên bảng kỹ năng).

```
┌ Lộ trình học ──────────────────────────────── [Học tiếp →] ┐
│ (Theo đúng trình độ) (Kế hoạch mỗi ngày) (Kiểm tra lên cấp)│
└────────────────────────────────────────────────────────────┘
┌ A1 ✓ · [A2 · Đang học] · B1 · B2 · C1          [Đổi cấp ▾] ┐
│ 23%  chặng đường tới IELTS 5.5                             │
│ ████████░░░░░░░░░░░░░░░░░░|kiểm tra lên cấp (80%)          │
│ ┌ Bài đã học  31/102 ┐ ┌ Từ đã học  120/300 ┐               │
│ ◎ 45 phút mỗi ngày · khoảng 6 tuần tới hết A2   [Sửa]      │
│ 🎓 Bài kiểm tra lên cấp                         [Làm bài →] │
└────────────────────────────────────────────────────────────┘
┌ Kế hoạch hôm nay 2/5 ──────────────────────────────────────┐
│ ✓ Ngữ pháp · Used to                         ~6 phút       │
│ ▶ Gõ câu · Used to                ← Tiếp theo  ~10 phút     │
│   Dịch câu · Used to                         ~8 phút       │
│   Nghe · bài A2 (thứ Tư: nghe)               ~10 phút      │
│   Ôn từ vựng · ngày 4                        ~8 phút       │
└────────────────────────────────────────────────────────────┘
┌ Mục lục A2 · xong 3/17 chương ┐ ┌ Chương 4/17 · Thì tương lai ┐
│ Chương 1  Hiện tại ...   6/6 │ │ 2/9 bài đã học               │
│ Chương 2  ...            3/6 │ │ ✓ Ngữ pháp  Will cho dự đoán  │
│ [Chương 4  Thì tương lai 2/9]│ │ ▶ Gõ câu    Will cho dự đoán  │
│ ...  (cuộn trong khung)      │ │   Dịch câu  Will cho dự đoán  │
└──────────────────────────────┘ │   Ngữ pháp  Going to ...     │
                                  └──────────────────────────────┘
```

Điện thoại: các khối xếp dọc; mục lục và chi tiết chương thành một khối, bấm
chương thì bung danh sách bài ngay dưới.

**Màn làm bài** (`/path/lesson?point=…&kind=grammar|typing|translate`): khung
gọn, đầu trang ghi "Chương 4 · Bài 2/9", dùng lại đúng màn đã có (bài giảng ngữ
pháp, `TypingRunner`, `TranslateRunner`); xong thì có nút "Bài tiếp →".

## Quy tắc

- **Học tiếp** = bài chưa xong đầu tiên theo thứ tự chương → điểm → (ngữ pháp,
  gõ, dịch). Không có bài nào thì trỏ tới bài kiểm tra lên cấp.
- **Kế hoạch hôm nay**: lấy bài kế tiếp trên lộ trình cộng dồn số phút ước lượng
  (ngữ pháp 6, gõ câu 10, dịch câu 8) tới khi chạm `minutesPerDay − 10`; thêm một
  lượt kỹ năng xoay theo thứ trong tuần (T2 nghe, T3 đọc, T4 nói, T5 viết, rồi
  lặp); thêm ôn từ vựng nếu giáo trình 30 ngày có bộ tới hạn. Tính lại mỗi lần
  mở, không lưu. "Xong" đọc từ log hôm nay.
- **Ước lượng thời gian**: (số phút ước lượng của các bài còn lại ở cấp này) ÷
  `minutesPerDay`, ghi là "khoảng". Đích cuối theo `targetBand` quy ra cấp qua
  `bookBand.ts`.
- **Kiểm tra lên cấp** (khuôn AIO): 36 câu trắc nghiệm — 12 từ vựng, 12 ngữ pháp
  (rút từ các điểm của cấp), 12 đọc hiểu (2 đoạn). 40 phút. Đạt khi ≥ 29/36 và mỗi
  phần ≥ 7/12. Đạt thì `level` lên một bậc. Trượt thì chờ 24 giờ, rồi 3 ngày, rồi
  7 ngày. Đề AI soạn một lần cho mỗi lượt làm (3 lượt gọi: từ vựng, ngữ pháp, đọc).
  Gợi ý làm khi xong ≥ 80% nhưng không khoá.
- **Đổi cấp** bằng tay luôn được (không bắt thi).
- Lần đầu mở: hỏi cấp hiện tại, band mục tiêu, số phút mỗi ngày (một thẻ nhỏ,
  ba lựa chọn), không bắt làm bài xếp lớp.

## Để lại cho người dựng

- Cách chia số phút chính xác, thứ tự xoay kỹ năng: chỉnh được, không ảnh hưởng
  dữ liệu.
- Lượt kỹ năng trong kế hoạch dẫn sang màn đã có (nghe/đọc/nói/viết) với cấp đang học.
- Thứ tiếng khác tiếng Anh: chỉ hiện lộ trình khi có khung ngữ pháp và chữ Latin;
  còn lại ẩn thẻ.
