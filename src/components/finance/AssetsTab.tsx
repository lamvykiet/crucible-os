"use client";

import { useEffect, useState } from "react";
import { Building2, Link2, Package, Pencil, Plus, Trash2, TrendingDown, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import AssetModal, { type AssetDraft } from "./AssetModal";
import { todayLocalIso } from "@/lib/localDate";

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
  debtId: string | null;
  debtName: string | null;
  outstandingDebt: number;
  equity: number;
  debtAsOf: string | null;
}

interface Totals {
  count: number;
  acquisitionCost: number;
  worth: number;
  debt: number;
  equity: number;
  monthlyDepreciation: number;
}

const formatVND = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

const CATEGORY_ICON: Record<string, typeof Package> = {
  "Real Estate": Building2,
};

export default function AssetsTab() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [unlinkedDebts, setUnlinkedDebts] = useState<{ id: string; name: string }[]>([]);
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
          setErrorText("");
        } else {
          setErrorText(json.error || "Không tải được danh sách tài sản");
        }
      } catch {
        if (!ignore) setErrorText("Không tải được danh sách tài sản");
      }
    })();
    return () => { ignore = true; };
  }, [reloadTick]);

  const allDebts = [
    ...unlinkedDebts,
    ...(assets ?? [])
      .filter((a) => a.debtId && a.debtName)
      .map((a) => ({ id: a.debtId as string, name: a.debtName as string })),
  ].filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i);

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
            disposalDate: null, disposalAmount: null, debtId, notes: "",
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
      debtId: a.debtId, notes: a.notes,
    });
    setOpenSeq((n) => n + 1);
    setIsModalOpen(true);
  };

  const handleDelete = async (a: AssetRow) => {
    if (!confirm(t(`Delete "${a.name}"?`, `Xoá "${a.name}"?`))) return;
    const res = await fetch(`/api/finance/assets?id=${a.id}`, { method: "DELETE" });
    if (res.ok) setReloadTick((n) => n + 1);
  };

  const card = (
    icon: React.ReactNode,
    label: string,
    value: string,
    hint: string,
    tone = "text-[var(--color-text)]"
  ) => (
    <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm flex flex-col justify-center">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center flex-none">
          {icon}
        </div>
        <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </div>
      </div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-[var(--color-text-faint)] mt-1">{hint}</div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="c-h2 text-[var(--color-text)]">{t("Assets", "Tài sản")}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {t(
              "What you own, what it is worth today, and how much of it is really yours",
              "Bạn đang sở hữu gì, hôm nay đáng bao nhiêu, và bao nhiêu thực sự là của bạn"
            )}
          </p>
        </div>
        <button onClick={() => openNew()} className="c-btn c-btn-primary c-btn-pill shadow-sm">
          <Plus size={16} />
          {t("Add asset", "Thêm tài sản")}
        </button>
      </div>

      {errorText && (
        <div className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-4 rounded-xl">
          {errorText}
        </div>
      )}

      {/* Khoản vay chưa gắn tài sản — phần lớn nhất của bảng cân đối mà bị bỏ sót */}
      {unlinkedDebts.map((d) => (
        <div
          key={d.id}
          className="bg-[var(--color-warning-tint)] border border-[var(--color-warning)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 text-sm text-[var(--color-warning)]">
            <Link2 size={18} className="flex-none" />
            <span>
              {t("Loan", "Khoản vay")} <b>{d.name}</b>{" "}
              {t(
                "is not linked to any asset yet, so its equity cannot be computed.",
                "chưa gắn với tài sản nào, nên chưa tính được vốn chủ sở hữu."
              )}
            </span>
          </div>
          <button onClick={() => openNew(d.id)} className="c-btn c-btn-secondary c-btn-sm">
            {t("Add the asset", "Thêm tài sản cho khoản vay này")}
          </button>
        </div>
      ))}

      {totals && totals.count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {card(
            <Package size={20} />,
            t("Current worth", "Giá trị hiện tại"),
            formatVND(totals.worth),
            `${totals.count} ${t("assets", "tài sản")}`
          )}
          {card(
            <Wallet size={20} />,
            t("Your equity", "Vốn chủ sở hữu"),
            formatVND(totals.equity),
            t("worth minus outstanding loans", "giá trị trừ dư nợ còn lại"),
            totals.equity < 0 ? "text-[var(--color-error)]" : "text-[var(--color-success)]"
          )}
          {card(
            <Building2 size={20} />,
            t("Outstanding loans", "Dư nợ còn lại"),
            formatVND(totals.debt),
            t("linked to these assets", "gắn với các tài sản này"),
            "text-[var(--color-warning)]"
          )}
          {card(
            <TrendingDown size={20} />,
            t("Depreciation", "Khấu hao"),
            formatVND(totals.monthlyDepreciation),
            t("per month, book value", "mỗi tháng, theo sổ sách")
          )}
        </div>
      )}

      {assets === null && !errorText && (
        <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
      )}

      {assets && assets.length === 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-8 border border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("No assets recorded yet.", "Chưa ghi tài sản nào.")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(assets ?? []).map((a) => {
          const Icon = CATEGORY_ICON[a.category] ?? Package;
          const noDep = a.monthlyDepreciation === 0;
          const worn = a.acquisitionCost > 0
            ? Math.min(100, (a.accumulatedDepreciation / a.acquisitionCost) * 100)
            : 0;
          return (
            <div
              key={a.id}
              className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] flex items-center justify-center flex-none">
                    <Icon size={20} />
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
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(a)}
                    aria-label={t("Edit", "Sửa")}
                    className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    aria-label={t("Delete", "Xoá")}
                    className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-tint)] transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    {a.currentValue !== null
                      ? t("Valued at", "Định giá")
                      : t("Book value", "Giá trị sổ sách")}
                  </div>
                  <div className="text-lg font-bold text-[var(--color-text)] tabular-nums">
                    {formatVND(a.worth)}
                  </div>
                </div>
                {a.debtId && (
                  <div>
                    <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {t("Your equity", "Vốn chủ sở hữu")}
                    </div>
                    <div
                      className={`text-lg font-bold tabular-nums ${
                        a.equity < 0 ? "text-[var(--color-error)]" : "text-[var(--color-success)]"
                      }`}
                    >
                      {formatVND(a.equity)}
                    </div>
                  </div>
                )}
              </div>

              {a.debtId && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {t("Loan", "Khoản vay")} <b>{a.debtName}</b> ·{" "}
                  {t("outstanding", "dư nợ")} {formatVND(a.outstandingDebt)}
                  {a.debtAsOf && ` (${t("as of", "tới")} ${a.debtAsOf})`}
                </p>
              )}

              {!noDep && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                    <span>
                      {t("Depreciated", "Đã khấu hao")} {formatVND(a.accumulatedDepreciation)}
                    </span>
                    <span>
                      {a.remainingLifeMonths} {t("months left", "tháng còn lại")}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-warning)] transition-all"
                      style={{ width: `${Math.max(2, worn)}%` }}
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
