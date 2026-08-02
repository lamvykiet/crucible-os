"use client";

import { useState } from "react";
import { BookOpen, Search, Plus, Filter, Tag as TagIcon } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export default function DictionaryTab() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Dummy data
  const dictionaryItems = [
    { 
      id: 1, 
      term: "Glassmorphism", 
      phonetic: "/ˈɡlæsˌmɔːrfɪzəm/", 
      def: t("(n) A UI design style characterized by frosted glass effects, lighting, and transparency.", "(n) Một phong cách thiết kế giao diện người dùng đặc trưng bởi hiệu ứng nền mờ (frosted glass), ánh sáng, và độ trong suốt."), 
      domain: "Design", 
      tags: ["UI/UX", "Trend", "CSS"],
      example: "The new UI heavily uses glassmorphism." 
    },
    { 
      id: 2, 
      term: "Supabase", 
      phonetic: "/ˈsuːpəbeɪs/", 
      def: t("(n) An open source Firebase alternative providing PostgreSQL and Authentication.", "(n) Một nền tảng mã nguồn mở thay thế Firebase, cung cấp cơ sở dữ liệu PostgreSQL và Authentication."), 
      domain: "Tech", 
      tags: ["Backend", "Database", "BaaS"],
      example: "We use Supabase for our backend." 
    },
    { 
      id: 3, 
      term: "FSRS", 
      phonetic: "/ɛf-ɛs-ɑr-ɛs/", 
      def: t("(n) Free Spaced Repetition Scheduler - A modern algorithm for flashcard scheduling replacing Anki SM-2.", "(n) Free Spaced Repetition Scheduler - Thuật toán tính toán thời gian ôn tập thẻ ghi nhớ thế hệ mới thay thế Anki SM-2."), 
      domain: "Learning", 
      tags: ["Algorithm", "Memory"],
      example: "FSRS algorithm optimizes flashcard review times." 
    },
    {
      id: 4,
      term: "EBITDA",
      phonetic: "/ɪˈbɪtdɑː/",
      def: t("(n) Earnings Before Interest, Taxes, Depreciation, and Amortization. A measure of a company's overall financial performance.", "(n) Thu nhập trước lãi vay, thuế, khấu hao. Thước đo hiệu quả tài chính tổng thể của một công ty."),
      domain: "Finance",
      tags: ["Accounting", "Metric", "CFA"],
      example: "The company reported a strong EBITDA for Q3."
    }
  ];

  const allTags = Array.from(new Set(dictionaryItems.flatMap(item => item.tags)));

  const filteredItems = dictionaryItems.filter(item => {
    const matchesSearch = item.term.toLowerCase().includes(search.toLowerCase()) || 
                          item.def.toLowerCase().includes(search.toLowerCase());
    const matchesTag = selectedTag ? item.tags.includes(selectedTag) : true;
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{fontFamily: 'var(--font-display)'}}>
            {t("Dictionary", "Từ Điển")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("Store vocabulary, terminology, and cross-reference with tags.", "Lưu trữ từ vựng, thuật ngữ và liên kết chéo qua các tag.")}
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={18} />
            <input 
              type="text" 
              placeholder={t("Search terms...", "Tìm kiếm từ...")} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="c-input w-full pl-10 rounded-full"
            />
          </div>
          <button className="c-btn bg-[#66c2c2] hover:bg-[var(--color-success)] text-white rounded-full flex-none font-bold shadow-sm">
            <Plus size={18} className="mr-2" /> {t("Add Term", "Thêm từ")}
          </button>
        </div>
      </div>

      {/* Tags Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Filter size={16} className="text-[var(--color-text-faint)] flex-none" />
        <button 
          onClick={() => setSelectedTag(null)}
          className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedTag === null ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'}`}
        >
          {t("All Tags", "Tất cả")}
        </button>
        {allTags.map(tag => (
          <button 
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedTag === tag ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'}`}
          >
            # {tag}
          </button>
        ))}
      </div>

      {/* Dictionary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-[var(--color-primary)]" style={{fontFamily: 'var(--font-display)'}}>{item.term}</h3>
                <span className="text-[10px] py-1 px-2 rounded-full bg-[var(--color-success-tint)] text-[var(--color-success)] font-bold tracking-wider uppercase border border-[var(--color-success)]">{item.domain}</span>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-faint)] mb-4">{item.phonetic}</p>
              <p className="text-[var(--color-text-muted)] text-sm mb-4 leading-relaxed">{item.def}</p>
            </div>
            
            <div className="mt-auto space-y-4">
              {item.example && (
                <div className="bg-[var(--color-surface-2)] p-3 rounded-xl border-l-2 border-[var(--color-success)]">
                  <p className="text-xs italic text-[var(--color-text-muted)]">&ldquo;{item.example}&rdquo;</p>
                </div>
              )}
              
              {/* Tags display */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--color-border)]">
                {item.tags.map(tag => (
                  <span key={tag} className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer hover:bg-[var(--color-surface-3)] transition-colors" onClick={() => setSelectedTag(tag)}>
                    <TagIcon size={10} /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
        
        {filteredItems.length === 0 && (
          <div className="col-span-full py-12 text-center text-[var(--color-text-faint)]">
            {t("No terms found matching your search criteria.", "Không tìm thấy từ vựng phù hợp.")}
          </div>
        )}
      </div>
    </div>
  );
}
