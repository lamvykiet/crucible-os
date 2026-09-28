"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2, Sparkles, CircleCheck, Pause, AlertCircle, Feather, GitMerge,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Status {
  stepCount: number;
  total: number;
  done: number;
  remaining: number;
  grammarNotes: number;
  looseNotes: number;
}

/**
 * Soạn bài học và bài tập cho cả cuốn sách.
 *
 * Việc chạy thành nhiều lượt gọi ngắn thay vì một lượt dài, vì một request chỉ
 * có 60 giây mà cả cuốn cần hàng trăm lượt gọi AI. Mỗi lượt xong là ghi xuống
 * bảng ngay, nên đóng trang giữa lúc soạn cũng không mất phần đã làm — mở lại
 * là tiếp từ chỗ dở.
 *
 * Hạn mức AI của gói miễn phí tính theo ngày, nên cả cuốn thường phải soạn
 * trong vài buổi. Gặp hết hạn mức thì dừng và nói rõ còn bao nhiêu, chứ không
 * quay vòng thử lại.
 */
export default function BookBuilder({
  bookId,
  onProgress,
}: {
  bookId: string;
  /** Gọi khi soạn xong một phần, để đường học cập nhật dấu. */
  onProgress?: () => void;
}) {
  const { t } = useLanguage();

  const [status, setStatus] = useState<Status | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Cờ dừng đọc trong vòng lặp `while`.
   *
   * Phải là ref chứ không phải state: vòng lặp đọc giá trị ngay trong thân hàm,
   * mà state trong một closure đã chạy thì đứng mãi ở giá trị lúc bắt đầu — bấm
   * dừng sẽ không có tác dụng gì cho tới lượt gọi sau.
   */
  const stop = useRef(false);

  /**
   * Những phần hỏng trong phiên này, gửi kèm để máy chủ bỏ qua.
   *
   * Hàng đợi luôn lấy phần thiếu đầu tiên, nên không có danh sách này thì một
   * unit hỏng làm cả cuốn đứng lại: lượt sau lấy đúng phần đó, hỏng tiếp, mãi
   * mãi. Bỏ qua trong phiên thôi — phần ấy vẫn còn thiếu nên lần mở sau sẽ soạn
   * lại, biết đâu lúc đó model rảnh hơn.
   */
  const skipped = useRef<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/books/build?bookId=${encodeURIComponent(bookId)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setStatus(json);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(bookId);
      });
    return () => controller.abort();
  }, [bookId]);

  /** Đối chiếu lại điểm đứng riêng với khung — một lượt gọi AI, chỉ so tên. */
  const remap = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning/books/build", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không đối chiếu được");

      setNote(
        json.merged > 0
          ? t(
              `${json.merged} of ${json.checked} points merged into the syllabus.`,
              `Đã gộp ${json.merged}/${json.checked} điểm vào khung có sẵn.`
            )
          : t(
              "None of them matched — the syllabus really does not cover these yet.",
              "Không điểm nào trùng — khung thật sự chưa có những điểm này."
            )
      );

      const fresh = await fetch(
        `/api/learning/books/build?bookId=${encodeURIComponent(bookId)}`
      ).then((r) => r.json());
      if (fresh?.success) setStatus(fresh);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    stop.current = false;
    skipped.current = [];
    setRunning(true);
    setError(null);
    setNote(null);

    /** Bỏ qua quá nhiều là dấu hiệu hỏng hệ thống, không phải một unit khó. */
    const SKIP_LIMIT = 5;

    /**
     * Lượt hai xin ít khối hơn.
     *
     * Phần hỏng vì chạy quá lâu thì thử lại y nguyên cũng hỏng y như vậy — không
     * có gì đổi giữa hai lần. Nên lượt hai xin 3 khối thay vì 4-5: vẫn đủ một bộ
     * bài tập, mà ngắn hơn hẳn nên kịp giờ.
     */
    let light = false;

    try {
      // Chạy tới khi hết việc, người dùng bấm dừng, hoặc máy chủ bảo dừng.
      for (;;) {
        if (stop.current) {
          setNote(t("Paused. Press again to carry on.", "Đã tạm dừng. Bấm lại để soạn tiếp."));
          break;
        }

        const res = await fetch("/api/learning/books/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId, skip: skipped.current, light }),
        });
        const json = await res.json();

        if (!json?.success) {
          setError(json?.error || t("Could not build", "Không soạn được"));
          break;
        }

        setStatus((prev) =>
          prev ? { ...prev, done: json.done, remaining: json.remaining } : prev
        );
        const last = json.made?.[json.made.length - 1];
        setCurrent(last ? `${last.label}` : null);
        if (json.made?.length > 0) onProgress?.();

        if (json.stopped === "quota") {
          setNote(
            t(
              `Daily AI limit reached. ${json.remaining} parts left — carry on tomorrow.`,
              `Hết hạn mức AI hôm nay. Còn ${json.remaining} phần — mai soạn tiếp.`
            )
          );
          break;
        }
        // Một phần hỏng thì ghi vào danh sách bỏ qua rồi đi tiếp. Dừng cả cuốn
        // vì một unit là bắt người dùng ngồi bấm lại từng lượt.
        if (json.failed) {
          skipped.current = [...skipped.current, `${json.failed.step}:${json.failed.part}`];
          if (skipped.current.length >= SKIP_LIMIT && !light) {
            light = true;
            skipped.current = [];
            setNote(
              t(
                "Several parts were slow — retrying with shorter exercise sets…",
                "Nhiều phần chạy quá lâu — thử lại với bộ bài tập ngắn hơn…"
              )
            );
            continue;
          }
          if (skipped.current.length >= SKIP_LIMIT) {
            setError(
              t(
                `Gave up after ${SKIP_LIMIT} parts failed. Try again later.`,
                `Đã bỏ qua ${SKIP_LIMIT} phần vì soạn hỏng, dừng ở đây. Thử lại sau.`
              )
            );
            break;
          }
          setNote(
            t(
              `Unit ${json.failed.label} was slow — skipped for now, ${skipped.current.length}/${SKIP_LIMIT}.`,
              `Unit ${json.failed.label} soạn quá lâu — tạm bỏ qua, ${skipped.current.length}/${SKIP_LIMIT}.`
            )
          );
          continue;
        }
        // Hết phần làm được: mọi thứ còn thiếu đều đã bỏ qua. Thử lại một lượt
        // với bản nhẹ trước khi chịu thua — phần hỏng vì dài thì bản ngắn qua
        // được, mà để lại cho lần sau thì lần sau cũng hỏng đúng như vậy.
        if (json.stopped === "skipped") {
          if (!light) {
            light = true;
            skipped.current = [];
            setNote(
              t(
                `Retrying ${json.remaining} slow parts with shorter exercise sets…`,
                `Thử lại ${json.remaining} phần chạy quá lâu, với bộ bài tập ngắn hơn…`
              )
            );
            continue;
          }
          setNote(
            t(
              `${json.remaining} parts were skipped this run. Open this again later to retry them.`,
              `Còn ${json.remaining} phần đã bỏ qua trong lượt này. Mở lại sau để soạn tiếp chúng.`
            )
          );
          break;
        }
        if (json.stopped) {
          setError(json.error || t("Stopped partway", "Dừng giữa đường"));
          break;
        }
        if (json.remaining === 0) {
          setNote(t("The whole book is ready.", "Cả cuốn đã soạn xong."));
          break;
        }
        // Không soạn được phần nào, cũng không báo phần nào hỏng, mà vẫn còn
        // việc: gọi tiếp chỉ lặp vô ích.
        if (!json.made || json.made.length === 0) {
          setError(t("Nothing was built this round", "Lượt này không soạn được phần nào"));
          break;
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
      setCurrent(null);
      // Đọc lại trạng thái thật một lần khi dừng. Trong lúc chạy, con số điểm
      // ngữ pháp không đổi theo từng lượt — nó đến từ lượt đọc đầu tiên — nên
      // để nguyên là bày một con số đã cũ ngay trên màn hình.
      try {
        const fresh = await fetch(
          `/api/learning/books/build?bookId=${encodeURIComponent(bookId)}`
        ).then((r) => r.json());
        if (fresh?.success) setStatus(fresh);
      } catch {
        // Đọc lại hỏng thì giữ con số đang có, không đáng báo lỗi.
      }
    }
  };

  if (loadedFor !== bookId || !status) return null;

  const pct = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;
  const complete = status.remaining === 0;

  return (
    <div className="c-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="c-h5 flex items-center gap-2">
            {complete ? <CircleCheck size={16} /> : <Sparkles size={16} />}
            {t("Lessons and exercises", "Bài học và bài tập")}
          </p>
          <p className="c-help">
            {complete
              ? t(
                  "Every unit has a lesson and an exercise set.",
                  "Mọi unit đều đã có phần lý thuyết và phần bài tập."
                )
              : t(
                  "Build them for every unit in one go. Runs in batches, picks up where it left off.",
                  "Soạn một lượt cho mọi unit. Chạy theo từng đợt, dừng giữa đường thì mở lại là tiếp."
                )}
          </p>
        </div>
        {!complete && (
          <button
            onClick={running ? () => { stop.current = true; } : () => void run()}
            className={`c-btn flex-none ${running ? "c-btn-secondary" : "c-btn-primary"}`}
          >
            {running ? (
              <>
                <Pause size={16} />
                {t("Pause", "Tạm dừng")}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {status.done > 0 ? t("Carry on", "Soạn tiếp") : t("Build all", "Soạn cả sách")}
              </>
            )}
          </button>
        )}
      </div>

      <div className="c-progress">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="c-stat-label tabular-nums flex items-center gap-2">
        {running && <Loader2 size={13} className="animate-spin" />}
        {t(
          `${status.done} of ${status.total} parts · ${status.stepCount} units`,
          `Xong ${status.done}/${status.total} phần · ${status.stepCount} unit`
        )}
        {running && current && ` · ${t(`unit ${current}`, `unit ${current}`)}`}
      </p>

      {status.grammarNotes > 0 && (
        <p className="c-help flex items-center gap-2">
          <Feather size={13} />
          {t(
            `${status.grammarNotes} grammar points from this book are in the Grammar section.`,
            `${status.grammarNotes} điểm ngữ pháp của sách này đã vào mục Ngữ pháp.`
          )}
        </p>
      )}

      {/* Điểm đứng riêng có thể là điểm khung thật sự chưa có, mà cũng có thể
          là đối chiếu hụt. Một lượt gọi AI so lại tên là biết. */}
      {status.looseNotes > 0 && !running && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="c-help flex items-center gap-2">
            <GitMerge size={13} />
            {t(
              `${status.looseNotes} of them sit on their own branch.`,
              `Trong đó ${status.looseNotes} điểm đang đứng thành nhánh riêng.`
            )}
          </p>
          <button
            onClick={() => void remap()}
            disabled={busy}
            className="c-btn c-btn-secondary c-btn-sm flex-none"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <GitMerge size={15} />}
            {t("Match against the syllabus", "Đối chiếu lại với khung")}
          </button>
        </div>
      )}

      {note && <p className="c-help">{note}</p>}
      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={18} className="icon" />
          <p className="flex-1">{error}</p>
        </div>
      )}
    </div>
  );
}
