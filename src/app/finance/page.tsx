"use client";

import { useState } from "react";
import {
  LayoutDashboard, TrendingUp, CreditCard, Landmark, Package, History as HistoryIcon,
} from "lucide-react";
import DashboardTab from "@/components/finance/DashboardTab";
import IncomeTab from "@/components/finance/IncomeTab";
import ExpenseTab from "@/components/finance/ExpenseTab";
import DebtsTab from "@/components/finance/DebtsTab";
import HistoryTab from "@/components/finance/HistoryTab";
import AssetsTab from "@/components/finance/AssetsTab";

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Header with Tabs */}
      <div className="flex flex-col">
        {/* Tabs Navigation (Centered) */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-[var(--color-surface)] rounded-full p-1 border border-[var(--color-border)] shadow-sm overflow-x-auto max-w-full hide-scrollbar">
            {[
              { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
              { id: "income", label: "Income", Icon: TrendingUp },
              { id: "expense", label: "Expense", Icon: CreditCard },
              { id: "debts", label: "Debts", Icon: Landmark },
              { id: "assets", label: "Assets", Icon: Package },
              { id: "history", label: "History", Icon: HistoryIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
                title={tab.label}
                className={`w-11 h-11 md:w-auto md:h-auto flex items-center justify-center md:px-8 md:py-2.5 rounded-full text-sm font-bold transition-all uppercase tracking-wider whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-md"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                }`}
              >
                {/* Dưới 768px sáu tab chữ tràn ngang phải cuộn mới thấy tab cuối;
                    icon thì vừa đủ một hàng. Chữ vẫn nằm trong DOM cho trình
                    đọc màn hình qua aria-label. */}
                <tab.Icon size={18} className="md:hidden" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Unified Header with Month Picker and Modal (Removed) */}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "income" && <IncomeTab />}
        {activeTab === "expense" && <ExpenseTab />}
        {activeTab === "debts" && <DebtsTab />}
        {activeTab === "assets" && <AssetsTab />}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
