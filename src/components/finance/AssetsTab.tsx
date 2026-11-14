"use client";

import { useEffect, useState } from "react";
import { Building2, Link2, Package, Pencil, Plus, Trash2, TrendingDown, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import AssetModal, { type AssetDraft } from "./AssetModal";
import { todayLocalIso } from "@/lib/localDate";
import { formatVND } from "@/lib/formatMoney";
import { VIZ } from "@/lib/viz";
import MetricCard from "@/components/charts/MetricCard";

// Tài sản và công cụ dụng cụ.
//
// Hai con số dễ lẫn, nên trình bày tách bạch:
//   GIÁ TRỊ  — tài sản đáng bao nhiêu hôm nay (sổ sách, hoặc định giá lại).
//   VỐN CHỦ SỞ HỮU — phần thực sự là của bạn: giá trị trừ dư nợ còn lại.
//
// Trả gốc không làm tài sản đắt lên, nó làm nợ nhỏ đi — vốn chủ sở hữu tự tăng
// đúng bằng số đó.

interface AssetRow {
  id: string;
  name: string;
  category: string;
  acquisitionDate: string;
  acquisitionCost: number;
  depreciationMethod: string;
  usefulLifeMonths: number;
  salvageValue: number;
  currentValue: number | null;
  valuationDate: string | null;
  status: string;
  disposalDate: string | null;
  disposalAmount: number | null;
  notes: string;
  accumulatedDepreciation: number;
  bookValue: number;
  monthlyDepreciation: number;
  remainingLifeMonths: number;
  worth: number;
  loans: { id: string; name: string; outstanding: number; asOf: string | null }[];
  outstandingDebt: number;
  equity: number;
}

interface Totals {
  count: number;
  acquisitionCost: number;
  worth: number;
  debt: number;
  equity: number;
  monthlyDepreciation: number;
}

const CATEGORY_ICON: Record<string, typeof Package> = {
  "Real Estate": Building2,
};

export default function AssetsTab() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [unlinkedDebts, setUnlinkedDebts] = useState<{ id: string; name: string }[]>([]);
  // Mọi khoản vay, để form chọn. Khác với `unlinkedDebts` vốn chỉ là danh sách
  // ĐÁNG NHẮC — vay tín chấp không nằm trong đó vì nó không thế chấp gì cả.
  const [allDebts, setAllDebts] = useState<{ id: string; name: string }[]>([]);
  const [errorText, setErrorText] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [editing, setEditing] = useState<AssetDraft | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Tăng mỗi lần mở modal. Dùng làm `key` để React tạo mới component, nhờ đó
  // form luôn nạp đúng `initial`. Không có nó thì hai lần mở form THÊM MỚI đều
  // có id undefined, modal tưởng không đổi gì và giữ nguyên giá trị lần trước —
  // nút "thêm tài sản cho khoản vay này" thành vô tác dụng.
  const [openSeq, setOpenSeq] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/finance/assets");
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setAssets(json.data.assets);
          setTotals(json.data.totals);
          setCategories(json.data.categories);
          setUnlinkedDebts(json.data.unlinkedDebts);
          setAllDebts(json.data.allDebts ?? []);
          setErrorText("");
        } else {
          setErrorText(json.error || "load");
        }
      } catch {
        if (!ignore) setErrorText("load");
      }
    })();
    return () => { ignore = true; };
  }, [reloadTick]);

  // Gắn sẵn khoản vay và chọn sẵn nhóm bất động sản, nhưng KHÔNG điền sẵn
  // nguyên giá — tôi không biết bạn mua căn nhà bao nhiêu, và một con số bịa
  // sẽ lặng lẽ làm sai mọi phép tính vốn chủ sở hữu về sau.
  const openNew = (debtId?: string) => {
    setEditing(
      debtId
        ? {
            name: "", category: "Real Estate",
            acquisitionDate: todayLocalIso(), acquisitionCost: 0,
            depreciationMethod: "none", usefulLifeMonths: 0, salvageValue: 0,
            currentValue: null, valuationDate: null, status: "owned",
            disposalDate: null, disposalAmount: null, debtIds: [debtId], notes: "",
          }
        : null
    );
    setOpenSeq((n) => n + 1);
    setIsModalOpen(true);
  };

  const openEdit = (a: AssetRow) => {
    setEditing({
      id: a.id, name: a.name, category: a.category,
      acquisitionDate: a.acquisitionDate, acquisitionCost: a.acquisitionCost,
      depreciationMethod: a.depreciationMethod, usefulLifeMonths: a.usefulLifeMonths,
      salvageValue: a.salvageValue, currentValue: a.currentValue,
      valuationDate: a.valuationDate, status: a.status,
      disposalDate: a.disposalDate, disposalAmount: a.disposalAmount,
      debtIds: a.loans.map((l) => l.id), notes: a.notes,
    });
    setOpenSeq((n) => n + 1);
    setIsModalOpen(true);
  };

  const handleDelete = async (a: AssetRow) => {
    if (!confirm(t(`Delete "${a.name}"?`, `Xoá "${a.name}"?`))) return;
    const res = await fetch(`/api/finance/assets?id=${a.id}`, { method: "DELETE" });
    if (res.ok) setReloadTick((n) => n + 1);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="c-h2 c-page-title text-[var(--color-text)]">{t("Assets", "Tài sản")}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t(
              "What you own, what it is worth today, and how much of it is really yours",
              "Bạn đang sở hữu gì, hôm nay đáng bao nhiêu, và bao nhiêu thực sự là của bạn"
            )}
          </p>
        </div>
        <button
          onClick={() => openNew()}
          aria-label={t("Add asset", "Thêm tài sản")}
          title={t("Add asset", "Thêm tài sản")}
          className="c-btn c-btn-primary w-11 h-11 p-0! [&>svg]:shrink-0 md:w-auto md:h-auto md:px-5! md:py-2.5!"
        >
          <Plus size={16} /> <span className="hidden md:inline">{t("Add asset", "Thêm tài sản")}</span>
        </button>
      </div>

      {errorText && (
        <div className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-4 rounded-xl">
          {errorText === "load"
            ? t("Could not load the asset list.", "Không tải được danh sách tài sản.")
            : errorText}
        </div>
      )}

      {/* Khoản vay chưa gắn tài sản — phần lớn nhất của bảng cân đối mà bị bỏ sót */}
      {unlinkedDebts.map((d) => (
        <div
          key={d.id}
          className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--color-warning-tint)] p-4"
        >
          <Link2 size={18} className="flex-none text-[var(--color-warning)]" aria-hidden />
          <p className="min-w-0 flex-1 basis-56 text-sm text-[var(--color-text)]">
              {t("Loan", "Khoản vay")} <b>{d.name}</b>{" "}
              {t(
                "is not linked to any asset yet, so its equity cannot be computed.",
                "chưa gắn với tài sản nào, nên chưa tính được vốn chủ sở hữu."
              )}
          </p>
          <button onClick={() => openNew(d.id)} className="c-btn c-btn-secondary c-btn-sm min-h-11">
            {t("Add the asset", "Thêm tài sản cho khoản vay này")}
          </button>
        </div>
      ))}

      {totals && totals.count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Số MỨC màu mực; chỉ vốn chủ ÂM (nợ vượt giá trị) mới là tin xấu. */}
          <MetricCard
            size="sm"
            icon={<Package size={16} />}
            label={t("Current worth", "Giá trị hiện tại")}
            value={formatVND(totals.worth)}
            note={`${totals.count} ${t("assets", "tài sản")}`}
          />
          <MetricCard
            size="sm"
            icon={<Wallet size={16} />}
            label={t("Your equity", "Vốn chủ sở hữu")}
            value={formatVND(totals.equity)}
            tone={totals.equity < 0 ? "bad" : "neutral"}
            note={t("worth minus outstanding loans", "giá trị trừ dư nợ còn lại")}
          />
          <MetricCard
            size="sm"
            icon={<Building2 size={16} />}
            label={t("Outstanding loans", "Dư nợ còn lại")}
            value={formatVND(totals.debt)}
            note={t("linked to these assets", "gắn với các tài sản này")}
          />
          <MetricCard
            size="sm"
            icon={<TrendingDown size={16} />}
            label={t("Depreciation", "Khấu hao")}
            value={formatVND(totals.monthlyDepreciation)}
            note={t("per month, book value", "mỗi tháng, theo sổ sách")}
          />
        </div>
      )}

      {assets === null && !errorText && (
        <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
      )}

      {assets && assets.length === 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 md:p-8 flex flex-col items-center gap-2 text-center">
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("No assets recorded yet", "Chưa ghi tài sản nào")}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-xl">
            {t(
              "Add what you own with its purchase price and date to see what it is worth today and how much of it is yours.",
              "Thêm thứ bạn đang sở hữu kèm giá mua và ngày mua để thấy hôm nay nó đáng bao nhiêu và bao nhiêu là của bạn."
            )}
          </p>
          <button onClick={() => openNew()} className="mt-3 c-btn c-btn-primary">
            <Plus size={16} /> {t("Add asset", "Thêm tài sản")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(assets ?? []).map((a) => {
          const Icon = CATEGORY_ICON[a.category] ?? Package;
          const noDep = a.monthlyDepreciation === 0;
          const worn = a.acquisitionCost > 0
            ? Math.min(100, (a.accumulatedDepreciation / a.acquisitionCost) * 100)
            : 0;
          return (
            <div
              key={a.id}
              className="bg-[var(--color-surface)] rounded-2xl p-5 md:p-6 border border-[var(--color-border)] flex flex-col min-w-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center flex-none">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="c-h5 text-[var(--color-text)] truncate" title={a.name}>
                      {a.name}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {a.category} · {t("bought", "mua")} {a.acquisitionDate} ·{" "}
                      {formatVND(a.acquisitionCost)}
                      {a.status !== "owned" && ` · ${a.status === "sold" ? t("sold", "đã bán") : t("written off", "đã thanh lý")}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center shrink-0 -mr-2 -mt-2">
                  <button
                    onClick={() => openEdit(a)}
                    aria-label={t("Edit", "Sửa")}
                    className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    aria-label={t("Delete", "Xoá")}
                    className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-tint)] transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <div className="c-overline text-[var(--color-text-muted)]">
                    {a.currentValue !== null
                      ? t("Valued at", "Định giá")
                      : t("Book value", "Giá trị sổ sách")}
                  </div>
                  <div className="mt-1 c-metric-value-sm whitespace-nowrap text-[var(--color-text)]">
                    {formatVND(a.worth)}
                  </div>
                </div>
                {a.loans.length > 0 && (
                  <div>
                    <div className="c-overline text-[var(--color-text-muted)]">
                      {t("Your equity", "Vốn chủ sở hữu")}
                    </div>
                    <div
                      className={`mt-1 c-metric-value-sm whitespace-nowrap ${
                        a.equity < 0 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"
                      }`}
                    >
                      {formatVND(a.equity)}
                    </div>
                  </div>
                )}
              </div>

              {a.loans.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                  {a.loans.map((l) => (
                    <li key={l.id} className="text-xs tabular-nums text-[var(--color-text-muted)]">
                      {l.name} · {t("outstanding", "dư nợ")} {formatVND(l.outstanding)}
                      {l.asOf && ` (${t("as of", "tới")} ${l.asOf})`}
                    </li>
                  ))}
                  {a.loans.length > 1 && (
                    <li className="text-xs font-semibold tabular-nums text-[var(--color-text)]">
                      {t("total", "tổng")} {formatVND(a.outstandingDebt)}
                    </li>
                  )}
                </ul>
              )}

              {!noDep && (
                <div className="mt-4">
                  <div className="flex justify-between gap-3 text-xs tabular-nums text-[var(--color-text-muted)] mb-1.5">
                    <span>
                      {t("Depreciated", "Đã khấu hao")} {formatVND(a.accumulatedDepreciation)}
                    </span>
                    <span>
                      {a.remainingLifeMonths} {t("months left", "tháng còn lại")}
                    </span>
                  </div>
                  {/* Khấu hao là tiến độ, không phải tốt/xấu: rãnh xám, phần
                      đã khấu hao màu nhấn — không dùng màu cảnh báo. */}
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: VIZ.ghost }} aria-hidden>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, worn))}%`, minWidth: worn > 0 ? 4 : 0, background: VIZ.accent }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-faint)]">
                    {formatVND(a.monthlyDepreciation)}/{t("month", "tháng")}
                  </p>
                </div>
              )}

              {a.notes && (
                <p className="mt-3 text-xs text-[var(--color-text-faint)]">{a.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      <AssetModal
        key={openSeq}
        isOpen={isModalOpen}
        initial={editing}
        categories={categories}
        debts={allDebts}
        onClose={() => { setIsModalOpen(false); setEditing(null); }}
        onSaved={() => setReloadTick((n) => n + 1)}
      />
    </div>
  );
}
