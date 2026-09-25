"use client";

import { useState, type ReactNode } from "react";
import { BookOpen, Dumbbell } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import SkillGuideView from "./SkillGuideView";
import type { SkillId } from "@/lib/languageSkills";

/**
 * Khung chung cho mọi trang kỹ năng: học trước, luyện sau.
 *
 * Trước đây bấm vào một kỹ năng là ra thẳng bài tập. Bài tập đo được mình đang
 * ở đâu nhưng không dạy cách làm — người học cần biết *viết câu mở bài thế nào*
 * rồi mới luyện có ích.
 *
 * Mặc định mở tab Học, nhưng chỉ ở lần đầu: quay lại lần sau thì thường là để
 * luyện tiếp chứ không phải đọc lại. Ghi nhớ bằng `localStorage` vì đây là tiện
 * nghi của riêng máy này, không đáng lưu xuống máy chủ.
 */
const seenKey = (langCode: string, skill: string) => `crucible.guide-seen.${langCode}.${skill}`;

export default function SkillShell({
  langCode,
  skill,
  children,
}: {
  langCode: string;
  skill: SkillId;
  children: ReactNode;
}) {
  const { t } = useLanguage();

  const [tab, setTab] = useState<"guide" | "practice">(() => {
    // `localStorage` có thể ném lỗi ở chế độ riêng tư hoặc khi chặn dữ liệu
    // trang — hỏng chỗ này không được làm hỏng cả trang.
    try {
      return localStorage.getItem(seenKey(langCode, skill)) ? "practice" : "guide";
    } catch {
      return "guide";
    }
  });

  const go = (next: "guide" | "practice") => {
    setTab(next);
    if (next === "practice") {
      try {
        localStorage.setItem(seenKey(langCode, skill), "1");
      } catch {
        // Không nhớ được thì lần sau lại mở tab Học. Không sao.
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="c-seg w-fit">
        <button className={`c-seg-opt ${tab === "guide" ? "active" : ""}`} onClick={() => go("guide")}>
          <BookOpen size={15} />
          {t("Learn", "Học")}
        </button>
        <button
          className={`c-seg-opt ${tab === "practice" ? "active" : ""}`}
          onClick={() => go("practice")}
        >
          <Dumbbell size={15} />
          {t("Practise", "Luyện")}
        </button>
      </div>

      {tab === "guide" ? (
        <div className="space-y-6">
          <SkillGuideView langCode={langCode} skill={skill} />
          <button onClick={() => go("practice")} className="c-btn c-btn-primary c-btn-lg">
            <Dumbbell size={18} />
            {t("Start practising", "Bắt đầu luyện")}
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
