"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface FormData {
  sourceUrl: string;
  platformLabel: string;
  topics: string[];
  subTopics: Record<string, string[]>;
  defaultTopic: string;
  existing: { topic: string; subTopic: string | null; title: string | null; status: string } | null;
}

/**
 * Form "Lưu một video" mở từ nút Chia sẻ của TikTok / Facebook.
 *
 * Shortcut "Gửi vào Crucible" chỉ làm một việc: đổi token lấy link trang này
 * (kèm vé) rồi mở nó bằng "Show Web Page" — trang nổi ngay trên TikTok. Mọi lựa
 * chọn nằm ở đây chứ không ở các popup của Shortcuts, vì người dùng muốn đúng
 * cái form trên web: chọn đề tài, nhãn con hiện theo đề tài, tiêu đề tự điền.
 * Bản đầu dựng bằng ba popup "Choose from List" + "If" — không có gợi ý nhãn
 * con, và khối "If" dựng sai một chút là cả Shortcut hỏng.
 *
 * Ô nhập giữ nguyên kiểu với `VideoDownloaderTab` để hai nơi trông là một.
 * Khổ chính là 375px — cái khung web của Shortcut còn hẹp hơn Safari.
 */
export default function VideoSharePage() {
  const { t } = useLanguage();

  const [ticket, setTicket] = useState<string | null>(null);
  const [data, setData] = useState<FormData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [subTopic, setSubTopic] = useState("");
  const [title, setTitle] = useState("");
  // Người dùng đã gõ vào ô tiêu đề thì tiêu đề tự lấy về muộn không được đè lên.
  const [titleTouched, setTitleTouched] = useState(false);
  const [titleLoading, setTitleLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Đọc vé từ window thay vì useSearchParams() để khỏi phải bọc Suspense —
  // cùng cách với trang /login.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromServer = params.get("error");
    const tk = params.get("t");
    /* eslint-disable react-hooks/set-state-in-effect -- đọc URL một lần sau khi mount */
    if (fromServer) setError(fromServer);
    else if (!tk) setError(t("This page opens from the Share button.", "Trang này mở từ nút Chia sẻ trong TikTok/Facebook."));
    else setTicket(tk);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [t]);

  useEffect(() => {
    if (!ticket) return;
    const controller = new AbortController();
    const q = `t=${encodeURIComponent(ticket)}`;

    fetch(`/api/video/share/form?${q}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!json?.success) throw new Error(json?.error || "Không tải được dữ liệu");
        const form = json as FormData;
        setData(form);
        setTopic(form.defaultTopic);
        setSubTopic(form.existing?.subTopic ?? "");
        if (form.existing?.title) {
          setTitle(form.existing.title);
          setTitleTouched(true);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    // Chậm (3–5 giây, đi qua fdown.vn) nên gọi song song và không chặn form.
    fetch(`/api/video/share/title?${q}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json?.title) setTitle((cur) => cur || json.title);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setTitleLoading(false);
      });

    return () => controller.abort();
  }, [ticket]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !topic || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/video/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, topic, subTopic: subTopic.trim(), title: title.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.success) throw new Error(json?.message || `Lỗi ${res.status}`);
      setDone(json.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const suggestions = data?.subTopics[topic] ?? [];

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6 space-y-4">
      <div>
        <p className="c-overline">Crucible</p>
        <h1 className="c-h3 text-[var(--color-text)] mt-1">{t("Save a video", "Lưu một video")}</h1>
        {data && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1 truncate" title={data.sourceUrl}>
            {data.platformLabel} · {data.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
          </p>
        )}
      </div>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {done ? (
        <div className="c-card space-y-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={22} className="text-[var(--color-success)] flex-none" />
            <p className="font-bold text-[var(--color-text)]">{done}</p>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("Tap Done at the top to go back.", "Bấm Xong ở góc trên để quay lại.")}
          </p>
        </div>
      ) : !data ? (
        !error && (
          <div className="c-card flex items-center gap-2 text-[var(--color-text-muted)]">
            <Loader2 size={16} className="animate-spin" /> {t("Loading…", "Đang tải…")}
          </div>
        )
      ) : (
        <form onSubmit={save} className="c-card space-y-3">
          {data.existing && (
            <div className="c-alert c-alert-info">
              <AlertCircle size={18} className="icon" />
              <span className="flex-1">
                {data.existing.status === "saved"
                  ? t(`Already in your library («${data.existing.topic}»). Saving updates its topic.`,
                      `Video này đã có trong thư viện («${data.existing.topic}»). Lưu lại sẽ cập nhật đề tài.`)
                  : t(`Already queued («${data.existing.topic}»). Saving updates it.`,
                      `Video này đang chờ tải («${data.existing.topic}»). Lưu lại sẽ cập nhật.`)}
              </span>
            </div>
          )}

          <select
            className="c-input w-full"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label={t("Topic", "Đề tài")}
          >
            {data.topics.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <input
            className="c-input w-full"
            value={subTopic}
            onChange={(e) => setSubTopic(e.target.value)}
            list="share-subtopic-options"
            autoComplete="off"
            aria-label={t("Sub-topic", "Nhãn con")}
            placeholder={t("Sub-topic — e.g. Print guide", "Nhãn con — vd Hướng dẫn in")}
          />
          {/* Giá trị trong datalist là nhãn người dùng tự gõ — không dịch,
              vì chuỗi này được lưu thẳng xuống DB. */}
          <datalist id="share-subtopic-options">
            {suggestions.map((sub) => (
              <option key={sub} value={sub} />
            ))}
          </datalist>

          {/* Safari trên iPhone không dựng danh sách của <datalist> — nhãn đã
              dùng phải hiện thành thẻ bấm được, như trên trang thư viện. */}
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

          <div className="relative">
            <input
              className="c-input w-full pr-10"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              aria-label={t("Title", "Tiêu đề")}
              placeholder={
                titleLoading && !titleTouched
                  ? t("Fetching the video title…", "Đang lấy tiêu đề video…")
                  : t("Title (optional)", "Tiêu đề (không bắt buộc)")
              }
            />
            {titleLoading && !titleTouched && (
              <Loader2
                size={16}
                className="animate-spin absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={!topic || saving}
            className="c-btn c-btn-primary w-full flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t("Add to library", "Thêm vào thư viện")}
          </button>
        </form>
      )}
    </div>
  );
}
