"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import SubjectsTab from "@/components/learning/SubjectsTab";
import DictionaryTab from "@/components/learning/DictionaryTab";
import MockExamTab from "@/components/learning/MockExamTab";

export default function LearningHubPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("subjects");

  const tabs = [
    { id: "subjects", label: t("Subjects", "Môn Học") },
    { id: "dictionary", label: t("Dictionary", "Từ Điển") },
    { id: "mock-exam", label: t("Mock Exam", "Thi Thử") },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Header with Tabs */}
      <div className="flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          Learning Hub
        </h1>
        
        {/* Tabs Navigation */}
        <div className="flex bg-[var(--color-surface)] rounded-full p-1 border border-[var(--color-border)] mb-8 shadow-sm overflow-x-auto max-w-full hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 md:px-8 py-2.5 rounded-full text-sm font-bold transition-all uppercase tracking-wider whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-md"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === "subjects" && <SubjectsTab />}
        {activeTab === "dictionary" && <DictionaryTab />}
        {activeTab === "mock-exam" && <MockExamTab />}
      </div>
    </div>
  );
}
