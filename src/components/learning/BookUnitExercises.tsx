"use client";

import { useState } from "react";
import { Loader2, Sparkles, AlertTriangle, Check, X, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export interface ExItem {
  prompt: string;
  given?: string;
  options?: string[];
  answer: string;
  explanation: string;
}

export interface ExBlock {
  label: string;
  kind: "build" | "gapfill" | "choice" | "correct" | "bank" | "passage";
  instruction: string;
  bank?: string[];
  /** Chỉ với kind=passage: đoạn văn có cài sẵn lỗi. */
  passage?: string;
  items: ExItem[];
}

/** Bỏ hoa thường, khoảng trắng thừa và dấu câu ở hai đầu trước khi so. */
const same = (a: string, b: string) => {
  const clean = (s: string) =>
    s.trim().toLowerCase().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, "").replace(/\s+/g, " ");
  return clean(a) === clean(b);
};

/**
 * Phần bài tập của một unit.
 *
 * Sáu dạng bám theo khuôn quen của sách bài tập: viết câu từ gợi ý rời, điền
 * động từ trong ngoặc, sửa cụm sai, chọn một trong hai, điền từ lấy trong khung,
 * và tìm lỗi trong một đoạn văn.
 *
 * Đề do ứng dụng tự ra, KHÔNG chép từ sách. Khuôn dạng bài thì không ai sở hữu,
 * nhưng từng câu trong sách là chữ của tác giả — mà với một cuốn sách luyện tập
 * thì chính những câu đó là sản phẩm.
 *
 * Dạng viết câu từ gợi ý chấm nhẹ tay: một gợi ý có thể ra vài câu đều đúng, nên
 * gõ khác đáp án mẫu thì hiện đáp án để tự đối chiếu, không tính là sai.
 *
 * Chấm ở TRÌNH DUYỆT chứ không ở máy chủ, khác các phần khác. Lý do: đề và đáp
 * án đã nằm sẵn trong bản đã lưu của unit này, nên giấu đáp án lúc này chỉ là
 * hình thức. Đổi lại chấm được ngay, không phải chờ mạng cho từng câu.
 */
export default function BookUnitExercises({
  bookId,
  step,
  items,
  onLoaded,
}: {
  bookId: string;
  step: number;
  items: ExBlock[] | null;
  onLoaded: (v: ExBlock[]) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Đáp án người học gõ, khoá theo "khối:câu". */
  const [typed, setTyped] = useState<Record<string, string>>({});
  /** Khối nào đã chấm. */
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/books/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, step, part: "exercises" }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không ra được đề");
      onLoaded(json.exercises?.items ?? []);
      setTyped({});
      setChecked({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const checkBlock = async (block: ExBlock, bi: number) => {
    setChecked((prev) => ({ ...prev, [block.label]: true }));
    // Dạng viết câu không vào điểm: chấm bằng so chuỗi thì câu đúng mà viết
    // khác mẫu cũng thành sai, và con số đó không nói lên gì.
    if (block.kind === "build") return;
    const correct = block.items.filter((it, i) => same(typed[`${bi}:${i}`] ?? "", it.answer)).length;
    // Ghi điểm nhưng không chặn gì nếu hỏng — điểm là phụ, bài làm mới là chính.
    fetch("/api/learning/books/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, step, correct, total: block.items.length }),
    }).catch(() => {});
  };

  if (!items) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="c-alert c-alert-error">
            <AlertTriangle size={18} className="icon" />
            <p className="flex-1">{error}</p>
          </div>
        )}
        <div className="c-card p-8 text-center space-y-3">
          <p className="c-h4">{t("No exercises yet", "Chưa có bài tập")}</p>
          <p className="c-card-body max-w-md mx-auto">
            {t(
              "Three or four blocks in the book's own formats: fill the gap, choose one of two, correct the mistake, fill from a word bank.",
              "Ba tới bốn khối theo đúng dạng của sách: điền chỗ trống, chọn một trong hai, sửa chỗ sai, và điền từ trong khung."
            )}
          </p>
          <button onClick={generate} disabled={busy} className="c-btn c-btn-primary c-btn-lg">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {busy ? t("Writing…", "Đang ra đề…") : t("Create exercises", "Ra đề")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {items.map((block, bi) => {
        const done = checked[block.label];
        const right = block.items.filter((it, i) => same(typed[`${bi}:${i}`] ?? "", it.answer)).length;
        const scored = block.kind !== "build";

        return (
          <section key={block.label} className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-md bg-[var(--color-surface-2)] text-[var(--color-text-muted)] grid place-content-center text-[13px] font-bold flex-none">
                {block.label}
              </span>
              <p className="flex-1 leading-snug">{block.instruction}</p>
            </div>

            {/* Đoạn văn có cài lỗi */}
            {block.kind === "passage" && block.passage && (
              <div className="c-card p-5">
                <p className="leading-loose text-[16px] whitespace-pre-wrap">{block.passage}</p>
              </div>
            )}

            {/* Khung từ cho sẵn */}
            {block.kind === "bank" && block.bank && block.bank.length > 0 && (
              <div className="c-card p-3 flex flex-wrap gap-2">
                {block.bank.map((w) => (
                  <span key={w} className="c-chip c-chip-outline">{w}</span>
                ))}
              </div>
            )}

            <ol className="space-y-3">
              {block.items.map((it, i) => {
                const k = `${bi}:${i}`;
                const mine = typed[k] ?? "";
                const ok = same(mine, it.answer);
                // Viết câu từ gợi ý thì nhiều cách viết đều đúng, nên không
                // đánh dấu sai — chỉ đưa đáp án mẫu ra để tự đối chiếu.
                const lenient = block.kind === "build";

                return (
                  <li key={i} className="flex gap-3">
                    <span className="c-stat-label tabular-nums pt-2 w-5 flex-none text-right">{i + 1}</span>
                    <div className="flex-1 space-y-2 min-w-0">
                      {block.kind === "build" || block.kind === "passage" ? (
                        <p className="leading-relaxed">
                          <span className="italic text-[var(--color-text-muted)]">{it.given}</span>
                        </p>
                      ) : (
                        <p className="leading-relaxed">
                          {it.prompt}
                          {it.given && <span className="ml-1.5 font-bold">({it.given})</span>}
                        </p>
                      )}

                      {block.kind === "choice" && it.options?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {it.options.map((opt) => (
                            <button
                              key={opt}
                              disabled={done}
                              onClick={() => setTyped((p) => ({ ...p, [k]: opt }))}
                              className={`c-btn c-btn-sm ${
                                done
                                  ? same(opt, it.answer)
                                    ? "c-btn-success"
                                    : mine === opt
                                      ? "c-btn-danger"
                                      : "c-btn-secondary"
                                  : mine === opt
                                    ? "c-btn-primary"
                                    : "c-btn-secondary"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          value={mine}
                          disabled={done}
                          onChange={(e) => setTyped((p) => ({ ...p, [k]: e.target.value }))}
                          placeholder={t("Your answer", "Đáp án của bạn")}
                          className="c-input w-full"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      )}

                      {done && (
                        <div className="space-y-1">
                          <p className="text-sm flex items-start gap-2">
                            {ok ? (
                              <Check size={15} className="text-[var(--color-success)] flex-none mt-0.5" />
                            ) : lenient ? (
                              <Check size={15} className="text-[var(--color-text-faint)] flex-none mt-0.5" />
                            ) : (
                              <X size={15} className="text-[var(--color-error)] flex-none mt-0.5" />
                            )}
                            <span>
                              {!ok && !lenient && (
                                <span className="text-[var(--color-text-muted)]">
                                  {mine ? `${mine} → ` : ""}
                                </span>
                              )}
                              {!ok && lenient && (
                                <span className="c-stat-label mr-1.5">
                                  {t("model answer", "đáp án mẫu")}
                                </span>
                              )}
                              <span className="font-medium">{it.answer}</span>
                            </span>
                          </p>
                          <p className="c-help">{it.explanation}</p>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {!done ? (
              <button onClick={() => checkBlock(block, bi)} className="c-btn c-btn-primary">
                <Check size={16} />
                {t(`Check ${block.label}`, `Chấm phần ${block.label}`)}
              </button>
            ) : (
              <p className="c-stat-label tabular-nums">
                {scored
                  ? t(`${right}/${block.items.length} correct`, `đúng ${right}/${block.items.length}`)
                  : t("Compare with the model answers", "Đối chiếu với đáp án mẫu")}
              </p>
            )}
          </section>
        );
      })}

      <button onClick={generate} disabled={busy} className="c-btn c-btn-tertiary c-btn-sm">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {t("New set of exercises", "Ra đề khác")}
      </button>
    </div>
  );
}
