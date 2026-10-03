"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ChevronDown, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useCategories } from "@/lib/useCategories";
import { formatVND, compactMoney } from "@/lib/formatMoney";
import { thisMonthLocalIso } from "@/lib/localDate";
import CustomMonthPicker from "@/components/ui/CustomMonthPicker";

// Không gian soi MỘT nhóm chi tiêu.
//
// Các màn còn lại nhìn từ trên xuống: tổng tháng rồi tỷ trọng các nhóm. Chúng
// trả lời "tháng này tiêu bao nhiêu" nhưng không trả lời "riêng nhóm Business
// năm nay thế nào so với năm ngoái".
//
// Mục này có tháng riêng, không dùng chung tháng với tab Chi tiêu: đang soi một
// nhóm thì thường muốn lùi lại vài tháng để xem, mà không muốn mọi biểu đồ khác
// trên trang nhảy theo.

interface SeriesPoint { name: string; amount: number; count: number }
interface Slice { name: string; amount: number; count: number; share: number }

interface GroupData {
  group: string;
  month: string;
  year: number;
  current: { total: number; count: number; avg: number };
  prevMonth: { label: string; total: number; count: number };
  lastYearMonth: { label: string; total: number; count: number };
  ytd: { total: number; count: number };
  lastYtd: { total: number; count: number };
  lastYearFull: number;
  monthlySeries: SeriesPoint[];
  subGroupsMonth: Slice[];
  subGroupsYear: Slice[];
  merchants: Slice[];
  missingMonths: string[];
  hasAnyData: boolean;
}

/** Chênh lệch kèm chiều. Với chi tiêu thì TĂNG là tin xấu. */
function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const { t } = useLanguage();
  const diff = now - before;
  const pct = before > 0 ? Math.round((diff / before) * 100) : null;
  const color =
    diff === 0
      ? "text-[var(--color-text-faint)]"
      : diff > 0
        ? "text-[var(--color-error)]"
        : "text-[var(--color-success)]";
  return (
    <div className="text-xs mt-1">
      <span className={`font-bold ${color}`}>
        {diff > 0 ? "↗" : diff < 0 ? "↘" : "→"}{" "}
        {pct !== null
          ? `${pct > 0 ? "+" : ""}${pct}%`
          : before === 0 && now > 0
            ? t("new", "mới")
            : t("unchanged", "không đổi")}
      </span>{" "}
      <span className="text-[var(--color-text-faint)]">
        {label} {formatVND(before)}
      </span>
    </div>
  );
}

export default function ExpenseGroupAnalysis({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t, language } = useLanguage();
  const { groupNames, label } = useCategories("Expense");

  const [group, setGroup] = useState("");
  const [month, setMonth] = useState(() => thisMonthLocalIso());
  const [data, setData] = useState<GroupData | null>(null);
  const [failed, setFailed] = useState(false);

  // Nhóm đầu tiên được chọn sẵn, để mục này không mở ra trống trơn. Đồng bộ
  // trong lúc render thay vì trong effect (react-hooks/set-state-in-effect).
  //
  // So bằng CHUỖI chứ không bằng tham chiếu: `useCategories` dựng mảng mới ở
  // mỗi lần render, nên `groupNames !== lastGroups` luôn đúng và thành vòng lặp
  // render vô hạn — đã làm trắng cả tab Chi tiêu một lần.
  const groupsKey = groupNames.join("|");
  const [lastGroupsKey, setLastGroupsKey] = useState("");
  if (groupNames.length > 0 && groupsKey !== lastGroupsKey) {
    setLastGroupsKey(groupsKey);
    if (!group || !groupNames.includes(group)) setGroup(groupNames[0]);
  }

  const isLoading =
    !failed && group !== "" && (!data || data.group !== group || data.month !== month);

  useEffect(() => {
    if (!group) return;
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/finance/expense/group?group=${encodeURIComponent(group)}&month=${month}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (ignore) return;
        if (json.success) {
          setData(json.data);
          setFailed(false);
        } else {
          setFailed(true);
        }
      } catch (e) {
        if (!ignore && (e as Error).name !== "AbortError") setFailed(true);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [group, month, refreshKey]);

  const selectClass =
    "w-full md:w-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl pl-4 pr-10 py-2.5 min-h-11 text-base md:text-sm font-bold text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] appearance-none";

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="c-h5 text-[var(--color-text)]">
            {t("Group deep dive", "Soi riêng một nhóm")}
          </h3>
          <p className="text-xs text-[var(--color-text-faint)] mt-1">
            {t(
              "this section has its own month, the rest of the page stays put",
              "mục này có tháng riêng, phần còn lại của trang không đổi theo"
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-label={t("Expense group", "Nhóm chi tiêu")}
              className={selectClass}
            >
              {groupNames.map((g) => (
                <option key={g} value={g}>
                  {label(g)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none"
            />
          </div>
          <CustomMonthPicker value={month} onChange={setMonth} />
        </div>
      </div>

      {failed && (
        <p className="text-sm text-[var(--color-error)]">
          {t("Could not load this group.", "Không tải được dữ liệu nhóm này.")}
        </p>
      )}

      {!failed && isLoading && (
        <p className="text-sm text-[var(--color-text-faint)]">{t("Loading...", "Đang tải...")}</p>
      )}

      {!failed && !isLoading && data && (
        <div className="space-y-6">
          {!data.hasAnyData ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {t(
                `No spending recorded for ${label(group)} in the last two years.`,
                `Hai năm qua chưa ghi khoản chi nào cho nhóm ${label(group)}.`
              )}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("This month", "Tháng này")} · {data.month}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--color-text)] mt-1">
                    {formatVND(data.current.total)}
                  </div>
                  <div className="text-xs text-[var(--color-text-faint)] mt-1">
                    {data.current.count} {t("transactions", "giao dịch")}
                    {data.current.count > 0 &&
                      ` · ${t("avg", "BQ")} ${formatVND(data.current.avg)}`}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("vs last month", "So tháng trước")}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--color-text)] mt-1">
                    {formatVND(data.prevMonth.total)}
                  </div>
                  <Delta
                    now={data.current.total}
                    before={data.prevMonth.total}
                    label={data.prevMonth.label}
                  />
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("vs same month last year", "So cùng kỳ năm trước")}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--color-text)] mt-1">
                    {formatVND(data.lastYearMonth.total)}
                  </div>
                  <Delta
                    now={data.current.total}
                    before={data.lastYearMonth.total}
                    label={data.lastYearMonth.label}
                  />
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {t("Year to date", "Luỹ kế năm")} {data.year}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--color-text)] mt-1">
                    {formatVND(data.ytd.total)}
                  </div>
                  {/* So với cùng kỳ năm trước đã CẮT tới cùng tháng, không phải
                      trọn năm trước — so trọn năm thì tháng nào cũng ra "giảm". */}
                  <Delta
                    now={data.ytd.total}
                    before={data.lastYtd.total}
                    label={`${data.year - 1} ${t("same period", "cùng kỳ")}`}
                  />
                </div>
              </div>

              {data.missingMonths.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning-tint)] p-4">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
                  <p className="text-sm text-[var(--color-text)]">
                    {t(
                      `${data.missingMonths.length} of the last 12 months have nothing in this group: `,
                      `${data.missingMonths.length} trong 12 tháng gần nhất không có khoản nào thuộc nhóm này: `
                    )}
                    <b>{data.missingMonths.join(", ")}</b>
                    {". "}
                    {t(
                      "If this is a recurring cost, those months are probably unrecorded.",
                      "Nếu đây là khoản chi đều hằng tháng thì nhiều khả năng mấy kỳ đó chưa nhập."
                    )}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-[var(--color-text)] mb-1">
                  {t("24 months", "24 tháng")}
                </h4>
                <p className="text-xs text-[var(--color-text-faint)] mb-4">
                  {t(
                    "columns: spending · line: number of transactions",
                    "cột: số tiền · đường: số giao dịch"
                  )}
                </p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.monthlySeries} className="c-chart-multi">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fill: "var(--color-text-faint)" }}
                        angle={-45}
                        textAnchor="end"
                        height={56}
                        interval={1}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "var(--color-text-faint)" }}
                        tickFormatter={(v) => compactMoney(Number(v), language === "vi")}
                        width={48}
                      />
                      <YAxis yAxisId="hidden" hide />
                      <Tooltip
                        formatter={(v, n) =>
                          n === (t("Transactions", "Số giao dịch") as string)
                            ? [String(v), n]
                            : [formatVND(Number(v) || 0), n]
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Bar
                        dataKey="amount"
                        name={t("Spending", "Số tiền")}
                        className="c-series-1"
                        fill="var(--chart-1)"
                        maxBarSize={22}
                      />
                      {/* Số giao dịch đi cùng trục tiền: nó chỉ để thấy NHỊP —
                          tháng tiêu nhiều vì một khoản lớn hay vì nhiều khoản
                          nhỏ. Không đặt trục thứ hai, hai thang số trên một
                          khung là cách nhanh nhất để đọc sai biểu đồ. */}
                      <Line
                        yAxisId="hidden"
                        type="monotone"
                        dataKey="count"
                        name={t("Transactions", "Số giao dịch")}
                        stroke="var(--color-text)"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r: 2, fill: "var(--color-text)" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)] mb-3">
                    {t("Sub-categories this year", "Danh mục con trong năm")} {data.year}
                  </h4>
                  {data.subGroupsYear.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("Nothing recorded this year.", "Năm nay chưa ghi khoản nào.")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.subGroupsYear.map((s) => (
                        <li key={s.name || "__none"}>
                          <div className="flex items-baseline justify-between gap-3 mb-1">
                            <span className="min-w-0 truncate text-xs font-bold text-[var(--color-text-muted)]">
                              {s.name || t("no sub-category", "chưa có danh mục con")}
                            </span>
                            <span className="flex-none text-xs font-bold tabular-nums text-[var(--color-text)]">
                              {formatVND(s.amount)}
                              <span className="ml-1.5 font-normal text-[var(--color-text-faint)]">
                                {s.share}%
                              </span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                              style={{ width: `${Math.max(2, s.share)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text)] mb-3">
                    {t("Where the money went", "Chi cho ai")} {data.year}
                  </h4>
                  {data.merchants.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("Nothing recorded this year.", "Năm nay chưa ghi khoản nào.")}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--color-border)]">
                      {data.merchants.map((m) => (
                        <li
                          key={m.name || "__none"}
                          className="py-2 first:pt-0 flex items-baseline justify-between gap-3"
                        >
                          <span className="min-w-0 truncate text-sm text-[var(--color-text)]">
                            {m.name || t("(no name)", "(chưa đặt tên)")}
                          </span>
                          <span className="flex-none text-sm tabular-nums text-[var(--color-text)]">
                            {formatVND(m.amount)}
                            <span className="ml-2 text-xs text-[var(--color-text-faint)]">
                              {m.count}×
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
