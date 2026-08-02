"use client";

import { useState, useEffect } from "react";
import {
  Video, Loader2, AlertCircle, ExternalLink, Folder, Smartphone,
  ChevronDown, RotateCcw, Link as LinkIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Thư viện video — KHÔNG tải video.
 *
 * Bản cũ có ô dán link và nút "Tải Xuống Ngay" chỉ chạy setTimeout rồi báo
 * "Đã tải xong!" mà không gửi request nào. Việc tải thật không thể làm trong
 * app: hệ thống chạy trên Vercel free, nơi không cài được yt-dlp, filesystem
 * chỉ đọc và function có giới hạn thời gian.
 *
 * Luồng thật: shortcut trên iOS tải video và đẩy thẳng lên Google Drive, vào
 * thư mục con theo loại. Màn hình này đọc lại cây thư mục đó.
 */

interface VideoItem {
  id: string;
  name: string;
  sizeBytes: number | null;
  modifiedTime: string | null;
  sourceUrl: string | null;
  webViewLink: string | null;
  thumbnailLink: string | null;
  durationSec: number | null;
}

interface Category {
  id: string;
  name: string;
  webViewLink: string | null;
  videos: VideoItem[];
}

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function formatDuration(sec: number | null) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoDownloaderTab() {
  const { t } = useLanguage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      setNotConfigured(false);
      try {
        const res = await fetch("/api/video/library", { signal: controller.signal });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          if (json?.code === "NOT_CONFIGURED") setNotConfigured(true);
          throw new Error(json?.error || `Lỗi ${res.status}`);
        }
        setCategories(json.data.categories);
        setTotal(json.data.totalVideos);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-display)" }}>
            {t("Video Library", "Thư viện Video")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t(
              "Videos your iOS Shortcut saved to Drive, grouped by type.",
              "Video do shortcut iOS lưu lên Drive, gom theo loại."
            )}
            {total > 0 && ` · ${total} video`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGuide((v) => !v)} className="c-btn c-btn-secondary c-btn-sm flex items-center gap-2">
            <Smartphone size={16} />
            {t("Shortcut setup", "Cài shortcut")}
            <ChevronDown size={14} className={showGuide ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          <button onClick={() => setReloadKey((k) => k + 1)} className="c-btn c-btn-secondary c-btn-sm flex items-center gap-2">
            <RotateCcw size={16} /> {t("Refresh", "Tải lại")}
          </button>
        </div>
      </div>

      {/* Hướng dẫn dựng shortcut */}
      {showGuide && (
        <div className="c-card space-y-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-lg" style={{ fontFamily: "var(--font-display)" }}>
              {t("Set up the iOS Shortcut", "Dựng shortcut trên iOS")}
            </h3>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t(
              "The app never downloads videos — your phone does. Build a Shortcut with these steps:",
              "App không tải video, điện thoại của bạn tải. Dựng một Shortcut gồm các bước sau:"
            )}
          </p>
          <ol className="text-sm text-[var(--color-text)] space-y-2 list-decimal pl-5">
            <li>{t("Receive: URLs from the Share Sheet", "Nhận: URL từ Share Sheet")}</li>
            <li>{t("Get Contents of URL — fetch the video file", "Get Contents of URL — lấy file video về")}</li>
            <li>
              {t(
                'Choose from Menu: name the type (e.g. "Finance", "Marketing")',
                'Choose from Menu: chọn loại (vd "Tài chính", "Marketing")'
              )}
            </li>
            <li>
              {t(
                "Save File to Google Drive, into the subfolder matching that type",
                "Save File lên Google Drive, vào thư mục con đúng loại vừa chọn"
              )}
            </li>
            <li>
              {t(
                "Optional: put the original link in the file Description so it shows up here",
                "Không bắt buộc: ghi link gốc vào phần Description của file để hiện được ở đây"
              )}
            </li>
          </ol>
          <div className="c-alert c-alert-info">
            <AlertCircle size={18} className="icon" />
            <span>
              {t("Point GOOGLE_DRIVE_VIDEO_FOLDER_ID in .env at the parent folder.",
                 "Đặt GOOGLE_DRIVE_VIDEO_FOLDER_ID trong .env trỏ tới thư mục cha chứa các thư mục loại.")}
            </span>
          </div>
        </div>
      )}

      {/* Trạng thái */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading library...", "Đang tải thư viện...")}</span>
        </div>
      ) : notConfigured ? (
        <div className="c-alert c-alert-warning">
          <AlertCircle size={18} className="icon" />
          <div>
            <strong>{t("Not configured yet", "Chưa cấu hình")}</strong>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : error ? (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setReloadKey((k) => k + 1)} className="c-btn c-btn-tertiary c-btn-sm">
            {t("Retry", "Thử lại")}
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
            <Video size={32} />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--color-text)]">
              {t("No videos yet", "Chưa có video nào")}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm">
              {t(
                "Save one with your Shortcut, then hit Refresh.",
                "Lưu một video bằng shortcut rồi bấm Tải lại."
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {categories.map((cat) => (
            <section key={cat.id}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Folder size={18} className="text-[var(--color-warning)]" />
                  <h3 className="font-bold text-lg text-[var(--color-text)]">{cat.name}</h3>
                  <span className="c-chip text-[10px] py-1">{cat.videos.length}</span>
                </div>
                {cat.webViewLink && (
                  <a
                    href={cat.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="c-btn c-btn-tertiary c-btn-sm flex items-center gap-1.5"
                  >
                    {t("Open in Drive", "Mở trong Drive")} <ExternalLink size={14} />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.videos.map((v) => (
                  <div key={v.id} className="c-card flex flex-col gap-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center flex-none">
                        <Video size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-[var(--color-text)] break-words">{v.name}</p>
                        <p className="text-xs text-[var(--color-text-faint)] mt-1">
                          {[formatDuration(v.durationSec), formatSize(v.sizeBytes),
                            v.modifiedTime ? new Date(v.modifiedTime).toLocaleDateString("vi-VN") : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    {v.sourceUrl && (
                      <a
                        href={v.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-accent)] flex items-center gap-1.5 truncate hover:underline"
                        title={v.sourceUrl}
                      >
                        <LinkIcon size={12} className="flex-none" />
                        <span className="truncate">{v.sourceUrl}</span>
                      </a>
                    )}

                    {v.webViewLink && (
                      <a
                        href={v.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="c-btn c-btn-secondary c-btn-sm w-full flex items-center justify-center gap-1.5 mt-auto"
                      >
                        {t("Watch", "Xem")} <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
