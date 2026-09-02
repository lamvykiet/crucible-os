"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Edit2, Trash2, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import TransactionModal from "./TransactionModal";
import { thisMonthLocalIso } from "@/lib/localDate";
import { normalizeSupplier, PAYMENT_METHOD_LABELS } from "@/lib/invoice";
import TransactionCalendar from "./TransactionCalendar";

interface Transaction {
  id: string;
  date: string;
  type: string;
  supplier: string;
  amount: number;
  category: string;
  subGroup: string;
  paymentMethod: string;
  source: string;
  /** Id ảnh trên Drive, nhiều ảnh thì ngăn bằng dấu phẩy. */
  driveFileId: string | null;
  note: string;
  items?: any[];
}

const formatVND = (amount: number) => new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

export default function HistoryTab() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => thisMonthLocalIso());
  const [typeFilter, setTypeFilter] = useState("All");
  // Ngày đang lọc, chọn bằng cách chạm vào ô trên lịch. Rỗng là xem cả tháng.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [catFilter, setCatFilter] = useState("All");
  const [payFilter, setPayFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const loadTransactions = async (controller?: AbortController) => {
    setIsLoading(true);
    try {
      const monthParam = selectedMonth || thisMonthLocalIso();
      const res = await fetch(`/api/finance/history?month=${monthParam}&type=${typeFilter}`, { 
        signal: controller?.signal 
      });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.success) {
        setTransactions(result.data);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setTransactions([]);
    } finally {
      if (!controller?.signal.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadTransactions(controller);
    return () => controller.abort();
  }, [selectedMonth, typeFilter]);

  // Đổi tháng thì bỏ bộ lọc ngày: giữ lại sẽ trỏ tới một ngày không còn nằm
  // trong tháng đang xem, và danh sách trống trơn mà không rõ vì sao.
  const [lastMonth, setLastMonth] = useState(selectedMonth);
  if (selectedMonth !== lastMonth) {
    setLastMonth(selectedMonth);
    setSelectedDay(null);
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("Bạn có chắc chắn muốn xóa giao dịch này không?", "Are you sure you want to delete this transaction?"))) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/finance/transaction?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setTransactions(prev => prev.filter(t => t.id !== id));
      } else {
        alert("Failed to delete transaction");
      }
    } catch (err) {
      alert("Error deleting transaction");
    } finally {
      setIsDeleting(null);
    }
  };

  // Mọi bộ lọc chạy trong bộ nhớ, không gọi lại máy chủ: dữ liệu của cả tháng
  // đã nằm sẵn trong `transactions`.
  //
  // Tìm kiếm bỏ dấu bằng `normalizeSupplier` — cùng hàm mà luồng OCR dùng để
  // dò trùng nhà cung cấp. Gõ "ca phe" phải ra "Cà phê Cốc", vì không ai gõ
  // dấu khi đang tìm vội.
  const q = normalizeSupplier(query);
  const qDigits = query.replace(/[^0-9]/g, "");

  const matches = (tx: Transaction) => {
    if (!query.trim()) return true;
    if (q) {
      const hay = normalizeSupplier(
        [tx.supplier, tx.category, tx.subGroup, tx.note].join(" ")
      );
      if (hay.includes(q)) return true;
    }
    // Gõ số thì tìm theo số tiền, kể cả khi gõ có dấu chấm ngăn nghìn.
    if (qDigits && String(tx.amount).includes(qDigits)) return true;
    return false;
  };

  const isIncomplete = (tx: Transaction) =>
    !tx.subGroup || tx.paymentMethod === "unknown" || !(tx.items?.length);

  const shown = transactions
    .filter((tx) => !selectedDay || tx.date === selectedDay)
    .filter((tx) => catFilter === "All" || tx.category === catFilter)
    .filter((tx) => payFilter === "All" || tx.paymentMethod === payFilter)
    .filter((tx) => sourceFilter === "All" || tx.source === sourceFilter)
    .filter((tx) => !onlyIncomplete || isIncomplete(tx))
    .filter(matches);

  // Nhóm chi tiêu lấy từ chính dữ liệu đang có, không lấy từ bảng Category:
  // lọc theo một nhóm không xuất hiện trong tháng chỉ cho ra danh sách trống.
  const categories = [...new Set(transactions.map((tx) => tx.category))].sort();
  const activeFilters =
    (catFilter !== "All" ? 1 : 0) +
    (payFilter !== "All" ? 1 : 0) +
    (sourceFilter !== "All" ? 1 : 0) +
    (onlyIncomplete ? 1 : 0);

  const clearFilters = () => {
    setCatFilter("All");
    setPayFilter("All");
    setSourceFilter("All");
    setOnlyIncomplete(false);
  };

  const handleEdit = (tx: Transaction) => {
    // Chuyển sang hình dạng mà modal cần. PHẢI mang theo `subGroup` và
    // `paymentMethod`: thiếu chúng thì form mở ra với ô trống rồi ghi đè mất
    // giá trị thật khi lưu.
    setSelectedTx({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      supplier: tx.supplier,
      amount: tx.amount, // Total amount
      categoryGroup: tx.category,
      subGroup: tx.subGroup,
      paymentMethod: tx.paymentMethod,
      source: tx.source,
      driveFileId: tx.driveFileId,
      notes: tx.note,
      totalAmount: tx.amount,
      items: tx.items
    });
    setEditModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="c-h2 text-[var(--color-text)]">
            {t("Transaction History", "Lịch sử Giao dịch")}
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {t("View all your recorded transactions", "Xem tất cả giao dịch đã ghi nhận")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-success)]"
          >
            <option value="All">{t("All Types", "Tất cả các loại")}</option>
            <option value="Income">{t("Income", "Thu nhập")}</option>
            <option value="Expense">{t("Expense", "Chi phí")}</option>
            <option value="Refund">{t("Refund", "Hoàn tiền")}</option>
          </select>
          <CustomMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      <TransactionCalendar
        month={selectedMonth}
        transactions={transactions}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />

      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search transactions...", "Tìm kiếm giao dịch...")}
              className="w-full bg-[var(--color-surface-2)] border-none rounded-lg pl-9 pr-9 py-2 text-base md:text-sm text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-success)] focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label={t("Clear search", "Xoá tìm kiếm")}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            aria-label={t("Filters", "Bộ lọc")}
            className={`relative w-11 h-11 flex items-center justify-center rounded-lg transition-colors ${
              filterOpen || activeFilters > 0
                ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            <Filter size={18} />
            {activeFilters > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[10px] font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Bảng lọc mở rộng theo chiều dọc thay vì popover nổi: trên điện thoại
            popover neo vào một nút 44px rất dễ tràn mép màn hình. */}
        {filterOpen && (
          <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1.5">
              <span className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Category", "Nhóm chi tiêu")}
              </span>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="All">{t("All", "Tất cả")}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Payment", "Cách thanh toán")}
              </span>
              <select
                value={payFilter}
                onChange={(e) => setPayFilter(e.target.value)}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="All">{t("All", "Tất cả")}</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                {t("Source", "Nguồn")}
              </span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="All">{t("All", "Tất cả")}</option>
                <option value="manual">{t("Entered by hand", "Nhập tay")}</option>
                <option value="ocr">{t("Scanned receipt", "Quét hoá đơn")}</option>
                <option value="debt">{t("From loan schedule", "Từ lịch trả nợ")}</option>
              </select>
            </label>

            <div className="md:col-span-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 min-h-11 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyIncomplete}
                  onChange={(e) => setOnlyIncomplete(e.target.checked)}
                  className="w-5 h-5 accent-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-text)]">
                  {t("Only rows missing data", "Chỉ dòng còn thiếu dữ liệu")}
                </span>
              </label>
              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm min-h-11 px-3 text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
                >
                  {t("Clear filters", "Xoá bộ lọc")}
                </button>
              )}
            </div>
          </div>
        )}

        {(query || activeFilters > 0 || selectedDay) && (
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            {shown.length} / {transactions.length} {t("transactions", "giao dịch")}
            {selectedDay && ` · ${t("day", "ngày")} ${selectedDay}`}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-[var(--color-success)]">
            <span className="animate-spin text-4xl leading-none">⍥</span>
            <span className="ml-3 font-bold">{t("Loading...", "Đang tải...")}</span>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <p className="text-[var(--color-text-muted)]">
              {t("No transactions found for this period.", "Không tìm thấy giao dịch nào trong khoảng thời gian này.")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold">{t("Date", "Ngày")}</th>
                  <th className="p-4 font-bold">{t("Type", "Loại")}</th>
                  <th className="p-4 font-bold">{t("Category", "Danh mục")}</th>
                  <th className="p-4 font-bold">{t("Merchant/Source", "Đối tác/Nguồn")}</th>
                  <th className="p-4 font-bold text-right">{t("Amount", "Số tiền")}</th>
                  <th className="p-4 font-bold text-right">{t("Actions", "Thao tác")}</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-[var(--color-border)]">
                {shown.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="p-4 text-[var(--color-text)] whitespace-nowrap">{tx.date}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        tx.type.toLowerCase() === 'income' ? 'bg-[var(--color-success-tint)] text-[var(--color-success)]' :
                        tx.type.toLowerCase() === 'expense' ? 'bg-[var(--color-warning-tint)] text-[var(--color-warning)]' :
                        'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-4 text-[var(--color-text)]">{tx.category}</td>
                    <td className="p-4">
                      <div className="text-[var(--color-text)] font-semibold">{tx.supplier}</div>
                      {tx.note && <div className="text-xs text-[var(--color-text-faint)] truncate max-w-xs">{tx.note}</div>}
                    </td>
                    <td className={`p-4 text-right font-bold whitespace-nowrap ${
                      tx.type.toLowerCase() === 'income' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'
                    }`}>
                      {tx.type.toLowerCase() === 'expense' ? '-' : '+'}{formatVND(tx.amount)}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {/* Vùng chạm 44px và cách nhau 12px. Trước đây hai nút
                          chỉ 28px và sát nhau — trên điện thoại rất dễ bấm
                          nhầm sang nút xoá, mà xoá thì không lấy lại được. */}
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => handleEdit(tx)}
                          disabled={isDeleting === tx.id}
                          aria-label={t("Chỉnh sửa", "Edit")}
                          className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center text-[var(--color-info)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                          title={t("Chỉnh sửa", "Edit")}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(tx.id)}
                          disabled={isDeleting === tx.id}
                          aria-label={t("Xóa", "Delete")}
                          className="w-11 h-11 md:w-9 md:h-9 flex items-center justify-center text-[var(--color-error)] hover:bg-[var(--color-error-tint)] rounded-lg transition-colors disabled:opacity-50"
                          title={t("Xóa", "Delete")}
                        >
                          {isDeleting === tx.id ? <span className="animate-spin inline-block">⍥</span> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TransactionModal 
        isOpen={editModalOpen} 
        onClose={() => setEditModalOpen(false)} 
        onSuccess={() => loadTransactions()} 
        defaultType={selectedTx?.type || "Expense"}
        initialData={selectedTx}
      />
    </div>
  );
}
