"use client";

import { useState, useEffect } from "react";
import {
  Info, Loader2, CheckCircle2, XCircle, ExternalLink, Folder, Sparkles, Copy, Check,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface FolderStatus {
  env: string;
  label: string;
  required: boolean;
  id: string | null;
  name: string | null;
  webViewLink?: string | null;
  reachable: boolean;
  error: string | null;
}

/**
 * Trạng thái liên kết Google Drive.
 *
 * Bản cũ là hai ô nhập "ID thư mục" cùng nút "Lưu Cài đặt" không có `onClick`.
 * Kể cả có handler cũng vô nghĩa: các ID này nằm trong biến môi trường, đọc lúc
 * tiến trình khởi động — không thể sửa từ trình duyệt. Thay vì một biểu mẫu giả
 * vờ lưu được, màn hình này nói thật đang cấu hình gì và có đọc được không.
 */
export default function KnowledgeSettings() {
  const { t } = useLanguage();

  const [folders, setFolders] = useState<FolderStatus[]>([]);
  const [gemini, setGemini] = useState<{ configured: boolean; model: string; visionModel: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/knowledge/config", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setFolders(json.folders);
        setGemini(json.gemini);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl">
      <div>
        <h2
          className="text-2xl font-bold text-[var(--color-text)] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("Drive & AI connection", "Kết nối Drive & AI")}
        </h2>
        <p className="text-[var(--color-text-muted)] text-sm">
          {t(
            "Read-only status of what the server is configured with.",
            "Bảng trạng thái chỉ đọc, cho biết máy chủ đang được cấu hình những gì."
          )}
        </p>
      </div>

      <div className="bg-[var(--color-info-tint)] border-l-4 border-[var(--color-info)] p-4 rounded-r-lg text-sm">
        <h4 className="font-bold flex items-center gap-2 mb-1 text-[var(--color-info)]">
          <Info size={16} /> {t("How to change these", "Muốn đổi thì làm ở đâu")}
        </h4>
        <p className="text-[var(--color-text)]">
          {t(
            "These IDs live in environment variables, read when the server starts. Change them in .env for local runs, and in the Vercel project settings for production, then redeploy.",
            "Các ID này nằm trong biến môi trường, đọc lúc máy chủ khởi động. Sửa trong .env khi chạy máy nhà, và trong phần cấu hình dự án trên Vercel cho bản chạy thật, rồi deploy lại."
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-[var(--color-info)]">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-sm divide-y divide-[var(--color-border)]">
            {folders.map((f) => (
              <div key={f.env} className="p-5 flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${
                    f.reachable
                      ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                      : f.required
                        ? "bg-[var(--color-error-tint)] text-[var(--color-error)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]"
                  }`}
                >
                  <Folder size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-[var(--color-text)]">{f.label}</h3>
                    {f.reachable ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-success)]">
                        <CheckCircle2 size={12} /> {t("Connected", "Đã kết nối")}
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                          f.required ? "text-[var(--color-error)]" : "text-[var(--color-text-faint)]"
                        }`}
                      >
                        <XCircle size={12} /> {f.error}
                      </span>
                    )}
                  </div>

                  {f.name && <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{f.name}</p>}

                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-[11px] bg-[var(--color-surface-2)] px-2 py-1 rounded font-mono text-[var(--color-text-muted)]">
                      {f.env}
                    </code>
                    {f.id && (
                      <button
                        onClick={() => copy(f.id!)}
                        title={t("Copy folder ID", "Sao chép ID thư mục")}
                        className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                      >
                        {copied === f.id ? (
                          <Check size={13} className="text-[var(--color-success)]" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    )}
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                        title={t("Open in Drive", "Mở trong Drive")}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {gemini && (
            <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-sm p-5 flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none ${
                  gemini.configured
                    ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                    : "bg-[var(--color-error-tint)] text-[var(--color-error)]"
                }`}
              >
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-[var(--color-text)]">Gemini API</h3>
                  {gemini.configured ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-success)]">
                      <CheckCircle2 size={12} /> {t("Key present", "Đã có khoá")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-error)]">
                      <XCircle size={12} /> {t("GEMINI_API_KEY missing", "Thiếu GEMINI_API_KEY")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {t("Chat & Studio:", "Chat & Studio:")} <code className="font-mono">{gemini.model}</code>
                  {" · "}
                  {t("OCR & documents:", "OCR & tài liệu:")}{" "}
                  <code className="font-mono">{gemini.visionModel}</code>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
