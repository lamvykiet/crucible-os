"use client";

import { useState } from "react";
import { BookOpen, Search, Plus, ExternalLink } from "lucide-react";

export default function DictionaryPage() {
  const [search, setSearch] = useState("");
  
  // Dummy data for now, since we haven't built the CRUD APIs yet
  const dictionaryItems = [
    { id: 1, term: "Glassmorphism", phonetic: "/ˈɡlæsˌmɔːrfɪzəm/", def: "(n) Một phong cách thiết kế giao diện người dùng đặc trưng bởi hiệu ứng nền mờ (frosted glass), ánh sáng, và độ trong suốt.", domain: "Design", example: "The new UI heavily uses glassmorphism." },
    { id: 2, term: "Supabase", phonetic: "/ˈsuːpəbeɪs/", def: "(n) Một nền tảng mã nguồn mở thay thế Firebase, cung cấp cơ sở dữ liệu PostgreSQL và Authentication.", domain: "Tech", example: "We use Supabase for our backend." },
    { id: 3, term: "FSRS", phonetic: "/ɛf-ɛs-ɑr-ɛs/", def: "(n) Free Spaced Repetition Scheduler - Thuật toán tính toán thời gian ôn tập thẻ ghi nhớ thế hệ mới thay thế Anki SM-2.", domain: "Learning", example: "FSRS algorithm optimizes flashcard review times." },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{fontFamily: 'var(--font-display)'}}>
            <BookOpen className="text-[var(--color-primary)]" size={32} />
            Từ Điển Cá Nhân
          </h1>
          <p className="c-card-body mt-1">Lưu trữ từ vựng và thuật ngữ chuyên ngành.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm từ..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="c-input w-full pl-10 rounded-full"
            />
          </div>
          <button className="c-btn c-btn-primary c-btn-pill flex-none">
            <Plus size={18} /> Thêm từ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dictionaryItems.map(item => (
          <div key={item.id} className="c-card flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-[var(--color-primary)]" style={{fontFamily: 'var(--font-display)'}}>{item.term}</h3>
                <span className="c-chip c-chip-outline text-[10px] py-1">{item.domain}</span>
              </div>
              <p className="text-sm font-medium opacity-60 mb-3">{item.phonetic}</p>
              <p className="text-[var(--color-text-muted)] text-sm mb-4 leading-relaxed">{item.def}</p>
            </div>
            {item.example && (
              <div className="bg-[var(--color-surface-2)]/50 p-3 rounded-lg border-l-2 border-[var(--color-accent)] mt-auto">
                <p className="text-xs italic opacity-80">&ldquo;{item.example}&rdquo;</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
