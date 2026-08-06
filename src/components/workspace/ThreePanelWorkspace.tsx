"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, Plus, FileText, Folder, Copy, ThumbsUp, ThumbsDown,
  Grid, MoreVertical, Send, Loader2, AlertCircle, BookOpen, Eye, X,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useAiChat } from "@/lib/useAiChat";
import StudioPanel from "./StudioPanel";

/**
 * Bố cục 3 cột dùng chung cho cả /knowledge/[id] và /learning/subject/[id].
 *
 * Hai trang đó trước đây là hai bản copy-paste gần 240 dòng giống nhau, khác
 * mỗi vài chi tiết. Hệ quả: bản trong knowledge có iframe PDF thật, còn bản
 * trong learning lại hiển thị "Trình xem PDF mô phỏng" — tức là chỉ có icon và
 * dòng chữ, không hề nhúng tài liệu. Gộp lại thành một component thì cả hai
 * trang tự khắc dùng chung đúng một hành vi.
 *
 * Màu lấy từ token thay vì hex cứng (#1e1e1e/#2a2a2a như bản cũ), nên khung này
 * đổi theo chế độ sáng/tối cùng phần còn lại của ứng dụng.
 */

interface DocContext {
  name: string;
  /** "text" = nội dung đã trích; "file" = tệp nằm trên Gemini Files API. */
  mode: "text" | "file" | null;
  text: string;
  chars: number;
  fileUri: string | null;
  fileMimeType: string | null;
  ready: boolean;
  reason: string | null;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Thư mục cha trong cây nguồn, ví dụ "CFA / 6. Fixed Income". */
  path?: string;
}

interface Props {
  title: string;
  onBack: () => void;
  /** Thư mục Drive để liệt kê nguồn. Bỏ trống thì dùng thư mục Knowledge mặc định. */
  folderId?: string;
  /** Tài liệu mở sẵn khi vào trang (dùng cho /knowledge/[id]). */
  initialDocumentId?: string | null;
  chatGreeting: string;
  /** Nội dung tuỳ biến cho Panel 3. */
  studio?: React.ReactNode;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

export default function ThreePanelWorkspace({
  title,
  onBack,
  folderId,
  initialDocumentId = null,
  chatGreeting,
  studio,
}: Props) {
  const { t } = useLanguage();

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // `activeDocument` là NGUỒN đang được chọn — nó ở lại kể cả khi đóng trình xem.
  // Bản cũ dùng chung một biến cho cả hai việc, nên bấm "Đóng tài liệu" là mất
  // luôn ngữ cảnh, đúng lúc người dùng muốn quay ra hỏi AI về tài liệu vừa đọc.
  const [activeDocument, setActiveDocument] = useState<string | null>(initialDocumentId);
  const [viewerOpen, setViewerOpen] = useState<boolean>(Boolean(initialDocumentId));

  // Trên điện thoại không thể xếp ba cột cạnh nhau (280 + 300 + nội dung > bề
  // ngang máy), nên hiện từng khung một và cho chuyển bằng thanh chọn.
  const [pane, setPane] = useState<"sources" | "work" | "studio">("work");

  // Nội dung tài liệu đã trích, để gửi kèm câu hỏi cho AI.
  const [docContext, setDocContext] = useState<DocContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Tên tài liệu mở sẵn qua URL: nó có thể nằm trong thư mục con, tức không có
  // trong danh sách nguồn của thư mục hiện tại. Bản cũ để tiêu đề trơ "Tài liệu".
  const [initialFileName, setInitialFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Danh sách nguồn lấy thật từ Google Drive. Bản cũ của trang learning hardcode
  // 7 tên file (2025_CFA_L1V6_FI.pdf, Reading 47...) không hề tồn tại.
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoadingFiles(true);
      setFilesError(null);
      try {
        // recursive=1: tài liệu thật nằm sâu vài cấp thư mục, và panel này vô
        // hiệu hoá thư mục — không phẳng ra thì người dùng không chạm được file.
        const url = folderId
          ? `/api/drive/list?recursive=1&folderId=${encodeURIComponent(folderId)}`
          : "/api/drive/list?recursive=1";
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Lỗi ${res.status}`);
        setFiles(data?.files || []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setFilesError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoadingFiles(false);
      }
    };

    load();
    return () => controller.abort();
  }, [folderId]);

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeDocument) || null,
    [files, activeDocument]
  );

  const activeName = activeFile?.name || docContext?.name || initialFileName || null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      if (folderId) body.append("folderId", folderId);

      const res = await fetch("/api/knowledge/upload", { method: "POST", body });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || `Lỗi ${res.status}`);

      setFiles((prev) => [json.file as DriveFile, ...prev]);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Trích nội dung tài liệu đang chọn. Kết quả được cache phía máy chủ nên đổi
  // qua đổi lại giữa các nguồn không gọi Gemini lại từ đầu.
  useEffect(() => {
    if (!activeDocument) {
      setDocContext(null);
      return;
    }

    const controller = new AbortController();
    setContextLoading(true);
    setDocContext(null);

    fetch("/api/knowledge/document-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: activeDocument }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (json?.name) setInitialFileName(json.name);
        setDocContext(
          json?.success
            ? {
                name: json.name,
                mode: json.mode ?? null,
                text: json.text || "",
                chars: json.chars || 0,
                fileUri: json.fileUri ?? null,
                fileMimeType: json.fileMimeType ?? null,
                ready: Boolean(json.ready),
                reason: json.reason ?? null,
              }
            : {
                name: "", mode: null, text: "", chars: 0, fileUri: null, fileMimeType: null,
                ready: false, reason: json?.error || "Không đọc được tài liệu",
              }
        );
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setDocContext({
          name: "", mode: null, text: "", chars: 0, fileUri: null, fileMimeType: null,
          ready: false, reason: err.message,
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setContextLoading(false);
      });

    return () => controller.abort();
  }, [activeDocument]);

  const { messages, input, setInput, loading, send } = useAiChat({
    greeting: chatGreeting,
    // Nội dung THẬT của tài liệu, không phải mỗi cái tên như bản cũ. Đây là dữ
    // liệu chứ không phải mệnh lệnh — phía server bọc nó trong
    // <document_context> và nói rõ điều đó với model.
    getContext: () => {
      if (!activeDocument) return "";
      const title = docContext?.name || activeFile?.name || "";
      if (docContext?.mode !== "text" || !docContext.text) {
        return title ? `Tài liệu đang mở: "${title}"` : "";
      }
      return `Tài liệu đang mở: "${title}"\n\n${docContext.text}`;
    },
    // PDF/ảnh không đi qua contextText mà tham chiếu thẳng tệp trên Gemini.
    getDocumentFile: () =>
      docContext?.mode === "file" && docContext.fileUri
        ? { fileUri: docContext.fileUri, mimeType: docContext.fileMimeType || "application/pdf" }
        : null,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.path ?? "").toLowerCase().includes(q)
    );
  }, [files, search]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-11rem)] md:h-[calc(100dvh-6rem)] gap-3 md:gap-4 animate-in fade-in -mx-2 md:-mx-4 -mt-2 md:-mt-4 bg-[var(--color-bg)] text-[var(--color-text)] rounded-2xl md:rounded-3xl p-2 md:p-4 overflow-hidden border border-[var(--color-border)] shadow-2xl">

      {/* Thanh chọn khung — chỉ có trên mobile */}
      <div className="md:hidden flex gap-1 bg-[var(--color-surface-2)] p-1 rounded-xl flex-none">
        {([
          ["sources", t("Sources", "Nguồn")],
          ["work", t("Workspace", "Làm việc")],
          ["studio", "Studio"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPane(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              pane === key
                ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>


      {/* Panel 1: Nguồn */}
      <div
        className={`w-full md:w-[280px] flex-col gap-4 flex-1 md:flex-none min-h-0 ${
          pane === "sources" ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="flex items-center gap-3 mb-2 px-2">
          <button
            onClick={onBack}
            aria-label={t("Go back", "Quay lại")}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-bold truncate tracking-tight">{title}</h2>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex-1 flex flex-col min-h-0 shadow-inner">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm tracking-wide uppercase">
              {t("Sources", "Nguồn")}
            </h3>
            <span className="text-[11px] font-bold text-[var(--color-text-faint)]">
              {files.length}
            </span>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2.5 bg-transparent border border-[var(--color-border-strong)] text-[var(--color-text-muted)] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mb-4 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-all disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {uploading ? t("Uploading...", "Đang tải lên...") : t("Add source", "Thêm nguồn")}
          </button>

          {uploadError && (
            <div className="mb-3 flex items-start gap-2 text-xs text-[var(--color-error)] p-2 rounded-lg bg-[var(--color-error-tint)]">
              <AlertCircle size={14} className="mt-0.5 flex-none" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Filter sources", "Lọc nguồn")}
              className="w-full bg-[var(--color-bg)] border border-transparent focus:border-[var(--color-border-strong)] rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none transition-all text-[var(--color-text)] placeholder-[var(--color-text-faint)]"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
            {loadingFiles && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] p-2">
                <Loader2 size={14} className="animate-spin" />
                {t("Loading sources...", "Đang tải nguồn...")}
              </div>
            )}

            {filesError && (
              <div className="flex items-start gap-2 text-xs text-[var(--color-error)] p-2 rounded-lg bg-[var(--color-error-tint)]">
                <AlertCircle size={14} className="mt-0.5 flex-none" />
                <span>{filesError}</span>
              </div>
            )}

            {!loadingFiles && !filesError && visibleFiles.length === 0 && (
              <p className="text-xs text-[var(--color-text-faint)] p-2">
                {search
                  ? t("No matching source.", "Không có nguồn nào khớp.")
                  : t("This folder is empty.", "Thư mục này trống.")}
              </p>
            )}

            {visibleFiles.map((file) => {
              const isFolder = file.mimeType === FOLDER_MIME;
              const isActive = activeDocument === file.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  disabled={isFolder}
                  onClick={() => {
                    if (isActive) {
                      setActiveDocument(null);
                      setViewerOpen(false);
                    } else {
                      setActiveDocument(file.id);
                      setViewerOpen(true);
                    }
                  }}
                  className={`w-full text-left flex items-center gap-2 text-xs p-2 rounded-lg transition-colors group ${
                    isFolder
                      ? "opacity-60 cursor-default"
                      : "hover:bg-[var(--color-surface-2)] cursor-pointer"
                  } ${isActive ? "bg-[var(--color-surface-2)] border border-[var(--color-accent)]" : "border border-transparent"}`}
                >
                  {isFolder ? (
                    <Folder size={14} className="text-[var(--color-warning)] flex-none" />
                  ) : (
                    <FileText size={14} className="text-[var(--color-error)] flex-none" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate font-medium ${isActive ? "font-bold" : "text-[var(--color-text-muted)]"}`}>
                      {file.name}
                    </span>
                    {file.path && (
                      <span className="block truncate text-[10px] text-[var(--color-text-faint)]">
                        {file.path}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel 2: Workspace */}
      <div
        className={`flex-1 min-w-0 min-h-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 md:p-6 flex-col shadow-inner relative overflow-hidden ${
          pane === "work" ? "flex" : "hidden md:flex"
        }`}
      >
        {activeDocument && viewerOpen ? (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-border)] pb-4">
              <button
                onClick={() => setViewerOpen(false)}
                aria-label={t("Close document", "Đóng tài liệu")}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors bg-[var(--color-surface-2)] p-1.5 rounded-lg"
              >
                <ArrowLeft size={16} />
              </button>
              <h3 className="font-bold tracking-wide truncate flex-1">
                {activeName || t("Document", "Tài liệu")}
              </h3>
              <button
                onClick={() => setViewerOpen(false)}
                className="text-xs bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 px-3 py-1.5 rounded-lg transition-opacity whitespace-nowrap"
              >
                {t("Chat about this", "Hỏi AI về tài liệu này")}
              </button>
            </div>
            {/* iframe thật, thay cho "Trình xem PDF mô phỏng" của bản cũ. */}
            <div className="flex-1 min-h-0 bg-[var(--color-bg)] rounded-xl overflow-hidden border border-[var(--color-border)]">
              <iframe
                src={`/api/drive/download?id=${encodeURIComponent(activeDocument)}#toolbar=0`}
                className="w-full h-full border-none"
                title={activeName || "Document viewer"}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 border-b border-[var(--color-border)] pb-4">
              <h3 className="font-bold tracking-wide">{t("Conversation", "Cuộc trò chuyện")}</h3>
              <div className="flex gap-4 text-[var(--color-text-muted)]">
                <button className="hover:text-[var(--color-text)] transition-colors"><Grid size={18} /></button>
                <button className="hover:text-[var(--color-text)] transition-colors"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* Trạng thái ngữ cảnh: nói thẳng AI đang thật sự cầm gì trong tay.
                Không có dòng này thì người dùng không cách nào phân biệt "AI đã
                đọc tài liệu" với "AI chỉ đoán từ tên file" — đúng hành vi cũ. */}
            {activeDocument && (
              <div className="mb-4 flex items-center gap-2 text-xs rounded-xl px-3 py-2 border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                {contextLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin flex-none text-[var(--color-info)]" />
                    <span className="text-[var(--color-text-muted)]">
                      {t("Reading the document...", "Đang đọc nội dung tài liệu...")}
                    </span>
                  </>
                ) : docContext?.ready ? (
                  <>
                    <BookOpen size={14} className="flex-none text-[var(--color-success)]" />
                    <span className="flex-1 truncate text-[var(--color-text)]">
                      {t("AI has read", "AI đã đọc")}{" "}
                      <strong className="font-semibold">{activeName}</strong>{" "}
                      <span className="text-[var(--color-text-faint)]">
                        {docContext.mode === "text"
                          ? `(${docContext.chars.toLocaleString("vi-VN")} ${t("characters", "ký tự")})`
                          : t("(full file)", "(toàn bộ tệp)")}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} className="flex-none text-[var(--color-warning)]" />
                    <span className="flex-1 truncate text-[var(--color-text-muted)]">
                      {docContext?.reason || t("Content unavailable", "Chưa đọc được nội dung")}
                    </span>
                  </>
                )}

                <button
                  onClick={() => setViewerOpen(true)}
                  title={t("Open viewer", "Mở trình xem")}
                  className="flex-none text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => setActiveDocument(null)}
                  title={t("Remove from context", "Bỏ khỏi ngữ cảnh")}
                  className="flex-none text-[var(--color-text-muted)] hover:text-[var(--color-error)] p-1 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-6 pr-4 min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed border shadow-sm ${
                      msg.role === "user"
                        ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-on-primary)] rounded-tr-sm"
                        : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text)] rounded-tl-sm"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">
                      {msg.content}
                      {/* Con trỏ nhấp nháy trong lúc chữ đang chảy về */}
                      {loading && msg.role === "model" && i === messages.length - 1 && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-current animate-pulse" />
                      )}
                    </div>
                    {msg.role === "model" && msg.content && (
                      <div className="flex gap-1 mt-4 ml-auto justify-end text-[var(--color-text-muted)]">
                        <button
                          onClick={() => navigator.clipboard?.writeText(msg.content)}
                          aria-label={t("Copy", "Sao chép")}
                          className="hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)] p-1.5 rounded-lg transition-colors"
                        >
                          <Copy size={14} />
                        </button>
                        <button className="hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)] p-1.5 rounded-lg transition-colors"><ThumbsUp size={14} /></button>
                        <button className="hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)] p-1.5 rounded-lg transition-colors"><ThumbsDown size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={send} className="relative mt-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("Ask anything...", "Bắt đầu nhập lệnh...")}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border-strong)] focus:border-[var(--color-accent)] rounded-full pl-6 pr-32 py-4 text-sm focus:outline-none transition-all text-[var(--color-text)] placeholder-[var(--color-text-faint)] shadow-inner"
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <span className="text-[11px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-1 rounded-md">
                  {files.length} {t("sources", "nguồn")}
                </span>
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label={t("Send", "Gửi")}
                  className="bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 disabled:opacity-50 p-2.5 rounded-full transition-opacity shadow-md"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Panel 3: Studio */}
      <div
        className={`w-full md:w-[300px] flex-1 md:flex-none flex-col gap-4 min-h-0 ${
          pane === "studio" ? "flex" : "hidden md:flex"
        }`}
      >
        {studio ?? <StudioPanel fileId={activeDocument} fileName={activeName} />}
      </div>
    </div>
  );
}
