import type { SkillGuide } from "./types";

/** Hướng dẫn kỹ năng tiếng Pháp. */
export const FR_GUIDES: SkillGuide[] = [
  {
    code: "fr",
    skill: "dictation",
    title: "Chép chính tả tiếng Pháp — nghe ra rồi còn phải suy ra",
    intro:
      "Tiếng Pháp là thứ tiếng mà chép chính tả khó hơn nghe hiểu rất nhiều, vì phần lớn thông tin ngữ pháp KHÔNG phát ra thành tiếng.",
    minutes: 9,
    sections: [
      {
        id: "silent",
        title: "Những thứ không nghe thấy mà vẫn phải viết",
        blocks: [
          {
            kind: "table",
            head: ["Nghe giống hệt nhau", "Phải suy từ đâu"],
            rows: [
              ["il parle / ils parlent", "Từ ngữ cảnh: chủ ngữ số ít hay số nhiều"],
              ["le petit / les petits", "Từ mạo từ đứng trước"],
              ["j'ai mangé / j'ai mangés", "Từ quy tắc hợp phân từ"],
              ["elle est arrivée / il est arrivé", "Từ giống của chủ ngữ"],
            ],
          },
          {
            kind: "warn",
            items: [
              "Phụ âm cuối phần lớn không đọc, nhưng vẫn phải viết. Đây là chỗ mất điểm nhiều nhất.",
              "Đuôi -ent của ngôi thứ ba số nhiều hoàn toàn im lặng.",
            ],
          },
        ],
      },
      {
        id: "liaison",
        title: "Nối âm làm mất ranh giới từ",
        blocks: [
          {
            kind: "text",
            body:
              "Phụ âm cuối vốn câm lại thức dậy trước nguyên âm: les amis nghe thành le-zami, nous avons thành nou-zavon. Tai nghe một khối liền, nhưng phải chép thành hai từ tách rời — và chữ z đó thuộc về từ TRƯỚC, không phải từ sau.",
          },
        ],
      },
      {
        id: "how",
        title: "Cách làm",
        blocks: [
          {
            kind: "steps",
            items: [
              "Nghe và chép âm trước, chưa lo chính tả.",
              "Đọc lại những gì vừa chép, tìm chủ ngữ của từng động từ.",
              "Sửa đuôi động từ và hợp giống hợp số theo chủ ngữ tìm được.",
              "Kiểm lại dấu: é, è, ê là ba dấu khác nhau và đổi cả nghĩa.",
            ],
          },
        ],
      },
    ],
  },
  {
    code: "fr",
    skill: "writing",
    title: "Viết tiếng Pháp — hợp giống và nối ý",
    intro: "Hai thứ quyết định bài viết tiếng Pháp: hợp giống hợp số cho đúng, và nối ý cho mượt.",
    minutes: 9,
    sections: [
      {
        id: "agreement",
        title: "Hợp giống — kiểm theo thứ tự",
        blocks: [
          {
            kind: "steps",
            items: [
              "Danh từ giống gì, số gì?",
              "Mạo từ đã hợp chưa?",
              "Tính từ đã hợp chưa — kể cả tính từ đứng xa danh từ?",
              "Nếu dùng être: phân từ hợp với CHỦ NGỮ.",
              "Nếu dùng avoir: phân từ chỉ hợp khi tân ngữ trực tiếp đứng TRƯỚC.",
            ],
          },
        ],
      },
      {
        id: "connectors",
        title: "Từ nối — chọn theo văn phong",
        blocks: [
          {
            kind: "phrases",
            note: "Trong bài viết trang trọng thì dùng cột sau, đừng dùng cột khẩu ngữ.",
            items: [
              "Thêm ý: de plus, en outre, par ailleurs",
              "Đối lập: cependant, néanmoins, en revanche",
              "Nguyên nhân: en effet, car, du fait que",
              "Kết quả: par conséquent, ainsi, c'est pourquoi",
              "Kết luận: en définitive, pour conclure",
            ],
          },
          {
            kind: "text",
            title: "Bố cục kiểu Pháp",
            body:
              "Bài luận tiếng Pháp truyền thống đi theo ba phần: thèse — antithèse — synthèse. Nêu một phía, nêu phía ngược lại, rồi tổng hợp. Khác hẳn lối viết Anh-Mỹ là nêu lập trường ngay từ đầu.",
          },
        ],
      },
    ],
  },
  {
    code: "fr",
    skill: "pronunciation",
    title: "Phát âm tiếng Pháp — ba chỗ lộ rõ nhất",
    intro: "Sửa ba thứ này thì giọng đỡ lộ hơn hẳn, nhiều hơn là sửa từng nguyên âm.",
    minutes: 6,
    sections: [
      {
        id: "three",
        title: "Ba chỗ nên sửa trước",
        blocks: [
          {
            kind: "steps",
            items: [
              "Đừng đọc phụ âm cuối. Đây là dấu hiệu lộ rõ nhất của người nước ngoài.",
              "Nguyên âm mũi: hơi ra qua mũi mà KHÔNG đọc âm n ở cuối. banc không có n.",
              "Trọng âm rơi vào âm tiết CUỐI của cả ngữ, không phải của từng từ.",
            ],
          },
        ],
      },
    ],
  },
];

/** Hướng dẫn kỹ năng tiếng Quảng Đông. */
export const YUE_GUIDES: SkillGuide[] = [
  {
    code: "yue",
    skill: "dictation",
    title: "Chép chính tả tiếng Quảng — sáu thanh và lối viết riêng",
    intro:
      "Hai cái khó riêng: sáu thanh nhiều hơn tiếng Trung hai thanh, và chữ viết tiếng Quảng khác chữ Quan Thoại.",
    minutes: 9,
    sections: [
      {
        id: "six",
        title: "Sáu thanh, và ba thanh bằng",
        blocks: [
          {
            kind: "text",
            body:
              "Chỗ khó nhất không phải thanh lên xuống mà là BA THANH BẰNG — thanh 1, 3 và 6 đều phẳng, chỉ khác nhau về độ cao. Tai chưa quen thì nghe cả ba như một, mà sai độ cao là sai từ: si1 是 thơ, si3 试 thử, si6 事 việc.",
          },
          {
            kind: "warn",
            items: [
              "Khi gõ Jyutping, con số thanh là phần bắt buộc, không phải phần thêm cho đẹp.",
              "Âm cuối -p -t -k đóng miệng không nhả hơi — giống hệt thói quen tiếng Việt, nên đây là chỗ người Việt có lợi thế.",
            ],
          },
        ],
      },
      {
        id: "script",
        title: "Chữ viết tiếng Quảng",
        blocks: [
          {
            kind: "table",
            head: ["Tiếng Quảng", "Quan Thoại tương ứng"],
            rows: [
              ["係 hai6", "是"],
              ["唔 m4", "不"],
              ["喺 hai2", "在"],
              ["嘅 ge3", "的"],
              ["咗 zo2", "了"],
              ["佢 keoi5", "他/她"],
              ["嘢 je5", "东西"],
            ],
          },
          {
            kind: "text",
            body:
              "Bộ câu trong Crucible viết theo lối tiếng Quảng, không phải chữ Quan Thoại đọc giọng Quảng. Nếu chưa quen mặt chữ thì cứ gõ Jyutping — vẫn được tính đúng.",
          },
        ],
      },
    ],
  },
  {
    code: "yue",
    skill: "speaking",
    title: "Nói tiếng Quảng — trợ từ cuối câu",
    intro:
      "Nói đúng chữ mà thiếu trợ từ cuối câu thì nghe như người máy. Đây là chỗ tiếng Quảng khác tiếng Trung nhiều nhất.",
    minutes: 8,
    sections: [
      {
        id: "particles",
        title: "Trợ từ mang thái độ, không mang nghĩa",
        blocks: [
          {
            kind: "table",
            head: ["Trợ từ", "Thêm vào câu cái gì"],
            rows: [
              ["啊 aa3", "làm mềm câu, bớt cộc"],
              ["喇 laa3", "tình hình đã đổi"],
              ["囉 lo1", "điều hiển nhiên, ai cũng biết"],
              ["喎 wo3", "ngạc nhiên, hoặc nhắc lại lời người khác"],
              ["咩 me1", "nghi ngờ, hỏi lại"],
              ["啩 gwaa3", "phỏng đoán, không chắc"],
              ["啫 ze1", "chỉ có thế thôi"],
            ],
          },
          {
            kind: "warn",
            items: [
              "Cùng một câu, đổi trợ từ là đổi hẳn thái độ. 佢唔嚟 với 佢唔嚟喎 khác nhau xa.",
              "Bỏ hết trợ từ thì câu vẫn đúng ngữ pháp nhưng nghe lạnh và cứng.",
            ],
          },
        ],
      },
    ],
  },
];

/** Hướng dẫn kỹ năng tiếng Hàn. */
export const KO_GUIDES: SkillGuide[] = [
  {
    code: "ko",
    skill: "dictation",
    title: "Chép chính tả tiếng Hàn — viết một đằng đọc một nẻo",
    intro:
      "Tiếng Hàn viết theo hình vị chứ không theo âm, nên nghe ra tiếng rồi vẫn phải suy ra cách viết.",
    minutes: 9,
    sections: [
      {
        id: "changes",
        title: "Ba kiểu biến âm phải thuộc",
        blocks: [
          {
            kind: "table",
            head: ["Viết", "Đọc"],
            rows: [
              ["한국어", "han-gu-geo — phụ âm cuối chạy sang"],
              ["학년", "hang-nyeon — biến âm mũi"],
              ["같이", "ga-chi — ngạc hoá"],
              ["좋은", "jo-eun — ㅎ rụng"],
              ["앞문", "am-mun — biến âm mũi"],
            ],
          },
          {
            kind: "text",
            body:
              "Quy tắc chung: viết giữ nguyên hình vị để người đọc nhận ra gốc từ, còn đọc thì theo âm cho dễ phát. Nên khi chép, hãy nghĩ 'từ gốc là gì' chứ đừng chép đúng cái tai nghe.",
          },
        ],
      },
      {
        id: "batchim",
        title: "Phụ âm cuối — bảy âm cho nhiều cách viết",
        blocks: [
          {
            kind: "text",
            body:
              "Mọi phụ âm cuối đều rút về một trong bảy âm khi đứng một mình. 낫, 낮, 낯, 났 đọc giống hệt nhau. Chỉ khi có nguyên âm theo sau thì chữ thật mới lộ ra — nên nghe cả cụm chứ đừng nghe từng từ rời.",
          },
        ],
      },
    ],
  },
  {
    code: "ko",
    skill: "speaking",
    title: "Nói tiếng Hàn — chọn bậc nói",
    intro:
      "Tiếng Hàn không có bậc trung lập. Mỗi câu đều phải chọn một bậc, và chọn sai thì dù ngữ pháp đúng vẫn là nói sai.",
    minutes: 9,
    sections: [
      {
        id: "levels",
        title: "Ba bậc dùng hằng ngày",
        blocks: [
          {
            kind: "table",
            head: ["Bậc", "Dùng với ai"],
            rows: [
              ["해요체 (-아요/어요)", "Mặc định an toàn. Người lạ, đồng nghiệp, người hơn tuổi không quá thân."],
              ["합니다체 (-습니다)", "Trang trọng: thuyết trình, phỏng vấn, báo cáo, khách hàng."],
              ["반말 (-아/어)", "Bạn thân bằng tuổi hoặc ít tuổi hơn, và chỉ khi đã được phép."],
            ],
          },
          {
            kind: "warn",
            items: [
              "Chưa rõ quan hệ thì dùng 해요체. Trang trọng thừa không ai trách, thân mật thừa thì có.",
              "Dùng 반말 với người chưa cho phép là bất lịch sự nặng, nặng hơn nhiều so với cảm giác của người Việt.",
              "Kính ngữ -시- nâng NGƯỜI ĐƯỢC NÓI TỚI, khác với bậc nói là nâng người NGHE. Hai trục riêng biệt.",
            ],
          },
        ],
      },
      {
        id: "practice",
        title: "Luyện thế nào",
        blocks: [
          {
            kind: "text",
            body:
              "Khi tập nói một câu, tập luôn cả hai bậc 해요 và 합니다. Chuyển qua lại giữa hai bậc cho quen, vì trong đời thật bạn sẽ phải đổi bậc tuỳ người đối diện, và đổi chậm thì nghe rất gượng.",
          },
        ],
      },
    ],
  },
  {
    code: "ko",
    skill: "writing",
    title: "Viết tiếng Hàn — động từ ở cuối",
    intro:
      "Động từ đứng cuối câu, nên người đọc phải chờ tới chữ cuối mới biết ý. Điều đó đổi cách dựng câu.",
    minutes: 8,
    sections: [
      {
        id: "order",
        title: "Hệ quả của trật tự chủ – tân – động",
        blocks: [
          {
            kind: "steps",
            items: [
              "Thông tin quan trọng nhất nằm ở CUỐI câu, không phải đầu.",
              "Phủ định cũng ở cuối — đọc hết câu mới biết là có hay không.",
              "Câu càng dài thì khoảng cách giữa chủ ngữ và động từ càng xa, nên câu dài quá là câu khó đọc.",
            ],
          },
        ],
      },
      {
        id: "style",
        title: "Thể văn viết",
        blocks: [
          {
            kind: "text",
            body:
              "Báo chí, luận văn và báo cáo dùng thể 한다 (-ㄴ다/-는다), không dùng 해요. Viết luận mà dùng 해요체 là sai văn phong, dù câu nào cũng đúng ngữ pháp. Đây là lỗi rất hay gặp ở người học đã quen nói trước khi học viết.",
          },
        ],
      },
    ],
  },
];
