"use client";

import { useRouter, useSearchParams } from "next/navigation";
import DashboardTab from "@/components/finance/DashboardTab";
import IncomeTab from "@/components/finance/IncomeTab";
import ExpenseTab from "@/components/finance/ExpenseTab";
import DebtsTab from "@/components/finance/DebtsTab";
import HistoryTab from "@/components/finance/HistoryTab";
import AssetsTab from "@/components/finance/AssetsTab";
import AccountsTab from "@/components/finance/AccountsTab";
import ProjectsTab from "@/components/finance/ProjectsTab";
import FinanceScene from "@/components/finance/FinanceScene";

const TAB_IDS = ["dashboard", "income", "expense", "debts", "assets", "accounts", "projects", "history"];

/**
 * Sổ chi tiêu. Tab đang mở nằm trên URL (`/finance?tab=income`) chứ không
 * trong state: thanh trên (`TopNav`) vẽ dải tab này từ `src/lib/modules.tsx`
 * và chỉ đổi được URL. Nhờ vậy nút Back cũng đi đúng từng tab.
 *
 * Dải tab nằm trên thanh trên ở cả web lẫn điện thoại (`ModuleTabs`).
 */
export default function FinancePage() {
  const router = useRouter();
  const param = useSearchParams().get("tab");
  const activeTab = param && TAB_IDS.includes(param) ? param : "dashboard";
  const setActiveTab = (id: string) => router.push(`/finance?tab=${id}`, { scroll: false });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <FinanceScene />

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} />}
        {activeTab === "income" && <IncomeTab />}
        {activeTab === "expense" && <ExpenseTab />}
        {activeTab === "debts" && <DebtsTab />}
        {activeTab === "assets" && <AssetsTab />}
        {activeTab === "accounts" && <AccountsTab />}
        {activeTab === "projects" && <ProjectsTab />}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
