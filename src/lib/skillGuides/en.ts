import type { SkillGuide } from "./types";
import { EN_WRITING_GUIDE } from "./en-writing";

/** Hướng dẫn cho các kỹ năng tiếng Anh. Mọi lời giải thích do dự án tự viết. */
export const EN_GUIDES: SkillGuide[] = [
  EN_WRITING_GUIDE,
  {
    code: "en",
    skill: "collocations",
    title: "Kết hợp từ — vì sao biết đủ từ mà viết vẫn không tự nhiên",
    intro:
      "Đây là khoảng cách giữa 'đúng ngữ pháp' và 'người bản ngữ nói thế'. Không quy tắc nào bắc cầu qua được, nhưng có cách học cho nhanh.",
    minutes: 9,
    sections: [
      {
        id: "what",
        title: "Kết hợp từ là gì",
        blocks: [
          {
            kind: "text",
            body:
              "Một số từ chỉ đi với một số từ khác, không vì lý do logic nào cả. Mưa to là heavy rain chứ không phải strong rain, dù gió to lại là strong wind. Cả hai câu đều đúng ngữ pháp, nhưng chỉ một câu là tiếng Anh thật. Người chấm gọi phần này là vốn từ, và nó là một trong bốn tiêu chí của cả bài viết lẫn bài nói.",
          },
          {
            kind: "table",
            title: "Bảy mảng trong phần này",
            head: ["Mảng", "Ví dụ và chỗ khó"],
            rows: [
              ["Kết hợp từ", "make a mistake, heavy traffic — nhớ theo cặp, không suy ra được"],
              ["Cụm động từ", "put up with, boil down to — nghĩa không bằng tổng nghĩa các chữ"],
              ["Cấu tạo từ", "contribute → contribution → contributory — đổi từ loại cho hợp câu"],
              ["Giới từ đi kèm", "depend ON, similar TO — sai giới từ là lỗi ngữ pháp rõ ràng"],
              ["Thành ngữ", "the tip of the iceberg — cả cụm mang một nghĩa riêng"],
              ["Từ theo chủ đề", "sức khoẻ, công việc, môi trường, giáo dục — bốn chủ đề ra nhiều nhất"],
              ["Từ học thuật", "suggest, establish, outweigh — mỗi từ một mức chắc chắn khác nhau"],
            ],
          },
        ],
      },
      {
        id: "how",
        title: "Học thế nào cho vào",
        blocks: [
          {
            kind: "steps",
            items: [
              "Ghi cả CỤM, đừng ghi từ rời. Ghi 'make a decision' chứ không ghi 'decision = quyết định'.",
              "Ghi thêm một câu thật dùng cụm đó. Câu này quan trọng hơn định nghĩa.",
              "Khi gặp một cụm sai trong bài mình viết, chép lại CẢ HAI: cụm sai và cụm đúng, cạnh nhau.",
              "Ưu tiên cụm hay gặp. Học mười cụm thông dụng hơn một trăm cụm hiếm.",
            ],
          },
          {
            kind: "warn",
            title: "Hai cái bẫy",
            items: [
              "Dịch thẳng từ tiếng Việt. 'Mưa to' thành strong rain, 'uống thuốc' thành drink medicine (đúng phải là take medicine). Gần như mọi lỗi kết hợp từ đều sinh ra từ đây.",
              "Nhồi từ hiếm vào bài để lấy điểm vốn từ. Dùng sai một từ khó bị trừ nặng hơn là dùng đúng một từ thường.",
            ],
          },
        ],
      },
      {
        id: "writing",
        title: "Dùng trong bài viết",
        blocks: [
          {
            kind: "examples",
            items: [
              {
                bad: "The government should do more actions to solve this problem.",
                good: "The government should take further steps to tackle this problem.",
                note: "take steps, tackle a problem. Câu trên không sai ngữ pháp, nhưng không ai viết như vậy.",
              },
              {
                bad: "This makes a big effect on young people.",
                good: "This has a significant impact on young people.",
                note: "have an impact ON. Và effect là danh từ, affect là động từ — chỗ nhầm kinh điển.",
              },
            ],
          },
          {
            kind: "warn",
            title: "Thành ngữ — dùng rất dè",
            items: [
              "Phần lớn thành ngữ quá thân mật cho bài luận. a piece of cake thì không, nhưng the tip of the iceberg thì được.",
              "Trong bài NÓI thì thoải mái hơn nhiều, và dùng đúng một thành ngữ tự nhiên ăn điểm hơn cả đoạn văn hoa.",
              "Thành ngữ dùng sai ngữ cảnh bị trừ nặng hơn là không dùng. Không chắc thì bỏ qua.",
            ],
          },
          {
            kind: "text",
            title: "Từ theo chủ đề — học trước khi thi, không học lúc thi",
            body:
              "Đề thi xoay quanh một số chủ đề lặp đi lặp lại: sức khoẻ, công việc, môi trường, giáo dục, công nghệ, thành thị. Chuẩn bị sẵn mười lăm cụm cho mỗi chủ đề thì vào phòng thi không phải nghĩ từ, chỉ phải nghĩ ý. Đó là khác biệt lớn nhất giữa người luyện có hệ thống và người luyện ngẫu hứng.",
          },
          {
            kind: "text",
            title: "Một cụm dùng đúng hơn ba cụm nhét vào",
            body:
              "Đừng cố rải kết hợp từ khắp bài. Chọn hai tới ba cụm hợp với chủ đề và dùng cho đúng chỗ; phần còn lại viết bằng từ mình chắc chắn. Bài đọc trôi chảy ăn điểm hơn bài rải từ hiếm mà gượng.",
          },
        ],
      },
    ],
  },
  {
    code: "en",
    skill: "dictation",
    title: "Chép chính tả — nghe cho ra từng chữ",
    intro:
      "Nghe hiểu ý và nghe ra chữ là hai việc khác nhau. Bài này chỉ ra những chỗ tiếng Anh bị nuốt mất, để lần sau nghe là bắt được.",
    minutes: 8,
    sections: [
      {
        id: "why",
        title: "Vì sao chép được mới là nghe được",
        blocks: [
          {
            kind: "text",
            body:
              "Khi trả lời câu hỏi hiểu ý, não tự vá những chỗ nghe hụt bằng suy đoán từ ngữ cảnh. Vá xong thì mình tưởng đã nghe được, nhưng thật ra chưa. Chép chính tả chặn đường vá đó: thiếu một chữ là thiếu, và chỗ thiếu ấy chính là âm mình chưa nghe ra bao giờ.",
          },
        ],
      },
      {
        id: "swallowed",
        title: "Bốn chỗ tiếng Anh nuốt âm",
        blocks: [
          {
            kind: "table",
            head: ["Hiện tượng", "Nghe thành"],
            rows: [
              ["Nối phụ âm cuối sang nguyên âm đầu", "pick it up → pi-ki-tup"],
              ["Âm /t/ giữa hai nguyên âm (giọng Mỹ)", "water, better → wa-der, be-der"],
              ["Nuốt hẳn một âm trong cụm phụ âm", "next day → nex day"],
              ["Nguyên âm không nhấn rút về /ə/", "for, to, of, and → fə, tə, əv, ən"],
            ],
          },
          {
            kind: "warn",
            title: "Hai đuôi nghe gần như không thấy",
            items: [
              "Đuôi -s số nhiều và ngôi ba: sau âm vô thanh thì rất khẽ. books nghe gần như book.",
              "Đuôi -ed: chỉ thành một âm tiết riêng sau t và d. walked là một âm tiết, wanted mới là hai.",
            ],
          },
        ],
      },
      {
        id: "how",
        title: "Làm bài thế nào cho có ích",
        blocks: [
          {
            kind: "steps",
            items: [
              "Nghe lần đầu ở tốc độ thường, chưa gõ gì. Nắm lấy ý cả câu.",
              "Nghe lần hai, gõ những gì bắt được, để trống chỗ hụt.",
              "Nghe chậm cho đúng chỗ còn trống, đừng nghe lại cả câu.",
              "Chấm, rồi nhìn kỹ chữ sai — đó mới là thứ đáng nhớ, không phải những chữ đã đúng.",
              "Nghe lại câu một lần cuối SAU khi đã thấy đáp án. Lần này tai sẽ bắt được cái vừa nãy nó bỏ qua.",
            ],
          },
          {
            kind: "text",
            title: "Đừng nghe quá năm lần",
            body:
              "Nghe tới lần thứ sáu mà vẫn không ra thì không phải vấn đề tập trung, mà là âm đó chưa có trong đầu. Xem đáp án, đọc to lại vài lần, rồi đi tiếp. Nghe lại mãi chỉ mệt chứ không thêm được gì.",
          },
        ],
      },
    ],
  },
  {
    code: "en",
    skill: "listening",
    title: "Luyện nghe — bắt ý và giữ mạch",
    intro:
      "Phần này khác chép chính tả: không cần từng chữ, cần nắm được ý và theo kịp mạch nói.",
    minutes: 7,
    sections: [
      {
        id: "predict",
        title: "Đọc câu hỏi trước khi nghe",
        blocks: [
          {
            kind: "text",
            body:
              "Nghe rồi mới đọc câu hỏi là tự làm khó mình. Liếc câu hỏi trước thì biết phải đợi loại thông tin nào — con số, tên riêng, lý do, hay một sự thay đổi ý định — và tai sẽ tự lọc.",
          },
          {
            kind: "steps",
            items: [
              "Gạch chân từ khoá trong câu hỏi, nhất là danh từ và số.",
              "Đoán trước dạng đáp án: một con số? một ngày? một lý do?",
              "Nghe, và ghi ngay khi bắt được, đừng đợi hết bài.",
            ],
          },
        ],
      },
      {
        id: "traps",
        title: "Ba cái bẫy quen thuộc",
        blocks: [
          {
            kind: "warn",
            items: [
              "Đổi ý giữa chừng: người nói đưa ra một con số rồi sửa lại. Đáp án là con số SAU.",
              "Nói cùng ý bằng từ khác: câu hỏi dùng một từ, bài nghe dùng từ đồng nghĩa. Nghe thấy đúng từ trong câu hỏi thường lại là bẫy.",
              "Phủ định nhẹ: not particularly, hardly, I wouldn't say… — nghe lướt là hiểu ngược.",
            ],
          },
        ],
      },
      {
        id: "habit",
        title: "Luyện đều hơn là luyện nhiều",
        blocks: [
          {
            kind: "text",
            body:
              "Mười lăm phút mỗi ngày hơn hẳn hai tiếng cuối tuần. Tai cần gặp lại âm thường xuyên, không cần gặp lâu. Và luôn nghe lại bài cũ sau khi đã biết đáp án — đó là lúc tai học được nhiều nhất.",
          },
        ],
      },
    ],
  },
  {
    code: "en",
    skill: "reading",
    title: "Luyện đọc — tìm đúng chỗ, đừng đọc hết",
    intro:
      "Bài đọc dài mà thời gian ngắn, nên kỹ năng thật không phải đọc nhanh mà là biết bỏ qua chỗ nào.",
    minutes: 8,
    sections: [
      {
        id: "order",
        title: "Thứ tự làm bài",
        blocks: [
          {
            kind: "steps",
            items: [
              "Đọc lướt tiêu đề và câu đầu mỗi đoạn — khoảng một phút, để biết bài đi về đâu.",
              "Đọc câu hỏi, gạch từ khoá.",
              "Quay lại bài, quét tìm từ khoá hoặc từ đồng nghĩa của nó.",
              "Đọc kỹ ĐÚNG hai tới ba câu quanh chỗ tìm được, rồi trả lời.",
            ],
          },
          {
            kind: "text",
            title: "Đừng đọc kỹ từ đầu tới cuối",
            body:
              "Câu hỏi thường đi theo thứ tự thông tin trong bài. Trả lời xong câu ba thì câu bốn nằm ở phía sau chỗ vừa tìm được, không phải ở đầu bài. Dùng điều đó để thu hẹp vùng phải đọc.",
          },
        ],
      },
      {
        id: "tfng",
        title: "TRUE / FALSE / NOT GIVEN — chỗ mất điểm nhiều nhất",
        blocks: [
          {
            kind: "table",
            head: ["Đáp án", "Khi nào chọn"],
            rows: [
              ["TRUE", "Bài nói đúng điều đó, dù bằng từ khác"],
              ["FALSE", "Bài nói NGƯỢC LẠI điều đó"],
              ["NOT GIVEN", "Bài không nói gì về điều đó"],
            ],
          },
          {
            kind: "warn",
            items: [
              "FALSE khác NOT GIVEN: FALSE là bài mâu thuẫn, NOT GIVEN là bài im lặng. Nhầm hai cái này là lỗi phổ biến nhất của phần Đọc.",
              "Đừng dùng kiến thức nền. Biết ngoài đời điều đó sai cũng không làm nó thành FALSE — chỉ bài viết gì mới tính.",
              "Cẩn thận với all, always, only, never trong câu hỏi. Bài nói most mà câu hỏi nói all thì đó là FALSE.",
            ],
          },
        ],
      },
      {
        id: "vocab",
        title: "Gặp từ không biết thì làm gì",
        blocks: [
          {
            kind: "text",
            body:
              "Không tra. Xem từ đó là danh từ hay động từ, xem câu trước và câu sau, đoán nghĩa xấu hay tốt. Phần lớn câu hỏi không phụ thuộc vào đúng cái từ mình không biết. Dừng lại tra một từ là mất ba mươi giây, mà ba mươi giây đủ để trả lời một câu khác.",
          },
        ],
      },
    ],
  },
  {
    code: "en",
    skill: "speaking",
    title: "Luyện nói — nói đủ dài và nói có lý do",
    intro:
      "Điểm nói mất nhiều nhất không phải vì phát âm, mà vì trả lời quá ngắn và dừng lại quá sớm.",
    minutes: 9,
    sections: [
      {
        id: "extend",
        title: "Quy tắc: trả lời rồi thêm một lý do",
        blocks: [
          {
            kind: "examples",
            items: [
              {
                bad: "Do you like cooking? — Yes, I do.",
                good:
                  "Yes, quite a lot actually. It's the one part of the day when I'm not looking at a screen, so it feels like a break rather than a chore.",
                note: "Trả lời → thêm lý do → thêm một chi tiết. Ba nhịp, khoảng mười lăm giây. Đó là độ dài tối thiểu cho một câu Part 1.",
              },
            ],
          },
          {
            kind: "warn",
            items: [
              "Trả lời một chữ là tự hạ điểm lưu loát, dù nói đúng ngữ pháp.",
              "Nhưng nói lan man sang chuyện khác cũng bị trừ. Thêm lý do và chi tiết, đừng đổi chủ đề.",
            ],
          },
        ],
      },
      {
        id: "part2",
        title: "Part 2 — một phút chuẩn bị dùng vào việc gì",
        blocks: [
          {
            kind: "steps",
            items: [
              "Đừng viết câu. Viết TỪ KHOÁ, mỗi gạch đầu dòng trên thẻ đề một tới hai từ.",
              "Nghĩ trước phần 'and explain…' — đó là phần dài nhất và hay bị hụt giờ nhất.",
              "Chọn một ví dụ CỤ THỂ, có thật hoặc bịa cũng được. Không ai kiểm chứng, và chuyện cụ thể thì dễ nói dài hơn chuyện chung chung.",
              "Nói đủ hai phút. Dừng ở một phút là mất điểm, dù nói hay.",
            ],
          },
        ],
      },
      {
        id: "fillers",
        title: "Khi bí từ thì làm gì",
        blocks: [
          {
            kind: "phrases",
            note: "Nói vòng qua chỗ bí còn hơn im lặng. Im lặng bị tính là mất lưu loát, nói vòng thì không.",
            items: [
              "Câu giữ nhịp: That's an interesting question… / Let me think about that for a second.",
              "Không nhớ từ: I can't think of the word, but it's the thing you use to…",
              "Tự sửa: Sorry, what I mean is…",
              "Nói giảm khi không chắc: I'd say… / As far as I know…",
            ],
          },
          {
            kind: "text",
            title: "Đừng học thuộc câu trả lời",
            body:
              "Câu học thuộc nghe ra ngay: nhịp đều, không vấp, không có chỗ ngập ngừng tự nhiên. Giám khảo nghe thấy là hạ điểm lưu loát chứ không nâng. Học mẫu câu ngắn để nối ý thì được; học cả đoạn thì hại.",
          },
        ],
      },
    ],
  },
  {
    code: "en",
    skill: "pronunciation",
    title: "Phát âm — sửa cái ảnh hưởng nhiều nhất trước",
    intro:
      "Không cần giọng bản ngữ. Cần người nghe hiểu mà không phải đoán. Ba thứ dưới đây ảnh hưởng tới điều đó nhiều hơn hẳn từng âm lẻ.",
    minutes: 7,
    sections: [
      {
        id: "priority",
        title: "Thứ tự nên sửa",
        blocks: [
          {
            kind: "steps",
            items: [
              "Âm cuối — tiếng Việt chặn hơi ở âm cuối, tiếng Anh nhả hơi ra. Rụng âm cuối là chỗ gây khó hiểu nhất.",
              "Trọng âm từ — đặt sai chỗ là người nghe không nhận ra từ, dù mọi âm đều đúng.",
              "Nhịp câu — từ mang nghĩa được nhấn, từ ngữ pháp bị bóp lại. Đọc đều tăm tắp là dấu hiệu lộ rõ nhất.",
            ],
          },
          {
            kind: "text",
            title: "Vì sao theo thứ tự này",
            body:
              "Sửa /θ/ trong think thì hay, nhưng người nghe vẫn hiểu nếu bạn đọc thành sink hoặc tink. Còn đặt sai trọng âm của photographer thì họ không nhận ra từ. Sửa cái làm người ta không hiểu trước, sửa cái làm giọng đẹp hơn sau.",
          },
        ],
      },
      {
        id: "practice",
        title: "Cách luyện một âm",
        blocks: [
          {
            kind: "steps",
            items: [
              "Nghe mẫu hai lần, chưa đọc theo.",
              "Đọc theo cùng lúc với mẫu, không phải đọc sau.",
              "Thu âm mình rồi nghe lại. Tai nghe người khác chính xác hơn nhiều so với nghe mình lúc đang nói.",
              "Chỉ sửa MỘT âm trong một buổi. Sửa năm âm cùng lúc là không sửa được cái nào.",
            ],
          },
        ],
      },
    ],
  },
  {
    code: "en",
    skill: "vocabulary",
    title: "Từ vựng — nhớ lâu và dùng được",
    intro:
      "Biết nghĩa một từ không có nghĩa là dùng được nó. Bài này nói về khoảng cách giữa hai việc đó.",
    minutes: 8,
    sections: [
      {
        id: "depth",
        title: "Học một từ là học sáu thứ",
        blocks: [
          {
            kind: "table",
            head: ["Cần biết", "Ví dụ với từ research"],
            rows: [
              ["Nghĩa", "việc nghiên cứu"],
              ["Từ loại", "danh từ KHÔNG đếm được — không có researches"],
              ["Đi với từ nào", "conduct / carry out research, chứ không phải do research"],
              ["Giới từ đi kèm", "research INTO something"],
              ["Họ từ", "research → researcher → research (v)"],
              ["Sắc thái", "trang trọng, dùng trong văn viết học thuật"],
            ],
          },
          {
            kind: "text",
            body:
              "Chép mỗi nghĩa vào thẻ thì nhớ được nghĩa, nhưng lúc viết vẫn sai giới từ và sai kết hợp từ. Ghi thêm một câu ví dụ thật là cách rẻ nhất để giữ đủ sáu thứ trên cùng một chỗ.",
          },
        ],
      },
      {
        id: "spacing",
        title: "Vì sao phải lặp lại cách quãng",
        blocks: [
          {
            kind: "text",
            body:
              "Trí nhớ mờ dần theo thời gian, và nhắc lại đúng lúc sắp quên thì hiệu quả hơn nhắc lại khi còn nhớ rõ. Đó là lý do giáo trình từ vựng trong Crucible cho lặp mỗi bộ sau đúng 10 ngày, năm vòng — và vì sao ôn dồn một buổi trước khi thi thì thuộc nhanh mà quên cũng nhanh.",
          },
          {
            kind: "warn",
            items: [
              "Cố nhớ trước khi lật đáp án. Chính lúc gắng nhớ mới là lúc từ ăn vào, không phải lúc đọc lại.",
              "Mười từ một ngày mà đều, hơn năm mươi từ một buổi rồi nghỉ một tuần.",
            ],
          },
        ],
      },
    ],
  },
  {
    code: "en",
    skill: "grammar",
    title: "Ngữ pháp — học để dùng, không để thuộc bảng",
    intro: "Cách đi qua 175 điểm ngữ pháp mà không biến nó thành học vẹt.",
    minutes: 6,
    sections: [
      {
        id: "how",
        title: "Trình tự một điểm ngữ pháp",
        blocks: [
          {
            kind: "steps",
            items: [
              "Đọc phần kiến thức, nhưng đọc phần DÙNG KHI NÀO trước phần cấu trúc.",
              "Làm bài luyện ngay, đừng để sang hôm sau.",
              "Câu nào sai thì đọc lại lời giải thích, không chỉ xem đáp án đúng.",
              "Tự đặt một câu của riêng mình dùng điểm đó, về chuyện có thật trong đời mình.",
            ],
          },
          {
            kind: "text",
            title: "Bước cuối là bước quan trọng nhất",
            body:
              "Làm đúng bài trắc nghiệm chỉ chứng minh mình NHẬN RA được cấu trúc. Tự đặt câu mới là dùng được. Hai việc cách nhau rất xa, và chỉ bài tập thì không bắc cầu qua được.",
          },
        ],
      },
      {
        id: "order",
        title: "Nên học theo thứ tự nào",
        blocks: [
          {
            kind: "text",
            body:
              "Đi theo cấp độ trong khung, đừng nhảy cóc theo hứng. Nhưng nếu đang luyện thi và ít thời gian thì ba họ đáng làm trước: các thì hiện tại và quá khứ, mệnh đề quan hệ, và câu điều kiện — ba thứ này xuất hiện trong gần như mọi bài viết.",
          },
        ],
      },
    ],
  },
];
