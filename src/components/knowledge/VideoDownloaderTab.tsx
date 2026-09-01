"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Video, Loader2, AlertCircle, ExternalLink, Smartphone, ChevronDown,
  RotateCcw, Link as LinkIcon, Plus, Trash2, Clock, CheckCircle2, Copy,
  CloudDownload, Folder, FolderOpen, ArrowLeft, Play, X, Tag, Check,
  ClipboardPaste,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface VideoItem {
  id: string;
  sourceUrl: string;
  platform: string;
  topic: string;
  subTopic: string | null;
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

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function detectPlatform(url: string) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("facebook.com") || host === "fb.watch" || host.includes("fb.com")) return "facebook";
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  if (host.includes("instagram.com")) return "instagram";
  return "other";
}

/** Nhãn cho ô lọc của những video chưa gắn nhãn con. */
const UNTAGGED = "__untagged__";

/**
 * Thư viện video — dán link, chọn đề tài; điện thoại tải và đẩy file lên.
 *
 * Ứng dụng không tự tải video: nó chạy trên Vercel, nơi hệ thống file chỉ đọc,
 * function giới hạn 60 giây và không cài được yt-dlp. Bản đầu tiên của màn hình
 * này có nút "Tải Xuống Ngay" chỉ chạy `setTimeout` rồi báo "Đã tải xong!" mà
 * không gửi một request nào — nó giả từ đầu tới cuối.
 *
 * Việc app làm thật: giữ link gốc, nền tảng, đề tài và nhãn con — bốn thứ Drive
 * không giữ được, và là thứ khiến video lưu nửa năm trước vẫn tra lại được.
 *
 * Hai quyết định về bố cục, để lần sau đừng "dọn" ngược lại:
 *
 * - Ô link **co lại và đổi thành một thẻ gọn** ngay khi link hợp lệ. Người dùng
 *   dán link chứ không đọc nó; hiện đủ 180 ký tự URL TikTok chỉ tổ ăn hết một
 *   hàng mà không nói thêm được gì ngoài "đã dán rồi".
 * - Video phát **ngay tại đây** qua `/api/video/stream`, không mở tab Drive.
 *   Xem chú thích trong route đó về lý do không trỏ thẳng `<video src>` vào Drive.
 */
export default function VideoDownloaderTab() {
  const { t } = useLanguage();

  const [items, setItems] = useState<VideoItem[]>([]);
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [subTopics, setSubTopics] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showGuide, setShowGuide] = useState(false);

  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [subTopic, setSubTopic] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  // Id đang được server tải; đủ để vô hiệu hoá đúng một dòng thay vì cả danh sách.
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [playing, setPlaying] = useState<VideoItem | null>(null);

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
        setSubTopics(json.subTopics ?? {});
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
        body: JSON.stringify({
          sourceUrl: url.trim(), topic, subTopic: subTopic.trim(), title: title.trim(),
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không lưu được");

      setUrl("");
      setTitle("");
      // Nhãn con giữ nguyên: lưu video thường đi thành cụm cùng một nhãn.
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

  /** Gắn hoặc đổi nhãn con cho một video đã lưu. */
  const retag = async (id: string, value: string) => {
    const trimmed = value.trim();
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, subTopic: trimmed || null } : i))
    );
    try {
      const res = await fetch("/api/video/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, subTopic: trimmed }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không lưu được nhãn");
      // Nhãn mới phải vào danh sách gợi ý ngay, nếu không video kế tiếp lại
      // phải gõ tay đúng chuỗi đó.
      setItems((prev) => prev.map((i) => (i.id === json.item.id ? { ...i, ...json.item } : i)));
      const saved = json.item as VideoItem;
      if (saved.subTopic) {
        setSubTopics((prev) => {
          const list = prev[saved.topic] ?? [];
          if (list.includes(saved.subTopic!)) return prev;
          return { ...prev, [saved.topic]: [...list, saved.subTopic!].sort() };
        });
      }
    } catch (err) {
      setError((err as Error).message);
      reload();
    }
  };

  /**
   * Bảo server tải video về Drive luôn — không cần điện thoại, không cần
   * Shortcut. Video quá lớn hoặc mạng chậm có thể chạm trần 60 giây của
   * Vercel; lúc đó lỗi hiện ngay ở dòng đó và vẫn còn đường Shortcut.
   */
  const fetchNow = async (id: string) => {
    setFetchingId(id);
    setFetchError(null);
    try {
      const res = await fetch("/api/video/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Lỗi ${res.status}`);
      reload();
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setFetchingId(null);
    }
  };

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const saved = useMemo(() => items.filter((i) => i.status === "saved"), [items]);

  /** Thư mục = đề tài, dựng từ chính video đã lưu chứ không từ cây Drive. */
  const folders = useMemo(() => {
    const map = new Map<string, VideoItem[]>();
    for (const item of saved) {
      const list = map.get(item.topic);
      if (list) list.push(item);
      else map.set(item.topic, [item]);
    }
    return [...map.entries()]
      .map(([name, videos]) => ({
        name,
        videos,
        tags: [...new Set(videos.map((v) => v.subTopic).filter((s): s is string => Boolean(s)))].sort(
          (a, b) => a.localeCompare(b, "vi")
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [saved]);

  // Xoá video cuối cùng trong một thư mục làm thư mục đó biến mất; `current`
  // thành null và giao diện tự lùi về danh sách thư mục, không cần effect nào
  // đi dọn `openFolder` — và `subFilter` được đặt lại ở mỗi lần mở thư mục.
  const current = openFolder ? folders.find((f) => f.name === openFolder) ?? null : null;

  const visible = useMemo(() => {
    if (!current) return [];
    if (subFilter === null) return current.videos;
    if (subFilter === UNTAGGED) return current.videos.filter((v) => !v.subTopic);
    return current.videos.filter((v) => v.subTopic === subFilter);
  }, [current, subFilter]);

  const urlOk = isValidHttpUrl(url.trim());
  const suggestions = subTopics[topic] ?? [];

  const pasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setUrl(text.trim());
    } catch {
      // Trình duyệt từ chối đọc clipboard — người dùng vẫn dán tay được.
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="c-h2 text-[var(--color-text)]">
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

      {/* Dán link.
          Bố cục cố tình chỉ còn hai hàng. Bản trước có nhãn viết hoa trên mỗi ô
          (LINK / TOPIC / SUB-TOPIC / TITLE); bốn nhãn đó ăn gần một phần ba
          chiều cao thẻ mà không nói thêm gì so với placeholder, trong khi chỗ
          ấy để dành cho lưới thư mục bên dưới thì đáng hơn. Nhãn chuyển thành
          `aria-label` nên trình đọc màn hình không mất gì. */}
      <form onSubmit={add} className="c-card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] flex items-center justify-center flex-none">
              <LinkIcon size={18} />
            </div>
            <h3 className="c-h4 text-[var(--color-text)] truncate">
              {t("Save a video", "Lưu một video")}
            </h3>
          </div>
          {/* Cỡ thường chứ không phải c-btn-sm: bản thu gọn đầu tiên dùng
              c-btn-sm và nút tụt xuống 31px, dưới ngưỡng chạm 44px trên điện
              thoại. Chỗ tiết kiệm được nằm ở việc bỏ nhãn ô, không ở nút này. */}
          <button
            type="submit"
            disabled={!urlOk || !topic || saving}
            className="c-btn c-btn-primary flex items-center gap-2 flex-none"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t("Add to library", "Thêm vào thư viện")}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {urlOk ? (
            // Link đã vào — chỉ cần biết là nó có ở đó, không cần đọc lại.
            <div className="c-input w-full flex items-center gap-2 justify-between min-w-0">
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={16} className="text-[var(--color-success)] flex-none" />
                <span className="font-bold text-sm truncate">
                  {PLATFORM_LABEL[detectPlatform(url.trim())] ?? t("Link ready", "Đã có link")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setUrl("")}
                aria-label={t("Clear link", "Xoá link")}
                title={url.trim()}
                className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] flex-none"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 min-w-0">
              <input
                className="c-input w-full flex-1 min-w-0"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-label={t("Link", "Link video")}
                placeholder={t("Paste link — TikTok, Facebook…", "Dán link — TikTok, Facebook…")}
                inputMode="url"
                required
              />
              <button
                type="button"
                onClick={pasteLink}
                aria-label={t("Paste from clipboard", "Dán từ bộ nhớ tạm")}
                className="c-btn c-btn-secondary c-btn-icon flex-none"
              >
                <ClipboardPaste size={16} />
              </button>
            </div>
          )}

          <select
            className="c-input w-full"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label={t("Topic", "Đề tài")}
          >
            {topics.map((tp) => (
              <option key={tp.id} value={tp.name}>{tp.name}</option>
            ))}
          </select>

          <input
            className="c-input w-full"
            value={subTopic}
            onChange={(e) => setSubTopic(e.target.value)}
            list="video-subtopic-options"
            autoComplete="off"
            aria-label={t("Sub-topic", "Nhãn con")}
            placeholder={t("Sub-topic — e.g. Print guide", "Nhãn con — vd Hướng dẫn in")}
          />
          {/* Giá trị trong datalist là nhãn người dùng tự gõ — không dịch,
              vì chuỗi này được lưu thẳng xuống DB. */}
          <datalist id="video-subtopic-options">
            {suggestions.map((sub) => (
              <option key={sub} value={sub} />
            ))}
          </datalist>

          <input
            className="c-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={t("Title", "Tiêu đề")}
            placeholder={t("Title (optional)", "Tiêu đề (không bắt buộc)")}
          />
        </div>

        {/* Safari trên iPhone không dựng danh sách của <datalist>, nên nhãn đã
            dùng phải hiện thành thẻ bấm được thì trên điện thoại mới chọn nổi. */}
        {suggestions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {suggestions.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubTopic((cur) => (cur === sub ? "" : sub))}
                className={subTopic === sub ? "c-chip c-chip-solid" : "c-chip c-chip-outline"}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </form>

      {showGuide && (
        <div className="c-card space-y-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-[var(--color-accent)]" />
            <h3 className="c-h4">
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
              <h3 className="c-h3 text-[var(--color-text)] mb-1 flex items-center gap-2">
                <Clock size={16} className="text-[var(--color-warning)]" />
                {t("Waiting for the file", "Chờ file về")} ({pending.length})
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                {t("Hit Fetch now and the server brings the file in. Only if that fails do you need the Shortcut on your phone.",
                   "Bấm Tải ngay là server tự mang file về. Chỉ khi nút đó lỗi mới cần đến Shortcut trên điện thoại.")}
              </p>
              {fetchError && (
                <div className="c-alert c-alert-error mb-4">
                  <AlertCircle size={18} className="icon" />
                  <span>{fetchError}</span>
                </div>
              )}
              <div className="space-y-2">
                {pending.map((item) => (
                  <PendingRow
                    key={item.id}
                    item={item}
                    onDelete={remove}
                    onFetch={fetchNow}
                    fetching={fetchingId === item.id}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Thư viện: thư mục đề tài, mở ra là xem được ngay tại chỗ. */}
          <section>
            {current ? (
              <>
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => { setOpenFolder(null); setSubFilter(null); }}
                      className="c-btn c-btn-secondary c-btn-icon flex-none"
                      aria-label={t("Back to folders", "Quay lại danh sách thư mục")}
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <FolderOpen size={20} className="text-[var(--color-warning)] flex-none" />
                    <h3 className="c-h3 text-[var(--color-text)] truncate">{current.name}</h3>
                    <span className="c-chip">{current.videos.length}</span>
                  </div>
                </div>

                {(current.tags.length > 0 || current.videos.some((v) => !v.subTopic)) && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <button
                      onClick={() => setSubFilter(null)}
                      className={subFilter === null ? "c-chip c-chip-solid" : "c-chip c-chip-outline"}
                    >
                      {t("All", "Tất cả")}
                    </button>
                    {current.tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSubFilter((cur) => (cur === tag ? null : tag))}
                        className={subFilter === tag ? "c-chip c-chip-solid" : "c-chip c-chip-outline"}
                      >
                        {tag}
                      </button>
                    ))}
                    {current.videos.some((v) => !v.subTopic) && (
                      <button
                        onClick={() => setSubFilter((cur) => (cur === UNTAGGED ? null : UNTAGGED))}
                        className={subFilter === UNTAGGED ? "c-chip c-chip-solid" : "c-chip c-chip-outline"}
                      >
                        {t("Untagged", "Chưa gắn nhãn")}
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visible.map((item) => (
                    <SavedCard
                      key={item.id}
                      item={item}
                      suggestions={subTopics[item.topic] ?? []}
                      onPlay={setPlaying}
                      onDelete={remove}
                      onRetag={retag}
                      t={t}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="c-h3 text-[var(--color-text)] mb-4 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[var(--color-success)]" />
                  {t("Saved", "Đã lưu")} ({saved.length})
                </h3>
                {folders.length === 0 ? (
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {folders.map((folder) => (
                      <button
                        key={folder.name}
                        onClick={() => { setOpenFolder(folder.name); setSubFilter(null); }}
                        className="c-card text-left flex flex-col gap-3 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-[var(--color-warning-tint)] text-[var(--color-warning)] flex items-center justify-center flex-none">
                            <Folder size={22} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="c-h4 text-[var(--color-text)] truncate">{folder.name}</p>
                            <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                              {folder.videos.length} video
                            </p>
                          </div>
                        </div>
                        {folder.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {folder.tags.slice(0, 4).map((tag) => (
                              <span key={tag} className="c-chip c-chip-outline text-[11px]">{tag}</span>
                            ))}
                            {folder.tags.length > 4 && (
                              <span className="text-xs text-[var(--color-text-faint)]">
                                +{folder.tags.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {playing && <PlayerModal item={playing} onClose={() => setPlaying(null)} t={t} />}
    </div>
  );
}

/** Video đã dán link nhưng file chưa về — dòng gọn, có nút giục server tải. */
function PendingRow({
  item, onDelete, onFetch, fetching, t,
}: {
  item: VideoItem;
  onDelete: (id: string) => void;
  onFetch: (id: string) => void;
  fetching: boolean;
  t: (en: string, vi: string) => string;
}) {
  // fdown.vn chỉ tải được hai nền tảng này; các mục khác vẫn phải lưu tay.
  const canFetch = item.platform === "facebook" || item.platform === "tiktok";
  return (
    <div className="flex items-center gap-3 bg-[var(--color-surface-2)] p-3 rounded-xl border border-[var(--color-border)] flex-wrap">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-info-tint)] text-[var(--color-info)] flex items-center justify-center flex-none">
          <Video size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-[var(--color-text)] break-words">
            {item.title || item.driveFileName || t("Untitled", "Chưa đặt tên")}
          </p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
            {[PLATFORM_LABEL[item.platform] ?? item.platform, item.topic, item.subTopic]
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

      <div className="flex items-center gap-2">
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={item.sourceUrl}
          className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1"
        >
          <LinkIcon size={12} /> {t("Source", "Link gốc")}
        </a>
        {canFetch && (
          <button
            onClick={() => onFetch(item.id)}
            disabled={fetching}
            className="c-btn c-btn-primary c-btn-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fetching ? <Loader2 size={13} className="animate-spin" /> : <CloudDownload size={13} />}
            {fetching ? t("Fetching...", "Đang tải...") : t("Fetch now", "Tải ngay")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Thẻ video đã lưu: bấm là phát ngay, và gắn được nhãn con tại chỗ. */
function SavedCard({
  item, suggestions, onPlay, onDelete, onRetag, t,
}: {
  item: VideoItem;
  suggestions: string[];
  onPlay: (item: VideoItem) => void;
  onDelete: (id: string) => void;
  onRetag: (id: string, value: string) => void;
  t: (en: string, vi: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.subTopic ?? "");

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== (item.subTopic ?? "")) onRetag(item.id, draft);
  };

  return (
    <div className="c-card flex flex-col gap-3">
      <button
        onClick={() => onPlay(item)}
        disabled={!item.driveFileId}
        aria-label={t("Play", "Phát")}
        className="relative w-full aspect-video rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
          <Play size={20} fill="currentColor" />
        </span>
      </button>

      <div className="flex items-start gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-[var(--color-text)] break-words">
            {item.title || item.driveFileName || t("Untitled", "Chưa đặt tên")}
          </p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
            {[PLATFORM_LABEL[item.platform] ?? item.platform, formatSize(item.sizeBytes)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {/* Vùng chạm 44px theo đúng ngưỡng của hệ thiết kế; lề âm giữ cho nút
            trông vẫn sát mép thẻ chứ không nới thẻ rộng thêm. */}
        <button
          onClick={() => onDelete(item.id)}
          aria-label={t("Remove", "Xoá")}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-error)] flex-none w-11 h-11 -m-2 flex items-center justify-center"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            className="c-input flex-1 min-w-0"
            value={draft}
            autoFocus
            list={`subtopics-${item.id}`}
            autoComplete="off"
            placeholder={t("Sub-topic", "Nhãn con")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setDraft(item.subTopic ?? ""); setEditing(false); }
            }}
          />
          <datalist id={`subtopics-${item.id}`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            onClick={commit}
            aria-label={t("Save tag", "Lưu nhãn")}
            className="c-btn c-btn-primary c-btn-icon flex-none"
          >
            <Check size={15} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setDraft(item.subTopic ?? ""); setEditing(true); }}
          className={item.subTopic ? "c-chip self-start" : "c-chip c-chip-outline self-start"}
        >
          <Tag size={12} />
          {item.subTopic || t("Add tag", "Gắn nhãn")}
        </button>
      )}

      <div className="flex items-center gap-2 mt-auto">
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={item.sourceUrl}
          className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1"
        >
          <LinkIcon size={12} /> {t("Source", "Link gốc")}
        </a>
        <button
          onClick={() => navigator.clipboard?.writeText(item.sourceUrl)}
          title={t("Copy link", "Sao chép link")}
          aria-label={t("Copy link", "Sao chép link")}
          className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] w-11 h-11 -m-3 flex items-center justify-center flex-none"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}

/** Trình phát. Video chảy qua `/api/video/stream`, không mở tab Drive nào. */
function PlayerModal({
  item, onClose, t,
}: {
  item: VideoItem;
  onClose: () => void;
  t: (en: string, vi: string) => string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Khoá cuộn nền, nếu không thì vuốt trên điện thoại lại cuộn trang bên dưới.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="c-h4 text-[var(--color-text)] break-words">
              {item.title || item.driveFileName || t("Untitled", "Chưa đặt tên")}
            </p>
            <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
              {[item.topic, item.subTopic, PLATFORM_LABEL[item.platform] ?? item.platform,
                formatSize(item.sizeBytes)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("Close", "Đóng")}
            className="c-btn c-btn-secondary c-btn-icon flex-none"
          >
            <X size={16} />
          </button>
        </div>

        {failed ? (
          <div className="px-4 pb-4">
            <div className="c-alert c-alert-error">
              <AlertCircle size={18} className="icon" />
              <span className="flex-1">
                {t("Could not play this file here.", "Không phát được file này ở đây.")}
              </span>
              {item.driveFileId && (
                <a
                  href={`https://drive.google.com/file/d/${item.driveFileId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="c-btn c-btn-tertiary c-btn-sm flex items-center gap-1.5"
                >
                  {t("Open in Drive", "Mở trong Drive")} <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={`/api/video/stream?id=${item.driveFileId}`}
            controls
            autoPlay
            playsInline
            onError={() => setFailed(true)}
            className="w-full max-h-[70vh] bg-black"
          />
        )}
      </div>
    </div>
  );
}
