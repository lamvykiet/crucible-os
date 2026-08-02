"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import GeneralSettings from "@/components/settings/GeneralSettings";
import FinanceSettings from "@/components/settings/FinanceSettings";
import KnowledgeSettings from "@/components/settings/KnowledgeSettings";
import LearningSettings from "@/components/settings/LearningSettings";

export default function SettingsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", label: t("General", "Tổng Quan") },
    { id: "finance", label: t("Finance OS", "Tài Chính") },
    { id: "knowledge", label: t("Knowledge Hub", "Kiến Thức") },
    { id: "learning", label: t("Learning Hub", "Học Tập") },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Header with Tabs */}
      <div className="flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          {t("Settings", "Cài Đặt Hệ Thống")}
        </h1>
        
        {/* Tabs Navigation */}
        <div className="flex bg-[var(--color-surface)] rounded-full p-1 border border-[var(--color-border)] mb-8 shadow-sm overflow-x-auto max-w-full hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 md:px-8 py-2.5 rounded-full text-sm font-bold transition-all uppercase tracking-wider whitespace-nowrap ${
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
      <div className="animate-in fade-in duration-300 max-w-5xl mx-auto">
        {activeTab === "general" && <GeneralSettings />}
        {activeTab === "finance" && <FinanceSettings />}
        {activeTab === "knowledge" && <KnowledgeSettings />}
        {activeTab === "learning" && <LearningSettings />}
      </div>
    </div>
  );
}
