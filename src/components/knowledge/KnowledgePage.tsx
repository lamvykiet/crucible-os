"use client";

import { useRouter, useSearchParams } from "next/navigation";
import DocumentsTab from "@/components/knowledge/DocumentsTab";
import DashboardTab from "@/components/knowledge/DashboardTab";
import IdeaTrackerTab from "@/components/knowledge/IdeaTrackerTab";
import VideoDownloaderTab from "@/components/knowledge/VideoDownloaderTab";
import KnowledgeScene from "@/components/knowledge/KnowledgeScene";

const TAB_IDS = ["dashboard", "documents", "ideas", "videos"];

/**
 * Knowledge Hub. Tab đang mở nằm trên URL (`/knowledge?tab=ideas`) để thanh
 * trên vẽ được dải tab (xem `src/lib/modules.tsx`) và Back đi đúng bước.
 */
export default function KnowledgeHubPage() {
  const router = useRouter();
  const param = useSearchParams().get("tab");
  const activeTab = param && TAB_IDS.includes(param) ? param : "dashboard";
  const setActiveTab = (id: string) => router.push(`/knowledge?tab=${id}`, { scroll: false });


  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <KnowledgeScene />

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
