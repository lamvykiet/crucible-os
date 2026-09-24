import { group, type GrammarFamily, type GrammarSyllabus } from "./types";

/**
 * Tiếng Quảng Đông.
 *
 * Thang ở đây là **thang tự đặt**, bốn bậc, và phải nói thẳng như vậy: tiếng
 * Quảng Đông không có kỳ thi chuẩn nào được dùng rộng rãi như HSK hay TOPIK.
 * Gán bừa nhãn HSK hay CEFR vào đây là bịa ra một thứ không tồn tại.
 *
 * Đừng bê khung Quan Thoại sang. Chữ viết giống nhau nhưng ngữ pháp lệch ở
 * những chỗ rất hay dùng:
 *
 * - **Tân ngữ kép ngược thứ tự**: Quan Thoại 给我书, Quảng Đông 畀本書我 — vật
 *   đứng trước người.
 * - **Lượng từ làm dấu xác định**: 本書 tự nó đã là "cuốn sách đó", không cần
 *   từ chỉ định.
 * - **Trợ từ cuối câu** là cả một hệ thống, và là chỗ người học nghe hiểu hết
 *   chữ mà vẫn không bắt được thái độ người nói. Nên nó là một họ riêng, không
 *   phải một bài phụ lục.
 * - **So sánh** dùng 過 đặt sau tính từ, không phải 比 đặt trước.
 */
const FAMILIES: GrammarFamily[] = [
  {
    id: "basic",
    title: "Khung câu cơ bản",
    groups: [
      group("core", "Trật tự câu", [
        ["svo", "Trật tự chủ ngữ – động từ – tân ngữ", "1"],
        ["hai", "Câu với 係", "1"],
        ["jau-mou", "有 và 冇 chỉ sở hữu và tồn tại", "1"],
        ["hai-place", "喺 chỉ nơi chốn", "1"],
        ["adj-predicate", "Câu vị ngữ tính từ và 好", "1"],
        ["double-object", "Tân ngữ kép: vật đứng trước người", "2"],
      ]),
      group("negation", "Phủ định", [
        ["m", "唔 phủ định chung", "1"],
        ["mou", "冇 phủ định việc đã xảy ra", "1"],
        ["mei", "未 chỉ chưa", "2"],
        ["mhou", "唔好 và 咪 trong câu cấm", "2"],
      ]),
      group("questions", "Câu hỏi", [
        ["ma-question", "Hỏi bằng 嗎 và bằng 呀", "1"],
        ["a-not-a", "Hỏi chính phản: 去唔去, 有冇", "1"],
        ["question-words", "Từ hỏi 邊個, 乜嘢, 邊度, 幾時, 點樣, 點解", "1"],
        ["mei-question", "Hỏi bằng …未", "2"],
      ]),
    ],
  },
  {
    id: "classifiers",
    title: "Lượng từ",
    groups: [
      group("cl-basic", "Lượng từ cơ bản", [
        ["go", "Lượng từ chung 個", "1"],
        ["common-cl", "Lượng từ hay gặp 本, 張, 隻, 條, 件, 部", "1"],
        ["demonstrative", "呢 và 嗰 đi với lượng từ", "1"],
      ]),
      group("cl-special", "Cách dùng riêng của tiếng Quảng", [
        ["definite", "Lượng từ đứng một mình làm dấu xác định", "2"],
        ["possessive-cl", "Lượng từ thay 嘅 khi chỉ sở hữu", "3"],
        ["di", "啲 chỉ số nhiều và chỉ lượng ít", "1"],
        ["reduplication", "Lặp lượng từ chỉ từng cái một", "3"],
      ]),
    ],
  },
  {
    id: "aspect",
    title: "Trợ từ thể",
    groups: [
      group("core-aspect", "Thể cơ bản", [
        ["zo", "咗 chỉ việc đã hoàn thành", "1"],
        ["gan", "緊 chỉ việc đang diễn ra", "1"],
        ["gwo", "過 chỉ đã từng trải qua", "2"],
        ["zyu", "住 chỉ trạng thái duy trì", "2"],
        ["hoi", "開 chỉ thói quen đã thành nếp", "3"],
      ]),
      group("verb-particles", "Trợ từ sau động từ", [
        ["saai", "晒 chỉ hết, trọn vẹn", "2"],
        ["maai", "埋 chỉ thêm vào, làm nốt", "2"],
        ["faan", "返 chỉ trở lại trạng thái cũ", "2"],
        ["can", "親 chỉ hễ mỗi lần, và chỉ bị tác động", "3"],
        ["haa", "吓 chỉ làm một chút", "2"],
        ["stacking", "Chồng nhiều trợ từ sau một động từ", "4"],
      ]),
    ],
  },
  {
    id: "final-particles",
    title: "Trợ từ cuối câu",
    groups: [
      group("fp-basic", "Nhóm cơ bản", [
        ["aa", "啊 và các biến thể làm mềm câu", "1"],
        ["la", "喇 chỉ tình hình đã đổi", "1"],
        ["lo", "囉 chỉ điều hiển nhiên", "2"],
        ["ge", "嘅 khẳng định một sự thật", "2"],
        ["ze", "啫 chỉ chỉ có thế thôi", "2"],
      ]),
      group("fp-attitude", "Nhóm chỉ thái độ", [
        ["wo", "喎 chỉ ngạc nhiên hoặc nhắc lại lời người khác", "3"],
        ["me", "咩 chỉ nghi ngờ", "2"],
        ["gwa", "啩 chỉ phỏng đoán", "3"],
        ["tim", "添 chỉ hơn nữa, thêm vào", "3"],
        ["laa-maa", "嗄 và 嘛 khi xin xác nhận", "3"],
        ["combining", "Ghép hai trợ từ và nghĩa mới sinh ra", "4"],
        ["tone-change", "Biến điệu của trợ từ làm đổi thái độ", "4"],
      ]),
    ],
  },
  {
    id: "complements",
    title: "Bổ ngữ",
    groups: [
      group("result-direction", "Kết quả và xu hướng", [
        ["result", "Bổ ngữ kết quả 完, 到, 親", "2"],
        ["direction", "Bổ ngữ xu hướng 嚟 và 去", "2"],
        ["compound-dir", "Bổ ngữ xu hướng ghép", "3"],
      ]),
      group("potential", "Khả năng", [
        ["dak", "得 chỉ làm được", "2"],
        ["m-dak", "唔…得 chỉ không làm được", "2"],
        ["potential-pattern", "Mẫu 睇得到, 買唔起", "3"],
      ]),
      group("degree", "Mức độ", [
        ["dak-degree", "得 nối bổ ngữ mức độ", "2"],
        ["extreme", "極, 死, 到爆 chỉ mức cực", "3"],
      ]),
    ],
  },
  {
    id: "comparison",
    title: "So sánh",
    groups: [
      group("compare", "Các kiểu so sánh", [
        ["gwo", "Tính từ + 過 so sánh hơn", "1"],
        ["mou-gam", "冇…咁 so sánh kém", "2"],
        ["gam", "同…一樣 và 咁 so sánh bằng", "2"],
        ["zeoi", "最 so sánh nhất", "1"],
        ["jyut", "越嚟越 chỉ mức tăng dần", "3"],
      ]),
    ],
  },
  {
    id: "prepositions-modality",
    title: "Giới từ và năng nguyện",
    groups: [
      group("preps", "Giới từ", [
        ["hai-cung", "喺, 由, 到 chỉ nơi chốn và điểm xuất phát", "1"],
        ["bei", "畀 chỉ đối tượng nhận và chỉ bị động", "2"],
        ["tung", "同 chỉ đối tượng cùng làm và đối tượng hướng tới", "2"],
        ["jung", "用 và 照 chỉ phương thức", "3"],
      ]),
      group("modals", "Động từ năng nguyện", [
        ["sik-nang", "識 chỉ kỹ năng, 能 chỉ điều kiện", "1"],
        ["ho-yi", "可以 chỉ được phép", "1"],
        ["soeng-jiu", "想 và 要", "1"],
        ["jing-goi", "應該 và 要", "2"],
        ["mou-bit-jiu", "唔使 và 唔駛 chỉ không cần", "2"],
      ]),
    ],
  },
  {
    id: "special-sentences",
    title: "Câu đặc biệt",
    groups: [
      group("patterns", "Mẫu câu", [
        ["zoeng", "將 đưa tân ngữ lên trước động từ", "3"],
        ["bei-passive", "畀 làm câu bị động", "3"],
        ["hai-ge", "係…嘅 nhấn mạnh", "3"],
        ["existential", "Câu tồn hiện", "2"],
        ["serial-verb", "Câu liên động", "2"],
        ["lin-dou", "連…都 nhấn mạnh", "3"],
      ]),
    ],
  },
  {
    id: "complex",
    title: "Câu phức",
    groups: [
      group("connectors", "Liên từ", [
        ["jan-wai", "因為…所以 chỉ nguyên nhân kết quả", "2"],
        ["seoi-jin", "雖然…但係 chỉ nhượng bộ", "2"],
        ["jyu-gwo", "如果…就 chỉ giả thiết", "2"],
        ["m-ji", "唔止…仲 chỉ tăng tiến", "3"],
        ["zi-jiu", "只要…就 và 除非…先", "4"],
        ["sin", "先 chỉ mới, chỉ điều kiện đủ", "3"],
      ]),
      group("relative", "Định ngữ và thuật lại", [
        ["ge-clause", "嘅 nối cả mệnh đề làm định ngữ", "3"],
        ["reported", "Thuật lại lời người khác bằng 話", "3"],
      ]),
    ],
  },
  {
    id: "register",
    title: "Khẩu ngữ và văn viết",
    groups: [
      group("register-gap", "Khoảng cách nói và viết", [
        ["spoken-written", "Chữ chỉ dùng khi nói và chữ tương ứng khi viết", "3"],
        ["formal-borrow", "Mượn lối viết Quan Thoại trong văn bản trang trọng", "4"],
        ["colloquial-set", "Cụm cố định trong khẩu ngữ", "4"],
      ]),
    ],
  },
];

export const YUE_SYLLABUS: GrammarSyllabus = {
  code: "yue",
  scale: "Tự đặt",
  levels: ["1", "2", "3", "4"],
  families: FAMILIES,
  references: [
    "Cantonese: A Comprehensive Grammar (Matthews & Yip) — khung mô tả chính, nhất là trợ từ cuối câu",
    "Intermediate Cantonese (Matthews & Yip) — thứ tự giới thiệu trợ từ sau động từ",
    "Thang bốn bậc ở đây là do dự án tự đặt: tiếng Quảng Đông không có kỳ thi chuẩn nào dùng rộng rãi",
  ],
};
