"use client";

import { useState } from "react";
import {
  Upload, Sparkles, Loader2, AlertCircle, Check, X, Download, FileSpreadsheet,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface PreviewRow {
  line: number;
  term: string;
  phonetic: string | null;
  tone: string | null;
  definition: string;
  example: string | null;
  exampleTranslation: string | null;
  tags: string[];
  error: string | null;
}

interface Props {
  deckId?: string;
  languageId?: string;
  domain?: string;
  /** Các mức cấp độ của thứ tiếng, để gợi ý khi nhờ AI soạn. */
  levels?: string[];
  onDone: () => void;
  onClose: () => void;
}

/** Dòng tiêu đề của file mẫu — cũng chính là thứ tự cột khi dán không tiêu đề. */
const TEMPLATE =
  "term,phonetic,tone,definition,example,exampleTranslation,tags\n" +
  "水,seoi2,2,nước,我要飲水,Tôi muốn uống nước,cơ bản|đồ uống\n";

/**
 * Nhập từ vựng hàng loạt.
 *
 * Hai đường vào: dán bảng từ Excel, hoặc nhờ AI soạn theo chủ đề. Cả hai đều
 * bắt buộc đi qua bước xem trước — dán nhầm cột mà ghi thẳng 100 dòng rác vào
 * kho thì dọn tay rất lâu.
 */
export default function ImportDialog({
  deckId, languageId, domain, levels = [], onDone, onClose,
}: Props) {
  const { t } = useLanguage();

  const [tab, setTab] = useState<"paste" | "ai">("paste");
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [count, setCount] = useState(20);

  const preview = async (text: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, deckId, languageId, domain, dryRun: true }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không đọc được dữ liệu");
      setRows(json.rows);
      setCsv(text);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Nhờ AI soạn, rồi đưa kết quả qua đúng bước xem trước như khi dán tay. */
  const generate = async () => {
    if (!topic.trim() || !languageId) return;
    setBusy(true);
    setError(null);
    setRows(null);
    try {
      const res = await fetch("/api/learning/generate-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageId, topic, level, count }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không soạn được");

      const escape = (v: string | null) =>
        v ? `"${String(v).replace(/"/g, '""')}"` : "";
      const text =
        "term,phonetic,tone,definition,example,exampleTranslation,tags\n" +
        (json.words as Array<Record<string, string | null>>)
          .map((w) =>
            [w.term, w.phonetic, w.tone, w.definition, w.example, w.exampleTranslation, ""]
              .map((v) => escape(v as string | null))
              .join(",")
          )
          .join("\n");

      await preview(text);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, deckId, languageId, domain, dryRun: false }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không nhập được");
      setResult(
        t(
          `Added ${json.createdCount} words. Skipped ${json.skippedCount} duplicates, ${json.invalidCount} bad rows.`,
          `Đã thêm ${json.createdCount} từ. Bỏ qua ${json.skippedCount} từ trùng, ${json.invalidCount} dòng lỗi.`
        )
      );
      setRows(null);
      setCsv("");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mau-tu-vung.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const valid = rows?.filter((r) => !r.error) ?? [];
  const invalid = rows?.filter((r) => r.error) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="c-card c-elev-lg w-full max-w-3xl my-8 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="c-h3">{t("Add words in bulk", "Thêm từ hàng loạt")}</h2>
            <p className="c-card-body mt-1">
              {t(
                "Paste a table, or let AI draft a topic deck. You review before anything is saved.",
                "Dán một bảng, hoặc nhờ AI soạn theo chủ đề. Bạn xem trước rồi mới lưu."
              )}
            </p>
          </div>
          <button onClick={onClose} className="c-btn c-btn-secondary c-btn-icon" aria-label={t("Close", "Đóng")}>
            <X size={16} />
          </button>
        </div>

        <div className="c-seg self-start">
          <button className={`c-seg-opt ${tab === "paste" ? "active" : ""}`} onClick={() => setTab("paste")}>
            {t("Paste", "Dán bảng")}
          </button>
          <button
            className={`c-seg-opt ${tab === "ai" ? "active" : ""}`}
            onClick={() => setTab("ai")}
            disabled={!languageId}
            title={languageId ? undefined : t("Pick a language first", "Cần chọn thứ tiếng trước")}
          >
            {t("AI draft", "Nhờ AI soạn")}
          </button>
        </div>

        {error && (
          <div className="c-alert c-alert-error">
            <AlertCircle size={18} className="icon" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {result && (
          <div className="c-alert c-alert-success">
            <Check size={18} className="icon" />
            <span className="flex-1">{result}</span>
          </div>
        )}

        {/* ── Xem trước ─────────────────────────────────────────────────── */}
        {rows ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="c-chip c-chip-success">
                {valid.length} {t("ready", "dòng hợp lệ")}
              </span>
              {invalid.length > 0 && (
                <span className="c-chip c-chip-error">
                  {invalid.length} {t("with problems", "dòng lỗi")}
                </span>
              )}
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto border border-[var(--color-border)] rounded-xl">
              <table className="c-table">
                <thead>
                  <tr>
                    <th>{t("Word", "Từ")}</th>
                    <th>{t("Reading", "Cách đọc")}</th>
                    <th>{t("Meaning", "Nghĩa")}</th>
                    <th>{t("Status", "Tình trạng")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line}>
                      <td className="font-bold">{r.term || "—"}</td>
                      <td className="text-[var(--color-text-muted)]">
                        {r.phonetic ?? "—"}
                        {r.tone && ` (${r.tone})`}
                      </td>
                      <td>{r.definition || "—"}</td>
                      <td>
                        {r.error ? (
                          <span className="c-chip c-chip-error">{r.error}</span>
                        ) : (
                          <Check size={15} className="text-[var(--color-success)]" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={commit}
                disabled={busy || valid.length === 0}
                className="c-btn c-btn-primary"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {t(`Add ${valid.length} words`, `Thêm ${valid.length} từ`)}
              </button>
              <button onClick={() => setRows(null)} className="c-btn c-btn-secondary">
                {t("Back", "Quay lại")}
              </button>
            </div>
          </div>
        ) : tab === "paste" ? (
          <div className="space-y-4">
            <div className="c-field">
              <label htmlFor="csv">
                {t("Paste rows (CSV or straight from Excel)", "Dán các dòng (CSV hoặc copy thẳng từ Excel)")}
              </label>
              <textarea
                id="csv"
                className="c-textarea min-h-[160px] font-mono text-sm"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={TEMPLATE}
              />
              <p className="c-help">
                {t(
                  "Columns: word, reading, tone, meaning, example, translation, tags. A header row is optional. Up to 100 rows.",
                  "Cột: từ, cách đọc, thanh điệu, nghĩa, ví dụ, bản dịch, thẻ. Dòng tiêu đề không bắt buộc. Tối đa 100 dòng."
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => preview(csv)}
                disabled={!csv.trim() || busy}
                className="c-btn c-btn-primary"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                {t("Preview", "Xem trước")}
              </button>
              <button onClick={downloadTemplate} className="c-btn c-btn-secondary">
                <Download size={16} />
                {t("Download template", "Tải file mẫu")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="c-field md:col-span-2">
                <label htmlFor="topic">{t("Topic", "Chủ đề")}</label>
                <input
                  id="topic"
                  className="c-input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("Ordering at a restaurant", "Gọi món ở nhà hàng")}
                />
              </div>
              <div className="c-field">
                <label htmlFor="ai-level">{t("Level", "Trình độ")}</label>
                <select
                  id="ai-level"
                  className="c-select"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="">{t("Beginner", "Nhập môn")}</option>
                  {levels.map((lv) => (
                    <option key={lv} value={lv}>{lv}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="c-field max-w-[200px]">
              <label htmlFor="ai-count">{t("How many words", "Bao nhiêu từ")}</label>
              <input
                id="ai-count"
                type="number"
                min={5}
                max={40}
                className="c-input"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <button
              onClick={generate}
              disabled={!topic.trim() || busy}
              className="c-btn c-btn-primary"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {t("Draft the deck", "Soạn bộ thẻ")}
            </button>
            <p className="c-help">
              {t(
                "AI drafts in the right notation for this language. Check it before saving — it can be wrong.",
                "AI soạn theo đúng hệ phiên âm của thứ tiếng này. Vẫn nên đọc lại trước khi lưu — AI có thể sai."
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
