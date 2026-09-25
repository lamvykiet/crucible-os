import type { SkillGuide } from "./types";

/**
 * Hướng dẫn viết, theo định dạng bài thi tiếng Anh học thuật.
 *
 * Mọi câu giải thích và mẫu câu ở đây do dự án tự viết. Cấu trúc bài thi và tên
 * bốn tiêu chí chấm là dữ kiện công khai; cách diễn đạt của từng cuốn sách
 * luyện thi thì không — nên không câu nào dưới đây chép từ sách.
 */
export const EN_WRITING_GUIDE: SkillGuide = {
  code: "en",
  skill: "writing",
  title: "Viết Task 1 và Task 2",
  intro:
    "Bài này dạy cách dựng bài và cách đặt câu, không dạy mẹo. Đọc hết mất khoảng hai mươi phút, và nên đọc trước khi làm bài tập đầu tiên — viết xong rồi mới đọc thì chỉ tiếc công.",
  minutes: 20,
  sections: [
    {
      id: "overview",
      title: "Hai task khác nhau ở đâu",
      blocks: [
        {
          kind: "text",
          body:
            "Nhiều người viết Task 1 bằng đúng cái giọng của Task 2, rồi mất điểm mà không hiểu vì sao. Hai task đòi hai việc trái ngược nhau: Task 1 THUẬT LẠI, Task 2 LẬP LUẬN. Nêu ý kiến trong Task 1 là lạc đề; chỉ mô tả mà không có lập trường trong Task 2 cũng là lạc đề.",
        },
        {
          kind: "table",
          head: ["Task 1", "Task 2"],
          rows: [
            ["20 phút, tối thiểu 150 từ", "40 phút, tối thiểu 250 từ"],
            ["Tả số liệu, bản đồ hoặc quy trình", "Trả lời một câu hỏi, nêu lập trường"],
            ["Không được nêu ý kiến riêng", "Bắt buộc phải có ý kiến riêng"],
            ["Không cần kết luận dài, cần câu tổng quan", "Bắt buộc có mở bài và kết bài"],
            ["Tính hệ số 1", "Tính hệ số 2"],
          ],
        },
        {
          kind: "warn",
          title: "Ba lỗi làm hỏng bài ngay từ đầu",
          items: [
            "Viết Task 2 trước rồi hết giờ cho Task 1 — nhưng Task 1 vẫn chiếm một phần ba điểm phần Viết.",
            "Chép lại nguyên văn đề vào câu mở bài. Phần chép lại không được tính vào số từ, và giám khảo nhìn ra ngay.",
            "Viết quá ít. Dưới số từ tối thiểu là bị trừ, không có ngoại lệ.",
          ],
        },
      ],
    },
    {
      id: "task1-structure",
      title: "Task 1 — bộ khung bốn đoạn",
      blocks: [
        {
          kind: "steps",
          title: "Thứ tự viết",
          items: [
            "Đoạn 1 — Diễn đạt lại đề bằng lời của mình. Một câu. Đổi từ, đổi cấu trúc, giữ nguyên ý.",
            "Đoạn 2 — Câu tổng quan: hai tới ba xu hướng LỚN nhất. Không kèm con số nào.",
            "Đoạn 3 — Nhóm số liệu thứ nhất, có dẫn số cụ thể.",
            "Đoạn 4 — Nhóm số liệu còn lại, có dẫn số cụ thể.",
          ],
        },
        {
          kind: "text",
          title: "Câu tổng quan là chỗ ăn điểm nhất",
          body:
            "Đây là đoạn ngắn nhất nhưng quan trọng nhất của Task 1. Nó trả lời câu hỏi: nhìn từ xa thì bức tranh này nói gì? Cái gì cao nhất, cái gì thấp nhất, cái gì tăng, cái gì không đổi. Bỏ qua đoạn này là tự chặn trần điểm của mình, dù phần sau tả số liệu đúng hết.",
        },
        {
          kind: "examples",
          title: "Diễn đạt lại đề",
          note: "Giả sử đề là: The chart below shows the number of visitors to three museums in London between 2010 and 2020.",
          items: [
            {
              bad: "The chart below shows the number of visitors to three museums in London between 2010 and 2020.",
              good: "The bar chart compares how many people visited three museums in London over a ten-year period from 2010.",
              note: "Đổi shows → compares, the number of visitors → how many people visited, between 2010 and 2020 → over a ten-year period from 2010.",
            },
            {
              bad: "The graph gives information about the amount of electricity produced.",
              good: "The line graph illustrates changes in electricity output across four countries.",
              note: "Đừng dùng mãi gives information about. Chọn động từ nói đúng việc biểu đồ đang làm: compares, illustrates, traces, breaks down.",
            },
          ],
        },
        {
          kind: "phrases",
          title: "Mẫu câu tổng quan",
          note: "Điền phần trong ngoặc. Đừng dùng cả ba trong một bài.",
          items: [
            "Overall, (nhóm A) remained the highest throughout the period, while (nhóm B) saw the sharpest decline.",
            "It is clear that (xu hướng chung), although (một ngoại lệ đáng chú ý).",
            "The most striking feature is that (điểm nổi bật nhất), with (điểm nổi bật thứ hai) following a similar pattern.",
          ],
        },
      ],
    },
    {
      id: "task1-sentences",
      title: "Task 1 — cách đặt câu tả số liệu",
      blocks: [
        {
          kind: "text",
          body:
            "Câu tả số liệu chỉ có vài khuôn. Nắm ba khuôn dưới đây là đủ viết cả bài, và quan trọng hơn là đủ để KHÔNG lặp lại cùng một cấu trúc bốn lần liền — lặp cấu trúc là chỗ mất điểm ngữ pháp mà ít người để ý.",
        },
        {
          kind: "table",
          title: "Ba khuôn, xoay vòng nhau",
          head: ["Khuôn", "Ví dụ"],
          rows: [
            ["Chủ ngữ + động từ chỉ xu hướng + trạng từ", "Visitor numbers rose steadily between 2012 and 2016."],
            ["There was + tính từ + danh từ chỉ xu hướng + in + đối tượng", "There was a steady rise in visitor numbers between 2012 and 2016."],
            ["Đối tượng + saw/experienced + tính từ + danh từ", "The museum saw a steady rise in visitors over the same period."],
          ],
        },
        {
          kind: "text",
          title: "Cặp động từ và danh từ đi với nhau",
          body:
            "Mỗi xu hướng có một động từ và một danh từ tương ứng. Biết cả cặp thì đổi khuôn câu được mà không phải đổi ý: rise → a rise, increase → an increase, fall → a fall, decline → a decline, drop → a drop, fluctuate → a fluctuation, level off → a levelling off.",
        },
        {
          kind: "table",
          title: "Mức độ, chọn cho đúng",
          head: ["Mức", "Trạng từ và tính từ"],
          rows: [
            ["Rất mạnh", "dramatically / sharply / steeply — a dramatic, sharp, steep"],
            ["Đáng kể", "significantly / considerably / markedly"],
            ["Đều đặn", "steadily / gradually / consistently"],
            ["Nhẹ", "slightly / marginally"],
          ],
        },
        {
          kind: "examples",
          title: "Ba lỗi hay gặp khi dẫn số",
          items: [
            {
              bad: "The number increased 20%.",
              good: "The number increased BY 20%, reaching 120,000 in 2015.",
              note: "increase by + mức tăng; increase to + con số đạt tới. Thiếu giới từ là lỗi ngữ pháp, không phải lỗi nhỏ.",
            },
            {
              bad: "In 2010 it was 50,000. In 2011 it was 55,000. In 2012 it was 61,000.",
              good: "Numbers climbed from 50,000 in 2010 to 61,000 two years later.",
              note: "Đừng liệt kê từng năm một. Gộp thành một xu hướng rồi dẫn điểm đầu và điểm cuối.",
            },
            {
              bad: "The amount of visitors was higher.",
              good: "The number of visitors was higher.",
              note: "amount đi với danh từ không đếm được, number đi với đếm được. Đây là lỗi bị bắt rất thường xuyên trong Task 1.",
            },
          ],
        },
        {
          kind: "text",
          title: "Nếu đề là bản đồ hoặc quy trình",
          body:
            "Bản đồ thì trục là THỜI GIAN và VỊ TRÍ: cái gì mới xuất hiện, cái gì bị dỡ bỏ, cái gì được thay thế bằng cái gì, nằm ở phía nào. Dùng nhiều bị động: a car park was built, the woodland was cleared. Quy trình thì trục là THỨ TỰ: dùng bị động và từ nối chỉ trình tự, và không cần dẫn số vì quy trình không có số.",
        },
      ],
    },
    {
      id: "task2-structure",
      title: "Task 2 — bộ khung bốn đoạn",
      blocks: [
        {
          kind: "steps",
          title: "Thứ tự viết",
          items: [
            "Mở bài — Diễn đạt lại đề bằng lời mình, rồi nêu thẳng lập trường. Hai câu là đủ.",
            "Thân bài 1 — Một ý chính, giải thích tại sao, rồi một ví dụ cụ thể.",
            "Thân bài 2 — Ý chính thứ hai, cùng cách triển khai.",
            "Kết bài — Nhắc lại lập trường bằng cách nói khác. Một tới hai câu. Không đưa ý mới.",
          ],
        },
        {
          kind: "warn",
          title: "Đọc kỹ đề hỏi gì — bốn dạng, bốn cách trả lời",
          items: [
            "Do you agree or disagree? → Phải chọn một phía và giữ nó suốt bài. Đứng giữa mà không rõ lập trường là mất điểm đáp ứng yêu cầu đề.",
            "Discuss both views and give your opinion → BẮT BUỘC có cả hai phía VÀ ý kiến riêng. Thiếu một trong ba là thiếu vế của đề.",
            "What are the causes and what solutions...? → Hai thân bài phải là nguyên nhân và giải pháp, không phải hai nguyên nhân.",
            "Advantages and disadvantages → Nếu đề hỏi cái nào lớn hơn thì phải trả lời cái nào lớn hơn, không chỉ liệt kê hai bên.",
          ],
        },
        {
          kind: "examples",
          title: "Câu nêu lập trường",
          items: [
            {
              bad: "In this essay I will discuss both sides of this issue and give my opinion.",
              good: "While tighter regulation has some merit, I believe education is the more effective long-term answer.",
              note: "Câu đầu chỉ thông báo mình sắp làm gì — không mang thông tin nào. Câu sau đã nói luôn lập trường, và người chấm biết ngay bài sẽ đi về đâu.",
            },
          ],
        },
      ],
    },
    {
      id: "task2-paragraph",
      title: "Task 2 — dựng một đoạn thân bài",
      blocks: [
        {
          kind: "text",
          body:
            "Đây là chỗ quyết định band. Phần lớn bài điểm thấp không phải vì ngữ pháp sai, mà vì ý chỉ được nêu ra rồi bỏ đó. Một đoạn thân bài đạt phải đi đủ bốn bước.",
        },
        {
          kind: "steps",
          title: "Bốn bước trong một đoạn",
          items: [
            "Câu chủ đề — nêu ý chính của đoạn, một câu, không vòng vo.",
            "Giải thích — VÌ SAO điều đó đúng. Đây là bước hay bị bỏ nhất.",
            "Ví dụ hoặc hệ quả — làm cho ý trở nên cụ thể.",
            "Câu chốt — nối ý này trở lại với lập trường của bài.",
          ],
        },
        {
          kind: "examples",
          title: "Cùng một ý, viết hụt và viết đủ",
          items: [
            {
              bad:
                "Firstly, public transport is good for the environment. It reduces pollution. Many countries have good public transport. So governments should invest in it.",
              good:
                "The clearest argument for investing in public transport is environmental. A single full bus removes the equivalent of dozens of private cars from the road, which cuts both congestion and emissions at the same time. Cities that have expanded their metro networks tend to report measurable falls in roadside air pollution within a few years. Spending on transport, in other words, buys cleaner air more cheaply than most direct environmental policies.",
              note: "Bản trên có bốn câu nhưng chỉ có một ý, lặp lại bốn lần. Bản dưới cũng bốn câu nhưng mỗi câu làm một việc khác nhau: nêu, giải thích, dẫn chứng, chốt.",
            },
          ],
        },
        {
          kind: "phrases",
          title: "Mẫu câu cho từng bước",
          note: "Đừng dùng hết. Chọn mỗi bước một cái rồi đổi ở đoạn sau.",
          items: [
            "Nêu ý: The strongest argument for… is that… / A further consideration is…",
            "Giải thích: This matters because… / The reason is straightforward: …",
            "Dẫn chứng: Countries that have… tend to… / A clear case is…",
            "Chốt: For this reason, … / Taken together, these points suggest that…",
            "Nhượng bộ rồi bác lại: Critics argue that… Yet this overlooks…",
          ],
        },
        {
          kind: "warn",
          title: "Từ nối — dùng ít mà đúng",
          items: [
            "Đừng mở đầu mọi đoạn bằng Firstly, Secondly, Finally. Bốn đoạn mà đánh số cả bốn là nghe như danh sách, không phải lập luận.",
            "Moreover và Furthermore không phải lúc nào cũng thay được cho nhau về sắc thái, và rắc hai từ đó vào mỗi câu thứ hai là dấu hiệu rõ nhất của bài học thuộc mẫu.",
            "Từ nối tốt nhất thường là những từ không ai để ý: This, Such, These, Yet, So.",
          ],
        },
      ],
    },
    {
      id: "timing",
      title: "Chia giờ và soát bài",
      blocks: [
        {
          kind: "steps",
          title: "60 phút chia thế nào",
          items: [
            "0–5 phút — Đọc kỹ cả hai đề. Gạch ra ý chính cho Task 2 trước, để đầu tự nghĩ trong lúc làm Task 1.",
            "5–23 phút — Viết Task 1.",
            "23–28 phút — Lập dàn ý Task 2: lập trường, hai ý chính, mỗi ý một ví dụ.",
            "28–55 phút — Viết Task 2.",
            "55–60 phút — Soát cả hai bài.",
          ],
        },
        {
          kind: "text",
          title: "Soát bài thì soát cái gì",
          body:
            "Năm phút cuối không đủ để sửa ý, nên đừng cố. Chỉ soát bốn thứ dễ sửa mà ăn điểm ngay: chia động từ theo chủ ngữ, đuôi -s ở danh từ số nhiều, mạo từ a/an/the, và dấu chấm câu ở chỗ nối hai mệnh đề. Bốn thứ này là phần lớn lỗi ngữ pháp của một bài trung bình.",
        },
        {
          kind: "warn",
          title: "Về việc học thuộc mẫu câu",
          items: [
            "Mẫu câu dài học thuộc sẵn thì giám khảo nhận ra, và phần đó bị loại khỏi phần được tính điểm.",
            "Mẫu câu trong bài này ngắn có chủ ý: chúng là khung để gắn ý của bạn vào, không phải câu để bê nguyên.",
          ],
        },
      ],
    },
  ],
  references: [
    "Định dạng bài thi và tên bốn tiêu chí chấm là thông tin công khai về cách kỳ thi vận hành",
    "Trình tự dạy tham khảo cách các tài liệu luyện thi phổ biến sắp xếp — nội dung và ví dụ do dự án tự viết",
    "Không chép câu chữ từ bất kỳ sách luyện thi nào",
  ],
};
