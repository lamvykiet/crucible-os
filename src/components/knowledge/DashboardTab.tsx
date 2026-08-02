"use client";

import { useState, useEffect } from "react";
import { Folder, AlertTriangle, Lightbulb, BrainCircuit, Video, Zap, FileText, FileArchive, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface RecentDoc {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  isStale: boolean;
}

interface Summary {
  totalDocuments: number;
  staleDocuments: number;
  totalIdeas: number;
  staleIdeas: number;
  staleDays: number;
  driveError: string | null;
  recent: RecentDoc[];
}

const EMPTY_SUMMARY: Summary = {
  totalDocuments: 0, staleDocuments: 0, totalIdeas: 0, staleIdeas: 0,
  staleDays: 30, driveError: null, recent: [],
};

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
}

export default function DashboardTab({
  onNavigate,
}: {
  /** Chuyển sang tab khác của Knowledge Hub. */
  onNavigate?: (tab: string) => void;
}) {
  const { t } = useLanguage();

  const [ideaRequest, setIdeaRequest] = useState("");
  const [promptDirective, setPromptDirective] = useState("Generate a structured development plan with technical specifications.");

  const [isGenerating, setIsGenerating] = useState(false);
  const [blueprintResult, setBlueprintResult] = useState("");

  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoadingSummary(true);
      try {
        const res = await fetch("/api/knowledge/summary", { signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) setSummary({ ...EMPTY_SUMMARY, ...json.data });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setLoadingSummary(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const handleGenerateIdea = async () => {
    if (!ideaRequest) return;
    setIsGenerating(true);
    setBlueprintResult("");
    try {
      const res = await fetch("/api/ai/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: ideaRequest, directive: promptDirective })
      });
      const data = await res.json();
      if (data.reply) {
        setBlueprintResult(data.reply);
      } else {
        setBlueprintResult("Error: " + data.error);
      }
    } catch {
      setBlueprintResult("Error generating blueprint");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Widget tổng quan — số thật từ /api/knowledge/summary.
          Hai ô cũ "Thẻ Dữ Liệu" và "Bộ Nhớ Phản Hồi AI" đã bỏ: hệ thống không
          có bảng nào lưu hai thứ đó, nên mọi con số hiển thị đều là bịa. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t("Total Documents", "Tổng Tài Liệu")}</p>
              <h3 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                {loadingSummary ? <Loader2 size={24} className="animate-spin" /> : summary.totalDocuments}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-muted)]">
              <Folder size={18} />
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-text-faint)]">{t("Google Drive Synced", "Đồng bộ từ Google Drive")}</p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t("Stale Documents", "Tài Liệu Cũ")}</p>
              <h3 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                {loadingSummary ? <Loader2 size={24} className="animate-spin" /> : summary.staleDocuments}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--color-error-tint)] flex items-center justify-center text-[var(--color-error)]">
              <AlertTriangle size={18} />
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-text-faint)]">
            {t(`Untouched > ${summary.staleDays} days`, `Không đụng tới > ${summary.staleDays} ngày`)}
          </p>
        </div>

        <button
          onClick={() => onNavigate?.("ideas")}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm text-left hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t("Ideas", "Ý Tưởng")}</p>
              <h3 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                {loadingSummary ? <Loader2 size={24} className="animate-spin" /> : summary.totalIdeas}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--color-warning-tint)] flex items-center justify-center text-[var(--color-warning)]">
              <Lightbulb size={18} />
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-text-faint)]">
            {summary.staleIdeas > 0
              ? t(`${summary.staleIdeas} gone quiet`, `${summary.staleIdeas} đang bỏ trống`)
              : t("All active", "Đều đang hoạt động")}
          </p>
        </button>
      </div>

      {summary.driveError && (
        <div className="c-alert c-alert-warning">
          <AlertCircle size={18} className="icon" />
          <span>{t("Drive:", "Drive:")} {summary.driveError}</span>
        </div>
      )}

      {/* Middle Section: Video Downloader & Idea Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Thư viện Video
            Panel cũ ở đây là một ô nhập link + nút "Tải & Lưu Trữ" gọi
            /api/video/download — route đó trả kết quả giả và đã bị gỡ. App không
            tải video được trên Vercel free (không cài được yt-dlp, filesystem
            chỉ đọc, function có giới hạn thời gian). Việc tải giờ do shortcut
            iOS làm, app chỉ đọc lại thư mục Drive. Xem tab Video. */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[var(--color-info-tint)] rounded-lg flex items-center justify-center text-[var(--color-info)]">
              <Video size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{t("Video Library", "Thư viện Video")}</h3>
              <p className="text-[10px] text-[var(--color-text-muted)]">{t("Saved from your iOS Shortcut", "Lưu từ shortcut iOS của bạn")}</p>
            </div>
          </div>

          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed flex-1">
            {t(
              "Your Shortcut downloads the video on your phone and uploads it to Drive, sorted by type. This app reads that folder — it never downloads anything itself.",
              "Shortcut tải video ngay trên điện thoại rồi đẩy lên Drive theo đúng loại. App chỉ đọc lại thư mục đó, không tự tải gì cả."
            )}
          </p>

          {onNavigate && (
            <button
              onClick={() => onNavigate("videos")}
              className="c-btn c-btn-secondary w-full mt-4 flex items-center justify-center gap-2"
            >
              <Video size={16} /> {t("Open Video Library", "Mở thư viện Video")}
            </button>
          )}
        </div>

        {/* Idea Tracker */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-warning-tint)] rounded-lg flex items-center justify-center text-[var(--color-warning)]">
                <Lightbulb size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{t("Idea Tracker", "Quản Lý Ý Tưởng")}</h3>
                <p className="text-[10px] text-[var(--color-text-muted)]">{t("Generate blueprints using Gemini or Claude", "Tạo bản thiết kế dùng Gemini hoặc Claude")}</p>
              </div>
            </div>
            
            <div className="flex bg-[var(--color-surface-2)] rounded-full p-1">
              <button className="px-4 py-1.5 rounded-full text-[10px] font-bold bg-[#bfb4aa] text-white flex items-center gap-1 shadow-sm"><Zap size={10} /> Gemini</button>
              <button className="px-4 py-1.5 rounded-full text-[10px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1"><BrainCircuit size={10} /> Claude</button>
            </div>
          </div>
          
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="flex-1 flex flex-col">
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{t("User Idea / Feature Request", "Ý Tưởng / Yêu Cầu Tính Năng")}</label>
              <textarea 
                value={ideaRequest}
                onChange={(e) => setIdeaRequest(e.target.value)}
                placeholder="e.g. Build an AI-driven personal knowledge base..."
                className="w-full flex-1 min-h-[80px] bg-[var(--color-surface-2)] border-none rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all resize-none"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t("System Prompt Directive", "Mệnh Lệnh Hệ Thống")}</label>
                <div className="flex gap-2">
                  <button onClick={() => setPromptDirective("Generate a structured development plan with technical specifications.")} className="text-[9px] bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 rounded-md font-bold hover:bg-[var(--color-surface-2)]">Dev Plan</button>
                  <button onClick={() => setPromptDirective("Generate a detailed content outline with key talking points.")} className="text-[9px] bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 rounded-md font-bold hover:bg-[var(--color-surface-2)]">Content Outline</button>
                  <button onClick={() => setPromptDirective("Generate a database architecture schema for Prisma.")} className="text-[9px] bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 rounded-md font-bold hover:bg-[var(--color-surface-2)]">DB Architecture</button>
                </div>
              </div>
              <input 
                type="text" 
                value={promptDirective}
                onChange={(e) => setPromptDirective(e.target.value)}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm focus:outline-none transition-all shadow-sm"
              />
            </div>
            
            <button 
              onClick={handleGenerateIdea}
              disabled={isGenerating}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-on-primary)] rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors mt-2 shadow-sm"
            >
              {isGenerating ? <span className="animate-spin text-xl leading-none">⍥</span> : <BrainCircuit size={16} />} 
              {isGenerating ? t("Generating...", "Đang tạo...") : t("Generate Blueprint", "Tạo Bản Thiết Kế")}
            </button>
          </div>
        </div>
      </div>

      {blueprintResult && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden mt-6">
          <div className="bg-[var(--color-surface-2)] px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
            <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2"><Zap size={18} className="text-[var(--color-warning)]" /> Generated Blueprint</h3>
            <button onClick={() => setBlueprintResult("")} className="text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] text-sm font-bold px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">Close</button>
          </div>
          <div className="p-6 prose prose-sm max-w-none max-h-[500px] overflow-y-auto whitespace-pre-wrap text-sm text-[var(--color-text)] font-medium">
            {blueprintResult}
          </div>
        </div>
      )}

      {/* Recent Media & Documents */}
      <div>
        <div className="flex justify-between items-center mb-4 mt-8">
          <h3 className="text-xl font-bold flex items-center gap-2 text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            <Folder size={20} className="text-[var(--color-primary)]" />
            {t("Recent Media & Documents", "Tài Liệu & Truyền Thông Mới Nhất")}
          </h3>
          <span className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-[11px] font-bold px-3 py-1.5 rounded-full border border-[var(--color-border)]">
            {t(`Showing ${summary.recent.length}`, `Đang hiển thị ${summary.recent.length} mục`)}
          </span>
        </div>
        
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              {/* Cột "Thẻ" và "Lượt xem" đã bỏ: hệ thống không lưu thẻ hay số
                  lượt xem ở đâu cả, bản cũ chỉ điền sẵn "#System Spec", "12
                  lượt xem" cho hai dòng dữ liệu bịa. */}
              <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-6 py-4">{t("Document", "Tài liệu")}</th>
                  <th className="px-6 py-4">{t("Last modified", "Sửa lần cuối")}</th>
                  <th className="px-6 py-4 text-right">{t("Actions", "Hành Động")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {loadingSummary && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-[var(--color-text-muted)]">
                      <Loader2 size={20} className="animate-spin inline" />
                    </td>
                  </tr>
                )}

                {!loadingSummary && summary.recent.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-[var(--color-text-faint)] text-sm">
                      {t("No documents in the Drive folder yet.", "Chưa có tài liệu nào trong thư mục Drive.")}
                    </td>
                  </tr>
                )}

                {summary.recent.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-center flex-none">
                          {item.mimeType === "application/pdf"
                            ? <FileText size={20} className="text-[var(--color-text-faint)]" />
                            : <FileArchive size={20} className="text-[var(--color-text-faint)]" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--color-text)] mb-1 flex items-center gap-2 flex-wrap">
                            <span className="break-words">{item.name}</span>
                            {item.isStale && (
                              <span className="flex items-center gap-1 bg-[var(--color-error-tint)] text-[var(--color-error)] text-[9px] px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                <AlertTriangle size={10} /> {t(`STALE (>${summary.staleDays}D)`, `CŨ (>${summary.staleDays} NGÀY)`)}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-muted)] font-medium bg-[var(--color-surface-2)] inline-block px-2 py-0.5 rounded">
                            {item.mimeType} • {formatSize(item.sizeBytes)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
                      {item.modifiedTime
                        ? new Date(item.modifiedTime).toLocaleDateString("vi-VN")
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.webViewLink && (
                        <a
                          href={item.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="c-btn c-btn-secondary c-btn-sm inline-flex items-center gap-1.5"
                        >
                          {t("Open", "Mở")} <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
