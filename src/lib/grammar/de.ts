import { group, type GrammarFamily, type GrammarSyllabus } from "./types";

/**
 * Tiếng Đức, xếp theo thang CEFR.
 *
 * Tiếng Đức bắt người học trả giá ngay từ A1 cho hai thứ mà cả tiếng Anh lẫn
 * tiếng Pháp đều không có: **ba giống cộng bốn cách** — mạo từ, tính từ và
 * đại từ đổi dạng theo vai của danh từ trong câu, nên học danh từ mà không học
 * kèm der/die/das là học hỏng — và **vị trí động từ**: động từ chia luôn đứng
 * thứ hai trong câu trần thuật, nhảy xuống cuối trong mệnh đề phụ, còn tiền tố
 * tách được thì bị đá xuống cuối câu. Nên ba họ đó (danh ngữ, cách, trật tự
 * câu) đứng trước.
 *
 * Đuôi tính từ để tới A2–B1 chứ không sớm hơn: nó phụ thuộc cùng lúc vào
 * giống, cách và loại mạo từ đứng trước, nên học khi chưa vững bốn cách là học
 * vẹt ba cái bảng. Konjunktiv I để tận C1 — ngoài báo chí và văn bản trang
 * trọng, người Đức gần như không dùng nó khi nói.
 */
const FAMILIES: GrammarFamily[] = [
  {
    id: "noun-phrase",
    title: "Danh ngữ và giống",
    groups: [
      group("gender-number", "Giống và số của danh từ", [
        ["gender-basics", "Ba giống der, die, das — học danh từ kèm mạo từ", "A1"],
        ["plural", "Năm kiểu tạo số nhiều và đuôi -e, -er, -n, -s", "A1"],
        ["gender-clues", "Đuôi từ đoán được giống: -ung, -heit, -chen, -ismus", "A2"],
        ["compound", "Danh từ ghép: giống theo thành tố cuối", "A2"],
        ["n-declension", "Danh từ yếu, biến cách đuôi -n: der Kollege, den Kollegen", "B1"],
      ]),
      group("articles", "Mạo từ và từ hạn định", [
        ["definite", "Mạo từ xác định der, die, das", "A1"],
        ["indefinite", "Mạo từ không xác định ein, eine và phủ định kein", "A1"],
        ["possessive", "Mạo từ sở hữu mein, dein, sein, ihr", "A1"],
        ["demonstrative", "Chỉ định dieser, jener, derselbe", "A2"],
        ["zero-article", "Những chỗ bỏ hẳn mạo từ: nghề nghiệp, quốc tịch, chất liệu", "B1"],
      ]),
      group("adjectives", "Tính từ", [
        ["predicative", "Tính từ làm vị ngữ không đổi đuôi", "A1"],
        ["after-definite", "Đuôi tính từ sau mạo từ xác định", "A2"],
        ["after-indefinite", "Đuôi tính từ sau ein, kein và mạo từ sở hữu", "A2"],
        ["no-article", "Đuôi tính từ khi không có mạo từ", "B1"],
        ["comparative", "So sánh hơn -er, als và so ... wie", "A2"],
        ["superlative", "So sánh nhất am -sten và der/die/das -ste", "A2"],
        ["nominalized", "Tính từ làm danh từ: der Bekannte, das Gute", "B2"],
      ]),
    ],
  },
  {
    id: "cases",
    title: "Bốn cách",
    groups: [
      group("case-system", "Hệ thống cách", [
        ["nominative", "Nominativ: chủ ngữ và sau sein, werden", "A1"],
        ["accusative", "Akkusativ: tân ngữ trực tiếp, chỉ đổi ở giống đực", "A1"],
        ["dative", "Dativ: tân ngữ gián tiếp và đuôi -n ở số nhiều", "A2"],
        ["genitive", "Genitiv: sở hữu và đuôi -s, -es", "B1"],
        ["genitive-vs-von", "Genitiv trong văn viết, von + Dativ trong văn nói", "B2"],
      ]),
      group("case-verbs", "Động từ quyết định cách", [
        ["dative-verbs", "Động từ đi với Dativ: helfen, danken, gefallen", "A2"],
        ["two-objects", "Động từ hai tân ngữ và thứ tự Dativ trước Akkusativ", "B1"],
        ["genitive-verbs", "Động từ và tính từ đi với Genitiv", "C1"],
      ]),
    ],
  },
  {
    id: "pronouns",
    title: "Đại từ",
    groups: [
      group("personal", "Đại từ nhân xưng", [
        ["subject", "Đại từ chủ ngữ và ba cách xưng hô du, ihr, Sie", "A1"],
        ["object", "Đại từ ở Akkusativ và Dativ: mich, mir, ihn, ihm", "A2"],
        ["reflexive", "Đại từ phản thân sich ở Akkusativ và Dativ", "A2"],
        ["es", "Es làm chủ ngữ hình thức: es gibt, es regnet", "A2"],
      ]),
      group("relative-interrogative", "Đại từ quan hệ và nghi vấn", [
        ["wer-wen", "Wer, wen, wem, wessen", "A2"],
        ["relative", "Đại từ quan hệ der, die, das theo giống và cách", "B1"],
        ["relative-prep", "Giới từ + đại từ quan hệ: mit dem, für die", "B1"],
        ["was-wo", "Was và wo làm từ quan hệ: alles, was; dort, wo", "B2"],
      ]),
      group("pronominal-adverbs", "Trạng từ đại từ", [
        ["da-compounds", "Da- + giới từ: dafür, darauf, damit", "B1"],
        ["wo-compounds", "Wo- + giới từ khi hỏi: wofür, worauf", "B1"],
      ]),
    ],
  },
  {
    id: "word-order",
    title: "Trật tự câu",
    groups: [
      group("main-clause", "Câu chính", [
        ["v2", "Động từ chia luôn ở vị trí thứ hai", "A1"],
        ["inversion", "Đảo chủ ngữ khi trạng ngữ đứng đầu câu", "A1"],
        ["sentence-bracket", "Khung câu: phần động từ thứ hai xuống cuối", "A2"],
        ["nicht-position", "Vị trí của nicht trong câu", "A2"],
        ["tekamolo", "Thứ tự trạng ngữ: thời gian, nguyên nhân, cách thức, nơi chốn", "B1"],
      ]),
      group("subordinate", "Mệnh đề phụ", [
        ["verb-final", "Động từ chia xuống cuối mệnh đề phụ", "A2"],
        ["dass-weil", "Dass, weil, wenn, ob", "A2"],
        ["sub-first", "Mệnh đề phụ đứng đầu: động từ chính lên ngay sau dấu phẩy", "B1"],
        ["double-infinitive", "Hai nguyên thể cuối câu: hat kommen müssen", "C1"],
      ]),
    ],
  },
  {
    id: "present",
    title: "Hiện tại và mệnh lệnh",
    groups: [
      group("present-tense", "Thì hiện tại", [
        ["regular", "Chia động từ đều theo sáu ngôi", "A1"],
        ["sein-haben", "Sein, haben, werden", "A1"],
        ["vowel-change", "Động từ đổi nguyên âm ở du, er: fahren, lesen, nehmen", "A1"],
        ["separable", "Động từ tách được: anrufen, aufstehen, einkaufen", "A1"],
        ["inseparable", "Tiền tố không tách: be-, ver-, er-, ent-", "A2"],
        ["reflexive-verbs", "Động từ phản thân sich freuen, sich erinnern", "A2"],
      ]),
      group("modals", "Động từ khuyết thiếu", [
        ["modal-forms", "Können, müssen, wollen, dürfen, sollen, mögen", "A1"],
        ["moechte", "Möchte cho lời yêu cầu lịch sự", "A1"],
        ["modal-meanings", "Nicht müssen khác nicht dürfen", "A2"],
        ["subjective-modals", "Modalverb chỉ phỏng đoán: er muss krank sein", "C1"],
      ]),
      group("imperative", "Mệnh lệnh", [
        ["forms", "Ba dạng mệnh lệnh du, ihr, Sie", "A1"],
        ["separable-imp", "Mệnh lệnh với động từ tách được: Ruf mich an!", "A2"],
      ]),
    ],
  },
  {
    id: "past-future",
    title: "Quá khứ và tương lai",
    groups: [
      group("perfekt", "Perfekt", [
        ["haben", "Perfekt với haben và phân từ ge-...-t, ge-...-en", "A1"],
        ["sein", "Perfekt với sein: động từ chỉ chuyển động và đổi trạng thái", "A1"],
        ["participle-prefix", "Phân từ của động từ tách và không tách: angerufen, besucht", "A2"],
        ["ieren", "Động từ -ieren không có ge-: studiert, telefoniert", "A2"],
      ]),
      group("praeteritum", "Präteritum", [
        ["sein-haben-modals", "Präteritum của sein, haben và động từ khuyết thiếu khi nói", "A2"],
        ["written", "Präteritum trong văn kể và văn viết", "B1"],
        ["strong-forms", "Ba dạng của động từ mạnh: gehen, ging, gegangen", "B1"],
      ]),
      group("other-tenses", "Thì khác", [
        ["futur-i", "Futur I và hiện tại dùng cho tương lai", "A2"],
        ["plusquamperfekt", "Plusquamperfekt cho việc xảy ra trước", "B1"],
        ["futur-ii", "Futur II cho phỏng đoán về quá khứ", "C1"],
      ]),
    ],
  },
  {
    id: "mood-voice",
    title: "Thức và dạng câu",
    groups: [
      group("konjunktiv-ii", "Konjunktiv II", [
        ["wuerde", "Würde + nguyên thể", "A2"],
        ["politeness", "Hätte, wäre, könnte cho lời đề nghị lịch sự", "A2"],
        ["unreal-present", "Điều kiện không có thật ở hiện tại: Wenn ich Zeit hätte", "B1"],
        ["unreal-past", "Không có thật ở quá khứ: hätte ... gemacht", "B2"],
        ["als-ob", "Als ob, als wenn + Konjunktiv II", "B2"],
      ]),
      group("konjunktiv-i", "Konjunktiv I", [
        ["indirect-speech", "Konjunktiv I trong lời nói gián tiếp của báo chí", "C1"],
        ["substitution", "Khi Konjunktiv I trùng hiện tại thì thay bằng Konjunktiv II", "C1"],
      ]),
      group("passive", "Bị động", [
        ["vorgang", "Vorgangspassiv werden + phân từ", "B1"],
        ["von-durch", "Von và durch: ai làm, bằng cách nào", "B1"],
        ["zustand", "Zustandspassiv sein + phân từ", "B2"],
        ["modal-passive", "Bị động với động từ khuyết thiếu: muss gemacht werden", "B2"],
        ["alternatives", "Thay bị động bằng man, sich lassen, -bar", "C1"],
      ]),
    ],
  },
  {
    id: "complex",
    title: "Câu phức và liên kết",
    groups: [
      group("infinitive", "Nguyên thể", [
        ["zu", "Nguyên thể có zu và động từ đi kèm nó", "B1"],
        ["um-zu", "Um ... zu, ohne ... zu, statt ... zu", "B1"],
        ["lassen", "Lassen + nguyên thể, sai khiến", "B1"],
      ]),
      group("participles", "Phân từ", [
        ["participle-adj", "Phân từ làm tính từ: die lachenden Kinder", "B2"],
        ["extended-attribute", "Định ngữ mở rộng: der seit Jahren geplante Bau", "C1"],
      ]),
      group("connectors", "Từ nối", [
        ["coordinating", "Liên từ không đổi trật tự: und, aber, oder, denn, sondern", "A1"],
        ["adverbial", "Trạng từ nối đẩy động từ lên trước: deshalb, trotzdem, dann", "A2"],
        ["temporal", "Mệnh đề thời gian als, wenn, während, nachdem, bevor", "B1"],
        ["concession", "Nhượng bộ obwohl, trotz, trotzdem", "B1"],
        ["two-part", "Liên từ hai vế: sowohl ... als auch, weder ... noch, je ... desto", "B2"],
        ["register", "Chọn từ nối theo văn nói hay văn viết", "C1"],
      ]),
      group("reported", "Lời nói gián tiếp", [
        ["statements", "Thuật lại câu trần thuật bằng dass", "B1"],
        ["questions", "Câu hỏi gián tiếp với ob và từ hỏi", "B1"],
      ]),
    ],
  },
  {
    id: "prepositions",
    title: "Giới từ",
    groups: [
      group("case-preps", "Giới từ theo cách", [
        ["accusative-preps", "Giới từ đi với Akkusativ: für, durch, ohne, gegen, um", "A1"],
        ["dative-preps", "Giới từ đi với Dativ: mit, nach, bei, seit, von, zu, aus", "A1"],
        ["contractions", "Giới từ co với mạo từ: im, am, zum, zur, ins", "A1"],
        ["two-way", "Giới từ hai cách: Wo? thì Dativ, Wohin? thì Akkusativ", "A2"],
        ["genitive-preps", "Giới từ đi với Genitiv: wegen, trotz, während, statt", "B1"],
      ]),
      group("verb-preps", "Giới từ gắn với động từ", [
        ["common", "Những cặp động từ và giới từ hay gặp: warten auf, denken an", "B1"],
        ["adjective-preps", "Tính từ đi với giới từ: stolz auf, interessiert an", "B2"],
      ]),
    ],
  },
];

export const DE_SYLLABUS: GrammarSyllabus = {
  code: "de",
  scale: "CEFR",
  levels: ["A1", "A2", "B1", "B2", "C1"],
  families: FAMILIES,
  references: [
    "Khung tham chiếu châu Âu (CEFR) — thang A1–C1",
    "Profile deutsch (Goethe-Institut) — phân bổ điểm ngữ pháp theo cấp",
    "Duden – Die Grammatik — khung mô tả, nhất là phần cách và đuôi tính từ",
    "Hammer's German Grammar and Usage — khung mô tả trật tự câu",
  ],
};
