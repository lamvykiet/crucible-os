"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function FinanceSettings() {
  const { t } = useLanguage();
  
  const [transactionTypes, setTransactionTypes] = useState(["Income", "Expense", "Transfer", "Refund", "Adjustment"]);
  const [incomeGroups, setIncomeGroups] = useState([
    { id: 1, name: "Freelance", subcategories: [] },
    { id: 2, name: "Investment", subcategories: [] },
    { id: 3, name: "Other Income", subcategories: [] },
    { id: 4, name: "Main income", subcategories: ["Salary", "Bonus"] },
  ]);
  const [expenseGroups, setExpenseGroups] = useState([
    { id: 1, name: "Food & Dining", subcategories: ["Breakfast", "Lunch", "Dinner", "Cafe"] },
    { id: 2, name: "Groceries", subcategories: [] },
    { id: 3, name: "Transportation", subcategories: [] },
    { id: 4, name: "Shopping", subcategories: [] },
    { id: 5, name: "Health", subcategories: [] },
    { id: 6, name: "Utilities", subcategories: [] },
    { id: 7, name: "Entertainment", subcategories: [] },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t("Danh mục", "Danh mục")}</h2>
        <p className="text-[var(--color-text-muted)] text-sm">{t("Thêm / xóa loại giao dịch, nhóm thu nhập, nhóm chi tiêu và danh mục con", "Thêm / xóa loại giao dịch, nhóm thu nhập, nhóm chi tiêu và danh mục con")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Loại giao dịch */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm flex flex-col h-full">
          <h3 className="font-bold text-[var(--color-text)] mb-4">{t("Loại giao dịch", "Loại giao dịch")}</h3>
          <div className="flex flex-wrap gap-2 mb-6 flex-1">
            {transactionTypes.map(type => (
              <span key={type} className="inline-flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-1.5 rounded-full text-xs font-medium shadow-sm">
                {type} <button className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] ml-1"><X size={12} /></button>
              </span>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={t("Thêm loại giao dịch...", "Thêm loại giao dịch...")}
              className="flex-1 border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-success)]"
            />
            <button className="bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md flex items-center gap-1">
              <Plus size={14} /> Thêm
            </button>
          </div>
        </div>

        {/* Nhóm thu nhập */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm flex flex-col h-full">
          <h3 className="font-bold text-[var(--color-text)] mb-4">{t("Nhóm thu nhập", "Nhóm thu nhập")}</h3>
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap gap-4">
              {incomeGroups.map(group => (
                <div key={group.id} className="w-full md:w-[calc(50%-0.5rem)]">
                  <div className="flex items-center gap-2 mb-2 border-b border-[var(--color-border)] pb-2 border-dashed">
                    <span className="inline-flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                      {group.name} <button className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] ml-1"><X size={12} /></button>
                    </span>
                    <button className="inline-flex items-center gap-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] px-2 py-1 rounded-full text-[10px] font-bold">
                      <Plus size={10} /> Danh mục con
                    </button>
                  </div>
                  {group.subcategories.length === 0 ? (
                    <p className="text-[10px] text-[var(--color-text-faint)] italic pl-2">{t("Chưa có danh mục con", "Chưa có danh mục con")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pl-2">
                      {group.subcategories.map(sub => (
                        <span key={sub} className="inline-flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] px-2 py-1 rounded-md text-[10px]">
                          {sub} <button className="text-[var(--color-text-faint)] hover:text-[var(--color-error)]"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2 mt-6 pt-4 border-t border-[var(--color-border)] border-dashed">
            <input 
              type="text" 
              placeholder={t("VD: Salary, Bonus...", "VD: Salary, Bonus...")}
              className="flex-1 border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-success)]"
            />
            <button className="bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md flex items-center gap-1">
              <Plus size={14} /> Thêm
            </button>
          </div>
        </div>
      </div>

      {/* Nhóm chi tiêu */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm">
        <h3 className="font-bold text-[var(--color-text)] mb-2">{t("Nhóm chi tiêu & danh mục con", "Nhóm chi tiêu & danh mục con")}</h3>
        <p className="text-[11px] text-[var(--color-text-faint)] mb-6">{t("Bấm + Danh mục con trên từng nhóm để thêm mục con (VD: Food & Dining → Breakfast, Lunch, Dinner, Cafe).", "Bấm + Danh mục con trên từng nhóm để thêm mục con (VD: Food & Dining → Breakfast, Lunch, Dinner, Cafe).")}</p>
        
        <div className="space-y-4">
          {expenseGroups.map(group => (
            <div key={group.id} className="border-b border-[var(--color-border)] border-dashed pb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  {group.name} <button className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] ml-1"><X size={12} /></button>
                </span>
                <button className="inline-flex items-center gap-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm">
                  <Plus size={10} /> Danh mục con
                </button>
              </div>
              
              {group.subcategories.length === 0 ? (
                <p className="text-[10px] text-[var(--color-text-faint)] italic pl-4">{t("Chưa có danh mục con", "Chưa có danh mục con")}</p>
              ) : (
                <div className="flex flex-wrap gap-2 pl-4">
                  {group.subcategories.map(sub => (
                    <span key={sub} className="inline-flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] px-3 py-1 rounded-md text-[11px]">
                      {sub} <button className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] ml-1"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
