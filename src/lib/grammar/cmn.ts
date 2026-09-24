import { group, type GrammarFamily, type GrammarSyllabus } from "./types";

/**
 * Tiếng Trung Quan Thoại, xếp theo thang HSK.
 *
 * Trục hoàn toàn khác tiếng Anh và tiếng Pháp: tiếng Trung **không chia động
 * từ**, không có giống, không có số nhiều bắt buộc. Đổi lại, gánh nặng dồn vào
 * ba chỗ mà người nói tiếng Việt hay coi nhẹ:
 *
 * 1. **Lượng từ** — mọi danh từ đếm được đều phải có lượng từ riêng, chọn sai
 *    là sai ngay ở câu đơn giản nhất.
 * 2. **Trợ từ 了, 着, 过** — đây KHÔNG phải thì. 了 không có nghĩa là quá khứ;
 *    coi nó là quá khứ là cái sai dai dẳng nhất của người học.
 * 3. **Bổ ngữ** — kết quả, xu hướng, khả năng, mức độ. Tiếng Việt diễn đạt
 *    những ý này bằng từ riêng, tiếng Trung dồn hết vào sau động từ.
 *
 * Nên lượng từ và bổ ngữ được tách thành họ riêng và trải dài nhiều cấp, thay
 * vì nhét vào một bài "ngữ pháp cơ bản".
 */
const FAMILIES: GrammarFamily[] = [
  {
    id: "basic-order",
    title: "Trật tự câu cơ bản",
    groups: [
      group("core", "Khung câu", [
        ["svo", "Trật tự chủ ngữ – động từ – tân ngữ", "1"],
        ["shi", "Câu với 是", "1"],
        ["you", "Câu với 有 chỉ sở hữu và tồn tại", "1"],
        ["zai-place", "在 chỉ nơi chốn", "1"],
        ["time-place-order", "Thứ tự: thời gian đứng trước nơi chốn, cả hai trước động từ", "2"],
        ["adj-predicate", "Câu vị ngữ tính từ, và vì sao phải có 很", "1"],
      ]),
      group("negation-basic", "Phủ định", [
        ["bu", "不 phủ định thói quen, ý muốn và tương lai", "1"],
        ["mei", "没 phủ định việc đã xảy ra và phủ định 有", "1"],
        ["bu-vs-mei", "Chọn 不 hay 没", "2"],
        ["bie", "别 và 不要 trong câu cấm", "2"],
      ]),
    ],
  },
  {
    id: "measure-words",
    title: "Lượng từ",
    groups: [
      group("mw-basic", "Lượng từ cơ bản", [
        ["ge", "Lượng từ chung 个", "1"],
        ["common", "Những lượng từ hay gặp 本, 张, 只, 条, 件, 位", "1"],
        ["demonstr", "这, 那 đi với lượng từ", "1"],
        ["ji-duoshao", "几 và 多少 khi hỏi số lượng", "1"],
      ]),
      group("mw-advanced", "Lượng từ nâng cao", [
        ["verbal-mw", "Lượng từ động tác 次, 遍, 下, 趟", "3"],
        ["duration", "Lượng từ thời lượng và vị trí của nó", "3"],
        ["collective", "Lượng từ tập hợp và lượng từ ước chừng", "4"],
        ["mw-nuance", "Lượng từ mang sắc thái: 名, 匹, 颗, 粒", "5"],
      ]),
    ],
  },
  {
    id: "de-particles",
    title: "Ba chữ de",
    groups: [
      group("de-three", "的, 得, 地", [
        ["de-possess", "的 chỉ sở hữu và định ngữ", "1"],
        ["de-clause", "的 nối cả mệnh đề làm định ngữ", "3"],
        ["de-degree", "得 nối bổ ngữ trạng thái và mức độ", "2"],
        ["di-adverb", "地 nối trạng ngữ vào động từ", "3"],
        ["three-compare", "Phân biệt ba chữ de", "3"],
        ["de-nominal", "的 tạo danh ngữ, bỏ hẳn danh từ phía sau", "4"],
      ]),
    ],
  },
  {
    id: "aspect",
    title: "Trợ từ thể",
    groups: [
      group("le", "了", [
        ["le-verb", "了 sau động từ: việc đã hoàn thành", "1"],
        ["le-sentence", "了 cuối câu: tình hình đã đổi", "2"],
        ["le-two", "Câu có cả hai chữ 了", "3"],
        ["le-not-past", "了 không phải thì quá khứ — những chỗ dùng sai hay gặp", "3"],
        ["le-negation", "Bỏ 了 khi phủ định bằng 没", "2"],
      ]),
      group("zhe-guo", "着 và 过", [
        ["zhe", "着 chỉ trạng thái đang duy trì", "2"],
        ["zhe-manner", "着 nối hai động tác cùng lúc", "3"],
        ["guo", "过 chỉ đã từng trải qua", "2"],
        ["guo-vs-le", "Phân biệt 过 và 了", "3"],
      ]),
      group("progressive", "Đang diễn ra", [
        ["zhengzai", "正在, 在, 呢 chỉ việc đang xảy ra", "2"],
        ["jiuyao", "就要…了 và 快要…了 chỉ việc sắp xảy ra", "3"],
      ]),
    ],
  },
  {
    id: "complements",
    title: "Bổ ngữ",
    groups: [
      group("result", "Bổ ngữ kết quả", [
        ["basic", "完, 好, 到, 见, 懂 sau động từ", "2"],
        ["negation-result", "Phủ định bổ ngữ kết quả bằng 没", "3"],
      ]),
      group("direction", "Bổ ngữ xu hướng", [
        ["simple-dir", "来 và 去 sau động từ", "2"],
        ["compound-dir", "Bổ ngữ xu hướng ghép 出来, 进去, 起来", "3"],
        ["extended-dir", "Nghĩa mở rộng của 起来, 下去, 出来", "4"],
        ["object-position", "Vị trí tân ngữ trong bổ ngữ xu hướng", "4"],
      ]),
      group("potential", "Bổ ngữ khả năng", [
        ["de-bu", "得 và 不 chen giữa động từ và bổ ngữ", "3"],
        ["common-potential", "Những bổ ngữ khả năng hay gặp 听得懂, 买不起", "3"],
        ["vs-neng", "Phân biệt bổ ngữ khả năng với 能", "4"],
      ]),
      group("degree-quantity", "Bổ ngữ mức độ và số lượng", [
        ["degree", "Bổ ngữ mức độ với 得", "2"],
        ["duration-comp", "Bổ ngữ thời lượng", "3"],
        ["frequency-comp", "Bổ ngữ số lần", "3"],
        ["extreme", "极了, 死了, 坏了 chỉ mức cực", "4"],
      ]),
    ],
  },
  {
    id: "prepositions",
    title: "Giới từ",
    groups: [
      group("prep-common", "Giới từ thường dùng", [
        ["cong-dao", "从 và 到", "1"],
        ["gei", "给 chỉ đối tượng nhận", "2"],
        ["gen-he", "跟 và 和 chỉ đối tượng cùng làm", "2"],
        ["dui", "对 chỉ đối tượng hướng tới", "2"],
        ["li", "离 chỉ khoảng cách", "2"],
        ["wei-weile", "为 và 为了 chỉ mục đích", "3"],
        ["yong-anzhao", "用, 按照, 根据 chỉ phương thức và căn cứ", "4"],
      ]),
    ],
  },
  {
    id: "special-sentences",
    title: "Câu đặc biệt",
    groups: [
      group("ba-bei", "把 và 被", [
        ["ba-basic", "Câu 把: xử lý một vật xác định", "3"],
        ["ba-conditions", "Điều kiện bắt buộc của câu 把", "4"],
        ["bei-basic", "Câu 被 chỉ bị động", "3"],
        ["bei-alt", "叫, 让, 给 thay cho 被", "4"],
        ["bei-nuance", "Sắc thái không may của câu 被", "5"],
      ]),
      group("shi-de", "是…的", [
        ["focus", "是…的 nhấn vào thời gian, nơi chốn hay cách thức", "3"],
        ["vs-le", "Phân biệt 是…的 với câu có 了", "4"],
      ]),
      group("other-patterns", "Mẫu câu khác", [
        ["existential", "Câu tồn hiện: nơi chốn + động từ + vật", "3"],
        ["pivotal", "Câu kiêm ngữ với 让, 请, 叫", "3"],
        ["serial", "Câu liên động, hai động từ nối tiếp", "2"],
        ["lian-dou", "连…都/也 nhấn mạnh", "4"],
        ["chule", "除了…以外 và hai nghĩa trái nhau của nó", "4"],
      ]),
    ],
  },
  {
    id: "comparison",
    title: "So sánh",
    groups: [
      group("compare", "Các kiểu so sánh", [
        ["bi", "比 so sánh hơn", "2"],
        ["bi-degree", "比 kèm mức chênh lệch", "3"],
        ["meiyou", "没有 so sánh kém", "2"],
        ["yiyang", "跟…一样 so sánh bằng", "2"],
        ["yue", "越来越 và 越…越", "3"],
        ["zui", "最 so sánh nhất", "1"],
        ["buru", "不如 và 比不上", "5"],
      ]),
    ],
  },
  {
    id: "modality",
    title: "Động từ năng nguyện",
    groups: [
      group("ability-permission", "Khả năng và cho phép", [
        ["hui", "会 chỉ kỹ năng học được", "1"],
        ["neng", "能 chỉ điều kiện cho phép", "1"],
        ["keyi", "可以 chỉ được phép", "1"],
        ["three-compare", "Phân biệt 会, 能, 可以", "2"],
      ]),
      group("will-duty", "Ý muốn và bổn phận", [
        ["yao-xiang", "要 và 想", "1"],
        ["yuanyi", "愿意 và 肯", "3"],
        ["yinggai", "应该 và 该", "2"],
        ["dei-bixu", "得 và 必须", "3"],
        ["negation-modal", "Phủ định của động từ năng nguyện, và bẫy 不用 với 不必", "3"],
      ]),
    ],
  },
  {
    id: "complex-sentences",
    title: "Câu phức",
    groups: [
      group("paired", "Cặp liên từ", [
        ["yinwei", "因为…所以 chỉ nguyên nhân kết quả", "2"],
        ["suiran", "虽然…但是 chỉ nhượng bộ", "2"],
        ["ruguo", "如果…就 chỉ giả thiết", "2"],
        ["budan", "不但…而且 chỉ tăng tiến", "3"],
        ["zhiyao-zhiyou", "只要…就 và 只有…才", "4"],
        ["jishi", "即使…也 chỉ giả thiết nhượng bộ", "4"],
        ["yushu", "与其…不如 chỉ chọn lựa", "5"],
        ["ningke", "宁可…也不 chỉ thà rằng", "5"],
      ]),
      group("adverb-links", "Phó từ nối", [
        ["jiu-cai", "就 và 才: sớm hay muộn so với mong đợi", "3"],
        ["you-zai", "又 và 再: đã lặp hay sẽ lặp", "2"],
        ["hai-geng", "还 và 更 khi tăng mức", "3"],
        ["dou", "都 và phạm vi nó bao", "1"],
      ]),
    ],
  },
  {
    id: "register",
    title: "Văn viết và thành ngữ",
    groups: [
      group("written", "Lối viết", [
        ["formal-words", "Từ văn viết thay cho từ khẩu ngữ", "5"],
        ["classical-remnant", "Dấu vết văn ngôn còn dùng: 之, 其, 所", "6"],
        ["chengyu", "Thành ngữ bốn chữ và cách chen vào câu", "5"],
        ["long-modifier", "Định ngữ dài trước danh từ trong văn viết", "6"],
      ]),
    ],
  },
];

export const CMN_SYLLABUS: GrammarSyllabus = {
  code: "cmn",
  scale: "HSK",
  levels: ["1", "2", "3", "4", "5", "6"],
  families: FAMILIES,
  references: [
    "Chuẩn trình độ tiếng Trung quốc tế (HSK) — thang 1–6",
    "现代汉语八百词 (Lữ Thúc Tương) — cách phân loại hư từ và ví dụ dùng",
    "Mandarin Chinese: A Functional Reference Grammar (Li & Thompson) — khung mô tả bổ ngữ và thể",
    "实用现代汉语语法 (Lưu Nguyệt Hoa và cộng sự) — thứ tự dạy câu 把 và câu 被",
  ],
};
