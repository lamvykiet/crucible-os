/**
 * Khung chương trình ngữ pháp.
 *
 * Đây là phần soạn tay, và cố ý như vậy: thứ tự học và cấp độ của từng điểm
 * ngữ pháp cần phán đoán sư phạm, phải ổn định qua thời gian, và không được
 * đổi mỗi lần mở trang. Chỉ có *nội dung* từng bài (giải thích, cấu trúc, ví
 * dụ, bài tập) mới sinh bằng AI rồi lưu lại.
 *
 * Về nguồn: bản thân sự thật ngữ pháp thì không ai sở hữu — "phủ định mệnh
 * lệnh dùng Don't + động từ nguyên thể" là dữ kiện về tiếng Anh. Cái được bảo
 * hộ là cách diễn đạt của từng cuốn sách. Khung dưới đây là cách sắp xếp của
 * chính dự án này, xếp theo thang CEFR (A1→C1) của Hội đồng châu Âu.
 *
 * Thêm một thứ tiếng mới thì viết thêm một khung riêng cho nó: tiếng Hàn có hệ
 * kính ngữ, tiếng Trung có trợ từ 了/过, tiếng Pháp có giống và chia động từ —
 * bê khung tiếng Anh sang là vô nghĩa.
 */

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export interface GrammarPoint {
  /** Định danh bền, dùng làm khoá lưu nội dung đã sinh. Đừng đổi sau khi phát hành. */
  id: string;
  title: string;
  level: CefrLevel;
}

export interface GrammarGroup {
  id: string;
  title: string;
  points: GrammarPoint[];
}

export interface GrammarFamily {
  id: string;
  title: string;
  groups: GrammarGroup[];
}

/** Rút gọn khai báo: [id, tiêu đề, cấp độ]. */
type P = [string, string, CefrLevel];

const group = (id: string, title: string, points: P[]): GrammarGroup => ({
  id,
  title,
  points: points.map(([pid, ptitle, level]) => ({ id: `${id}.${pid}`, title: ptitle, level })),
});

export const GRAMMAR_SYLLABUS: GrammarFamily[] = [
  {
    id: "foundations",
    title: "Nền tảng câu",
    groups: [
      group("clause-patterns", "Các mẫu mệnh đề cơ bản", [
        ["sv", "Mệnh đề chủ ngữ + động từ", "A1"],
        ["svo", "Mệnh đề chủ ngữ + động từ + tân ngữ", "A1"],
        ["linking", "Động từ nối và bổ ngữ", "A2"],
        ["two-objects", "Động từ có hai tân ngữ", "B1"],
        ["object-complement", "Bổ ngữ cho tân ngữ", "B2"],
      ]),
      group("word-order", "Trật tự từ", [
        ["subject-first", "Chủ ngữ đứng trước động từ trong câu kể", "A1"],
        ["object-after", "Tân ngữ đứng sau ngoại động từ", "A2"],
        ["place-time", "Vị trí của trạng ngữ nơi chốn và thời gian", "B1"],
        ["manner-place-time", "Thứ tự cách thức – nơi chốn – thời gian", "B2"],
      ]),
      group("be-have-do", "Ba động từ be, have, do", [
        ["be-main", "Be làm động từ chính", "A1"],
        ["have-possession", "Have chỉ sở hữu và quan hệ", "A1"],
        ["do-main", "Do làm động từ chính", "A2"],
        ["auxiliaries", "Be, have, do làm trợ động từ", "B1"],
      ]),
      group("imperatives", "Câu mệnh lệnh", [
        ["positive", "Mệnh lệnh khẳng định", "A1"],
        ["negative", "Mệnh lệnh phủ định", "A1"],
        ["lets", "Rủ rê với let's", "A2"],
        ["soften", "Làm dịu lời đề nghị", "B1"],
      ]),
      group("there-be", "There is và there are", [
        ["present", "There is và there are", "A1"],
        ["past", "There was và there were", "A2"],
        ["modal-future", "There với thì tương lai và động từ khuyết thiếu", "B1"],
        ["perfect", "There has been và there have been", "B2"],
      ]),
      group("impersonal-it", "It phi nhân xưng và it đón trước", [
        ["weather-time", "It chỉ thời tiết, thời gian, khoảng cách", "A1"],
        ["adj-to-inf", "It + be + tính từ + to-infinitive", "B1"],
        ["that-clause", "It kèm mệnh đề that theo sau", "B2"],
        ["reporting", "Mẫu tường thuật phi nhân xưng với it", "C1"],
      ]),
      group("agreement", "Hoà hợp chủ ngữ – động từ", [
        ["be-match", "Chia be theo chủ ngữ", "A1"],
        ["third-person-s", "Thêm -s hoặc -es với ngôi thứ ba", "A2"],
        ["compound", "Hoà hợp với chủ ngữ ghép", "B1"],
        ["collective", "Hoà hợp với danh từ tập hợp và lượng từ", "B2"],
      ]),
    ],
  },

  {
    id: "nouns",
    title: "Danh từ và cụm danh từ",
    groups: [
      group("count", "Đếm được và không đếm được", [
        ["plural", "Số nhiều quy tắc", "A1"],
        ["irregular", "Số nhiều bất quy tắc", "A2"],
        ["uncountable", "Danh từ không đếm được", "A2"],
        ["partitives", "Đơn vị đo cho danh từ không đếm được", "B1"],
      ]),
      group("possession", "Sở hữu", [
        ["apostrophe-s", "Sở hữu cách với 's", "A1"],
        ["of-phrase", "Sở hữu bằng of", "A2"],
        ["double", "Sở hữu kép", "B2"],
      ]),
      group("noun-phrase", "Mở rộng cụm danh từ", [
        ["compound", "Danh từ ghép", "A2"],
        ["premodifiers", "Nhiều từ bổ nghĩa đứng trước", "B1"],
        ["postmodifiers", "Bổ nghĩa đứng sau bằng cụm giới từ", "B1"],
        ["nominalisation", "Danh hoá trong văn viết trang trọng", "C1"],
      ]),
    ],
  },

  {
    id: "determiners",
    title: "Từ hạn định và lượng từ",
    groups: [
      group("articles", "Mạo từ", [
        ["a-an", "A và an", "A1"],
        ["the", "The khi đã xác định", "A1"],
        ["zero", "Không dùng mạo từ", "A2"],
        ["generic", "Mạo từ khi nói khái quát", "B1"],
      ]),
      group("quantifiers", "Lượng từ", [
        ["some-any", "Some và any", "A1"],
        ["much-many", "Much, many, a lot of", "A2"],
        ["few-little", "A few, few, a little, little", "B1"],
        ["all-both-whole", "All, both, whole, every, each", "B1"],
      ]),
      group("demonstratives", "Từ chỉ định", [
        ["this-that", "This, that, these, those", "A1"],
        ["reference", "Dùng từ chỉ định để nhắc lại ý trước", "B2"],
      ]),
    ],
  },

  {
    id: "pronouns",
    title: "Đại từ",
    groups: [
      group("personal", "Đại từ nhân xưng", [
        ["subject", "Đại từ làm chủ ngữ", "A1"],
        ["object", "Đại từ làm tân ngữ", "A1"],
        ["possessive", "Đại từ sở hữu", "A2"],
      ]),
      group("reflexive", "Đại từ phản thân và tương hỗ", [
        ["self", "Myself, yourself, themselves", "A2"],
        ["each-other", "Each other và one another", "B1"],
        ["emphatic", "Dùng đại từ phản thân để nhấn mạnh", "B2"],
      ]),
      group("indefinite", "Đại từ bất định", [
        ["some-any-body", "Somebody, anybody, nobody, everybody", "A2"],
        ["one", "One và ones thay cho danh từ", "B1"],
      ]),
    ],
  },

  {
    id: "adjectives-adverbs",
    title: "Tính từ và trạng từ",
    groups: [
      group("adjectives", "Tính từ", [
        ["position", "Vị trí trước danh từ và sau động từ nối", "A1"],
        ["order", "Thứ tự nhiều tính từ", "B1"],
        ["ed-ing", "Tính từ đuôi -ed và -ing", "B1"],
      ]),
      group("adverbs", "Trạng từ", [
        ["frequency", "Trạng từ tần suất", "A1"],
        ["manner", "Trạng từ chỉ cách thức", "A2"],
        ["degree", "Trạng từ chỉ mức độ", "B1"],
        ["comment", "Trạng từ bình luận cả câu", "B2"],
      ]),
      group("comparison", "So sánh", [
        ["comparative", "So sánh hơn", "A1"],
        ["superlative", "So sánh nhất", "A2"],
        ["as-as", "So sánh bằng với as ... as", "A2"],
        ["gradable", "Mức độ tăng dần và tính từ tuyệt đối", "B2"],
      ]),
    ],
  },

  {
    id: "present",
    title: "Thì hiện tại",
    groups: [
      group("simple", "Hiện tại đơn", [
        ["habits", "Nói về thói quen và sự thật", "A1"],
        ["negatives", "Phủ định với don't và doesn't", "A1"],
        ["state-verbs", "Động từ chỉ trạng thái", "B1"],
      ]),
      group("continuous", "Hiện tại tiếp diễn", [
        ["now", "Hành động đang diễn ra", "A1"],
        ["arrangements", "Kế hoạch đã sắp xếp", "A2"],
        ["changing", "Tình huống đang thay đổi", "B1"],
      ]),
      group("perfect", "Hiện tại hoàn thành", [
        ["experience", "Nói về trải nghiệm", "A2"],
        ["since-for", "Since và for", "A2"],
        ["just-already-yet", "Just, already, yet", "B1"],
        ["perfect-continuous", "Hiện tại hoàn thành tiếp diễn", "B1"],
        ["vs-past", "Phân biệt với quá khứ đơn", "B2"],
      ]),
    ],
  },

  {
    id: "past",
    title: "Thì quá khứ",
    groups: [
      group("simple-past", "Quá khứ đơn", [
        ["regular", "Động từ có quy tắc", "A1"],
        ["irregular", "Động từ bất quy tắc", "A2"],
        ["questions", "Câu hỏi và phủ định với did", "A2"],
      ]),
      group("past-continuous", "Quá khứ tiếp diễn", [
        ["background", "Bối cảnh của một hành động", "A2"],
        ["interrupted", "Hành động bị cắt ngang", "B1"],
      ]),
      group("past-perfect", "Quá khứ hoàn thành", [
        ["earlier", "Việc xảy ra trước một mốc quá khứ", "B1"],
        ["continuous", "Quá khứ hoàn thành tiếp diễn", "B2"],
      ]),
      group("used-to", "Thói quen trong quá khứ", [
        ["used-to", "Used to", "A2"],
        ["would", "Would cho thói quen lặp lại", "B2"],
        ["be-used-to", "Be used to và get used to", "B2"],
      ]),
    ],
  },

  {
    id: "future",
    title: "Cách nói tương lai",
    groups: [
      group("basic-future", "Những cách cơ bản", [
        ["will", "Will cho quyết định tức thời và dự đoán", "A1"],
        ["going-to", "Be going to cho dự định", "A1"],
        ["present-continuous", "Hiện tại tiếp diễn cho lịch đã hẹn", "A2"],
        ["present-simple", "Hiện tại đơn cho lịch trình cố định", "A2"],
      ]),
      group("advanced-future", "Những cách nâng cao", [
        ["future-continuous", "Tương lai tiếp diễn", "B1"],
        ["future-perfect", "Tương lai hoàn thành", "B2"],
        ["about-to", "Be about to và be due to", "B2"],
        ["future-in-past", "Tương lai nhìn từ quá khứ", "C1"],
      ]),
    ],
  },

  {
    id: "modality",
    title: "Động từ khuyết thiếu",
    groups: [
      group("ability-permission", "Khả năng và xin phép", [
        ["can", "Can cho khả năng", "A1"],
        ["could-may", "Could và may để xin phép", "A2"],
        ["be-able-to", "Be able to", "B1"],
      ]),
      group("obligation", "Bắt buộc và khuyên nhủ", [
        ["must-have-to", "Must và have to", "A2"],
        ["should", "Should và ought to", "A2"],
        ["mustnt-dont-have-to", "Mustn't khác don't have to", "B1"],
        ["had-better", "Had better", "B2"],
      ]),
      group("deduction", "Suy đoán", [
        ["present-deduction", "Must, might, can't cho hiện tại", "B1"],
        ["past-deduction", "Must have, might have, can't have", "B2"],
      ]),
      group("hedging", "Nói giảm và giữ khoảng cách", [
        ["softening", "Dùng khuyết thiếu để nói bớt chắc chắn", "B2"],
        ["formal-modality", "Khuyết thiếu trong văn trang trọng", "C1"],
      ]),
    ],
  },

  {
    id: "questions",
    title: "Câu hỏi và phủ định",
    groups: [
      group("question-forms", "Dạng câu hỏi", [
        ["yes-no", "Câu hỏi có/không", "A1"],
        ["wh", "Câu hỏi với từ để hỏi", "A1"],
        ["subject-questions", "Câu hỏi về chủ ngữ", "B1"],
        ["indirect", "Câu hỏi gián tiếp", "B1"],
      ]),
      group("tags-short", "Câu hỏi đuôi và trả lời ngắn", [
        ["short-answers", "Trả lời ngắn", "A1"],
        ["question-tags", "Câu hỏi đuôi", "B1"],
        ["echo", "Câu hỏi nhắc lại để thể hiện phản ứng", "B2"],
      ]),
      group("negation", "Phủ định", [
        ["not", "Phủ định với not", "A1"],
        ["no-none", "No, none, neither", "B1"],
        ["negative-adverbs", "Trạng từ mang nghĩa phủ định", "C1"],
      ]),
    ],
  },

  {
    id: "passive",
    title: "Thể bị động",
    groups: [
      group("basic-passive", "Bị động cơ bản", [
        ["present-past", "Bị động hiện tại và quá khứ đơn", "B1"],
        ["by-agent", "Nêu tác nhân bằng by", "B1"],
        ["why-passive", "Khi nào nên dùng bị động", "B1"],
      ]),
      group("advanced-passive", "Bị động nâng cao", [
        ["perfect-modal", "Bị động với thì hoàn thành và khuyết thiếu", "B2"],
        ["reporting-passive", "Bị động trong mẫu tường thuật", "C1"],
        ["get-passive", "Bị động với get", "B2"],
        ["causative", "Have và get something done", "B2"],
      ]),
    ],
  },

  {
    id: "non-finite",
    title: "Động từ nguyên thể và danh động từ",
    groups: [
      group("infinitive", "To-infinitive", [
        ["purpose", "Chỉ mục đích", "A2"],
        ["after-adjectives", "Sau tính từ", "B1"],
        ["bare-infinitive", "Nguyên thể không to", "B1"],
      ]),
      group("gerund", "Danh động từ", [
        ["as-subject", "Danh động từ làm chủ ngữ", "A2"],
        ["after-prepositions", "Sau giới từ", "B1"],
        ["verb-patterns", "Động từ đi với -ing hay to", "B1"],
        ["meaning-change", "Những động từ đổi nghĩa", "B2"],
      ]),
      group("participles", "Phân từ", [
        ["participle-clauses", "Mệnh đề phân từ", "B2"],
        ["dangling", "Tránh phân từ treo", "C1"],
      ]),
    ],
  },

  {
    id: "relative",
    title: "Mệnh đề quan hệ",
    groups: [
      group("defining", "Mệnh đề xác định", [
        ["who-which-that", "Who, which, that", "A2"],
        ["omitting", "Lược bỏ đại từ quan hệ", "B1"],
        ["where-when-whose", "Where, when, whose", "B1"],
      ]),
      group("non-defining", "Mệnh đề không xác định", [
        ["commas", "Dùng dấu phẩy và khác biệt về nghĩa", "B2"],
        ["which-whole-clause", "Which nhắc lại cả mệnh đề trước", "B2"],
        ["preposition-fronting", "Giới từ đứng trước đại từ quan hệ", "C1"],
      ]),
    ],
  },

  {
    id: "conditionals",
    title: "Câu điều kiện và giả định",
    groups: [
      group("conditionals", "Các loại điều kiện", [
        ["zero", "Điều kiện loại không", "A2"],
        ["first", "Điều kiện loại một", "A2"],
        ["second", "Điều kiện loại hai", "B1"],
        ["third", "Điều kiện loại ba", "B2"],
        ["mixed", "Điều kiện hỗn hợp", "C1"],
      ]),
      group("wish-regret", "Ước và tiếc nuối", [
        ["wish-present", "Wish cho hiện tại", "B1"],
        ["wish-past", "Wish cho quá khứ", "B2"],
        ["if-only", "If only và would rather", "B2"],
      ]),
      group("subjunctive", "Lối cầu khẩn và đảo ngữ điều kiện", [
        ["mandative", "Lối cầu khẩn sau động từ đề nghị", "C1"],
        ["inverted-conditionals", "Were, had, should đảo lên đầu", "C1"],
      ]),
    ],
  },

  {
    id: "reported",
    title: "Câu tường thuật",
    groups: [
      group("reported-basics", "Cơ bản", [
        ["statements", "Tường thuật câu kể", "B1"],
        ["backshift", "Lùi thì", "B1"],
        ["questions-commands", "Tường thuật câu hỏi và mệnh lệnh", "B1"],
      ]),
      group("reporting-verbs", "Động từ tường thuật", [
        ["say-tell", "Say và tell", "A2"],
        ["patterns", "Các mẫu đi kèm động từ tường thuật", "B2"],
        ["nuance", "Chọn động từ để lộ thái độ", "C1"],
      ]),
    ],
  },

  {
    id: "prepositions",
    title: "Giới từ",
    groups: [
      group("time-place", "Thời gian và nơi chốn", [
        ["in-on-at-time", "In, on, at chỉ thời gian", "A1"],
        ["in-on-at-place", "In, on, at chỉ nơi chốn", "A1"],
        ["movement", "Giới từ chỉ chuyển động", "A2"],
      ]),
      group("dependent", "Giới từ đi kèm từ khác", [
        ["after-verbs", "Giới từ sau động từ", "B1"],
        ["after-adjectives", "Giới từ sau tính từ", "B1"],
        ["after-nouns", "Giới từ sau danh từ", "B2"],
      ]),
      group("phrasal", "Cụm động từ", [
        ["separable", "Cụm động từ tách được", "B1"],
        ["three-part", "Cụm động từ ba thành phần", "B2"],
        ["register", "Chọn cụm động từ hay động từ trang trọng", "C1"],
      ]),
    ],
  },

  {
    id: "discourse",
    title: "Liên kết và mạch văn",
    groups: [
      group("connectors", "Từ nối", [
        ["and-but-because", "And, but, because, so", "A1"],
        ["although-however", "Although và however", "B1"],
        ["purpose-result", "Nối chỉ mục đích và kết quả", "B2"],
        ["formal-connectors", "Từ nối trong văn trang trọng", "C1"],
      ]),
      group("cohesion", "Mạch lạc", [
        ["substitution", "Thay thế và lược bỏ", "B2"],
        ["reference-chains", "Chuỗi quy chiếu trong đoạn văn", "C1"],
      ]),
      group("emphasis", "Nhấn mạnh", [
        ["cleft", "Câu chẻ với it và what", "B2"],
        ["inversion", "Đảo ngữ sau trạng từ phủ định", "C1"],
        ["fronting", "Đưa thành phần lên đầu câu", "C1"],
      ]),
    ],
  },
];

/** Tổng số điểm ngữ pháp, dùng cho nhãn "Tất cả (n)". */
export const countPoints = (families: GrammarFamily[] = GRAMMAR_SYLLABUS) =>
  families.reduce((sum, f) => sum + f.groups.reduce((s, g) => s + g.points.length, 0), 0);

/** Đếm theo từng cấp độ, cho các chip lọc. */
export function countByLevel(families: GrammarFamily[] = GRAMMAR_SYLLABUS) {
  const counts: Record<CefrLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  for (const f of families) {
    for (const g of f.groups) {
      for (const p of g.points) counts[p.level] += 1;
    }
  }
  return counts;
}

/** Tra một điểm ngữ pháp theo id, kèm nhóm và họ chứa nó. */
export function findPoint(pointId: string) {
  for (const family of GRAMMAR_SYLLABUS) {
    for (const group of family.groups) {
      const point = group.points.find((p) => p.id === pointId);
      if (point) return { family, group, point };
    }
  }
  return null;
}
