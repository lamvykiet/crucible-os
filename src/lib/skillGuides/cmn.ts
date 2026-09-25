import type { SkillGuide } from "./types";

/** Hướng dẫn kỹ năng tiếng Trung Quan Thoại, viết cho người nói tiếng Việt. */
export const CMN_GUIDES: SkillGuide[] = [
  {
    code: "cmn",
    skill: "dictation",
    title: "Chép chính tả — nghe ra thanh và nghe ra âm",
    intro:
      "Người Việt có lợi thế lớn khi học tiếng Trung: tiếng Việt cũng có thanh. Nhưng chính lợi thế đó sinh ra cái bẫy — thanh Việt không ánh một-một sang thanh Trung.",
    minutes: 9,
    sections: [
      {
        id: "tones",
        title: "Bốn thanh, và chỗ người Việt hay lệch",
        blocks: [
          {
            kind: "table",
            head: ["Thanh", "Đặc điểm và chỗ dễ nhầm"],
            rows: [
              ["Thanh 1 (mā)", "Cao và PHẲNG suốt. Tiếng Việt không có thanh nào phẳng cao như vậy nên hay bị kéo xuống."],
              ["Thanh 2 (má)", "Lên từ GIỮA, không lên từ thấp như dấu sắc tiếng Việt."],
              ["Thanh 3 (mǎ)", "Xuống rồi lên. Trong câu nói nhanh thường chỉ còn phần xuống."],
              ["Thanh 4 (mà)", "Từ cao rơi thẳng xuống, dứt khoát. Gần dấu huyền nhưng mạnh hơn nhiều."],
            ],
          },
          {
            kind: "warn",
            title: "Hai quy tắc biến thanh phải nhớ",
            items: [
              "Hai thanh 3 liền nhau: cái trước đổi thành thanh 2. 你好 viết nǐ hǎo nhưng đọc ní hǎo. Nghe ra ní mà chép nǐ vẫn là đúng.",
              "不 và 一 đổi thanh theo chữ đứng sau. 不是 đọc bú shì chứ không phải bù shì.",
            ],
          },
        ],
      },
      {
        id: "sounds",
        title: "Ba cặp âm dễ lẫn nhất",
        blocks: [
          {
            kind: "table",
            head: ["Cặp", "Khác nhau ở đâu"],
            rows: [
              ["zh ch sh r / z c s", "Nhóm đầu uốn đầu lưỡi lên vòm, nhóm sau lưỡi phẳng."],
              ["j q x / zh ch sh", "j q x lưỡi phẳng đưa ra trước, môi bẹt. Không uốn lưỡi."],
              ["ü / u", "ü là nói i rồi tròn môi mà giữ nguyên lưỡi. Khác hẳn u."],
            ],
          },
          {
            kind: "text",
            title: "n và ng ở cuối",
            body:
              "Tiếng Việt phân biệt rõ hai âm này nên người Việt ít sai khi nói. Nhưng khi NGHE nhanh thì vẫn dễ lẫn, và chép sai một chữ là sai cả từ: 深 shēn khác 生 shēng.",
          },
        ],
      },
      {
        id: "how",
        title: "Gõ đáp án bằng gì",
        blocks: [
          {
            kind: "text",
            body:
              "Gõ chữ Hán hay gõ pinyin đều được tính đúng. Nhưng nếu đã cài được bộ gõ thì nên gõ chữ Hán: lúc đó bạn vừa phải nghe ra âm, vừa phải chọn đúng chữ trong số các chữ đồng âm — và chính bước chọn chữ ấy dạy bạn nhiều nhất. 名 với 明 đọc y hệt nhau, chỉ khi viết ra mới lộ là mình hiểu hay chưa.",
          },
        ],
      },
    ],
  },
  {
    code: "cmn",
    skill: "writing",
    title: "Viết tiếng Trung — câu và đoạn",
    intro:
      "Tiếng Trung không chia động từ, nên cái khó khi viết không phải là hình thái từ mà là TRẬT TỰ và chọn đúng hư từ.",
    minutes: 10,
    sections: [
      {
        id: "order",
        title: "Trật tự trong câu — thứ tự cố định",
        blocks: [
          {
            kind: "text",
            body:
              "Tiếng Việt cho phép đảo trạng ngữ khá tự do, tiếng Trung thì không. Sai trật tự là câu hỏng, kể cả khi mọi chữ đều đúng.",
          },
          {
            kind: "table",
            head: ["Quy tắc", "Ví dụ"],
            rows: [
              ["Thời gian đứng TRƯỚC nơi chốn", "我明天在北京开会。"],
              ["Cả hai đứng TRƯỚC động từ", "không phải 我开会明天"],
              ["Từ lớn trước từ nhỏ", "2026年9月25日 — ngược hẳn tiếng Việt"],
              ["Định ngữ đứng TRƯỚC danh từ", "我昨天买的那本书"],
            ],
          },
        ],
      },
      {
        id: "particles",
        title: "了 — chỗ sai dai dẳng nhất",
        blocks: [
          {
            kind: "warn",
            items: [
              "了 KHÔNG phải thì quá khứ. 我明天吃了饭就走 nói về ngày mai mà vẫn có 了.",
              "了 sau động từ = việc hoàn thành. 了 cuối câu = tình hình đã đổi. Hai cái khác nhau.",
              "Phủ định bằng 没 thì BỎ 了: 我没吃饭, không phải 我没吃了饭.",
            ],
          },
        ],
      },
      {
        id: "paragraph",
        title: "Dựng đoạn văn",
        blocks: [
          {
            kind: "phrases",
            title: "Cặp liên từ để nối ý",
            note: "Tiếng Trung dùng liên từ theo CẶP, thiếu một vế là câu cụt.",
            items: [
              "因为… 所以… — vì… nên…",
              "虽然… 但是… — tuy… nhưng…",
              "不但… 而且… — không những… mà còn…",
              "如果… 就… — nếu… thì…",
              "只有… 才… — chỉ có… mới…",
            ],
          },
          {
            kind: "text",
            title: "Viết trang trọng thì khác gì",
            body:
              "Văn viết dùng từ hai âm tiết thay cho từ một âm tiết khẩu ngữ, và chen thành ngữ bốn chữ. Nhưng đừng rắc thành ngữ bừa: một thành ngữ dùng đúng chỗ hơn năm thành ngữ nhét vào cho có.",
          },
        ],
      },
    ],
  },
  {
    code: "cmn",
    skill: "speaking",
    title: "Nói tiếng Trung — thanh điệu trong câu",
    intro:
      "Đọc đúng thanh từng chữ rời là một việc. Giữ được thanh khi nói cả câu lại là việc khác hẳn, và đó mới là thứ quyết định người ta có hiểu không.",
    minutes: 8,
    sections: [
      {
        id: "in-sentence",
        title: "Thanh bị gì khi vào câu",
        blocks: [
          {
            kind: "steps",
            items: [
              "Thanh nhẹ: âm tiết thứ hai của 妈妈, 爸爸, 谢谢 đọc ngắn và nhẹ, không có đường thanh riêng. Đọc thành thanh đầy đủ là nghe cứng ngay.",
              "Thanh 3 trong câu: thường chỉ còn phần xuống, không lên lại. Chỉ khi đứng cuối câu mới đủ cả xuống và lên.",
              "Nhịp: tiếng Trung đi theo cụm hai âm tiết. Ngắt đúng cụm thì người nghe theo được, ngắt bừa thì không.",
            ],
          },
        ],
      },
      {
        id: "practice",
        title: "Cách luyện",
        blocks: [
          {
            kind: "text",
            body:
              "Luyện theo CÂU, đừng luyện theo chữ rời. Đọc từng chữ đúng thanh mà ghép lại vẫn sai là chuyện rất thường. Cách hiệu quả nhất là đọc theo mẫu cùng lúc — bắt đầu nói ngay khi mẫu bắt đầu, không đợi mẫu nói xong.",
          },
        ],
      },
    ],
  },
  {
    code: "cmn",
    skill: "vocabulary",
    title: "Từ vựng tiếng Trung — học chữ hay học từ",
    intro:
      "Câu hỏi này quyết định cách bạn học: nhớ 3000 chữ rời, hay nhớ 3000 từ dùng được?",
    minutes: 8,
    sections: [
      {
        id: "char-vs-word",
        title: "Chữ không phải từ",
        blocks: [
          {
            kind: "text",
            body:
              "电 là điện, 脑 là não. Nhưng 电脑 là máy tính, không phải não điện. Phần lớn từ tiếng Trung hiện đại có hai chữ, và nghĩa của từ không phải phép cộng nghĩa hai chữ. Học chữ rời giúp đoán, nhưng chỉ học từ mới dùng được.",
          },
          {
            kind: "warn",
            items: [
              "Học chữ rời rồi tự ghép là cách sinh ra những từ không ai nói.",
              "Nhưng biết nghĩa từng chữ thì đoán được từ mới — nên vẫn nên biết, chỉ đừng dừng ở đó.",
            ],
          },
        ],
      },
      {
        id: "measure",
        title: "Lượng từ phải học kèm danh từ",
        blocks: [
          {
            kind: "text",
            body:
              "Đừng ghi 书 = sách. Ghi 一本书 — một quyển sách. Lượng từ gắn chặt với danh từ, học tách ra là lúc nói phải dừng lại nghĩ, và dừng lại nghĩ thì mất lưu loát.",
          },
        ],
      },
      {
        id: "homophone",
        title: "Từ đồng âm",
        blocks: [
          {
            kind: "text",
            body:
              "Tiếng Trung có rất nhiều chữ đọc giống nhau: shì có thể là 是, 事, 市, 试, 室… Đây là lý do phần chép chính tả bắt gõ chữ lại có ích hơn hẳn gõ pinyin — nó buộc bạn phân biệt những chữ mà tai không phân biệt được.",
          },
        ],
      },
    ],
  },
];
