import type { GrammarNote } from "./types";

/**
 * Ghi chú soạn tay cho khung tiếng Anh, tra theo id điểm (`nhóm.điểm`).
 *
 * Dựa trên danh mục quy tắc và lỗi hay gặp của tài liệu "Tổng quát ngữ pháp
 * tiếng Anh" (The Forum Center) cùng các sách trong `EN_SYLLABUS.references`.
 * Theo ranh giới đã chốt với người dùng: lấy QUY TẮC (dữ kiện về ngôn ngữ) và
 * DẠNG LỖI người học hay mắc; lời giảng, câu ví dụ, câu Sai/Đúng đều tự soạn.
 *
 * Khoá sai thì ghi chú lặng lẽ không hiện, và `tsc` không bắt được chuyện đó.
 * Khoá phải khớp đúng id điểm trong `en.ts` (id nhóm + "." + id điểm, KHÔNG
 * có id họ phía trước).
 */
export const EN_NOTES: Record<string, GrammarNote> = {
  // ── Nền tảng câu ────────────────────────────────────────────────────────
  "there-be.present": {
    rules: [
      "Động từ chia theo danh từ đứng ngay sau: there is + danh từ số ít/không đếm được, there are + danh từ số nhiều.",
      "Liệt kê nhiều thứ thì chia theo thứ đầu tiên: There is a desk and two chairs in the room.",
      "Muốn nói \"ở đâu đó có cái gì\" thì dùng there is/are, không dùng have/has.",
    ],
    mistakes: [
      { wrong: "There is a lot of problems with the plan.", right: "There are a lot of problems with the plan.", why: "Danh từ theo sau là \"problems\" (số nhiều), \"a lot of\" không quyết định số." },
      { wrong: "It has many parks in my city.", right: "There are many parks in my city.", why: "Dịch thẳng chữ \"có\" thành has; nói về sự tồn tại phải dùng there are." },
    ],
  },

  "agreement.third-person-s": {
    rules: [
      "Hiện tại đơn, chủ ngữ là he/she/it hoặc một danh từ số ít → động từ thêm -s.",
      "Thêm -es khi động từ tận cùng -ch, -sh, -s, -x, -z, -o (watches, fixes, goes); phụ âm + y → -ies (studies); have → has.",
      "Phủ định và câu hỏi dùng doesn't/does, và động từ chính quay về nguyên thể.",
    ],
    mistakes: [
      { wrong: "My father drive to work every day.", right: "My father drives to work every day.", why: "Chủ ngữ số ít ngôi thứ ba nên động từ phải có -s." },
      { wrong: "She don't eat meat.", right: "She doesn't eat meat.", why: "Ngôi thứ ba số ít phủ định bằng doesn't." },
      { wrong: "He doesn't likes spicy food.", right: "He doesn't like spicy food.", why: "-s đã nằm ở doesn't; động từ chính giữ nguyên thể." },
    ],
  },

  "agreement.compound": {
    rules: [
      "Hai chủ ngữ nối bằng and → động từ số nhiều.",
      "Ngoại lệ: hai danh từ cùng chỉ MỘT thứ (một món ăn, một người giữ hai vai) → số ít: Fish and chips is a classic British meal.",
      "A as well as B / A along with B không phải chủ ngữ ghép — động từ theo A (xem \"Cụm chen giữa chủ ngữ và động từ\").",
    ],
    mistakes: [
      { wrong: "My brother and his wife lives near the airport.", right: "My brother and his wife live near the airport.", why: "Hai người nối bằng and là chủ ngữ số nhiều." },
      { wrong: "My sister and I is going to the market.", right: "My sister and I are going to the market.", why: "\"My sister and I\" = we, nên dùng are." },
    ],
  },

  "agreement.collective": {
    rules: [
      "team, family, staff, committee, audience, government: coi cả nhóm như một khối → số ít; nhấn từng thành viên → số nhiều (thường gặp trong Anh-Anh).",
      "Đã chọn thì giữ nhất quán với đại từ theo sau: số ít đi với its, số nhiều đi với their.",
      "police, people, cattle luôn đi với động từ số nhiều.",
      "data trong văn học thuật thường dùng số nhiều (The data show…), số ít cũng được chấp nhận — chọn một cách và giữ suốt bài.",
    ],
    mistakes: [
      { wrong: "The police has arrested two suspects.", right: "The police have arrested two suspects.", why: "police luôn là số nhiều." },
      { wrong: "The committee have announced its decision.", right: "The committee has announced its decision.", why: "\"its\" cho thấy đang coi committee là một khối, động từ phải số ít cho khớp." },
    ],
  },

  "agreement-tricky.uncountable": {
    rules: [
      "Danh từ không đếm được không thêm -s và luôn đi với động từ số ít.",
      "Nhóm hay gặp: information, advice, equipment, furniture, research, knowledge, evidence, news, luggage, traffic, homework.",
      "Muốn đếm thì thêm đơn vị: a piece of advice, two items of equipment.",
    ],
    mistakes: [
      { wrong: "The new equipment are very expensive.", right: "The new equipment is very expensive.", why: "equipment không đếm được, động từ số ít." },
      { wrong: "We need more informations about the course.", right: "We need more information about the course.", why: "information không có dạng số nhiều." },
      { wrong: "These advices were really useful.", right: "This advice was really useful.", why: "advice không đếm được, đi với this và was." },
    ],
  },

  "agreement-tricky.intervening": {
    rules: [
      "Động từ hoà hợp với danh từ CHÍNH của chủ ngữ, bỏ qua cụm of…, cụm giới từ hay mệnh đề quan hệ chen ở giữa.",
      "along with, together with, as well as, in addition to không biến chủ ngữ thành số nhiều.",
      "Mẹo: lấy tay che cụm chen đi rồi đọc lại chủ ngữ và động từ liền nhau.",
    ],
    mistakes: [
      { wrong: "The price of these phones are rising.", right: "The price of these phones is rising.", why: "Chủ ngữ chính là \"the price\", không phải \"phones\"." },
      { wrong: "The manager, together with two assistants, were late.", right: "The manager, together with two assistants, was late.", why: "Cụm together with… chỉ là phần chen; chủ ngữ vẫn là \"the manager\"." },
      { wrong: "Students who live far from the campus often arrives late.", right: "Students who live far from the campus often arrive late.", why: "Động từ \"arrive\" thuộc chủ ngữ \"Students\" (số nhiều), không phải \"the campus\"." },
    ],
  },

  "agreement-tricky.indefinite": {
    rules: [
      "everyone, everybody, someone, anyone, no one, nobody, everything, each, every → động từ số ít.",
      "Each of / Either of / Neither of + danh từ số nhiều → động từ số ít trong văn trang trọng.",
      "Đại từ nhắc lại vẫn dùng they/their được: Everyone has their own opinion.",
    ],
    mistakes: [
      { wrong: "Everyone in my class have a laptop.", right: "Everyone in my class has a laptop.", why: "everyone luôn đi với động từ số ít." },
      { wrong: "Each of the rooms have a balcony.", right: "Each of the rooms has a balcony.", why: "Chủ ngữ thật là \"each\", không phải \"rooms\"." },
    ],
  },

  "agreement-tricky.one-of": {
    rules: [
      "One of + the/my/… + danh từ SỐ NHIỀU + động từ SỐ ÍT.",
      "Hai lỗi hay đi cùng nhau: danh từ sau one of bị viết số ít, và động từ bị chia số nhiều.",
    ],
    mistakes: [
      { wrong: "One of the biggest problems are air pollution.", right: "One of the biggest problems is air pollution.", why: "Chủ ngữ là \"one\", nên động từ số ít." },
      { wrong: "One of my friend works in a bank.", right: "One of my friends works in a bank.", why: "Sau one of là danh từ số nhiều — chọn \"một trong số nhiều người bạn\"." },
    ],
    ielts:
      "Mở đoạn Task 2 hay dùng \"One of the main reasons for this is…\" — mỗi lần viết câu này hãy soát cả hai chỗ: reasons (số nhiều) và is (số ít).",
  },

  "agreement-tricky.either-neither": {
    rules: [
      "Either A or B / Neither A nor B / Not only A but also B → động từ theo B, tức chủ ngữ đứng gần động từ nhất.",
      "Để câu nghe tự nhiên, nên đặt vế số nhiều ở sau.",
      "Both A and B → luôn số nhiều. Either/Neither đứng một mình → số ít.",
    ],
    mistakes: [
      { wrong: "Neither the bus nor the trains was on time.", right: "Neither the bus nor the trains were on time.", why: "Vế gần động từ là \"the trains\" (số nhiều)." },
      { wrong: "Either my parents or my sister are picking me up.", right: "Either my parents or my sister is picking me up.", why: "Vế gần động từ là \"my sister\" (số ít)." },
    ],
  },

  "agreement-tricky.number-of": {
    table: [
      ["Cụm", "Nghĩa", "Động từ"],
      ["the number of + N số nhiều", "con số, số lượng", "số ít"],
      ["a number of + N số nhiều", "nhiều (= many)", "số nhiều"],
      ["the percentage / proportion / amount of", "tỉ lệ, lượng", "số ít"],
    ],
    rules: [
      "Với the number of, chủ ngữ thật là \"con số\" nên động từ số ít.",
      "A number of chỉ là một cách nói \"nhiều\", động từ theo danh từ số nhiều phía sau.",
    ],
    mistakes: [
      { wrong: "The number of tourists have doubled since 2015.", right: "The number of tourists has doubled since 2015.", why: "Chủ ngữ là \"the number\" (số ít)." },
      { wrong: "A number of residents has complained about the noise.", right: "A number of residents have complained about the noise.", why: "a number of = many, động từ số nhiều." },
      { wrong: "The proportion of older people are expected to rise.", right: "The proportion of older people is expected to rise.", why: "Chủ ngữ là \"the proportion\"." },
    ],
    ielts:
      "Đây là lỗi hoà hợp phổ biến nhất ở Writing Task 1. Mọi câu mở bằng The number of / The proportion of / The percentage of đều đáng soát lại động từ.",
  },

  "agreement-tricky.fractions": {
    rules: [
      "Phân số, phần trăm, half, most, some, all, the rest + of + danh từ → động từ theo danh từ sau of.",
      "Danh từ sau of là số nhiều → động từ số nhiều; là số ít hoặc không đếm được → động từ số ít.",
    ],
    mistakes: [
      { wrong: "Sixty percent of the respondents was women.", right: "Sixty percent of the respondents were women.", why: "\"the respondents\" số nhiều." },
      { wrong: "Two-thirds of the land are used for farming.", right: "Two-thirds of the land is used for farming.", why: "\"land\" không đếm được." },
    ],
    ielts:
      "Task 1 so sánh tỉ lệ thường đổi qua lại hai kiểu này trong cùng một đoạn: \"40% of households own a car\" nhưng \"40% of the budget goes on housing\".",
  },

  "agreement-tricky.titles-amounts": {
    rules: [
      "Tên sách, phim, tổ chức, quốc gia mang hình thức số nhiều vẫn đi với động từ số ít: The Philippines is…, The United Nations was founded…",
      "Môn học tận cùng -ics (economics, physics, mathematics), news, và tên bệnh như measles → số ít.",
      "Lượng tiền, thời gian, khoảng cách được coi là một khối → số ít: Five kilometres is a long way to walk.",
      "statistics là môn học → số ít; là các con số thống kê → số nhiều.",
    ],
    mistakes: [
      { wrong: "The news are not good.", right: "The news is not good.", why: "news luôn số ít dù có -s." },
      { wrong: "Economics are my favourite subject.", right: "Economics is my favourite subject.", why: "Tên môn học -ics là số ít." },
      { wrong: "Two weeks are not enough for this trip.", right: "Two weeks is not enough for this trip.", why: "Khoảng thời gian được coi như một khối." },
    ],
  },

  // ── Từ loại và cấu tạo từ ───────────────────────────────────────────────
  "parts.eight": {
    table: [
      ["Từ loại", "Làm gì", "Ví dụ"],
      ["Danh từ (noun)", "gọi tên người, vật, nơi, ý niệm", "nurse, village, laptop, honesty"],
      ["Đại từ (pronoun)", "thay cho danh từ để khỏi lặp", "they, it, someone, which"],
      ["Động từ (verb)", "hành động hoặc trạng thái", "build, seem, belong"],
      ["Tính từ (adjective)", "miêu tả danh từ, đại từ", "cheap, crowded, reliable"],
      ["Trạng từ (adverb)", "bổ nghĩa cho động từ, tính từ, trạng từ hoặc cả câu", "slowly, rather, often, fortunately"],
      ["Giới từ (preposition)", "nối danh từ với phần còn lại của câu", "on, during, among"],
      ["Liên từ (conjunction)", "nối từ, cụm từ, mệnh đề", "or, while, unless"],
      ["Mạo từ (article)", "báo danh từ đang nói là xác định hay không", "a, an, the"],
    ],
    rules: [
      "Thán từ (oh, wow, oops) đôi khi được tính là từ loại thứ chín, nhưng gần như không xuất hiện trong IELTS Writing.",
      "Danh từ trừu tượng (development, pressure, freedom) là xương sống của văn nghị luận Task 2.",
      "Một từ có thể mang nhiều từ loại — \"light\" là danh từ, tính từ và động từ. Vị trí trong câu mới cho biết nó đang là gì.",
    ],
  },

  "parts.position": {
    table: [
      ["Vị trí trong câu", "Cần từ loại", "Ví dụ"],
      ["sau a/an/the, my/his, this…", "danh từ (có thể kèm tính từ)", "the solution, her careful plan"],
      ["trước danh từ", "tính từ", "a reliable source"],
      ["sau be, seem, become, feel, look, sound", "tính từ", "The room feels cold."],
      ["sau động từ thường hoặc sau tân ngữ", "trạng từ", "He explained it clearly."],
      ["trước tính từ hoặc trạng từ", "trạng từ", "surprisingly cheap"],
      ["sau can, must, should, will…", "động từ nguyên thể không to", "You should rest."],
    ],
    mistakes: [
      { wrong: "Prices rose dramatic last year.", right: "Prices rose dramatically last year.", why: "Bổ nghĩa cho động từ \"rose\" phải là trạng từ." },
      { wrong: "It was a success event.", right: "It was a successful event.", why: "Đứng trước danh từ \"event\" cần tính từ." },
      { wrong: "This issue seems importantly.", right: "This issue seems important.", why: "Sau động từ nối \"seem\" dùng tính từ." },
    ],
    ielts:
      "Task 1 có hai khung đổi qua lại được mà không đổi ý: động từ + trạng từ (\"rose sharply\") và tính từ + danh từ (\"a sharp rise\"). Dùng cả hai là cách tăng độ đa dạng an toàn.",
  },

  "parts.adj-adv": {
    rules: [
      "Tính từ đứng trước danh từ, hoặc sau động từ nối: be, seem, look, feel, sound, taste, smell, become, get, remain.",
      "Trạng từ bổ nghĩa cho động từ thường, cho tính từ, cho trạng từ khác hoặc cho cả câu. Phần lớn = tính từ + -ly; riêng good → well.",
      "Cùng một động từ có thể là động từ nối hoặc động từ hành động: She looked angry (trông giận) / She looked angrily at him (nhìn một cách giận dữ).",
    ],
    mistakes: [
      { wrong: "He speaks English very good.", right: "He speaks English very well.", why: "Bổ nghĩa cho \"speaks\" cần trạng từ well." },
      { wrong: "The soup tastes deliciously.", right: "The soup tastes delicious.", why: "\"taste\" ở đây là động từ nối, đi với tính từ." },
      { wrong: "She answered polite.", right: "She answered politely.", why: "Cách thức của hành động \"answered\" là trạng từ." },
    ],
  },

  "parts.ly-traps": {
    rules: [
      "Một số từ đuôi -ly là TÍNH TỪ: friendly, lovely, lonely, costly, likely, elderly, lively. Không có \"friendlily\" — nói \"in a friendly way\".",
      "Một số từ vừa là tính từ vừa là trạng từ, không thêm -ly: fast, hard, late, early, daily, straight.",
      "Thêm -ly làm đổi hẳn nghĩa: hardly = hầu như không, lately = gần đây, nearly = gần như.",
    ],
    mistakes: [
      { wrong: "She works very hardly.", right: "She works very hard.", why: "\"hard\" đã là trạng từ; \"hardly\" lại mang nghĩa \"hầu như không\"." },
      { wrong: "He always drives fastly.", right: "He always drives fast.", why: "Không có từ \"fastly\"." },
      { wrong: "The staff treated us friendly.", right: "The staff treated us in a friendly way.", why: "\"friendly\" là tính từ, không bổ nghĩa cho động từ được." },
    ],
  },

  "formation.negative-prefixes": {
    rules: [
      "un- phổ biến nhất và đứng được trước mọi chữ cái: unfair, unhealthy, unreal.",
      "in- dùng với nhiều gốc Latin: incorrect, inefficient. Trước p, m, b → im- (impatient, immature, imbalance); trước r → ir- (irregular, irrelevant); trước l → il- (illogical, illiterate).",
      "dis- cho động từ và một số tính từ, danh từ: dislike, dishonest, disadvantage.",
      "Quy tắc theo chữ cái đầu chỉ áp cho họ in-/im-/ir-/il-. Không chắc un- hay in- thì tra từ điển.",
    ],
    mistakes: [
      { wrong: "Parking here is inlegal.", right: "Parking here is illegal.", why: "Gốc bắt đầu bằng l → il-." },
      { wrong: "That is unpossible.", right: "That is impossible.", why: "Gốc bắt đầu bằng p → im-." },
      { wrong: "He was unhonest with us.", right: "He was dishonest with us.", why: "honest đi với dis-." },
    ],
  },

  "formation.meaning-prefixes": {
    table: [
      ["Tiền tố", "Nghĩa", "Ví dụ"],
      ["re-", "làm lại", "rebuild, reconsider"],
      ["mis-", "làm sai", "misread, mislead"],
      ["over-", "quá mức", "overspend, overcrowded"],
      ["under-", "dưới mức, chưa đủ", "underpaid, underestimate"],
      ["pre-", "trước", "preview, pre-school"],
      ["co-", "cùng", "co-worker, coexist"],
    ],
    rules: ["Tiền tố đổi NGHĨA nhưng thường giữ nguyên từ loại: estimate (động từ) → underestimate (động từ)."],
    ielts:
      "overcrowded, overpopulated, underfunded, underrepresented là nhóm từ \"đắt\" cho Task 2 về đô thị, giáo dục, y tế.",
  },

  "formation.noun-suffixes": {
    table: [
      ["Hậu tố", "Tạo ra", "Ví dụ"],
      ["-er, -or, -ist, -ant", "người làm việc đó", "employer, investor, scientist, assistant"],
      ["-ee", "người nhận việc đó", "employee, trainee"],
      ["-ment", "việc, kết quả của việc", "investment, development"],
      ["-tion, -sion", "quá trình, hành động", "pollution, decision"],
      ["-ness", "trạng thái (từ tính từ)", "awareness, loneliness"],
      ["-ity", "tính chất (từ tính từ)", "equality, popularity"],
      ["-ance, -ence", "trạng thái, hành động", "performance, dependence"],
    ],
    mistakes: [
      { wrong: "They showed us a lot of kind.", right: "They showed us a lot of kindness.", why: "Sau \"a lot of\" cần danh từ; kind → kindness." },
      { wrong: "Schools need more invest.", right: "Schools need more investment.", why: "Sau \"more\" ở đây cần danh từ." },
      { wrong: "The employers went on strike for higher pay.", right: "The employees went on strike for higher pay.", why: "-er là người thuê, -ee là người được thuê." },
    ],
  },

  "formation.adj-suffixes": {
    table: [
      ["Hậu tố", "Nghĩa", "Ví dụ"],
      ["-ful", "có nhiều", "harmful, stressful"],
      ["-less", "không có", "homeless, pointless"],
      ["-ive", "có xu hướng, có tính", "effective, competitive"],
      ["-ous", "có tính chất", "dangerous, ambitious"],
      ["-al", "thuộc về", "environmental, financial"],
      ["-able, -ible", "có thể được", "affordable, accessible"],
    ],
    rules: ["-ful và -less thường thành cặp trái nghĩa (useful/useless), nhưng không phải lúc nào cũng vậy: priceless nghĩa là vô giá, không phải \"rẻ\"."],
    mistakes: [
      { wrong: "This is a danger road at night.", right: "This is a dangerous road at night.", why: "Trước danh từ cần tính từ dangerous." },
      { wrong: "Housing is not afford for most young families.", right: "Housing is not affordable for most young families.", why: "Sau be cần tính từ." },
      { wrong: "Plastic waste is a serious environment problem.", right: "Plastic waste is a serious environmental problem.", why: "Bổ nghĩa cho \"problem\" cần tính từ environmental." },
    ],
  },

  "formation.verb-adv-suffixes": {
    table: [
      ["Hậu tố", "Biến thành", "Ví dụ"],
      ["-en", "động từ (từ tính từ/danh từ)", "widen, strengthen, threaten"],
      ["-ize / -ise", "động từ", "modernise, prioritise"],
      ["-ify", "động từ", "simplify, justify"],
      ["-ly", "trạng từ (từ tính từ)", "gradually, significantly"],
    ],
    rules: [
      "Anh-Mỹ viết -ize, Anh-Anh chấp nhận cả -ise. Chọn một kiểu và giữ suốt bài.",
      "Tính từ tận cùng -ic → -ically (dramatically); -le → -ly (possibly, gently); phụ âm + y → -ily (easily).",
    ],
    mistakes: [
      { wrong: "We must strength the local economy.", right: "We must strengthen the local economy.", why: "Sau must cần động từ; strength là danh từ." },
      { wrong: "Sales fell dramaticly in March.", right: "Sales fell dramatically in March.", why: "Tính từ -ic thành trạng từ bằng -ically." },
    ],
  },

  "formation.word-family": {
    rules: [
      "Bước 1 — xác định chỗ trống cần chức năng gì (xem \"Đoán từ loại qua vị trí trong câu\").",
      "Bước 2 — chọn hậu tố mang đúng từ loại đó.",
      "Bước 3 — soát tiếp: danh từ số ít hay nhiều, động từ đúng thì và ngôi chưa, câu có cần nghĩa phủ định không.",
      "Bước 4 — tra từ điển khi không chắc: đếm được không, đi với giới từ nào, hai dạng gần giống nhau khác nghĩa ra sao.",
    ],
    table: [
      ["Động từ", "Danh từ", "Tính từ", "Trạng từ"],
      ["succeed", "success", "successful", "successfully"],
      ["compete", "competition, competitor", "competitive", "competitively"],
      ["depend", "dependence", "dependent", "—"],
      ["economise", "economy, economics", "economic, economical", "economically"],
    ],
    mistakes: [
      { wrong: "She is very success in her career.", right: "She is very successful in her career.", why: "Sau be + very cần tính từ." },
      { wrong: "Tourism brings many economical benefits.", right: "Tourism brings many economic benefits.", why: "economic = thuộc về kinh tế; economical = tiết kiệm." },
    ],
    ielts:
      "Đổi dạng từ là cách paraphrase an toàn nhất: \"The population grew rapidly\" → \"There was rapid growth in the population\".",
  },

  // ── Kiểu câu và dấu câu ─────────────────────────────────────────────────
  "types.clauses": {
    rules: [
      "Mệnh đề là nhóm từ có chủ ngữ và động từ đã chia.",
      "Mệnh đề độc lập đứng một mình thành câu được. Mệnh đề phụ thuộc mở đầu bằng liên từ phụ thuộc (because, although, when, if…) hoặc từ quan hệ (who, which, that…) và phải gắn vào một mệnh đề độc lập.",
      "Cụm từ thì không có cặp chủ–vị: \"after the meeting\" là cụm, \"after the meeting ended\" là mệnh đề.",
    ],
    mistakes: [
      { wrong: "Because the rent is too high.", right: "Many students share flats because the rent is too high.", why: "Mệnh đề phụ không đứng một mình thành câu được." },
    ],
  },

  "types.simple": {
    rules: [
      "Câu đơn có đúng một mệnh đề độc lập: Subject + Verb (+ Object) (+ trạng ngữ).",
      "Vẫn là câu đơn khi có chủ ngữ ghép (My aunt and uncle run a café) hoặc vị ngữ ghép (She cooked dinner and washed up).",
      "Câu đơn không có nghĩa là câu ngắn — nó dài ra được nhờ cụm giới từ và trạng ngữ.",
    ],
    mistakes: [
      { wrong: "My cousin and I likes hiking.", right: "My cousin and I like hiking.", why: "Chủ ngữ ghép bằng and là số nhiều." },
    ],
    ielts: "Câu đơn hợp để nêu ý chủ đề ở đầu đoạn thân bài: rõ ràng và khó sai.",
  },

  "types.compound": {
    table: [
      ["FANBOYS", "Quan hệ", "Ví dụ"],
      ["for", "lý do (trang trọng)", "We left early, for the road was icy."],
      ["and", "thêm ý", "The flat is small, and the rent is high."],
      ["nor", "thêm một ý phủ định", "He didn't call, nor did he write."],
      ["but", "đối lập", "The plan is cheap, but it is slow."],
      ["or", "lựa chọn, nếu không thì", "Book now, or the seats will be gone."],
      ["yet", "đối lập bất ngờ", "She trained for months, yet she lost."],
      ["so", "kết quả", "The shop was closed, so we went home."],
    ],
    rules: [
      "Mệnh đề độc lập + dấu phẩy + FANBOYS + mệnh đề độc lập.",
      "Chỉ nối hai từ hoặc hai cụm thì không cần dấu phẩy: tea and coffee.",
      "Sau nor phải đảo trợ động từ lên trước chủ ngữ.",
    ],
    mistakes: [
      { wrong: "He didn't call, nor he wrote.", right: "He didn't call, nor did he write.", why: "Sau nor phải đảo ngữ." },
      { wrong: "The flat is small but, it is cheap.", right: "The flat is small, but it is cheap.", why: "Dấu phẩy đứng TRƯỚC liên từ." },
    ],
  },

  "types.complex": {
    table: [
      ["Chức năng", "Liên từ phụ thuộc"],
      ["thời gian", "when, while, before, after, since, until, as soon as"],
      ["lý do", "because, since, as"],
      ["nhượng bộ", "although, though, even though"],
      ["điều kiện", "if, unless, provided that, as long as"],
      ["mục đích", "so that, in order that"],
      ["kết quả", "so … that, such … that"],
      ["cách thức", "as if, as though"],
    ],
    rules: [
      "Mệnh đề phụ đứng đầu câu → có dấu phẩy ngăn với mệnh đề chính.",
      "Mệnh đề phụ đứng sau → thường không cần dấu phẩy.",
      "Có ba loại mệnh đề phụ: mệnh đề danh từ, mệnh đề quan hệ, mệnh đề trạng ngữ.",
    ],
    mistakes: [
      { wrong: "Although it was expensive, but we bought it.", right: "Although it was expensive, we bought it.", why: "although và but không đi chung — lỗi do dịch thẳng \"Mặc dù… nhưng…\"." },
      { wrong: "Because I was tired so I went to bed early.", right: "Because I was tired, I went to bed early.", why: "because và so không đi chung — lỗi do dịch thẳng \"Vì… nên…\"." },
    ],
  },

  "types.compound-complex": {
    rules: [
      "Ít nhất hai mệnh đề độc lập và ít nhất một mệnh đề phụ thuộc.",
      "Ví dụ: When the factory closed, many workers moved away, and the town slowly emptied.",
      "Giữ trong khoảng 25–30 từ. Dài hơn thì tách câu — người đọc lạc mạch trước khi giám khảo kịp chấm range.",
    ],
    mistakes: [
      {
        wrong: "When the factory closed many workers moved away and the town slowly emptied and the schools lost students because there were fewer families.",
        right: "When the factory closed, many workers moved away. With fewer families left, the local schools also lost students.",
        why: "Chuỗi and nối dài và thiếu dấu phẩy làm câu rối; tách làm hai câu rõ hơn mà vẫn đa dạng.",
      },
    ],
  },

  "types.variety": {
    rules: [
      "Độ đa dạng không có nghĩa câu càng dài càng tốt. Một câu phức ngắn mà đúng có giá trị hơn một câu dài mà sai.",
      "Phối trong mỗi đoạn: câu đơn nêu ý, câu phức giải thích nguyên nhân hoặc điều kiện, câu ghép bổ sung hoặc đối lập.",
      "Nền là cấu trúc mình chắc chắn đúng; thêm một hai cấu trúc khó (mệnh đề quan hệ không xác định, bị động, điều kiện loại 2, đảo ngữ) khi đã nắm chắc.",
    ],
    ielts:
      "Tiêu chí Grammatical Range and Accuracy chiếm 25% điểm Writing và Speaking. Lên band 7 cần cùng lúc HAI thứ: dùng câu phức thường xuyên VÀ phần lớn câu không có lỗi — có cái này thiếu cái kia thì vẫn kẹt ở 6.",
  },

  "punctuation.end-marks": {
    rules: [
      "Dấu chấm kết thúc câu kể và câu mệnh lệnh bình thường.",
      "Dấu chấm hỏi chỉ cho câu hỏi trực tiếp. Câu hỏi gián tiếp nằm trong câu kể thì kết thúc bằng dấu chấm: I wonder whether it will rain.",
      "Dấu chấm than gần như không dùng trong văn học thuật.",
    ],
    mistakes: [
      { wrong: "I asked her where she lived?", right: "I asked her where she lived.", why: "Đây là câu kể chứa câu hỏi gián tiếp, không phải câu hỏi." },
      { wrong: "Could you tell me where the station is.", right: "Could you tell me where the station is?", why: "Cả câu là một câu hỏi trực tiếp (Could you…?)." },
    ],
    ielts: "Đừng dùng ! để nhấn mạnh trong Task 2 — nhấn bằng từ: crucially, above all, most importantly.",
  },

  "punctuation.comma-rules": {
    rules: [
      "Sau mệnh đề phụ hoặc cụm từ mở đầu câu: If it rains, … / In recent years, …",
      "Trước FANBOYS khi nối hai mệnh đề độc lập.",
      "Ngăn các mục trong danh sách từ ba mục trở lên.",
      "Bao quanh mệnh đề quan hệ không xác định và các cụm chêm như however, for example.",
      "KHÔNG đặt dấu phẩy giữa chủ ngữ và động từ, và không đặt khi chỉ nối hai từ hay hai cụm.",
    ],
    mistakes: [
      { wrong: "When I arrived the meeting had already started.", right: "When I arrived, the meeting had already started.", why: "Mệnh đề phụ đứng đầu cần dấu phẩy." },
      { wrong: "She enjoys swimming, and cycling.", right: "She enjoys swimming and cycling.", why: "Chỉ nối hai thứ thì không cần phẩy." },
      { wrong: "The main problem with public transport, is the cost.", right: "The main problem with public transport is the cost.", why: "Không tách chủ ngữ khỏi động từ bằng dấu phẩy." },
    ],
  },

  "punctuation.comma-splice": {
    rules: [
      "Hai mệnh đề độc lập không được nối chỉ bằng một dấu phẩy (comma splice). Viết liền nhau không có dấu gì (run-on) cũng là lỗi cùng họ.",
      "Năm cách sửa: tách thành hai câu; dùng dấu chấm phẩy; thêm FANBOYS sau dấu phẩy; biến một vế thành mệnh đề phụ; dùng \"; however,\".",
      "however, therefore, moreover KHÔNG phải liên từ — \"…, however, …\" nối hai mệnh đề vẫn là comma splice.",
    ],
    mistakes: [
      { wrong: "The city is crowded, many people still move there.", right: "The city is crowded, but many people still move there.", why: "Cần liên từ (hoặc dấu chấm/chấm phẩy) giữa hai mệnh đề độc lập." },
      { wrong: "Prices went up, however, demand stayed high.", right: "Prices went up; however, demand stayed high.", why: "however là trạng từ nối, phải đứng sau dấu chấm phẩy hoặc mở câu mới." },
    ],
    ielts: "Lỗi này rất hay gặp ở bài band 5–6 và kéo điểm Accuracy xuống dù câu vẫn hiểu được.",
  },

  "punctuation.fragment": {
    rules: [
      "Mỗi câu phải có ít nhất một mệnh đề độc lập.",
      "Mệnh đề phụ (Because…, Although…, Which…) hay cụm phân từ (Looking at the chart…) đứng một mình là câu cụt.",
      "Sửa bằng cách ghép vào câu đứng trước hoặc sau, hoặc viết lại cho có chủ ngữ và động từ chính.",
    ],
    mistakes: [
      { wrong: "Many young people move to cities. Because there are more jobs.", right: "Many young people move to cities because there are more jobs.", why: "\"Because…\" phải gắn vào mệnh đề chính." },
      { wrong: "For example, the rise in online shopping.", right: "One example is the rise in online shopping.", why: "Câu cũ không có động từ chính." },
    ],
  },

  "punctuation.semicolon": {
    rules: [
      "Nối hai mệnh đề độc lập có liên hệ chặt mà không cần liên từ.",
      "Đứng trước trạng từ nối (however, therefore, moreover, otherwise, as a result) mở đầu vế thứ hai; sau trạng từ nối là dấu phẩy.",
      "Không dùng dấu chấm phẩy trước mệnh đề phụ.",
      "Ngăn các mục của danh sách khi chính các mục đã chứa dấu phẩy.",
    ],
    mistakes: [
      { wrong: "Although the plan is costly; it will save money later.", right: "Although the plan is costly, it will save money later.", why: "Mệnh đề phụ đứng đầu ngăn bằng dấu phẩy, không phải chấm phẩy." },
      { wrong: "Fees have risen, therefore fewer students apply.", right: "Fees have risen; therefore, fewer students apply.", why: "therefore là trạng từ nối." },
    ],
    ielts: "Một hai dấu chấm phẩy dùng đúng cho thấy bạn kiểm soát được dấu câu. Rải khắp bài thì phản tác dụng.",
  },

  "punctuation.oxford-comma": {
    rules: [
      "Dấu phẩy Oxford là dấu phẩy trước and/or cuối danh sách từ ba mục: trains, buses, and trams.",
      "Có hay không đều đúng. Điều bắt buộc là NHẤT QUÁN trong cả bài.",
      "Nó giúp tránh hiểu nhầm khi các mục dài hoặc chứa and: I thanked my parents, the coach, and the team captain.",
    ],
  },

  "editing.checklist": {
    rules: [
      "Câu nào cũng có chủ ngữ và động từ chia chưa? (câu cụt)",
      "Động từ khớp số với chủ ngữ CHÍNH chưa — nhất là sau the number of, one of, each, và cụm of… chen giữa?",
      "Thì có khớp mốc thời gian không? Năm trong quá khứ → quá khứ đơn; in recent years / since → hiện tại hoàn thành.",
      "Danh từ đếm được số nhiều đã có -s chưa; danh từ không đếm được có bị thêm -s không?",
      "Danh từ đếm được số ít đã có a/an/the/my… đứng trước chưa?",
      "Có comma splice không? Mệnh đề phụ đứng đầu đã có dấu phẩy chưa?",
      "although có đi chung với but, because có đi chung với so không?",
      "Sau động từ nối là tính từ; bổ nghĩa cho động từ thường là trạng từ.",
      "Sau can/must/should/will là động từ nguyên thể không to.",
    ],
    ielts:
      "Dành 2–3 phút cuối để soát theo danh sách này, mỗi lượt chỉ tìm MỘT loại lỗi. Soát mọi thứ cùng lúc thì mắt trượt qua chính những lỗi quen tay nhất.",
  },

  // ── Hệ thống thì ────────────────────────────────────────────────────────
  "overview.signals": {
    table: [
      ["Thì", "Dấu hiệu thường gặp"],
      ["Hiện tại đơn", "always, usually, often, every week, on Sundays"],
      ["Hiện tại tiếp diễn", "now, right now, at the moment, currently, Look!"],
      ["Hiện tại hoàn thành", "already, yet, just, ever, never, since, for, so far, recently, over the past decade"],
      ["Quá khứ đơn", "yesterday, last year, … ago, in 2010, when I was young"],
      ["Quá khứ hoàn thành", "by the time + quá khứ, before, after, already"],
      ["Tương lai", "tomorrow, next month, soon; by 2030 (→ will have done)"],
    ],
    rules: ["Dấu hiệu chỉ là gợi ý; ngữ cảnh mới quyết định. \"recently\" đi được cả với quá khứ đơn: I recently moved to Da Nang."],
    mistakes: [
      { wrong: "I have met her two days ago.", right: "I met her two days ago.", why: "\"ago\" là mốc quá khứ xác định → quá khứ đơn." },
      { wrong: "Since 2015, the price rose steadily.", right: "Since 2015, the price has risen steadily.", why: "\"since\" nối quá khứ tới hiện tại → hiện tại hoàn thành." },
    ],
  },

  "overview.map": {
    table: [
      ["Thể", "Hiện tại", "Quá khứ", "Tương lai"],
      ["Đơn", "works", "worked", "will work"],
      ["Tiếp diễn", "is working", "was working", "will be working"],
      ["Hoàn thành", "has worked", "had worked", "will have worked"],
      ["Hoàn thành tiếp diễn", "has been working", "had been working", "will have been working"],
    ],
    rules: [
      "Ba mốc thời gian × bốn thể = mười hai thì.",
      "Đơn: sự việc trọn vẹn, thói quen, sự thật. Tiếp diễn (be + V-ing): đang diễn ra quanh một mốc.",
      "Hoàn thành (have + V3): đã xong trước một mốc, nhìn từ mốc đó. Hoàn thành tiếp diễn (have been + V-ing): kéo dài tới mốc, nhấn vào quá trình.",
      "be going to là một cách nói tương lai, không phải thì thứ mười ba.",
    ],
  },

  "overview.ielts-writing": {
    rules: [
      "Task 1 có năm trong quá khứ → quá khứ đơn.",
      "Số liệu dự báo → will / is expected to / is projected to / is predicted to.",
      "Mô tả tới một mốc tương lai → will have + V3: By 2040, the figure will have doubled.",
      "Quy trình và bản đồ hiện tại → hiện tại đơn (quy trình dùng bị động). Bản đồ so sánh hai năm đã qua → quá khứ đơn, thường bị động: was built, were replaced.",
      "Task 2: hiện tại đơn cho quan điểm và sự thật chung; hiện tại hoàn thành cho xu hướng gần đây (In recent decades, … has increased); điều kiện loại 1 và 2 cho hệ quả của giải pháp.",
    ],
    mistakes: [
      { wrong: "In 2000, the figure is 20%.", right: "In 2000, the figure was 20%.", why: "Năm đã qua → quá khứ đơn." },
      { wrong: "By 2030, the number of users will double.", right: "By 2030, the number of users will have doubled.", why: "\"by + mốc tương lai\" nhấn việc xong trước mốc đó → tương lai hoàn thành." },
    ],
  },

  // ── Thì hiện tại ────────────────────────────────────────────────────────
  "simple.habits": {
    rules: [
      "Thói quen, sự thật hiển nhiên, lịch trình cố định.",
      "Đi cùng trạng từ tần suất: always, usually, often, sometimes, rarely, never.",
    ],
    mistakes: [
      { wrong: "She go to the gym every morning.", right: "She goes to the gym every morning.", why: "Ngôi thứ ba số ít thêm -es với go." },
      { wrong: "Water boil at 100°C.", right: "Water boils at 100°C.", why: "Sự thật hiển nhiên, chủ ngữ số ít." },
      { wrong: "I am usually walking to work.", right: "I usually walk to work.", why: "Thói quen dùng hiện tại đơn, không dùng tiếp diễn." },
    ],
  },

  "simple.state-verbs": {
    rules: [
      "Động từ chỉ trạng thái thường không dùng ở thì tiếp diễn: know, understand, believe, mean, like, love, hate, prefer, want, need, own, belong, seem, contain, consist.",
      "Một số động từ đổi nghĩa thì dùng tiếp diễn được: think (đang cân nhắc: I'm thinking about it / cho rằng: I think so), have (ăn, trải qua: having lunch), see (gặp hẹn: I'm seeing the dentist).",
    ],
    mistakes: [
      { wrong: "She is owning two cars.", right: "She owns two cars.", why: "own là động từ trạng thái." },
      { wrong: "This box is containing old letters.", right: "This box contains old letters.", why: "contain là động từ trạng thái." },
      { wrong: "I'm not understanding this question.", right: "I don't understand this question.", why: "understand không dùng tiếp diễn." },
    ],
  },

  "continuous.now": {
    rules: ["am/is/are + V-ing. Hai phần đều bắt buộc — người học hay rơi mất be."],
    mistakes: [
      { wrong: "They waiting for the bus.", right: "They are waiting for the bus.", why: "Thiếu be." },
      { wrong: "Listen! Someone knocks at the door.", right: "Listen! Someone is knocking at the door.", why: "Việc đang xảy ra ngay lúc nói." },
    ],
  },

  "continuous.arrangements": {
    rules: ["Kế hoạch đã hẹn với người khác, thường có ngày giờ cụ thể → hiện tại tiếp diễn."],
    mistakes: [
      { wrong: "I meet my tutor tomorrow at three.", right: "I'm meeting my tutor tomorrow at three.", why: "Cuộc hẹn đã sắp xếp." },
    ],
  },

  "perfect.vs-past": {
    rules: [
      "Có mốc quá khứ xác định (yesterday, last year, in 2019, … ago, when…) → quá khứ đơn.",
      "Không nêu mốc, quan tâm tới kết quả hay trải nghiệm tính đến nay → hiện tại hoàn thành.",
      "Câu hỏi When…? luôn dùng quá khứ đơn.",
    ],
    mistakes: [
      { wrong: "She has graduated in 2021.", right: "She graduated in 2021.", why: "\"in 2021\" là mốc xác định." },
      { wrong: "When have you arrived?", right: "When did you arrive?", why: "When hỏi về một mốc → quá khứ đơn." },
      { wrong: "I live here since 2018.", right: "I have lived here since 2018.", why: "since nối quá khứ tới nay." },
    ],
    ielts: "Mở bài Task 2: \"Over the past few decades, the number of … has risen\" — hiện tại hoàn thành nối quá khứ với hiện tại.",
  },

  "perfect.perfect-continuous": {
    rules: [
      "have/has been + V-ing: việc bắt đầu trong quá khứ, kéo dài tới giờ, nhấn vào quá trình.",
      "I have lived here for five years và I have been living here for five years đều đúng; bản tiếp diễn nhấn sự liên tục.",
      "Nói SỐ LƯỢNG đã làm xong thì dùng hoàn thành đơn: I've written three emails.",
      "Không dùng với động từ trạng thái.",
    ],
    mistakes: [
      { wrong: "I have been knowing him for years.", right: "I have known him for years.", why: "know là động từ trạng thái." },
      { wrong: "She has been writing four reports today.", right: "She has written four reports today.", why: "Có số lượng hoàn tất → hoàn thành đơn." },
    ],
  },

  // ── Thì quá khứ ─────────────────────────────────────────────────────────
  "simple-past.irregular": {
    rules: [
      "Động từ bất quy tắc phải thuộc cả ba cột: buy–bought–bought, take–took–taken, write–wrote–written.",
      "Câu hỏi và phủ định có did → động từ chính về nguyên thể.",
    ],
    mistakes: [
      { wrong: "He catched the early train.", right: "He caught the early train.", why: "catch là động từ bất quy tắc." },
      { wrong: "Did you saw the news?", right: "Did you see the news?", why: "Sau did dùng nguyên thể." },
      { wrong: "Sales have rose sharply.", right: "Sales have risen sharply.", why: "Sau have cần cột 3: rise–rose–risen." },
    ],
    ielts: "rise–rose–risen, fall–fell–fallen, grow–grew–grown là ba động từ dễ chia sai nhất trong Task 1.",
  },

  "past-continuous.interrupted": {
    rules: [
      "Việc đang diễn ra (was/were + V-ing) bị một việc ngắn (quá khứ đơn) xen vào.",
      "when thường đi với việc ngắn; while thường đi với việc đang diễn ra.",
      "Chuỗi việc ngắn nối tiếp nhau → toàn bộ dùng quá khứ đơn.",
    ],
    mistakes: [
      { wrong: "When the power went out, we watched a film.", right: "When the power went out, we were watching a film.", why: "Ý là đang xem dở thì mất điện." },
      { wrong: "While I walked home, it started to rain.", right: "While I was walking home, it started to rain.", why: "Việc đang diễn ra dùng quá khứ tiếp diễn." },
      { wrong: "She was opening the door and was walking in.", right: "She opened the door and walked in.", why: "Hai việc ngắn nối tiếp nhau." },
    ],
  },

  "past-perfect.earlier": {
    rules: [
      "had + V3: việc xảy ra trước một mốc hoặc một việc khác trong quá khứ.",
      "Khi before/after đã nói rõ thứ tự, dùng quá khứ đơn cho cả hai cũng được chấp nhận.",
      "Chỉ có một việc trong quá khứ, không có mốc so sánh → đừng dùng quá khứ hoàn thành.",
    ],
    mistakes: [
      { wrong: "When we got to the station, the train already left.", right: "When we got to the station, the train had already left.", why: "Tàu đi TRƯỚC lúc chúng tôi tới." },
      { wrong: "I had visited my grandparents last weekend.", right: "I visited my grandparents last weekend.", why: "Chỉ một việc, không có mốc nào để so trước sau." },
    ],
  },

  // ── Cách nói tương lai ──────────────────────────────────────────────────
  "basic-future.will": {
    rules: [
      "will + V: quyết định ngay lúc nói, dự đoán theo ý kiến (I think, probably), lời hứa, lời đề nghị.",
      "Sau will là nguyên thể không to.",
      "Không dùng will trong mệnh đề if/when nói về tương lai.",
    ],
    mistakes: [
      { wrong: "I will to call you later.", right: "I'll call you later.", why: "will đi thẳng với động từ nguyên thể." },
      { wrong: "A: The phone's ringing. B: I'm going to get it.", right: "A: The phone's ringing. B: I'll get it.", why: "Quyết định ngay lúc nói → will." },
    ],
  },

  "basic-future.going-to": {
    rules: [
      "be going to + V: dự định đã có từ trước; dự đoán dựa trên bằng chứng đang thấy.",
      "be là bắt buộc: am/is/are going to.",
    ],
    mistakes: [
      { wrong: "Look at that sky — it will rain.", right: "Look at that sky — it's going to rain.", why: "Có bằng chứng trước mắt → going to." },
      { wrong: "They going to open a new branch.", right: "They are going to open a new branch.", why: "Thiếu be." },
    ],
  },

  "advanced-future.future-perfect": {
    rules: [
      "will have + V3: việc sẽ xong trước một mốc tương lai.",
      "Thường đi với by + mốc, hoặc by the time + hiện tại đơn.",
    ],
    mistakes: [
      { wrong: "By the time you will arrive, we will have eaten.", right: "By the time you arrive, we will have eaten.", why: "Mệnh đề by the time nói về tương lai dùng hiện tại đơn." },
      { wrong: "By 2035, the figure will reach 50%.", right: "By 2035, the figure will have reached 50%.", why: "Nhấn việc đạt mức đó trước mốc 2035." },
    ],
    ielts: "Câu dự báo Task 1 mang \"by + năm\" là chỗ tự nhiên nhất để dùng tương lai hoàn thành.",
  },

  "advanced-future.future-perfect-continuous": {
    rules: [
      "will have been + V-ing: việc sẽ kéo dài liên tục tới một mốc tương lai, nhấn vào độ dài.",
      "Thường đi với for + khoảng thời gian và by / by the time.",
    ],
    mistakes: [
      { wrong: "By June, I will work here for ten years.", right: "By June, I will have been working here for ten years.", why: "Nhấn khoảng thời gian kéo dài tới mốc tháng Sáu." },
    ],
  },

  // ── Động từ khuyết thiếu ────────────────────────────────────────────────
  "ability-permission.can": {
    rules: [
      "Sau mọi động từ khuyết thiếu là nguyên thể không to.",
      "Động từ khuyết thiếu không thêm -s, không có dạng V-ing hay to.",
    ],
    mistakes: [
      { wrong: "She can speaks three languages.", right: "She can speak three languages.", why: "Sau can dùng nguyên thể." },
      { wrong: "You must to wear a helmet.", right: "You must wear a helmet.", why: "must không đi với to." },
    ],
  },

  "deduction.past-deduction": {
    table: [
      ["Cấu trúc", "Nghĩa", "Ví dụ"],
      ["must have + V3", "chắc hẳn đã", "The road is wet. It must have rained."],
      ["might / may / could have + V3", "có lẽ đã", "She might have taken the wrong bus."],
      ["can't / couldn't have + V3", "chắc chắn đã không", "He can't have finished already."],
    ],
    rules: ["Mức chắc chắn tăng dần: might / may / could → should → must."],
    mistakes: [
      { wrong: "He must missed the bus.", right: "He must have missed the bus.", why: "Suy đoán về quá khứ cần have + V3." },
      { wrong: "They mustn't have seen us.", right: "They can't have seen us.", why: "Phủ định của suy đoán chắc chắn là can't have, không phải mustn't have." },
    ],
  },

  "deduction.regret": {
    rules: [
      "should have + V3: lẽ ra nên làm (mà đã không làm) — tiếc nuối hoặc trách móc.",
      "shouldn't have + V3: lẽ ra không nên (mà đã làm).",
      "could have + V3: đã có thể xảy ra / đã có thể làm, nhưng không.",
      "needn't have + V3: đã làm, rồi hoá ra không cần.",
    ],
    mistakes: [
      { wrong: "You should told me earlier.", right: "You should have told me earlier.", why: "Nói về quá khứ cần have + V3." },
      { wrong: "I should have not said that.", right: "I shouldn't have said that.", why: "not đứng ngay sau should." },
    ],
  },

  "hedging.softening": {
    rules: [
      "may / might / could + V làm câu bớt tuyệt đối.",
      "Kết hợp được với tend to, it is likely that, to some extent, in many cases.",
      "Tránh always, never, everyone, all khi không có bằng chứng đi kèm.",
    ],
    mistakes: [
      { wrong: "Social media makes all teenagers depressed.", right: "Social media may contribute to depression among some teenagers.", why: "Khẳng định tuyệt đối dễ bị coi là thiếu cơ sở trong văn nghị luận." },
    ],
    ielts: "\"This policy could lead to higher costs for small businesses\" thuyết phục hơn \"This policy will destroy small businesses\" — giám khảo chấm cả độ chừng mực của lập luận.",
  },

  // ── Thể bị động ─────────────────────────────────────────────────────────
  "basic-passive.present-past": {
    table: [
      ["Thì", "Bị động", "Ví dụ"],
      ["Hiện tại đơn", "am/is/are + V3", "Rice is grown in the delta."],
      ["Hiện tại tiếp diễn", "am/is/are being + V3", "The bridge is being repaired."],
      ["Quá khứ đơn", "was/were + V3", "The school was founded in 1998."],
      ["Quá khứ tiếp diễn", "was/were being + V3", "The room was being cleaned."],
      ["Hiện tại hoàn thành", "has/have been + V3", "Three new parks have been opened."],
      ["Quá khứ hoàn thành", "had been + V3", "All the tickets had been sold."],
      ["Tương lai đơn", "will be + V3", "The results will be published soon."],
      ["Động từ khuyết thiếu", "modal + be + V3", "Plastic bags should be banned."],
    ],
    rules: ["be mang thì; động từ chính luôn ở dạng V3."],
    mistakes: [
      { wrong: "The museum was build in 1920.", right: "The museum was built in 1920.", why: "Động từ chính phải ở V3." },
      { wrong: "The report has finished.", right: "The report has been finished.", why: "Báo cáo không tự làm xong — cần been + V3." },
    ],
  },

  "basic-passive.why-passive": {
    rules: [
      "Dùng bị động khi đối tượng chịu tác động quan trọng hơn người làm.",
      "Bỏ by + tác nhân khi tác nhân không rõ, không quan trọng, hoặc ai cũng biết.",
      "Giữ by khi tác nhân là thông tin mới, đáng chú ý.",
    ],
    mistakes: [
      { wrong: "My wallet was stolen by someone.", right: "My wallet was stolen.", why: "\"by someone\" không thêm thông tin gì." },
    ],
    ielts: "Task 2: \"It is often argued that…\", \"This issue should be addressed by governments\" — bị động làm giọng văn khách quan hơn.",
  },

  "basic-passive.intransitive": {
    rules: [
      "Chỉ động từ có tân ngữ (ngoại động từ) mới chuyển sang bị động được.",
      "Nội động từ không có bị động: happen, occur, arrive, die, rise, fall, appear, disappear, remain, exist, consist of.",
      "Task 1: rise/fall là nội động từ (không có \"was risen\"); raise/lower là ngoại động từ (prices were raised).",
    ],
    mistakes: [
      { wrong: "The accident was happened at night.", right: "The accident happened at night.", why: "happen không có tân ngữ nên không có bị động." },
      { wrong: "The number of visitors was risen in 2020.", right: "The number of visitors rose in 2020.", why: "rise là nội động từ." },
      { wrong: "Many species have been disappeared.", right: "Many species have disappeared.", why: "disappear là nội động từ." },
    ],
  },

  "advanced-passive.process": {
    rules: [
      "Task 1 dạng quy trình gần như toàn bộ dùng bị động hiện tại đơn.",
      "Nối các bước bằng first, next, then, after that, once, finally; gộp bước bằng mệnh đề quan hệ hoặc where.",
      "Bước tự nhiên không do con người làm (water evaporates, the dough rises) vẫn giữ chủ động.",
    ],
    mistakes: [
      { wrong: "Then the beans roast at a high temperature.", right: "Then the beans are roasted at a high temperature.", why: "Hạt bị rang, không tự rang." },
      { wrong: "After that, the bottles are wash and fill.", right: "After that, the bottles are washed and filled.", why: "Cả hai động từ sau are đều phải ở V3." },
    ],
    ielts: "Một câu quy trình mẫu: \"First, the cocoa beans are harvested and left to dry. They are then roasted, after which the shells are removed.\"",
  },

  "advanced-passive.reporting-passive": {
    rules: [
      "It is said / believed / thought / argued / estimated that + mệnh đề.",
      "S + is said / believed + to V (hiện tại) hoặc to have V3 (quá khứ).",
    ],
    mistakes: [
      { wrong: "It is believed that the bridge to be unsafe.", right: "The bridge is believed to be unsafe.", why: "Sau that cần mệnh đề đủ; muốn dùng to be thì chủ ngữ là the bridge." },
      { wrong: "The painting is thought to paint in 1890.", right: "The painting is thought to have been painted in 1890.", why: "Việc trong quá khứ và bị động → to have been + V3." },
    ],
    ielts: "\"It is widely believed that…\" nêu quan điểm của số đông mà không phải nói ai — rất hợp mở đoạn Task 2.",
  },

  // ── Câu hỏi và phủ định ─────────────────────────────────────────────────
  "question-forms.indirect": {
    rules: [
      "Sau Do you know / Could you tell me / I wonder / I'm not sure → từ để hỏi + chủ ngữ + động từ, không đảo, không do/does/did.",
      "Câu hỏi có/không lồng vào → if / whether.",
    ],
    mistakes: [
      { wrong: "Could you tell me where is the bank?", right: "Could you tell me where the bank is?", why: "Phần lồng vào giữ trật tự câu kể." },
      { wrong: "I wonder what time does the shop close.", right: "I wonder what time the shop closes.", why: "Bỏ does, động từ chia theo chủ ngữ." },
      { wrong: "Do you know is he coming?", right: "Do you know if he is coming?", why: "Câu hỏi có/không lồng vào cần if/whether." },
    ],
  },

  // ── Danh từ, mạo từ, đại từ ─────────────────────────────────────────────
  "count.irregular": {
    table: [
      ["Số ít", "Số nhiều"],
      ["child, person, man, woman", "children, people, men, women"],
      ["tooth, foot, mouse", "teeth, feet, mice"],
      ["criterion, phenomenon", "criteria, phenomena"],
      ["analysis, crisis", "analyses, crises"],
    ],
    mistakes: [
      { wrong: "Many childrens play in this park.", right: "Many children play in this park.", why: "children đã là số nhiều." },
      { wrong: "The main criteria is cost.", right: "The main criterion is cost.", why: "criteria là số nhiều của criterion." },
    ],
    ielts: "phenomenon/phenomena và criterion/criteria hay xuất hiện ở Task 2 — và hay bị chia sai số.",
  },

  "count.uncountable": {
    rules: [
      "Không thêm -s, không đi với a/an, không đi với many/few.",
      "Dùng much, a lot of, little, some, hoặc đơn vị đếm: a piece of, an item of.",
    ],
    mistakes: [
      { wrong: "She gave me many useful advices.", right: "She gave me a lot of useful advice.", why: "advice không đếm được." },
      { wrong: "We bought some new furnitures.", right: "We bought some new furniture.", why: "furniture không đếm được." },
    ],
  },

  "articles.a-an": {
    rules: [
      "Chọn a hay an theo ÂM đầu, không theo chữ cái đầu.",
      "a university, a European, a one-way ticket — âm đầu là phụ âm /j/ hoặc /w/.",
      "an hour, an honest man, an MBA — âm đầu là nguyên âm.",
    ],
    mistakes: [
      { wrong: "Here is an useful tip.", right: "Here is a useful tip.", why: "useful đọc /ˈjuːs-/, âm phụ âm." },
      { wrong: "It was a honour to meet her.", right: "It was an honour to meet her.", why: "h câm, âm đầu là nguyên âm." },
    ],
  },

  "articles.the": {
    rules: [
      "Dùng the khi người nghe biết đang nói tới cái nào: đã nhắc trước đó, là duy nhất, hoặc có cụm bổ nghĩa xác định đi kèm.",
      "Danh từ đếm được số ít không bao giờ đứng trơ: cần a/an/the/my/this…",
    ],
    mistakes: [
      { wrong: "She bought new laptop yesterday.", right: "She bought a new laptop yesterday.", why: "Danh từ đếm được số ít cần mạo từ." },
      { wrong: "Sun rises in east.", right: "The sun rises in the east.", why: "Vật duy nhất và phương hướng dùng the." },
    ],
  },

  "articles.zero": {
    rules: [
      "Không dùng mạo từ với danh từ số nhiều hoặc không đếm được khi nói chung chung: Cars pollute the air.",
      "go to school / university / hospital / prison / church / bed / work: nói mục đích của nơi đó thì không có the; nói về toà nhà cụ thể thì có.",
      "Bữa ăn, môn học, ngôn ngữ, phần lớn tên nước số ít: không mạo từ.",
    ],
    mistakes: [
      { wrong: "The money cannot buy happiness.", right: "Money cannot buy happiness.", why: "Nói về tiền nói chung." },
      { wrong: "She goes to the work by bus.", right: "She goes to work by bus.", why: "go to work là cụm cố định." },
    ],
  },

  "personal.subject": {
    rules: [
      "Chủ ngữ dùng I, he, she, we, they. Sau động từ và giới từ dùng me, him, her, us, them.",
      "Ghép với người khác thì để mình sau cùng: My friend and I…",
    ],
    mistakes: [
      { wrong: "Me and my brother went fishing.", right: "My brother and I went fishing.", why: "Vị trí chủ ngữ cần I, và nhường người khác đứng trước." },
      { wrong: "Between you and I, the plan won't work.", right: "Between you and me, the plan won't work.", why: "Sau giới từ between dùng me." },
    ],
  },

  "personal.its": {
    rules: [
      "its = của nó (tính từ sở hữu, không có dấu nháy).",
      "it's = it is hoặc it has.",
      "Mẹo: thử thay bằng \"it is\" — đọc thông thì viết it's, không thông thì viết its.",
    ],
    mistakes: [
      { wrong: "The company changed it's logo.", right: "The company changed its logo.", why: "\"changed it is logo\" vô nghĩa → sở hữu its." },
      { wrong: "Its been a long day.", right: "It's been a long day.", why: "= It has been." },
    ],
  },

  "reflexive.self": {
    mistakes: [
      { wrong: "He hurt him while cooking.", right: "He hurt himself while cooking.", why: "Chủ ngữ và tân ngữ là cùng một người → đại từ phản thân." },
      { wrong: "Myself and my team will handle it.", right: "My team and I will handle it.", why: "Đại từ phản thân không làm chủ ngữ." },
    ],
  },

  // ── Tính từ, trạng từ, so sánh ──────────────────────────────────────────
  "adjectives.position": {
    rules: ["Sau động từ nối dùng tính từ: be, seem, appear, look, sound, feel, taste, smell, become, get, remain, stay."],
    mistakes: [
      { wrong: "She seemed nervously before the interview.", right: "She seemed nervous before the interview.", why: "seem là động từ nối." },
      { wrong: "Your plan sounds greatly.", right: "Your plan sounds great.", why: "sound ở đây là động từ nối." },
    ],
  },

  "adverbs.frequency": {
    rules: [
      "always / usually / often / sometimes / rarely / never đứng trước động từ thường, sau be, và giữa trợ động từ với động từ chính (I have never been there).",
      "sometimes, usually đưa lên đầu câu được; always, never thì không.",
    ],
    mistakes: [
      { wrong: "He drinks always coffee in the morning.", right: "He always drinks coffee in the morning.", why: "Trước động từ thường." },
      { wrong: "She never is late.", right: "She is never late.", why: "Sau be." },
    ],
  },

  "comparison.comparative": {
    mistakes: [
      { wrong: "This phone is more cheaper than that one.", right: "This phone is cheaper than that one.", why: "Tính từ ngắn đã có -er, không thêm more." },
      { wrong: "She is taller that her brother.", right: "She is taller than her brother.", why: "So sánh hơn đi với than." },
    ],
  },

  "comparison.superlative": {
    rules: [
      "So sánh trong một nhóm từ ba đối tượng trở lên → so sánh nhất, có the.",
      "Tính từ một âm tiết: -est; hai âm tiết tận cùng -y: -iest; còn lại: the most.",
      "Bất quy tắc: good–better–best, bad–worse–worst, far–further–furthest.",
    ],
    mistakes: [
      { wrong: "It is the more expensive hotel in the city.", right: "It is the most expensive hotel in the city.", why: "So với cả thành phố → so sánh nhất." },
      { wrong: "This is the most cheapest option.", right: "This is the cheapest option.", why: "Không dùng most và -est cùng lúc." },
    ],
  },

  // ── Mệnh đề quan hệ ─────────────────────────────────────────────────────
  "defining.who-which-that": {
    rules: [
      "who cho người, which cho vật và con vật, that cho cả hai (chỉ trong mệnh đề xác định).",
      "whose chỉ sở hữu; whom là tân ngữ chỉ người (văn trang trọng).",
      "Không lặp lại đại từ bên trong mệnh đề quan hệ.",
    ],
    mistakes: [
      { wrong: "The doctor which treated me was very kind.", right: "The doctor who treated me was very kind.", why: "Người → who." },
      { wrong: "The book that I bought it yesterday is great.", right: "The book that I bought yesterday is great.", why: "that đã thay cho \"the book\", không thêm it." },
    ],
  },

  "defining.omitting": {
    rules: [
      "Bỏ được đại từ quan hệ khi nó làm TÂN NGỮ trong mệnh đề xác định: The film (that) we watched was long.",
      "Làm chủ ngữ thì không bỏ — trừ khi rút gọn thành cụm phân từ: people living nearby, a bridge built in 1990.",
    ],
    mistakes: [
      { wrong: "The woman lives next door is a nurse.", right: "The woman who lives next door is a nurse.", why: "who làm chủ ngữ của \"lives\", không bỏ được." },
    ],
  },

  "defining.where-when-whose": {
    rules: [
      "where = in/at which (nơi chốn), when = thời điểm, why sau the reason, whose = của người/vật đó.",
      "where chỉ dùng khi phần sau đã đủ chủ ngữ và tân ngữ. Nếu nơi chốn là tân ngữ của động từ phía sau thì dùng which/that.",
    ],
    mistakes: [
      { wrong: "The reason because he left is unclear.", right: "The reason why he left is unclear.", why: "Sau the reason dùng why (hoặc that)." },
      { wrong: "This is the town where I visited last year.", right: "This is the town (that) I visited last year.", why: "visit cần tân ngữ — chính là the town — nên dùng that/which." },
    ],
  },

  "non-defining.commas": {
    rules: [
      "Mệnh đề không xác định nằm giữa hai dấu phẩy, chỉ dùng who / whom / whose / which — không dùng that, không được lược.",
      "Dấu phẩy làm đổi nghĩa: My cousin who lives in Da Nang is a chef (tôi có nhiều anh chị em họ) / My cousin, who lives in Da Nang, is a chef (thông tin thêm).",
      "Sau tên riêng và danh từ duy nhất luôn là mệnh đề không xác định.",
    ],
    mistakes: [
      { wrong: "Hanoi, that is the capital, has many lakes.", right: "Hanoi, which is the capital, has many lakes.", why: "Mệnh đề không xác định không dùng that." },
      { wrong: "My mother who is a teacher loves reading.", right: "My mother, who is a teacher, loves reading.", why: "Ai cũng chỉ có một mẹ, nên mệnh đề chỉ là thông tin thêm." },
    ],
  },

  // ── Nguyên thể và danh động từ ──────────────────────────────────────────
  "gerund.verb-patterns": {
    table: [
      ["Động từ + to V", "Động từ + V-ing"],
      ["want, hope, plan, decide, agree", "enjoy, avoid, finish, suggest, consider"],
      ["refuse, manage, afford, promise, expect", "mind, deny, keep, practise, risk"],
    ],
    rules: ["Sau giới từ luôn là V-ing — kể cả khi giới từ đó là \"to\": look forward to, be used to, object to, when it comes to."],
    mistakes: [
      { wrong: "I'm looking forward to hear from you.", right: "I'm looking forward to hearing from you.", why: "to ở đây là giới từ." },
      { wrong: "She suggested to take a taxi.", right: "She suggested taking a taxi.", why: "suggest + V-ing." },
      { wrong: "We can't afford buying a new car.", right: "We can't afford to buy a new car.", why: "afford + to V." },
    ],
  },

  // ── Câu điều kiện ───────────────────────────────────────────────────────
  "conditionals.zero": {
    rules: ["If + hiện tại đơn, hiện tại đơn — sự thật, quy luật. if ở đây gần nghĩa với whenever."],
    mistakes: [
      { wrong: "If you heat ice, it will melts.", right: "If you heat ice, it melts.", why: "Quy luật tự nhiên → hiện tại đơn cả hai vế." },
    ],
  },

  "conditionals.first": {
    rules: [
      "If + hiện tại đơn, will / can / may + V — khả năng có thật ở tương lai.",
      "Không dùng will trong mệnh đề if.",
    ],
    mistakes: [
      { wrong: "If it will rain tomorrow, we will stay at home.", right: "If it rains tomorrow, we will stay at home.", why: "Mệnh đề if dùng hiện tại đơn." },
    ],
  },

  "conditionals.unless": {
    rules: [
      "unless = if … not (trừ khi).",
      "Mệnh đề sau unless ở dạng KHẲNG ĐỊNH — thêm not vào là đảo ngược nghĩa.",
      "Giống if, mệnh đề unless nói về tương lai dùng hiện tại đơn.",
    ],
    mistakes: [
      { wrong: "We'll be late unless we don't leave now.", right: "We'll be late unless we leave now.", why: "unless đã mang nghĩa phủ định." },
      { wrong: "Unless you will apply before Friday, you'll lose your place.", right: "Unless you apply before Friday, you'll lose your place.", why: "Không dùng will sau unless." },
    ],
  },

  "conditionals.second": {
    rules: [
      "If + quá khứ đơn, would / could / might + V — trái thực tế ở hiện tại, hoặc ít khả năng ở tương lai.",
      "Văn trang trọng dùng were cho mọi ngôi: If I were you…",
    ],
    mistakes: [
      { wrong: "If I have more money, I would buy a house.", right: "If I had more money, I would buy a house.", why: "Đi với would thì mệnh đề if lùi về quá khứ." },
      { wrong: "If I would be rich, I would travel more.", right: "If I were rich, I would travel more.", why: "Không dùng would trong mệnh đề if." },
    ],
    ielts: "Đề xuất giải pháp Task 2: \"If governments taxed sugary drinks, consumption would fall.\"",
  },

  "conditionals.third": {
    rules: ["If + had + V3, would / could / might have + V3 — giả định trái với quá khứ."],
    mistakes: [
      { wrong: "If he had left earlier, he would catch the train.", right: "If he had left earlier, he would have caught the train.", why: "Kết quả cũng ở quá khứ." },
      { wrong: "If I would have known, I would have told you.", right: "If I had known, I would have told you.", why: "Mệnh đề if dùng had + V3." },
    ],
  },

  "conditionals.mixed": {
    rules: [
      "Điều kiện trái quá khứ → kết quả trái hiện tại: If + had V3, would + V (now).",
      "Điều kiện trái hiện tại → kết quả trái quá khứ: If + quá khứ đơn, would have + V3.",
      "Ví dụ: If I had saved more last year, I would be less worried now.",
    ],
    mistakes: [
      { wrong: "If she had taken the job, she would have lived in Singapore now.", right: "If she had taken the job, she would be living in Singapore now.", why: "\"now\" là kết quả ở hiện tại → would + V." },
    ],
  },

  "subjunctive.inverted-conditionals": {
    rules: [
      "Should + S + V = If S (should) + V: Should you need help, call me.",
      "Were + S + to V / Were + S = If S were.",
      "Had + S + V3 = If S had V3.",
      "Phủ định viết Had they not…, không viết Hadn't they…",
    ],
    mistakes: [
      { wrong: "Hadn't we booked early, we would have had no seats.", right: "Had we not booked early, we would have had no seats.", why: "Đảo ngữ điều kiện không dùng dạng rút gọn n't." },
    ],
    ielts: "Một câu đảo ngữ điều kiện đúng trong cả bài là đủ thể hiện range; dùng dày đặc thì giọng văn gượng.",
  },

  // ── Mệnh đề danh từ và trạng ngữ ────────────────────────────────────────
  "noun-clauses.that-object": {
    rules: [
      "S + think / believe / argue / claim / suggest / agree + (that) + mệnh đề.",
      "Văn nói hay lược that; văn viết trang trọng nên giữ.",
      "Đứng sau một số danh từ: the fact that, the idea that, the belief that.",
      "Mệnh đề that phải có chủ ngữ riêng.",
    ],
    mistakes: [
      { wrong: "Many people believe that should ban cars in the city centre.", right: "Many people believe that cars should be banned in the city centre.", why: "Mệnh đề that thiếu chủ ngữ." },
      { wrong: "I agree that is a good idea.", right: "I agree that it is a good idea.", why: "Thiếu chủ ngữ it." },
    ],
    ielts: "Khung nêu quan điểm Task 2: Some people argue that… / I firmly believe that… / There is no doubt that…",
  },

  "noun-clauses.wh-order": {
    rules: [
      "what / where / when / why / how / who + chủ ngữ + động từ — giữ trật tự câu kể, không đảo như câu hỏi.",
      "what = the thing(s) that.",
    ],
    mistakes: [
      { wrong: "I don't understand what does he mean.", right: "I don't understand what he means.", why: "Bỏ does, động từ chia theo he." },
      { wrong: "Nobody knows why did the company close.", right: "Nobody knows why the company closed.", why: "Trật tự câu kể, động từ ở quá khứ." },
    ],
  },

  "noun-clauses.whether-if": {
    rules: [
      "Câu hỏi có/không lồng vào câu → whether hoặc if.",
      "Chỉ dùng whether (không dùng if): sau giới từ (depends on whether), trước to V (whether to go), khi làm chủ ngữ đầu câu, và khi or not đứng ngay sau.",
    ],
    mistakes: [
      { wrong: "I'm not sure he will come or not.", right: "I'm not sure whether he will come or not.", why: "Thiếu từ mở đầu mệnh đề." },
      { wrong: "It depends on if we have enough time.", right: "It depends on whether we have enough time.", why: "Sau giới từ chỉ dùng whether." },
    ],
  },

  "noun-clauses.as-subject": {
    rules: [
      "What / Whether / That / How + mệnh đề làm chủ ngữ → động từ chính số ít.",
      "Chủ ngữ dài làm câu nặng đầu; thường chuyển thành It + be + tính từ + that: It is clear that…",
    ],
    mistakes: [
      { wrong: "What he told us were surprising.", right: "What he told us was surprising.", why: "Mệnh đề danh từ làm chủ ngữ là số ít." },
    ],
    ielts: "\"What concerns many parents is the amount of time children spend online\" — một câu chẻ với what đủ làm đoạn văn có điểm nhấn.",
  },

  "noun-clauses.as-complement": {
    rules: [
      "The problem / issue / reason / truth / main advantage + is + that + mệnh đề.",
      "Văn trang trọng viết The reason is that…, tránh The reason is because…",
    ],
    mistakes: [
      { wrong: "The problem is we not have enough staff.", right: "The problem is that we do not have enough staff.", why: "Thiếu that và thiếu trợ động từ do." },
      { wrong: "The reason is because prices rose.", right: "The reason is that prices rose.", why: "reason đã mang nghĩa nguyên nhân; because thừa." },
    ],
  },

  "adverbial.time-future": {
    rules: [
      "Sau when, as soon as, before, after, until, once, by the time nói về tương lai → hiện tại đơn (hoặc hiện tại hoàn thành), không dùng will.",
      "Mệnh đề chính vẫn dùng will.",
    ],
    mistakes: [
      { wrong: "I'll call you when I will get home.", right: "I'll call you when I get home.", why: "Mệnh đề thời gian dùng hiện tại đơn." },
      { wrong: "We won't start until everyone will arrive.", right: "We won't start until everyone has arrived.", why: "Không dùng will sau until." },
    ],
  },

  "adverbial.reason": {
    rules: [
      "because nhấn vào lý do, thường đứng sau mệnh đề chính.",
      "since / as nêu lý do người nghe đã biết, thường đứng đầu câu.",
      "because of / due to / owing to + danh từ hoặc cụm danh từ, không + mệnh đề.",
      "since còn có nghĩa \"kể từ\" — xem ngữ cảnh.",
    ],
    mistakes: [
      { wrong: "Due to the traffic was heavy, we were late.", right: "Due to the heavy traffic, we were late.", why: "due to đi với cụm danh từ." },
      { wrong: "As it was late so we left.", right: "As it was late, we left.", why: "as và so không đi chung." },
    ],
  },

  "adverbial.so-such-that": {
    rules: [
      "so + tính từ / trạng từ + that.",
      "so + many / much / few / little + danh từ + that.",
      "such + a/an + tính từ + danh từ số ít + that; such + tính từ + danh từ số nhiều/không đếm được + that.",
    ],
    mistakes: [
      { wrong: "It was so hot day that we stayed inside.", right: "It was such a hot day that we stayed inside.", why: "Có danh từ \"day\" → such a." },
      { wrong: "There were such many people that we left.", right: "There were so many people that we left.", why: "many đi với so." },
      { wrong: "She spoke such quickly that I missed it.", right: "She spoke so quickly that I missed it.", why: "Trước trạng từ dùng so." },
    ],
  },

  "adverbial.as-if": {
    rules: [
      "as if / as though + mệnh đề: trông như, cư xử như thể.",
      "Điều có thật hoặc có thể thật → giữ thì bình thường: It looks as if it is going to rain.",
      "Điều trái thực tế → lùi thì: He talks as if he were the boss.",
      "like + mệnh đề phổ biến trong văn nói; văn viết trang trọng dùng as if.",
    ],
    mistakes: [
      { wrong: "He acts as if he is my father.", right: "He acts as if he were my father.", why: "Anh ta không phải bố tôi → trái thực tế, lùi thì." },
    ],
  },

  // ── Liên kết ────────────────────────────────────────────────────────────
  "connectors.and-but-because": {
    rules: [
      "because giới thiệu NGUYÊN NHÂN, so giới thiệu KẾT QUẢ — đổi chỗ là đảo ngược quan hệ.",
      "because và so không đi chung trong một câu.",
      "because of + danh từ; because + mệnh đề.",
    ],
    mistakes: [
      { wrong: "I missed the bus, so I woke up late.", right: "I missed the bus because I woke up late.", why: "Dậy muộn là nguyên nhân, không phải kết quả." },
      { wrong: "Because of it was raining, we stayed in.", right: "Because it was raining, we stayed in.", why: "Theo sau là mệnh đề nên dùng because." },
    ],
  },

  "connectors.although-however": {
    table: [
      ["Từ", "Theo sau là", "Dấu câu"],
      ["although / though / even though", "mệnh đề", "Although A, B. / B although A."],
      ["despite / in spite of", "danh từ hoặc V-ing", "Despite A, B."],
      ["however", "câu mới", "A. However, B. / A; however, B."],
      ["but", "mệnh đề", "A, but B."],
    ],
    rules: ["Không dùng although và but trong cùng một câu."],
    mistakes: [
      { wrong: "Although he is rich, but he is unhappy.", right: "Although he is rich, he is unhappy.", why: "Một câu chỉ cần một từ nối nhượng bộ." },
      { wrong: "Despite it was cold, we went swimming.", right: "Despite the cold, we went swimming.", why: "despite đi với danh từ; muốn giữ mệnh đề thì dùng although." },
      { wrong: "The plan is cheap, however it is slow.", right: "The plan is cheap; however, it is slow.", why: "however là trạng từ nối, không phải liên từ." },
    ],
  },

  "connectors.purpose-result": {
    rules: [
      "Mục đích: to / in order to / so as to + V; so that / in order that + mệnh đề (thường có can, could, will, would).",
      "Kết quả: so (liên từ) + mệnh đề; therefore / as a result / consequently mở câu mới hoặc đứng sau dấu chấm phẩy.",
    ],
    mistakes: [
      { wrong: "She saved money so that buy a car.", right: "She saved money so that she could buy a car.", why: "so that cần cả một mệnh đề." },
      { wrong: "He left early for catch the train.", right: "He left early to catch the train.", why: "Mục đích dùng to + V, không dùng for + V." },
    ],
  },

  // ── Giới từ ─────────────────────────────────────────────────────────────
  "dependent.after-adjectives": {
    table: [
      ["Tính từ + giới từ", "Ví dụ"],
      ["good / bad at", "good at maths"],
      ["interested in", "interested in history"],
      ["afraid / scared of", "afraid of heights"],
      ["responsible for", "responsible for the budget"],
      ["similar to / different from", "similar to last year"],
      ["keen on", "keen on cycling"],
      ["aware of", "aware of the risks"],
    ],
    rules: ["Học giới từ theo CỤM, đừng dịch giới từ từ tiếng Việt sang."],
    mistakes: [
      { wrong: "She is interested about art.", right: "She is interested in art.", why: "interested đi với in." },
      { wrong: "He is good in cooking.", right: "He is good at cooking.", why: "good đi với at." },
    ],
  },

  "dependent.after-verbs": {
    table: [
      ["Động từ + giới từ", "Ví dụ"],
      ["look for", "looking for my keys"],
      ["wait for", "waiting for the bus"],
      ["apologise for", "apologised for the delay"],
      ["belong to", "belongs to my aunt"],
      ["depend on", "depends on the weather"],
      ["consist of", "consists of three parts"],
    ],
    rules: [
      "Một số động từ KHÔNG đi với giới từ: discuss, enter, reach, marry, contact, approach, emphasise.",
      "go home, go there, go abroad không có to.",
    ],
    mistakes: [
      { wrong: "We discussed about the plan.", right: "We discussed the plan.", why: "discuss là ngoại động từ, không có about." },
      { wrong: "They are waiting the train.", right: "They are waiting for the train.", why: "wait cần for trước tân ngữ." },
      { wrong: "I'll contact with you next week.", right: "I'll contact you next week.", why: "contact không có with." },
    ],
  },
};
