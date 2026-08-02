"use client";

import { useState } from "react";
import { Brain, RotateCcw, Check, X, ThumbsUp } from "lucide-react";

export default function FlashcardPage() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);

  const cards = [
    { front: "Glassmorphism", back: "Một phong cách thiết kế giao diện người dùng đặc trưng bởi hiệu ứng nền mờ (frosted glass), ánh sáng, và độ trong suốt." },
    { front: "FSRS", back: "Free Spaced Repetition Scheduler - Thuật toán tính toán thời gian ôn tập thẻ ghi nhớ thế hệ mới." },
    { front: "Supabase", back: "Nền tảng mã nguồn mở cung cấp cơ sở dữ liệu PostgreSQL và Authentication (thay thế Firebase)." }
  ];

  const currentCard = cards[cardIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCardIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-3 mb-2" style={{fontFamily: 'var(--font-display)'}}>
          <Brain className="text-[var(--color-success)]" size={32} />
          Ôn Tập Hôm Nay
        </h1>
        <p className="c-card-body">Thẻ {cardIndex + 1} / {cards.length}</p>
      </div>

      {/* Flashcard Component */}
      <div 
        className="w-full h-80 perspective-1000 cursor-pointer" 
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? "rotate-y-180" : ""}`}>
          
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[32px] shadow-lg flex items-center justify-center p-8 text-center">
            <h2 className="text-4xl font-bold text-[var(--color-primary)]" style={{fontFamily: 'var(--font-display)'}}>
              {currentCard.front}
            </h2>
            <div className="absolute bottom-6 text-xs uppercase tracking-widest opacity-40 font-semibold">Bấm để lật</div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[32px] shadow-xl flex items-center justify-center p-10 text-center">
            <p className="text-xl leading-relaxed">
              {currentCard.back}
            </p>
          </div>

        </div>
      </div>

      {/* Actions (Only show when flipped) */}
      <div className={`flex items-center gap-4 mt-8 transition-opacity duration-300 ${isFlipped ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="flex flex-col items-center gap-2 text-[var(--color-error)] hover:opacity-80 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-[var(--color-error-tint)] flex items-center justify-center">
            <X size={24} />
          </div>
          <span className="text-xs font-semibold">Quên (1m)</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="flex flex-col items-center gap-2 text-[var(--color-warning)] hover:opacity-80 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-[var(--color-warning-tint)] flex items-center justify-center">
            <RotateCcw size={24} />
          </div>
          <span className="text-xs font-semibold">Khó (10m)</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="flex flex-col items-center gap-2 text-[var(--color-success)] hover:opacity-80 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-[var(--color-success-tint)] flex items-center justify-center">
            <Check size={24} />
          </div>
          <span className="text-xs font-semibold">Tốt (1d)</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="flex flex-col items-center gap-2 text-[var(--color-info)] hover:opacity-80 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-[var(--color-info-tint)] flex items-center justify-center">
            <ThumbsUp size={24} />
          </div>
          <span className="text-xs font-semibold">Dễ (4d)</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}} />
    </div>
  );
}
