import { group, type GrammarFamily, type GrammarSyllabus } from "./types";

/**
 * Tiếng Pháp, xếp theo thang CEFR.
 *
 * Trục chính khác hẳn tiếng Anh: tiếng Pháp bắt người học trả giá ngay từ A1
 * cho hai thứ mà tiếng Anh gần như không có — **giống của danh từ** kéo theo
 * hợp giống ở mạo từ, tính từ và phân từ, và **chia động từ** đổi đuôi theo cả
 * sáu ngôi. Nên hai họ đó đứng trước, chứ không nhét vào giữa như bên tiếng
 * Anh.
 *
 * Thức giả định (subjonctif) để tận B1–B2 chứ không sớm hơn: nó không phải một
 * "thì" mà là hệ quả của mệnh đề chính, nên học trước khi vững câu phức là học
 * vẹt cái bảng chia.
 */
const FAMILIES: GrammarFamily[] = [
  {
    id: "noun-phrase",
    title: "Danh ngữ và giống",
    groups: [
      group("gender-number", "Giống và số của danh từ", [
        ["gender-basics", "Giống đực và giống cái của danh từ", "A1"],
        ["plural", "Số nhiều và các cách tạo bất quy tắc", "A1"],
        ["gender-clues", "Dấu hiệu đuôi từ đoán được giống", "A2"],
        ["compound", "Danh từ ghép và số nhiều của chúng", "B2"],
      ]),
      group("articles", "Mạo từ", [
        ["definite", "Mạo từ xác định le, la, les", "A1"],
        ["indefinite", "Mạo từ không xác định un, une, des", "A1"],
        ["partitive", "Mạo từ bộ phận du, de la, des", "A1"],
        ["contracted", "Mạo từ co rút au, aux, du, des", "A2"],
        ["de-negation", "Đổi thành de sau phủ định và sau từ chỉ lượng", "A2"],
        ["omission", "Những chỗ bỏ hẳn mạo từ", "B1"],
      ]),
      group("adjectives", "Tính từ", [
        ["agreement", "Hợp giống và hợp số của tính từ", "A1"],
        ["position", "Tính từ đứng trước hay sau danh từ", "A2"],
        ["meaning-shift", "Tính từ đổi nghĩa theo vị trí", "B2"],
        ["comparative", "So sánh hơn plus, moins, aussi", "A2"],
        ["superlative", "So sánh nhất le plus, le moins", "A2"],
        ["irregular-compare", "So sánh bất quy tắc meilleur và mieux", "B1"],
      ]),
      group("determiners", "Từ hạn định khác", [
        ["demonstrative", "Chỉ định ce, cet, cette, ces", "A1"],
        ["possessive", "Sở hữu mon, ton, son và biến thể", "A1"],
        ["quantity", "Từ chỉ lượng beaucoup de, peu de, assez de", "A2"],
        ["indefinite-det", "Tout, chaque, quelque, plusieurs", "B1"],
      ]),
    ],
  },
  {
    id: "pronouns",
    title: "Đại từ",
    groups: [
      group("subject-stress", "Đại từ chủ ngữ và nhấn mạnh", [
        ["subject", "Đại từ chủ ngữ je, tu, il...", "A1"],
        ["on", "Đại từ on và ba cách dùng của nó", "A2"],
        ["tonic", "Đại từ nhấn mạnh moi, toi, lui", "A2"],
      ]),
      group("object-pronouns", "Đại từ tân ngữ", [
        ["direct", "Tân ngữ trực tiếp me, te, le, la, les", "A2"],
        ["indirect", "Tân ngữ gián tiếp lui, leur", "A2"],
        ["y", "Đại từ y thay nơi chốn và thay à + vật", "B1"],
        ["en", "Đại từ en thay de + danh từ và thay lượng", "B1"],
        ["order", "Thứ tự khi có hai đại từ đứng cạnh nhau", "B1"],
        ["imperative-order", "Vị trí đại từ trong câu mệnh lệnh", "B1"],
      ]),
      group("relative-interrogative", "Đại từ quan hệ và nghi vấn", [
        ["qui-que", "Qui và que", "A2"],
        ["ou-dont", "Où và dont", "B1"],
        ["lequel", "Lequel và các dạng co rút", "B2"],
        ["ce-qui-que", "Ce qui, ce que, ce dont", "B2"],
      ]),
    ],
  },
  {
    id: "present",
    title: "Hiện tại và mệnh lệnh",
    groups: [
      group("present-tense", "Thì hiện tại", [
        ["er-verbs", "Động từ nhóm một, đuôi -er", "A1"],
        ["ir-verbs", "Động từ nhóm hai, đuôi -ir", "A1"],
        ["irregular", "Động từ bất quy tắc thường gặp être, avoir, aller, faire", "A1"],
        ["stem-change", "Động từ đổi gốc acheter, appeler, préférer", "A2"],
        ["reflexive", "Động từ phản thân se lever, se laver", "A1"],
      ]),
      group("imperative", "Mệnh lệnh", [
        ["forms", "Ba dạng mệnh lệnh và cách tạo", "A1"],
        ["negative", "Mệnh lệnh phủ định", "A1"],
        ["reflexive-imp", "Mệnh lệnh với động từ phản thân", "A2"],
      ]),
      group("near-tenses", "Thì kề hiện tại", [
        ["futur-proche", "Tương lai gần aller + nguyên thể", "A1"],
        ["passe-recent", "Quá khứ gần venir de + nguyên thể", "A2"],
        ["en-train-de", "Đang diễn ra être en train de", "A2"],
      ]),
    ],
  },
  {
    id: "past",
    title: "Các thì quá khứ",
    groups: [
      group("passe-compose", "Passé composé", [
        ["avoir", "Passé composé với avoir", "A1"],
        ["etre", "Passé composé với être và danh sách động từ đi với être", "A1"],
        ["agreement-etre", "Hợp phân từ với chủ ngữ khi dùng être", "A2"],
        ["agreement-cod", "Hợp phân từ với tân ngữ trực tiếp đứng trước", "B1"],
        ["reflexive-past", "Passé composé của động từ phản thân", "B1"],
      ]),
      group("imparfait", "Imparfait", [
        ["forms", "Cách tạo imparfait từ ngôi chúng tôi", "A2"],
        ["uses", "Tả cảnh, thói quen và trạng thái", "A2"],
        ["vs-pc", "Chọn imparfait hay passé composé", "B1"],
      ]),
      group("other-past", "Quá khứ khác", [
        ["plus-que-parfait", "Plus-que-parfait cho việc xảy ra trước", "B1"],
        ["passe-simple", "Passé simple và chỗ nó còn sống: văn viết", "C1"],
        ["passe-anterieur", "Passé antérieur trong văn viết", "C1"],
      ]),
    ],
  },
  {
    id: "future-conditional",
    title: "Tương lai và điều kiện",
    groups: [
      group("future", "Tương lai", [
        ["futur-simple", "Futur simple và các gốc bất quy tắc", "A2"],
        ["futur-anterieur", "Futur antérieur", "B2"],
        ["quand-future", "Dùng tương lai sau quand, dès que, lorsque", "B1"],
      ]),
      group("conditional", "Điều kiện", [
        ["present", "Conditionnel présent, cách tạo và dùng", "B1"],
        ["politeness", "Dùng điều kiện cho lời đề nghị lịch sự", "A2"],
        ["passe", "Conditionnel passé và chuyện đã không xảy ra", "B2"],
        ["hearsay", "Điều kiện dùng cho tin chưa kiểm chứng", "C1"],
      ]),
      group("si-clauses", "Câu điều kiện với si", [
        ["si-present", "Si + hiện tại, mệnh đề chính ở tương lai", "A2"],
        ["si-imparfait", "Si + imparfait, mệnh đề chính ở conditionnel", "B1"],
        ["si-pqp", "Si + plus-que-parfait, giả định trái quá khứ", "B2"],
      ]),
    ],
  },
  {
    id: "subjunctive",
    title: "Thức giả định",
    groups: [
      group("subj-forms", "Cách tạo", [
        ["present-forms", "Subjonctif présent, dạng đều và bất quy tắc", "B1"],
        ["passe-forms", "Subjonctif passé", "B2"],
      ]),
      group("subj-uses", "Khi nào phải dùng", [
        ["will-emotion", "Sau động từ chỉ ý muốn và cảm xúc", "B1"],
        ["impersonal", "Sau cấu trúc vô nhân xưng il faut que, il est important que", "B1"],
        ["conjunctions", "Sau liên từ bien que, pour que, avant que, à moins que", "B2"],
        ["doubt", "Sau nghi ngờ và phủ định của ý kiến", "B2"],
        ["superlative-rel", "Sau so sánh nhất và sau le seul qui", "C1"],
        ["vs-indicatif", "Chọn giả định hay trần thuật: espérer và penser", "B2"],
      ]),
    ],
  },
  {
    id: "sentence-types",
    title: "Kiểu câu",
    groups: [
      group("negation", "Phủ định", [
        ["ne-pas", "Ne... pas và vị trí hai phần", "A1"],
        ["other-neg", "Ne... jamais, plus, rien, personne, que", "A2"],
        ["combined", "Ghép nhiều phủ định trong một câu", "B2"],
        ["ne-expletif", "Ne thừa nghĩa trong văn viết", "C1"],
      ]),
      group("questions", "Nghi vấn", [
        ["three-ways", "Ba cách hỏi: ngữ điệu, est-ce que, đảo ngữ", "A1"],
        ["question-words", "Từ hỏi qui, que, quoi, où, quand, comment, pourquoi", "A1"],
        ["quel", "Quel và các dạng hợp giống", "A2"],
        ["indirect-q", "Câu hỏi gián tiếp", "B1"],
      ]),
      group("voice", "Dạng câu", [
        ["passive", "Bị động và hợp phân từ", "B1"],
        ["passive-avoid", "Tránh bị động bằng on và bằng động từ phản thân", "B2"],
        ["causative", "Faire + nguyên thể, sai khiến", "B2"],
      ]),
    ],
  },
  {
    id: "complex",
    title: "Câu phức và liên kết",
    groups: [
      group("infinitive", "Nguyên thể và giới từ trước nó", [
        ["bare", "Động từ đi thẳng với nguyên thể", "A2"],
        ["de-a", "Động từ đòi de hoặc à trước nguyên thể", "B1"],
        ["pour-avant", "Pour, avant de, sans + nguyên thể", "B1"],
        ["past-inf", "Nguyên thể quá khứ après avoir, après être", "B2"],
      ]),
      group("participles", "Phân từ", [
        ["present-part", "Phân từ hiện tại và gérondif en + -ant", "B1"],
        ["adj-verbal", "Phân biệt tính từ động từ và phân từ hiện tại", "C1"],
      ]),
      group("reported", "Lời nói gián tiếp", [
        ["statements", "Thuật lại câu trần thuật", "B1"],
        ["backshift", "Lùi thì khi động từ dẫn ở quá khứ", "B1"],
        ["questions-orders", "Thuật lại câu hỏi và câu mệnh lệnh", "B2"],
      ]),
      group("connectors", "Từ nối", [
        ["cause", "Nguyên nhân parce que, car, puisque, comme", "A2"],
        ["consequence", "Kết quả donc, alors, c'est pourquoi, si bien que", "B1"],
        ["opposition", "Đối lập mais, pourtant, cependant, alors que", "B1"],
        ["concession", "Nhượng bộ bien que, même si, malgré", "B2"],
        ["goal", "Mục đích pour que, afin que", "B2"],
        ["register", "Chọn từ nối theo văn nói hay văn viết", "C1"],
      ]),
    ],
  },
  {
    id: "prepositions",
    title: "Giới từ",
    groups: [
      group("place-time", "Nơi chốn và thời gian", [
        ["countries", "Giới từ trước tên nước và thành phố", "A1"],
        ["time-preps", "Depuis, pendant, pour, il y a, dans", "A2"],
        ["en-dans", "Phân biệt en và dans khi nói thời lượng", "B1"],
      ]),
      group("verb-preps", "Giới từ gắn với động từ", [
        ["common", "Những cặp động từ và giới từ hay gặp", "B1"],
        ["change-meaning", "Động từ đổi nghĩa theo giới từ đi kèm", "B2"],
      ]),
    ],
  },
];

export const FR_SYLLABUS: GrammarSyllabus = {
  code: "fr",
  scale: "CEFR",
  levels: ["A1", "A2", "B1", "B2", "C1"],
  families: FAMILIES,
  references: [
    "Khung tham chiếu châu Âu (CEFR) — thang A1–C1",
    "Grammaire progressive du français (CLE International) — thứ tự giới thiệu theo cấp",
    "Bescherelle: La conjugaison pour tous — phân nhóm động từ và bảng chia",
    "Le Bon Usage (Grevisse & Goosse) — khung mô tả, nhất là phần hợp phân từ",
  ],
};
