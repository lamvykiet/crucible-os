"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Edit2, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";
import TransactionModal from "./TransactionModal";
import { thisMonthLocalIso } from "@/lib/localDate";

interface Transaction {
  id: string;
  date: string;
  type: string;
  supplier: string;
  amount: number;
  category: string;
  note: string;
  items?: any[];
}

const formatVND = (amount: number) => new Intl.NumberFormat("vi-VN").format(amount) + " ₫";

export default function HistoryTab() {
  const { t } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => thisMonthLocalIso());
  const [typeFilter, setTypeFilter] = useState("All");

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

  const handleEdit = (tx: Transaction) => {
    // Map history tx structure to modal structure
    setSelectedTx({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      supplier: tx.supplier,
      amount: tx.amount, // Total amount
      categoryGroup: tx.category,
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

      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" size={16} />
            <input 
              type="text" 
              placeholder={t("Search transactions...", "Tìm kiếm giao dịch...")}
              className="w-full bg-[var(--color-surface-2)] border-none rounded-lg pl-9 pr-4 py-2 text-base md:text-sm text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-success)] focus:outline-none"
            />
          </div>
          <button className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] rounded-lg transition-colors">
            <Filter size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-[var(--color-success)]">
            <span className="animate-spin text-4xl leading-none">⍥</span>
            <span className="ml-3 font-bold">{t("Loading...", "Đang tải...")}</span>
          </div>
        ) : transactions.length === 0 ? (
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
                {transactions.map((tx) => (
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
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(tx)}
                          disabled={isDeleting === tx.id}
                          className="p-1.5 text-[var(--color-info)] hover:bg-[var(--color-surface)] rounded-md transition-colors"
                          title={t("Chỉnh sửa", "Edit")}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(tx.id)}
                          disabled={isDeleting === tx.id}
                          className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error-tint)] rounded-md transition-colors disabled:opacity-50"
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
