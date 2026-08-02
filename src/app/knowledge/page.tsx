"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import DocumentsTab from "@/components/knowledge/DocumentsTab";
import DashboardTab from "@/components/knowledge/DashboardTab";
import IdeaTrackerTab from "@/components/knowledge/IdeaTrackerTab";
import VideoDownloaderTab from "@/components/knowledge/VideoDownloaderTab";

export default function KnowledgeHubPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("dashboard");

  // IdeaTrackerTab và VideoDownloaderTab tồn tại trong repo nhưng chưa từng
  // được gắn vào trang nào — hai tính năng mà BRD yêu cầu đều không truy cập
  // được từ giao diện.
  const tabs = [
    { id: "dashboard", label: t("Dashboard", "Tổng quan") },
    { id: "documents", label: t("Documents", "Tài liệu") },
    { id: "ideas", label: t("Ideas", "Ý tưởng") },
    { id: "videos", label: t("Videos", "Video") },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Header with Tabs */}
      <div className="flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          Knowledge Hub
        </h1>
        
        {/* Tabs Navigation */}
        <div className="flex bg-[var(--color-surface)] rounded-full p-1 border border-[var(--color-border)] mb-8 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all uppercase tracking-wider ${
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
        {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} />}
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "ideas" && <IdeaTrackerTab />}
        {activeTab === "videos" && <VideoDownloaderTab />}
      </div>
    </div>
  );
}
