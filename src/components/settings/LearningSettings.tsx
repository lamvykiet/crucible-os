"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function LearningSettings() {
  const { t } = useLanguage();
  
  const [domains, setDomains] = useState([
    { id: 1, name: "Finance", subjects: ["CFA", "CMA"] },
    { id: 2, name: "3D Design", subjects: ["Blender", "Maya"] },
    { id: 3, name: "Data Analyst", subjects: ["Python", "SQL"] },
    { id: 4, name: "Language", subjects: ["IELTS", "HSK", "TOPIK"] },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>{t("Ngành Học & Môn Học", "Ngành Học & Môn Học")}</h2>
        <p className="text-[var(--color-text-muted)] text-sm">{t("Thêm / xóa ngành học và các môn học thuộc ngành đó", "Thêm / xóa ngành học và các môn học thuộc ngành đó")}</p>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm">
        <h3 className="font-bold text-[var(--color-text)] mb-2">{t("Quản lý Ngành Học", "Quản lý Ngành Học")}</h3>
        <p className="text-[11px] text-[var(--color-text-faint)] mb-6">{t("Bấm + Môn học trên từng ngành để thêm môn (VD: Finance → CFA, CMA).", "Bấm + Môn học trên từng ngành để thêm môn (VD: Finance → CFA, CMA).")}</p>
        
        <div className="space-y-4">
          {domains.map(domain => (
            <div key={domain.id} className="border-b border-[var(--color-border)] border-dashed pb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  {domain.name} <button className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] ml-1"><X size={12} /></button>
                </span>
                <button className="inline-flex items-center gap-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm">
                  <Plus size={10} /> {t("Môn học", "Môn học")}
                </button>
              </div>
              
              {domain.subjects.length === 0 ? (
                <p className="text-[10px] text-[var(--color-text-faint)] italic pl-4">{t("Chưa có môn học", "Chưa có môn học")}</p>
              ) : (
                <div className="flex flex-wrap gap-2 pl-4">
                  {domain.subjects.map(sub => (
                    <span key={sub} className="inline-flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] px-3 py-1 rounded-md text-[11px]">
                      {sub} <button className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] ml-1"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 mt-6 pt-4 border-t border-[var(--color-border)] border-dashed max-w-md">
          <input 
            type="text" 
            placeholder={t("VD: Computer Science...", "VD: Computer Science...")}
            className="flex-1 border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-success)]"
          />
          <button className="bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md flex items-center gap-1">
            <Plus size={14} /> Thêm Ngành Học
          </button>
        </div>
      </div>
    </div>
  );
}
