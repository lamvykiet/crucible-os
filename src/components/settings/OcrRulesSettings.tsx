"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle, Info, GraduationCap } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { MATCH_TYPES, MATCH_TYPE_LABELS } from "@/lib/classify";

interface Rule {
  id: string;
  matchType: string;
  matchValue: string;
  transactionType: string | null;
  categoryGroup: string;
  subGroup: string | null;
  priority: number;
  active: boolean;
  source: string;
}

interface OcrLog {
  id: string;
  timestamp: string;
  fileName: string | null;
  status: string;
  message: string;
  durationMs: number | null;
}

const cardClass = "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm";
const inputClass =
  "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-info)] text-[var(--color-text)]";

/**
 * Quản lý quy tắc tự phân loại và xem nhật ký OCR.
 *
 * Hai tính năng này đã có trong dự án "Sổ Chi Tiêu" (sheet Classification_Rules
 * và OCR_Logs) nhưng chưa từng được chuyển sang Crucible.
 */
export default function OcrRulesSettings() {
  const { t } = useLanguage();
  const [rules, setRules] = useState<Rule[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [logs, setLogs] = useState<OcrLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);

  const [form, setForm] = useState({
    matchType: "vendor",
    matchValue: "",
    transactionType: "Expense",
    categoryGroup: "",
    subGroup: "",
  });

  const { groupNames, subGroupsOf, label } = useCategories(form.transactionType);

  const loadRules = async () => {
    try {
      const res = await fetch("/api/finance/rules");
      const data = await res.json();
      if (data.success) {
        setRules(data.rules);
        setVendors(data.vendors);
      }
    } catch {
      setError(t("Không tải được quy tắc", "Could not load rules"));
    }
  };

  const loadLogs = async (errorsOnly: boolean) => {
    try {
      const res = await fetch(`/api/finance/ocr-logs${errorsOnly ? "?status=ERROR" : ""}`);
      const data = await res.json();
      if (data.success) setLogs(data.logs);
    } catch {
      // Nhật ký là phụ trợ; hỏng thì để trống.
    }
  };

  useEffect(() => {
    Promise.all([loadRules(), loadLogs(onlyErrors)]).finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLogs(onlyErrors);
  }, [onlyErrors]);

  const addRule = async () => {
    if (!form.matchValue.trim() || !form.categoryGroup) {
      setError(t("Cần nhập giá trị so khớp và chọn nhóm", "Enter a match value and pick a category"));
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/finance/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setForm({ ...form, matchValue: "", subGroup: "" });
        loadRules();
      } else {
        setError(data.error || t("Không lưu được", "Could not save"));
      }
    } catch {
      setError(t("Lỗi kết nối", "Connection error"));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRule = async (rule: Rule) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
    await fetch("/api/finance/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, active: !rule.active }),
    });
  };

  const deleteRule = async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/finance/rules?id=${id}`, { method: "DELETE" });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2
          className="text-2xl font-bold text-[var(--color-text)] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("Quy tắc & Nhật ký OCR", "OCR rules & logs")}
        </h2>
        <p className="text-[var(--color-text-muted)] text-sm">
          {t(
            "Quy tắc được xét trước, gợi ý của AI chỉ dùng khi không quy tắc nào khớp.",
            "Rules run first; the AI suggestion is only used when no rule matches."
          )}
        </p>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-error)] bg-[var(--color-error-tint)] p-3 rounded-xl">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10 text-[var(--color-info)]">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Thêm quy tắc */}
          <div className={cardClass}>
            <h3 className="font-bold text-[var(--color-text)] mb-4">
              {t("Thêm quy tắc", "Add a rule")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">
                  {t("Khớp theo", "Match on")}
                </label>
                <select
                  value={form.matchType}
                  onChange={(e) => setForm({ ...form, matchType: e.target.value })}
                  className={inputClass}
                >
                  {MATCH_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {t(MATCH_TYPE_LABELS[m], m)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">
                  {t("Chứa chữ", "Contains")}
                </label>
                <input
                  type="text"
                  value={form.matchValue}
                  onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
                  placeholder="satrafoods"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">
                  {t("Loại", "Type")}
                </label>
                <select
                  value={form.transactionType}
                  onChange={(e) =>
                    setForm({ ...form, transactionType: e.target.value, categoryGroup: "", subGroup: "" })
                  }
                  className={inputClass}
                >
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Refund">Refund</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">
                  {t("Nhóm", "Category")}
                </label>
                <select
                  value={form.categoryGroup}
                  onChange={(e) => setForm({ ...form, categoryGroup: e.target.value, subGroup: "" })}
                  className={inputClass}
                >
                  <option value="">{t("— Chọn —", "— Select —")}</option>
                  {groupNames.map((g) => (
                    <option key={g} value={g}>
                      {label(g)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={addRule}
                disabled={isSaving}
                className="bg-[#66c2c2] hover:bg-[var(--color-success)] text-white font-bold px-4 py-2 rounded-xl text-sm shadow flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t("Thêm", "Add")}
              </button>
            </div>

            {subGroupsOf(form.categoryGroup).length > 0 && (
              <div className="mt-3 max-w-xs">
                <label className="block text-xs font-bold text-[var(--color-info)] mb-1 uppercase">
                  {t("Nhóm phụ", "Sub-group")}
                </label>
                <select
                  value={form.subGroup}
                  onChange={(e) => setForm({ ...form, subGroup: e.target.value })}
                  className={inputClass}
                >
                  <option value="">{t("— Không chọn —", "— None —")}</option>
                  {subGroupsOf(form.categoryGroup).map((sg) => (
                    <option key={sg} value={sg}>
                      {label(sg)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Danh sách quy tắc */}
          <div className={cardClass}>
            <h3 className="font-bold text-[var(--color-text)] mb-4">
              {t("Quy tắc hiện có", "Active rules")} ({rules.length})
            </h3>

            {rules.length === 0 ? (
              <p className="text-sm text-[var(--color-text-faint)] py-6 text-center">
                {t(
                  'Chưa có quy tắc nào. Khi duyệt hóa đơn, tích "Lần sau tự chọn..." để hệ thống tự học.',
                  'No rules yet. Tick "Always use..." while approving a receipt to teach the system.'
                )}
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] ${
                      rule.active ? "bg-[var(--color-surface-2)]" : "bg-transparent opacity-50"
                    }`}
                  >
                    <button
                      onClick={() => toggleRule(rule)}
                      title={t("Bật / tắt", "Toggle")}
                      className={rule.active ? "text-[var(--color-success)]" : "text-[var(--color-text-faint)]"}
                    >
                      {rule.active ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text)] truncate">
                        <span className="text-[var(--color-text-muted)]">
                          {t(MATCH_TYPE_LABELS[rule.matchType], rule.matchType)}
                        </span>{" "}
                        <strong>&quot;{rule.matchValue}&quot;</strong> →{" "}
                        <strong>{rule.categoryGroup}</strong>
                        {rule.subGroup ? ` / ${rule.subGroup}` : ""}
                      </p>
                      <p className="text-xs text-[var(--color-text-faint)] flex items-center gap-2 mt-0.5">
                        {rule.transactionType} · {t("ưu tiên", "priority")} {rule.priority}
                        {rule.source === "learned" && (
                          <span className="inline-flex items-center gap-1 text-[var(--color-info)]">
                            <GraduationCap size={12} /> {t("tự học", "learned")}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {vendors.length > 0 && (
              <p className="text-xs text-[var(--color-text-faint)] mt-4">
                {t("Đã ghi nhận", "Recorded")} {vendors.length}{" "}
                {t("nhà cung cấp từ các hóa đơn đã duyệt.", "vendors from approved receipts.")}
              </p>
            )}
          </div>

          {/* Nhật ký OCR */}
          <div className={cardClass}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[var(--color-text)]">{t("Nhật ký OCR", "OCR log")}</h3>
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyErrors}
                  onChange={(e) => setOnlyErrors(e.target.checked)}
                  className="accent-[#66c2c2]"
                />
                {t("Chỉ xem lỗi", "Errors only")}
              </label>
            </div>

            {logs.length === 0 ? (
              <p className="text-sm text-[var(--color-text-faint)] py-6 text-center">
                {t("Chưa có bản ghi nào.", "No entries yet.")}
              </p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
                    <span className="mt-0.5 flex-none">
                      {log.status === "OK" ? (
                        <CheckCircle2 size={14} className="text-[var(--color-success)]" />
                      ) : log.status === "ERROR" ? (
                        <XCircle size={14} className="text-[var(--color-error)]" />
                      ) : (
                        <Info size={14} className="text-[var(--color-info)]" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text)] break-words">{log.message}</p>
                      <p className="text-xs text-[var(--color-text-faint)]">
                        {new Date(log.timestamp).toLocaleString("vi-VN")}
                        {log.fileName ? ` · ${log.fileName}` : ""}
                        {log.durationMs !== null ? ` · ${(log.durationMs / 1000).toFixed(1)}s` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
