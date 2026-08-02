"use client";

import { Play, Clock, Award, FileText } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function MockExamTab() {
  const { t } = useLanguage();

  const exams = [
    {
      id: "cfa-1",
      title: "CFA Level 1 - Mock Exam A",
      category: "Finance",
      duration: "135 mins",
      questions: 90,
      difficulty: "Hard",
      sections: ["Ethical", "Quant", "Economics", "FSA", "Corporate", "Equity", "Fixed Income", "Derivatives", "Alternative", "Portfolio"]
    },
    {
      id: "cma-1",
      title: "CMA Part 1 - Financial Planning",
      category: "Finance",
      duration: "240 mins",
      questions: 100,
      difficulty: "Medium",
      sections: ["External Financial Reporting", "Planning, Budgeting", "Performance Management", "Cost Management", "Internal Controls", "Technology"]
    },
    {
      id: "ielts-1",
      title: "IELTS Academic - Practice 1",
      category: "Language",
      duration: "175 mins",
      questions: 80, // roughly
      difficulty: "Medium",
      sections: ["Listening", "Reading", "Writing", "Speaking"]
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t("Mock Exam", "Thi Thử")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("Practice with real-world exam structures", "Luyện tập với cấu trúc đề thi thực tế")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {exams.map(exam => (
          <div key={exam.id} className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-6 flex flex-col h-full hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] px-2 py-1 rounded bg-[var(--color-success-tint)] text-[var(--color-success)] font-bold uppercase tracking-wider mb-2 inline-block">
                  {exam.category}
                </span>
                <h3 className="text-xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{exam.title}</h3>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] mb-6">
              <div className="flex items-center gap-1"><Clock size={14} /> {exam.duration}</div>
              <div className="flex items-center gap-1"><FileText size={14} /> {exam.questions} {t("Qs", "câu")}</div>
              <div className="flex items-center gap-1"><Award size={14} /> {exam.difficulty}</div>
            </div>

            <div className="mb-6 flex-1">
              <h4 className="text-xs font-bold text-[var(--color-text-faint)] uppercase tracking-wider mb-2">{t("Sections structure", "Cấu trúc phần thi")}</h4>
              <div className="flex flex-wrap gap-1.5">
                {exam.sections.map(sec => (
                  <span key={sec} className="text-[10px] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)] px-2 py-1 rounded">
                    {sec}
                  </span>
                ))}
              </div>
            </div>

            <button className="w-full flex items-center justify-center gap-2 bg-[#66c2c2] hover:bg-[var(--color-success)] text-white font-bold py-3 rounded-xl transition-colors shadow-sm">
              <Play size={16} fill="currentColor" /> {t("Start Exam", "Bắt đầu thi")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
