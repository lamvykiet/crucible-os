"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, FileText, Search, Loader2, Folder, ChevronRight, LayoutGrid } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  thumbnailLink?: string;
}

interface Breadcrumb {
  id: string;
  name: string;
}

/** Nhãn ngắn cho ô góc thẻ: PDF, DOCX, SHEET... thay cho chữ "PDF" gán cứng. */
function fileKind(file: DriveFile): string {
  const google = /application\/vnd\.google-apps\.(\w+)/.exec(file.mimeType);
  if (google) return google[1].slice(0, 6);
  const ext = /\.([a-z0-9]+)$/i.exec(file.name);
  if (ext) return ext[1];
  return (file.mimeType.split("/").pop() || "file").slice(0, 6);
}

export default function DocumentsTab() {
  const { t } = useLanguage();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { id: "", name: t("Knowledge Hub", "Knowledge Hub") }
  ]);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  // Bản cũ gọi fetchFiles() trong effect nằm PHÍA TRÊN chỗ khai báo hàm, và
  // không huỷ request khi thư mục đổi — bấm nhanh qua vài thư mục thì phản hồi
  // về trễ của thư mục cũ có thể ghi đè lên danh sách đang hiển thị.
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = currentFolderId
          ? `/api/drive/list?folderId=${encodeURIComponent(currentFolderId)}`
          : "/api/drive/list";

        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to fetch files from Google Drive");
        }
        setFiles(data?.files || []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Lỗi không xác định");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [currentFolderId]);

  const handleFolderClick = (folderId: string, folderName: string) => {
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
    setSearch("");
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setSearch("");
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  
  const foldersList = filteredFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const documentsList = filteredFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="c-h2 flex items-center gap-3 text-[var(--color-text)]">
            <BookOpen className="text-[var(--color-primary)]" size={32} />
            {t("Documents Explorer", "Khám phá Tài liệu")}
          </h2>
          <p className="text-[var(--color-text-muted)] mt-1 text-sm">{t("Browse your Google Drive documents.", "Duyệt thư mục tài liệu từ Google Drive.")}</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 text-[var(--color-text-muted)]" size={18} />
          <input 
            type="text" 
            placeholder={t("Search files, folders...", "Tìm kiếm tài liệu, thư mục...")} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full pl-12 pr-4 py-2.5 focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto py-3 px-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm text-sm font-medium whitespace-nowrap">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.id || 'root'} className="flex items-center">
            <button 
              onClick={() => handleBreadcrumbClick(index)}
              className={`hover:text-[var(--color-primary)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--color-surface-2)] ${index === breadcrumbs.length - 1 ? 'text-[var(--color-text)] font-bold' : 'text-[var(--color-text-muted)]'}`}
            >
              {crumb.name}
            </button>
            {index < breadcrumbs.length - 1 && (
              <ChevronRight size={16} className="mx-1 opacity-40 text-[var(--color-text-muted)]" />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[var(--color-error-tint)] text-[var(--color-error)] p-4 rounded-xl flex items-center gap-3 text-sm">
          <BookOpen size={18} />
          <span><strong>{t("Connection Error:", "Lỗi kết nối:")}</strong> {error}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-[var(--color-text-faint)]">
          <Loader2 className="animate-spin mb-4 text-[var(--color-primary)]" size={48} />
          <p className="font-medium text-sm">{t("Syncing data...", "Đang đồng bộ dữ liệu...")}</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] border-dashed">
          <Folder className="mb-4 text-[var(--color-border-strong)] opacity-50" size={64} />
          <h3 className="c-h3 mb-2 text-[var(--color-text)]">{t("Empty Folder", "Thư mục trống")}</h3>
          <p className="text-[var(--color-text-muted)] text-sm">{t("No subfolders or documents found here.", "Chưa có thư mục con hoặc tài liệu nào ở đây.")}</p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* Folders Section */}
          {foldersList.length > 0 && (
            <div>
              <h3 className="c-h4 mb-4 flex items-center gap-2 text-[var(--color-text-muted)]">
                <LayoutGrid size={18} /> {t("Folders", "Thư mục")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {foldersList.map((folder) => (
                  <div 
                    key={folder.id} 
                    onClick={() => handleFolderClick(folder.id, folder.name)}
                    className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-[var(--color-primary)] hover:shadow-md hover:bg-[var(--color-surface-2)] transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-info-tint)] flex items-center justify-center flex-none group-hover:scale-105 transition-transform">
                      <Folder size={24} className="text-[var(--color-info)]" fill="currentColor" fillOpacity={0.2} />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="c-h4 text-[var(--color-text)] truncate">{folder.name}</h4>
                      <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{t("Drive Folder", "Thư mục Drive")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          {documentsList.length > 0 && (
            <div>
              <h3 className="c-h4 mb-4 flex items-center gap-2 text-[var(--color-text-muted)]">
                <FileText size={18} /> {t("Documents", "Tài liệu")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {documentsList.map((file) => (
                  <Link href={`/knowledge/${file.id}`} key={file.id} className="block group">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl h-full flex flex-col transition-all hover:-translate-y-1 hover:shadow-xl hover:border-[var(--color-accent)] overflow-hidden">
                      <div className="w-full aspect-[3/4] bg-[var(--color-surface-2)] relative overflow-hidden flex items-center justify-center border-b border-[var(--color-border)]">
                        {file.thumbnailLink ? (
                          <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <FileText size={48} className="text-[var(--color-border-strong)] opacity-30" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      
                      <div className="p-4 flex-1 flex flex-col">
                        <h4 className="c-h5 text-[var(--color-text)] line-clamp-2 leading-snug mb-3 group-hover:text-[var(--color-accent)] transition-colors">
                          {file.name.replace(/\.[a-z0-9]+$/i, "")}
                        </h4>
                        
                        <div className="mt-auto flex items-center justify-between text-[11px] text-[var(--color-text-faint)] font-medium">
                          <span className="bg-[var(--color-surface-2)] px-2 py-1 rounded uppercase tracking-wider">{fileKind(file)}</span>
                          <span>{new Date(file.modifiedTime).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          
        </div>
      )}
    </div>
  );
}
