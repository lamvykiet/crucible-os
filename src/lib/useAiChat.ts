"use client";

import { useCallback, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

/**
 * Logic chat với /api/ai/chat, dùng chung cho mọi nơi có khung chat.
 *
 * Trước đây logic này bị copy-paste ở 3 chỗ (learning/subject/[id],
 * knowledge/[id], AIChatSidebar) với những khác biệt nhỏ, nên sửa một chỗ là
 * quên hai chỗ kia.
 *
 * Đọc phản hồi dạng stream để chữ hiện dần thay vì đứng im chờ cả câu trả lời.
 */
export function useAiChat(options: {
  greeting: string;
  getContext?: () => string;
}) {
  const { greeting, getContext } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "model", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || loading) return;

      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: text },
      ];
      setMessages(nextMessages);
      setInput("");
      setLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Chỗ giữ sẵn cho câu trả lời, để chữ chảy dần vào đây.
      setMessages([...nextMessages, { role: "model", content: "" }]);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            messages: nextMessages,
            contextText: getContext?.() ?? "",
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || `Lỗi ${res.status}`);
        }

        // Server chỉ stream khi client gửi Accept: text/event-stream, nhưng vẫn
        // xử lý được trường hợp trả về JSON một cục.
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/event-stream")) {
          const data = await res.json();
          setMessages([
            ...nextMessages,
            { role: "model", content: data.reply ?? "" },
          ]);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Không đọc được phản hồi");

        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          // Phần cuối có thể là một sự kiện chưa nhận đủ — giữ lại cho vòng sau.
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                answer += parsed.text;
                setMessages([
                  ...nextMessages,
                  { role: "model", content: answer },
                ]);
              }
            } catch (err) {
              if (err instanceof SyntaxError) continue; // gói tin lỗi, bỏ qua
              throw err;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Đã có lỗi xảy ra khi kết nối AI.";
        setMessages([
          ...nextMessages,
          { role: "model", content: `⚠️ ${message}` },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, getContext]
  );

  return { messages, input, setInput, loading, send };
}
