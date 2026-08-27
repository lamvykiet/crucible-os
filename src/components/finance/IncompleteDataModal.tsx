"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { invalidateCategories } from "@/lib/useCategories";

// Điền bù danh mục con cho nhiều giao dịch trong một lượt.
//
// Trước đây muốn bổ sung phải mở từng giao dịch trong tab Lịch sử, sửa, lưu,
// đóng — lặp lại hai mươi mấy lần. Màn này gom tất cả vào một danh sách, mỗi
// dòng một ô chọn chỉ chứa danh mục con hợp lệ của đúng nhóm giao dịch đó.
//
// KHÔNG điền sẵn gợi ý. "Housing" có thể là điện, nước hay internet — đoán sai
// thì số liệu sai mà không ai hay. Ô nào để trống thì giữ nguyên, không ghi.

interface Row {
  id: string;
  date: string;
  supplier: string;
  type: string;
  categoryGroup: string;
  totalAmount: number;
  options: { name: string; nameVi: string }[];
}

const formatVND = (amount: number) =>
  new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function IncompleteDataModal({ isOpen, onClose, onSaved }: Props) {
  const { t, language } = useLanguage();
  // `null` = chưa tải xong, phân biệt với "đã tải và không còn gì để bổ sung".
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const label = useCallback(
    (o: { name: string; nameVi: string }) =>
      language === "en" ? o.name : o.nameVi || o.name,
    [language]
  );

  // Tải lại bằng cách tăng biến đếm rồi để effect lo phần fetch. Gọi thẳng một
  // hàm có setState từ trong effect sẽ vi phạm react-hooks/set-state-in-effect,
  // kể cả khi setState nằm sau await.
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;

    (async () => {
      try {
        const res = await fetch("/api/finance/incomplete");
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setRows(json.data.transactions);
          setPicked({});
          setError("");
        } else {
          setError(json.error || "Không tải được");
        }
      } catch {
        if (!ignore) setError("Không tải được");
      }
    })();

    return () => {
      ignore = true;
    };
  }, [isOpen, reloadTick]);

  if (!isOpen) return null;

  const updates = Object.entries(picked)
    .filter(([, v]) => v)
    .map(([id, subGroup]) => ({ id, subGroup }));

  const handleSave = async () => {
    if (updates.length === 0) return;
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/finance/incomplete", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json();
      if (json.data?.updated) {
        setSavedCount(json.data.updated);
        // Danh mục không đổi, nhưng số liệu theo nhóm thì có — xoá cache để các
        // modal khác không hiện danh sách cũ.
        invalidateCategories();
        onSaved?.();
        setReloadTick((n) => n + 1);
      }
      if (json.data?.rejected?.length) {
        setError(
          t("Some rows were rejected: ", "Một số dòng bị từ chối: ") +
            json.data.rejected
              .map((r: { reason: string }) => r.reason)
              .join("; ")
        );
      } else if (!json.success && json.error) {
        setError(json.error);
      }
    } catch {
      setError(t("Save failed", "Lưu không thành công"));
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = rows === null;
  const grouped = (rows ?? []).reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.categoryGroup] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-4">
      <div className="bg-[var(--color-surface)] rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-2rem)] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 p-5 md:p-6 border-b border-[var(--color-border)] flex justify-between items-center gap-3">
          <div className="min-w-0">
            <h2 className="c-h3 text-[var(--color-text)]">
              {t("Fill in sub-categories", "Bổ sung danh mục con")}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {t(
                "Left blank stays untouched. Nothing is guessed for you.",
                "Để trống thì giữ nguyên. Không có gợi ý đoán sẵn."
              )}
            </p>
          </div>
          <button
            onClick={() => { setSavedCount(0); onClose(); }}
            aria-label={t("Close", "Đóng")}
            className="shrink-0 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6 space-y-6">
          {error && (
            <div className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
              {error}
            </div>
          )}
          {savedCount > 0 && (
            <div className="text-sm text-[var(--color-success)] bg-[var(--color-success-tint)] p-3 rounded-xl">
              {t("Saved ", "Đã lưu ")}
              {savedCount}
              {t(" transactions.", " giao dịch.")}
            </div>
          )}

          {isLoading && (
            <p className="text-sm text-[var(--color-text-faint)]">
              {t("Loading...", "Đang tải...")}
            </p>
          )}

          {!isLoading && rows!.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
              {t(
                "Every transaction has a sub-category. Nothing to fill in.",
                "Mọi giao dịch đều đã có danh mục con. Không còn gì để bổ sung."
              )}
            </p>
          )}

          {Object.entries(grouped).map(([group, list]) => (
            <div key={group}>
              <h3 className="c-h5 text-[var(--color-text)] mb-3">
                {group}{" "}
                <span className="text-[var(--color-text-faint)] font-normal">
                  ({list.length})
                </span>
              </h3>
              <div className="space-y-3">
                {list.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 space-y-2"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold text-[var(--color-text)] truncate">
                        {r.supplier || t("(no name)", "(chưa đặt tên)")}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-[var(--color-text-muted)]">
                        {formatVND(r.totalAmount)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-faint)]">{r.date}</p>
                    {r.options.length === 0 ? (
                      <p className="text-xs text-[var(--color-warning)]">
                        {t(
                          "This group has no sub-categories yet. Add them in Settings first.",
                          "Nhóm này chưa có danh mục con nào. Thêm ở Cài đặt trước."
                        )}
                      </p>
                    ) : (
                      <select
                        value={picked[r.id] || ""}
                        onChange={(e) =>
                          setPicked((p) => ({ ...p, [r.id]: e.target.value }))
                        }
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
                      >
                        <option value="">
                          {t("— leave blank —", "— để trống —")}
                        </option>
                        {r.options.map((o) => (
                          <option key={o.name} value={o.name}>
                            {label(o)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 p-5 md:p-6 border-t border-[var(--color-border)] flex items-center gap-4 bg-[var(--color-surface-2)]">
          <button
            onClick={handleSave}
            disabled={isSaving || updates.length === 0}
            className="c-btn c-btn-primary c-btn-lg c-btn-pill shadow-sm"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {t("Save", "Lưu")}
            {updates.length > 0 ? ` (${updates.length})` : ""}
          </button>
          <button
            onClick={() => { setSavedCount(0); onClose(); }}
            disabled={isSaving}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bold px-4 py-3 text-sm transition-colors disabled:opacity-50"
          >
            {t("Close", "Đóng")}
          </button>
        </div>
      </div>
    </div>
  );
}
