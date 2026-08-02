"use client";

import { useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { useAiChat } from "@/lib/useAiChat";

export default function AIChatSidebar() {
  // Dùng chung hook với ThreePanelWorkspace. Trước đây mỗi nơi tự viết lại
  // logic gọi API, nên sửa một chỗ là quên chỗ còn lại.
  const { messages, input, setInput, loading, send } = useAiChat({
    greeting: "Chào bạn, tôi là Crucible AI. Bạn có câu hỏi gì về tài liệu này không?",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center">
          <Sparkles size={16} />
        </div>
        <div>
          <h3 className="font-bold text-[var(--color-text)]">AI Tutor</h3>
          {/* Trước đây ghi cứng "Gemini 1.5 Flash" — vừa sai model đang dùng,
              vừa phải sửa tay mỗi lần đổi. Model do server quyết định. */}
          <p className="text-xs text-[var(--color-text-muted)]">Crucible AI</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              msg.role === "user"
                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-tr-sm"
                : "bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-tl-sm"
            }`}>
              <div className="whitespace-pre-wrap">
                {msg.content}
                {loading && msg.role === "model" && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-current animate-pulse" />
                )}
              </div>
            </div>
          </div>
        ))}
        {/* Chỉ hiện spinner khi chưa có chữ nào chảy về; có rồi thì con trỏ
            nhấp nháy ở trên đã đủ báo hiệu. */}
        {loading && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface-2)] p-3 rounded-2xl rounded-tl-sm">
              <Loader2 className="animate-spin text-[var(--color-primary)]" size={16} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
        <form onSubmit={send} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi AI về tài liệu này..."
            disabled={loading}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Gửi"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-full disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} className="mr-[2px]" />}
          </button>
        </form>
        <p className="text-center text-[10px] text-[var(--color-text-faint)] mt-2">
          AI có thể mắc lỗi. Vui lòng kiểm tra lại thông tin.
        </p>
      </div>
    </div>
  );
}
