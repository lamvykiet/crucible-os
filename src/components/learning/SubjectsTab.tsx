"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { Layers, Palette, TrendingUp, BarChart3, Languages } from "lucide-react";
import Link from "next/link";

export default function SubjectsTab() {
  const { t } = useLanguage();

  const categories = [
    {
      id: "3d-design",
      name: t("3D Design", "Thiết kế 3D"),
      icon: <Palette className="text-pink-500" size={32} />,
      bgColor: "bg-pink-50",
      subjects: ["Blender Basics", "Advanced Modeling", "Texturing & Lighting"]
    },
    {
      id: "finance",
      name: t("Finance", "Tài chính"),
      icon: <TrendingUp className="text-[var(--color-success)]" size={32} />,
      bgColor: "bg-[var(--color-success-tint)]",
      subjects: ["CFA Level 1", "CMA Part 1", "CMA Part 2", "Personal Finance"]
    },
    {
      id: "data",
      name: t("Data Analyst", "Phân tích dữ liệu"),
      icon: <BarChart3 className="text-[var(--color-warning)]" size={32} />,
      bgColor: "bg-[var(--color-warning-tint)]",
      subjects: ["Python for Data", "SQL Mastery", "PowerBI & Tableau"]
    },
    {
      id: "language",
      name: t("Language", "Ngôn ngữ"),
      icon: <Languages className="text-[var(--color-info)]" size={32} />,
      bgColor: "bg-[var(--color-info-tint)]",
      subjects: ["IELTS Academic", "HSK 4", "TOPIK 3"]
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t("Subjects", "Môn Học")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("Manage and track your learning progress by topic", "Quản lý và theo dõi tiến độ học tập theo chủ đề")}
          </p>
        </div>
      </div>

      {/* Gallery View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map(cat => (
          <div key={cat.id} className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
            <div className={`${cat.bgColor} p-6 flex flex-col items-center justify-center text-center`}>
              <div className="bg-[var(--color-surface)] p-3 rounded-2xl shadow-sm mb-4">
                {cat.icon}
              </div>
              <h3 className="font-bold text-[var(--color-text)] text-lg" style={{ fontFamily: 'var(--font-display)' }}>{cat.name}</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{cat.subjects.length} {t("Subjects", "Môn học")}</p>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <ul className="space-y-2 flex-1">
                {cat.subjects.map(sub => (
                  <li key={sub} className="text-sm font-medium text-[var(--color-text-muted)] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-faint)]"></div>
                    {sub}
                  </li>
                ))}
              </ul>
              <Link href={`/learning/subject/${cat.id}`} className="w-full mt-6 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] font-medium text-sm rounded-lg transition-colors border border-[var(--color-border)] block text-center">
                {t("View Details", "Xem chi tiết")}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
