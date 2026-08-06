"use client";

import { useState } from "react";
import DashboardTab from "@/components/finance/DashboardTab";
import IncomeTab from "@/components/finance/IncomeTab";
import ExpenseTab from "@/components/finance/ExpenseTab";
import DebtsTab from "@/components/finance/DebtsTab";
import HistoryTab from "@/components/finance/HistoryTab";

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
              { id: "dashboard", label: "Dashboard" },
              { id: "income", label: "Income" },
              { id: "expense", label: "Expense" },
              { id: "debts", label: "Debts" },
              { id: "history", label: "History" }
            ].map((tab) => (
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

        {/* Unified Header with Month Picker and Modal (Removed) */}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "income" && <IncomeTab />}
        {activeTab === "expense" && <ExpenseTab />}
        {activeTab === "debts" && <DebtsTab />}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
