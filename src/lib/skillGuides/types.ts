import type { SkillId } from "@/lib/languageSkills";

/**
 * Bài hướng dẫn cho một kỹ năng.
 *
 * Vì sao có phần này: trước đây bấm vào một kỹ năng là ra thẳng bài tập, mà bài
 * tập chỉ đo được mình đang ở đâu chứ không dạy cách làm. Người học cần biết
 * *viết câu mở bài thế nào*, *đoạn thân bài gồm những gì*, rồi mới luyện có ích.
 *
 * Nội dung soạn tay, không sinh bằng AI: bài hướng dẫn phải đứng yên để đọc lại
 * được, và phải chịu trách nhiệm về những gì nó dạy. Nó cũng chạy được khi hết
 * hạn mức AI.
 *
 * Về nguồn: cấu trúc bài thi, tên tiêu chí chấm, và các sự thật ngữ pháp đều là
 * dữ kiện, không ai sở hữu. Cái được bảo hộ là CÁCH DIỄN ĐẠT của từng cuốn
 * sách. Mọi lời giải thích, ví dụ và mẫu câu dưới đây đều do dự án tự viết;
 * `references` chỉ ghi những sách đã tra để biết người ta thường dạy theo trình
 * tự nào.
 */

export type GuideBlock =
  | { kind: "text"; title?: string; body: string }
  | { kind: "steps"; title?: string; items: string[] }
  | { kind: "table"; title?: string; head: [string, string]; rows: [string, string][] }
  | { kind: "phrases"; title?: string; note?: string; items: string[] }
  | {
      kind: "examples";
      title?: string;
      note?: string;
      /** `bad` là cách viết hay gặp mà nên tránh; `good` là cách nên theo. */
      items: { bad?: string; good: string; note?: string }[];
    }
  | { kind: "warn"; title?: string; items: string[] };

export interface GuideSection {
  id: string;
  title: string;
  blocks: GuideBlock[];
}

export interface SkillGuide {
  code: string;
  skill: SkillId;
  title: string;
  /** Một đoạn nói rõ bài này dạy gì và không dạy gì. */
  intro: string;
  /** Ước lượng thời gian đọc, phút. */
  minutes: number;
  sections: GuideSection[];
  references?: string[];
}
