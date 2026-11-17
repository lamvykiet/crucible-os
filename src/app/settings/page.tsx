"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import GeneralSettings from "@/components/settings/GeneralSettings";
import FinanceSettings from "@/components/settings/FinanceSettings";
import OcrRulesSettings from "@/components/settings/OcrRulesSettings";
import KnowledgeSettings from "@/components/settings/KnowledgeSettings";
import LearningSettings from "@/components/settings/LearningSettings";
import PageIntro from "@/components/PageIntro";

export default function SettingsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", label: t("General", "Tổng Quan") },
    { id: "finance", label: t("Finance OS", "Tài Chính") },
    { id: "ocr", label: t("OCR Rules", "Quy Tắc OCR") },
    { id: "knowledge", label: t("Knowledge Hub", "Kiến Thức") },
    { id: "learning", label: t("Learning Hub", "Học Tập") },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <PageIntro
        title={t("Settings", "Cài đặt hệ thống")}
        kicker={tabs.find((x) => x.id === activeTab)?.label}
        lede={t("Language, theme, categories, OCR rules and per-module options.", "Ngôn ngữ, giao diện, danh mục, quy tắc OCR và tuỳ chọn từng phân hệ.")}
      />

      {/* Chuyển nhóm cài đặt: viên kính, mục đang chọn là viên trắng đục */}
      <div className="flex justify-center">
        <div role="tablist" className="c-glass flex rounded-full p-1 overflow-x-auto max-w-full hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 md:px-7 min-h-11 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[var(--glass-pill)] text-[var(--glass-pill-ink)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
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
        {activeTab === "ocr" && <OcrRulesSettings />}
        {activeTab === "knowledge" && <KnowledgeSettings />}
        {activeTab === "learning" && <LearningSettings />}
      </div>
    </div>
  );
}
