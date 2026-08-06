"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Video, Loader2, AlertCircle, ExternalLink, Smartphone, ChevronDown,
  RotateCcw, Link as LinkIcon, Plus, Trash2, Clock, CheckCircle2, Copy,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface VideoItem {
  id: string;
  sourceUrl: string;
  platform: string;
  topic: string;
  title: string | null;
  status: string;
  driveFileId: string | null;
  driveFileName: string | null;
  sizeBytes: number | null;
  createdAt: string;
  savedAt: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube",
  instagram: "Instagram", other: "Khác",
};

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

/**
 * Thư viện video — dán link, chọn đề tài; điện thoại tải và đẩy file lên.
 *
 * Ứng dụng không tự tải video: nó chạy trên Vercel, nơi hệ thống file chỉ đọc,
 * function giới hạn 60 giây và không cài được yt-dlp. Bản đầu tiên của màn hình
 * này có nút "Tải Xuống Ngay" chỉ chạy `setTimeout` rồi báo "Đã tải xong!" mà
 * không gửi một request nào — nó giả từ đầu tới cuối.
 *
 * Việc app làm thật: giữ link gốc, nền tảng và đề tài — ba thứ Drive không giữ
 * được, và là thứ khiến video lưu nửa năm trước vẫn tra lại được.
 */
export default function VideoDownloaderTab() {
  const { t } = useLanguage();

  const [items, setItems] = useState<VideoItem[]>([]);
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showGuide, setShowGuide] = useState(false);

  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/video/queue", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json?.success) throw new Error(json?.error || "Không tải được thư viện");
        setItems(json.items);
        setTopics(json.topics);
        setConfigured(json.configured);
        setTopic((cur) => cur || json.topics[0]?.name || "");
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !topic || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/video/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url.trim(), topic, title: title.trim() }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không lưu được");

      setUrl("");
      setTitle("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/video/queue?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  const pending = items.filter((i) => i.status === "pending");
  const saved = items.filter((i) => i.status === "saved");

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-display)" }}>
            {t("Video Library", "Thư viện Video")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("Paste a link, pick a topic — your Shortcut brings the file in.",
               "Dán link, chọn đề tài — Shortcut trên điện thoại mang file về.")}
            {saved.length > 0 && ` · ${saved.length} video`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGuide((v) => !v)} className="c-btn c-btn-secondary c-btn-sm flex items-center gap-2">
            <Smartphone size={16} />
            {t("Shortcut setup", "Cài Shortcut")}
            <ChevronDown size={14} className={showGuide ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          <button onClick={reload} className="c-btn c-btn-secondary c-btn-sm flex items-center gap-2">
            <RotateCcw size={16} /> {t("Refresh", "Tải lại")}
          </button>
        </div>
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {!configured && (
        <div className="c-alert c-alert-warning">
          <AlertCircle size={18} className="icon" />
          <span>{t("GOOGLE_DRIVE_VIDEO_FOLDER_ID is not set.", "Chưa đặt GOOGLE_DRIVE_VIDEO_FOLDER_ID trong biến môi trường.")}</span>
        </div>
      )}

      {/* Dán link */}
      <form onSubmit={add} className="c-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] flex items-center justify-center flex-none">
            <LinkIcon size={20} />
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-text)]">{t("Save a video", "Lưu một video")}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t("TikTok, Facebook Reel, YouTube, Instagram", "TikTok, Facebook Reel, YouTube, Instagram")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
          <div className="c-field">
            <label htmlFor="video-url">{t("Link", "Link video")}</label>
            <input
              id="video-url"
              className="c-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/..."
              inputMode="url"
              required
            />
          </div>
          <div className="c-field">
            <label htmlFor="video-topic">{t("Topic", "Đề tài")}</label>
            <select id="video-topic" className="c-input" value={topic} onChange={(e) => setTopic(e.target.value)}>
              {topics.map((tp) => (
                <option key={tp.id} value={tp.name}>{tp.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="c-field">
          <label htmlFor="video-title">{t("Title (optional)", "Tiêu đề (không bắt buộc)")}</label>
          <input
            id="video-title"
            className="c-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("e.g. 5 Excel shortcuts", "Vd: 5 phím tắt Excel")}
          />
        </div>

        <button type="submit" disabled={!url.trim() || !topic || saving} className="c-btn c-btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {t("Add to library", "Thêm vào thư viện")}
        </button>
      </form>

      {showGuide && (
        <div className="c-card space-y-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-lg" style={{ fontFamily: "var(--font-display)" }}>
              {t("How it works", "Cách hoạt động")}
            </h3>
          </div>
          <ol className="text-sm text-[var(--color-text)] space-y-2 list-decimal pl-5">
            <li>{t("Paste the link here and pick a topic.", "Dán link ở trên và chọn đề tài.")}</li>
            <li>{t("Share the same link to the Crucible Shortcut from the TikTok/Facebook app.",
                   "Từ app TikTok/Facebook, bấm Chia sẻ → chọn Shortcut \"Crucible\".")}</li>
            <li>{t("The Shortcut downloads it and uploads straight to Drive — nothing is kept on the phone.",
                   "Shortcut tải video rồi đẩy thẳng lên Drive — không lưu gì lại trên máy.")}</li>
            <li>{t("The entry below flips to Saved.", "Mục bên dưới chuyển sang trạng thái Đã lưu.")}</li>
          </ol>
          <div className="c-alert c-alert-info">
            <AlertCircle size={18} className="icon" />
            <span>
              {t("The app itself never downloads video — Vercel has a read-only filesystem and a 60s limit.",
                 "Bản thân app không tải video: Vercel có hệ thống file chỉ đọc và giới hạn 60 giây mỗi request.")}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="font-bold text-sm">{t("Loading...", "Đang tải...")}</span>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h3 className="font-bold text-[var(--color-text)] mb-1 flex items-center gap-2">
                <Clock size={16} className="text-[var(--color-warning)]" />
                {t("Waiting for the file", "Chờ file về")} ({pending.length})
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                {t("Share these links to the Shortcut on your phone.",
                   "Chia sẻ những link này sang Shortcut trên điện thoại.")}
              </p>
              <div className="space-y-2">
                {pending.map((item) => (
                  <VideoRow key={item.id} item={item} onDelete={remove} t={t} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[var(--color-success)]" />
              {t("Saved", "Đã lưu")} ({saved.length})
            </h3>
            {saved.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
                  <Video size={26} />
                </div>
                <p className="text-sm text-[var(--color-text-muted)] max-w-sm">
                  {t("Nothing saved yet. Paste a link above to start.",
                     "Chưa có video nào. Dán một link ở trên để bắt đầu.")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {saved.map((item) => (
                  <VideoRow key={item.id} item={item} onDelete={remove} t={t} card />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function VideoRow({
  item, onDelete, t, card,
}: {
  item: VideoItem;
  onDelete: (id: string) => void;
  t: (en: string, vi: string) => string;
  card?: boolean;
}) {
  return (
    <div className={`${card ? "c-card flex flex-col gap-3" : "flex items-center gap-3 bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-border)]"}`}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center flex-none">
          <Video size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-[var(--color-text)] break-words">
            {item.title || item.driveFileName || t("Untitled", "Chưa đặt tên")}
          </p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
            {[PLATFORM_LABEL[item.platform] ?? item.platform, item.topic, formatSize(item.sizeBytes)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          onClick={() => onDelete(item.id)}
          aria-label={t("Remove", "Xoá")}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] flex-none p-1"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 truncate max-w-[220px]"
          title={item.sourceUrl}
        >
          <LinkIcon size={12} className="flex-none" /> <span className="truncate">{item.sourceUrl}</span>
        </a>
        <button
          onClick={() => navigator.clipboard?.writeText(item.sourceUrl)}
          title={t("Copy link", "Sao chép link")}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
        >
          <Copy size={12} />
        </button>
        {item.driveFileId && (
          <a
            href={`https://drive.google.com/file/d/${item.driveFileId}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="c-btn c-btn-secondary c-btn-sm ml-auto flex items-center gap-1.5"
          >
            {t("Watch", "Xem")} <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
