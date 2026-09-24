import { group, type GrammarFamily, type GrammarSyllabus } from "./types";

/**
 * Tiếng Hàn, xếp theo thang TOPIK.
 *
 * Ba thứ quyết định cách sắp khung này, và cả ba đều không có trong tiếng Anh
 * lẫn tiếng Việt:
 *
 * 1. **Trật tự chủ – tân – động**: động từ luôn đứng cuối, nên mọi thứ gắn vào
 *    động từ đều nằm ở đuôi câu. Học đuôi câu chính là học ngữ pháp.
 * 2. **Kính ngữ** không phải phép lịch sự tuỳ chọn mà là ngữ pháp bắt buộc:
 *    mỗi câu đều phải chọn một bậc nói, không có bậc trung lập. Nên nó đứng
 *    ngay sau phần câu cơ bản, không để dành tới cấp cao.
 * 3. **Đuôi nối** thay cho liên từ: tiếng Việt nối câu bằng từ đứng giữa, tiếng
 *    Hàn nối bằng cách đổi đuôi vế trước. Đây là họ lớn nhất trong khung.
 *
 * Chia động từ bất quy tắc tách riêng chứ không rải rác: bảy loại bất quy tắc
 * đụng tới hầu hết mọi điểm ngữ pháp khác, nên cần một chỗ để tra.
 */
const FAMILIES: GrammarFamily[] = [
  {
    id: "basics",
    title: "Câu cơ bản và trợ từ",
    groups: [
      group("sentence-core", "Khung câu", [
        ["sov", "Trật tự chủ ngữ – tân ngữ – động từ", "1"],
        ["ida", "이다 và 아니다", "1"],
        ["itda-eopda", "있다 và 없다 chỉ tồn tại và sở hữu", "1"],
        ["topic-subject", "Trợ từ chủ đề 은/는 và trợ từ chủ ngữ 이/가", "1"],
        ["topic-vs-subject", "Chọn 은/는 hay 이/가 — chỗ sai dai dẳng nhất", "2"],
        ["object", "Trợ từ tân ngữ 을/를", "1"],
      ]),
      group("particles", "Trợ từ khác", [
        ["place-time", "에 và 에서", "1"],
        ["direction", "으로/로 chỉ hướng và phương tiện", "1"],
        ["and", "와/과, 하고, 랑 chỉ liệt kê và đi cùng", "1"],
        ["also-only", "도 và 만", "1"],
        ["from-to", "부터, 까지, 에서…까지", "2"],
        ["to-person", "에게, 한테, 께 và 에게서", "2"],
        ["comparison-particle", "보다 chỉ so sánh", "2"],
        ["stacking", "Chồng trợ từ và thứ tự khi chồng", "4"],
      ]),
    ],
  },
  {
    id: "speech-levels",
    title: "Kính ngữ và bậc nói",
    groups: [
      group("levels", "Bậc nói", [
        ["haeyo", "Bậc 해요 dùng hằng ngày", "1"],
        ["hamnida", "Bậc 합니다 trang trọng", "1"],
        ["banmal", "Bậc thân mật 반말 và khi nào được dùng", "2"],
        ["choose-level", "Chọn bậc theo tuổi, vai vế và hoàn cảnh", "2"],
        ["mixing", "Đổi bậc giữa chừng và điều đó nói lên gì", "4"],
      ]),
      group("honorific-marking", "Nâng người được nói tới", [
        ["si", "Đuôi kính ngữ -시- nâng chủ ngữ", "2"],
        ["honorific-particles", "께서 và 께 thay cho 이/가 và 에게", "3"],
        ["honorific-words", "Từ vựng kính ngữ riêng 드시다, 주무시다, 계시다", "3"],
        ["humble", "Khiêm nhường 드리다, 뵙다, 저", "3"],
        ["absolute-relative", "Kính ngữ tuyệt đối và tương đối trong công sở", "5"],
      ]),
    ],
  },
  {
    id: "tense",
    title: "Thì và thể",
    groups: [
      group("tense-basic", "Thì", [
        ["present", "Hiện tại", "1"],
        ["past", "Quá khứ -았/었-", "1"],
        ["past-past", "-았었/었었- chỉ quá khứ đã dứt hẳn", "4"],
        ["future-gess", "-겠- chỉ ý định và phỏng đoán", "2"],
        ["future-eul-geot", "-을 것이다 chỉ tương lai và dự tính", "2"],
        ["gess-vs-geot", "Phân biệt -겠- và -을 것이다", "3"],
      ]),
      group("aspect", "Thể", [
        ["go-itda", "-고 있다 chỉ đang diễn ra", "1"],
        ["a-itda", "-아/어 있다 chỉ trạng thái còn giữ", "3"],
        ["two-progressive", "Phân biệt -고 있다 và -아/어 있다", "3"],
        ["deo", "-더- chỉ hồi tưởng điều tự mình chứng kiến", "4"],
      ]),
    ],
  },
  {
    id: "negation",
    title: "Phủ định",
    groups: [
      group("neg", "Các cách phủ định", [
        ["an", "안 phủ định ý chí", "1"],
        ["mot", "못 phủ định khả năng", "1"],
        ["ji-anta", "-지 않다 và -지 못하다", "1"],
        ["short-long", "Phủ định ngắn và phủ định dài, chọn cái nào", "2"],
        ["ji-malda", "-지 말다 trong câu cấm", "2"],
        ["special-neg", "Phủ định của 있다, 알다, 이다", "2"],
      ]),
    ],
  },
  {
    id: "connectives",
    title: "Đuôi nối",
    groups: [
      group("listing-sequence", "Liệt kê và nối tiếp", [
        ["go", "-고 nối hai việc", "1"],
        ["aseo", "-아서/어서 chỉ nối tiếp và chỉ nguyên nhân", "1"],
        ["go-vs-aseo", "Phân biệt -고 và -아서/어서", "2"],
        ["myeonseo", "-으면서 chỉ hai việc cùng lúc", "2"],
        ["daga", "-다가 chỉ đang làm thì chuyển sang việc khác", "3"],
      ]),
      group("cause-condition", "Nguyên nhân và điều kiện", [
        ["nikka", "-으니까 chỉ nguyên nhân", "1"],
        ["aseo-vs-nikka", "Phân biệt -아서 và -으니까", "2"],
        ["myeon", "-으면 chỉ điều kiện", "1"],
        ["eulyeomyeon", "-으려면 chỉ muốn thì phải", "3"],
        ["gie", "-기에 và -길래", "4"],
        ["neun-baram", "-는 바람에 chỉ nguyên nhân ngoài ý muốn", "4"],
        ["neuneura", "-느라고 chỉ vì mải làm việc này", "4"],
      ]),
      group("contrast-purpose", "Đối lập và mục đích", [
        ["jiman", "-지만 chỉ đối lập", "1"],
        ["neunde", "-는데 và các sắc thái của nó", "2"],
        ["eundeyo", "-는데요 bỏ lửng cuối câu", "3"],
        ["eulyeogo", "-으려고 chỉ ý định", "2"],
        ["eureo", "-으러 chỉ mục đích đi lại", "1"],
        ["dorok", "-도록 chỉ mục đích và mức độ", "4"],
        ["eul-tende", "-을 텐데 chỉ phỏng đoán kèm tiếc nuối", "4"],
      ]),
    ],
  },
  {
    id: "modifiers",
    title: "Định ngữ",
    groups: [
      group("adnominal", "Đuôi định ngữ", [
        ["neun", "-는 + danh từ, động từ ở hiện tại", "1"],
        ["eun", "-은/ㄴ + danh từ, quá khứ và tính từ", "1"],
        ["eul", "-을 + danh từ, tương lai và giả định", "2"],
        ["deon", "-던 và -았던 chỉ quá khứ chưa dứt", "3"],
        ["long-clause", "Mệnh đề dài đứng trước danh từ", "3"],
      ]),
      group("nominalise", "Danh hoá", [
        ["gi", "-기 danh hoá", "2"],
        ["eum", "-음 danh hoá trong văn viết", "4"],
        ["geot", "것 và 거", "1"],
        ["gi-vs-eum", "Chọn -기 hay -음", "4"],
      ]),
    ],
  },
  {
    id: "endings",
    title: "Đuôi kết thúc câu",
    groups: [
      group("attitude", "Đuôi mang thái độ", [
        ["neyo", "-네요 chỉ vừa nhận ra", "2"],
        ["gunyo", "-군요 chỉ ngạc nhiên", "2"],
        ["janayo", "-잖아요 chỉ điều cả hai đều biết", "3"],
        ["geodeunyo", "-거든요 chỉ đưa ra lý do", "3"],
        ["deoragoyo", "-더라고요 kể lại điều đã chứng kiến", "4"],
        ["ji", "-지요 xin đồng tình", "2"],
      ]),
      group("request-suggest", "Đề nghị và rủ rê", [
        ["euseyo", "-으세요 sai bảo lịch sự", "1"],
        ["eupsida", "-읍시다 và -을까요 rủ cùng làm", "1"],
        ["a-jusida", "-아/어 주시겠어요 nhờ vả lịch sự", "2"],
        ["eulge", "-을게요 hứa hẹn", "2"],
        ["eullae", "-을래요 hỏi ý muốn", "2"],
      ]),
    ],
  },
  {
    id: "auxiliary",
    title: "Bổ trợ động từ",
    groups: [
      group("aux", "Các cấu trúc bổ trợ", [
        ["a-boda", "-아/어 보다 thử làm", "1"],
        ["a-juda", "-아/어 주다 làm giúp", "1"],
        ["a-beorida", "-아/어 버리다 làm mất hẳn", "3"],
        ["go-malda", "-고 말다 rốt cuộc đã xảy ra", "4"],
        ["a-noda", "-아/어 놓다 và -아/어 두다 làm sẵn để đó", "3"],
        ["a-gada-oda", "-아/어 가다 và -아/어 오다 chỉ tiến trình", "4"],
      ]),
      group("ability-permission", "Khả năng, cho phép, bổn phận", [
        ["eul-su", "-을 수 있다/없다 chỉ khả năng", "1"],
        ["a-do-doeda", "-아/어도 되다 chỉ được phép", "2"],
        ["eumyeon-andoeda", "-으면 안 되다 chỉ không được", "2"],
        ["a-ya-hada", "-아/어야 하다 chỉ phải làm", "2"],
        ["eul-jul-alda", "-을 줄 알다/모르다 chỉ biết cách", "2"],
      ]),
    ],
  },
  {
    id: "voice",
    title: "Bị động và sai khiến",
    groups: [
      group("passive-causative", "Hai dạng", [
        ["passive-suffix", "Bị động bằng 이, 히, 리, 기", "3"],
        ["a-jida", "-아/어지다 chỉ trở nên và chỉ bị động", "3"],
        ["causative-suffix", "Sai khiến bằng 이, 히, 리, 기, 우, 추", "4"],
        ["ge-hada", "-게 하다 chỉ bắt ai làm gì", "3"],
        ["irregular-pairs", "Cặp tự động và tha động không theo quy tắc", "5"],
      ]),
    ],
  },
  {
    id: "reported",
    title: "Lời nói gián tiếp",
    groups: [
      group("quotation", "Thuật lại", [
        ["dago", "-다고 하다 thuật câu trần thuật", "3"],
        ["nyago", "-냐고 하다 thuật câu hỏi", "3"],
        ["rago-jago", "-라고 하다 và -자고 하다 thuật mệnh lệnh và rủ rê", "3"],
        ["contracted", "Dạng rút gọn -대요, -냬요, -래요, -재요", "4"],
        ["quote-in-clause", "Trích dẫn nằm trong mệnh đề lớn hơn", "5"],
      ]),
    ],
  },
  {
    id: "irregular",
    title: "Chia bất quy tắc",
    groups: [
      group("irregular-verbs", "Bảy loại bất quy tắc", [
        ["b", "Bất quy tắc ㅂ", "2"],
        ["d", "Bất quy tắc ㄷ", "2"],
        ["s", "Bất quy tắc ㅅ", "2"],
        ["r-drop", "Rụng ㄹ", "2"],
        ["reu", "Bất quy tắc 르", "2"],
        ["eu-drop", "Rụng ㅡ", "2"],
        ["h", "Bất quy tắc ㅎ", "3"],
      ]),
    ],
  },
  {
    id: "advanced",
    title: "Cách nói nâng cao",
    groups: [
      group("set-patterns", "Cấu trúc cố định", [
        ["eul-ppun", "-을 뿐만 아니라 chỉ không những mà còn", "5"],
        ["gi-maryeon", "-기 마련이다 chỉ lẽ thường là vậy", "5"],
        ["eum-edo", "-음에도 불구하고 chỉ mặc dù", "5"],
        ["eul-ttae", "-을 때 và -는 동안 chỉ thời điểm và khoảng thời gian", "2"],
        ["neun-cheok", "-는 척하다 chỉ giả vờ", "4"],
        ["eul-mankeum", "-을 만큼 và -을 정도로 chỉ đến mức", "4"],
        ["e-ttara", "-에 따라 và -을 통해 trong văn viết", "5"],
      ]),
      group("written-style", "Văn viết", [
        ["hada-che", "Thể 한다 trong báo chí và luận văn", "5"],
        ["sino-korean", "Từ Hán Hàn và lối viết trang trọng", "5"],
        ["condensed", "Câu nén nhiều mệnh đề trong văn bản hành chính", "6"],
      ]),
    ],
  },
];

export const KO_SYLLABUS: GrammarSyllabus = {
  code: "ko",
  scale: "TOPIK",
  levels: ["1", "2", "3", "4", "5", "6"],
  families: FAMILIES,
  references: [
    "TOPIK — thang 1–6",
    "외국인을 위한 한국어 문법 (Viện Quốc ngữ Hàn Quốc) — cách phân loại và thuật ngữ",
    "Korean Grammar in Use, ba tập (Darakwon) — thứ tự giới thiệu đuôi nối và đuôi kết thúc",
    "Using Korean: A Guide to Contemporary Usage (Lukoff / Cambridge) — khung mô tả bậc nói",
  ],
};
