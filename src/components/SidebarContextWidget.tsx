"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { moduleFor } from "@/lib/modules";

// Hàng duyệt hoá đơn chỉ tải khi người dùng bấm "Duyệt ngay" — nó kéo theo
// danh mục, tài khoản, dự án; không đáng nhét vào gói của mọi trang.
const ReviewQueueModal = dynamic(() => import("@/components/finance/ReviewQueueModal"), { ssr: false });

/**
 * Widget ngữ cảnh ở đáy sidebar (skill suong-som-design 7.2, demo
 * pins-17-11.html): MỘT việc cần làm của function đang mở.
 *
 *   Tài chính — số hoá đơn chờ duyệt (`/api/drive/pending-count`, cùng
 *               endpoint với `PendingReviewButton`); nút mở `ReviewQueueModal`.
 *   Học tập   — thẻ đến hạn + đã ôn hôm nay (`/api/learning/overview`).
 *   Thói quen — việc hôm nay xong/tổng + việc kế tiếp (`/api/habits`).
 *   Khác, hoặc không có việc gì — widget ẩn.
 *
 * Chỉ dùng API sẵn có. Vòng tiến độ chỉ vẽ khi có MẪU SỐ thật:
 * `pending-count` chỉ trả số đang chờ, không có tổng hoá đơn của kỳ, nên
 * widget Tài chính dùng icon thay cho vòng — không vẽ một vòng không mang nghĩa.
 *
 * Sidebar thu gọn (68px) thì chỉ còn vòng/icon 36px + số (CSS ẩn bản đầy đủ).
 *
 * Modal duyệt PHẢI treo vào <body>: sidebar là `position: fixed` + `z-index`,
 * để modal trong đó thì nó nằm trong stacking context của sidebar và ăn
 * `:hover`/`:focus-within` của sidebar. Treo ra ngoài thì cũng ra khỏi div
 * `.c-fin` của FinancePage, nên tự mang class đó (cùng lối `PeriodBreakdownModal`).
 */

interface Task {
  key: string;
  /** 0..1, hoặc null khi không có mẫu số thật (không vẽ vòng). */
  ratio: number | null;
  ringLabel: string;
  count: number;
  line: string;
  sub: string;
  action: { label: string; href?: string; onClick?: () => void };
}

interface LearningTotals { dueCount: number; reviewedToday: number }
interface HabitRow { name: string; kind: string; done: boolean; scheduled: boolean; skipped: boolean; scheduleStart: string | null }
interface HabitsToday { doneCount: number; dueCount: number; habits: HabitRow[] }

type Loaded =
  | { key: "learning"; totals: LearningTotals }
  | { key: "habits"; data: HabitsToday };

function Ring({ ratio, size, stroke, label }: { ratio: number; size: number; stroke: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="c-ring"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx={c} cy={c} r={r} fill="none" className="c-ring-track" strokeWidth={stroke} />
      {pct > 0 && (
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          className="c-ring-value"
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      )}
    </svg>
  );
}

export default function SidebarContextWidget({ pending, onReviewed }: { pending: number; onReviewed: () => void }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const modKey = moduleFor(pathname)?.key ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Chỉ hỏi API của function đang mở, và hỏi lại mỗi lần đổi trang (vừa ôn
  // xong, vừa chấm một thói quen). CHỈ ĐỌC — widget không ghi gì.
  useEffect(() => {
    if (modKey !== "learning" && modKey !== "habits") return;
    const controller = new AbortController();
    const url = modKey === "learning" ? "/api/learning/overview" : "/api/habits";
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.success) return;
        if (modKey === "learning" && j.totals) setLoaded({ key: "learning", totals: j.totals });
        if (modKey === "habits") setLoaded({ key: "habits", data: j });
      })
      .catch(() => {
        // Widget phụ — hỏng thì ẩn, trang chính tự báo lỗi của nó.
      });
    return () => controller.abort();
  }, [modKey, pathname]);

  let task: Task | null = null;

  if (modKey === "finance" && pending > 0) {
    task = {
      key: "finance",
      ratio: null,
      ringLabel: "",
      count: pending,
      line: t(`${pending} receipts to review`, `${pending} hoá đơn chờ duyệt`),
      // Đúng với luồng OCR: quét chỉ lưu nháp, duyệt mới ghi sổ. Không nói
      // "tháng M đang thiếu" — bản nháp có thể thuộc tháng nào cũng được.
      sub: t("Not in the books until approved", "Chưa vào sổ cho tới khi duyệt"),
      action: { label: t("Review now", "Duyệt ngay"), onClick: () => setReviewOpen(true) },
    };
  } else if (modKey === "learning" && loaded?.key === "learning" && loaded.totals.dueCount > 0) {
    const { dueCount, reviewedToday } = loaded.totals;
    task = {
      key: "learning",
      // Phần thẻ của hôm nay đã ôn: đã ôn / (đã ôn + còn đến hạn).
      ratio: reviewedToday / (reviewedToday + dueCount),
      ringLabel: t(
        `${reviewedToday} of ${reviewedToday + dueCount} cards reviewed today`,
        `Đã ôn ${reviewedToday} trên ${reviewedToday + dueCount} thẻ hôm nay`
      ),
      count: dueCount,
      line: t(`${dueCount} cards due`, `${dueCount} thẻ đến hạn`),
      sub: reviewedToday > 0
        ? t(`${reviewedToday} reviewed today`, `Đã ôn ${reviewedToday} thẻ hôm nay`)
        : t("Not reviewed yet today", "Hôm nay chưa ôn thẻ nào"),
      action: { label: t("Review now", "Ôn ngay"), href: "/learning/flashcards" },
    };
  } else if (modKey === "habits" && loaded?.key === "habits") {
    const { doneCount, dueCount, habits } = loaded.data;
    if (dueCount > 0 && doneCount < dueCount) {
      // Việc kế tiếp: thói quen xây dựng tới lịch, chưa xong, chưa nghỉ —
      // có giờ bắt đầu thì sớm nhất trước, không giờ thì theo thứ tự sẵn có.
      const next = habits
        .filter((h) => h.kind === "build" && h.scheduled && !h.skipped && !h.done)
        .sort((a, b) => (a.scheduleStart ?? "99:99").localeCompare(b.scheduleStart ?? "99:99"))[0];
      task = {
        key: "habits",
        ratio: doneCount / dueCount,
        ringLabel: t(`${doneCount} of ${dueCount} habits done today`, `Xong ${doneCount} trên ${dueCount} việc hôm nay`),
        count: dueCount - doneCount,
        line: t(`${doneCount}/${dueCount} done today`, `${doneCount}/${dueCount} việc hôm nay`),
        sub: next ? t(`Next: ${next.name}`, `Tiếp theo: ${next.name}`) : t("Keep going", "Làm tiếp nhé"),
        action: { label: t("Open today", "Mở hôm nay"), href: "/habits" },
      };
    }
  }

  const modal =
    reviewOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="c-fin">
            <ReviewQueueModal
              isOpen
              onClose={() => {
                setReviewOpen(false);
                onReviewed();
              }}
            />
          </div>,
          document.body
        )
      : null;

  if (!task) return modal;

  const { action } = task;
  const glyph = (size: number, stroke: number, label?: string) =>
    task.ratio === null ? (
      <span className="c-ctx-icon" style={{ width: size, height: size }} aria-hidden>
        <ListTodo size={size > 40 ? 22 : 18} strokeWidth={1.8} />
      </span>
    ) : (
      <Ring ratio={task.ratio} size={size} stroke={stroke} label={label} />
    );

  const button = action.href ? (
    <Link href={action.href} className="c-btn c-btn-primary c-ctx-btn">{action.label}</Link>
  ) : (
    <button type="button" onClick={action.onClick} className="c-btn c-btn-primary c-ctx-btn">{action.label}</button>
  );

  return (
    <>
      <section className="c-ctx" aria-label={task.line}>
        {/* Bản đầy đủ — khi sidebar bung. */}
        <div className="c-ctx-full">
          <div className="c-ctx-row">
            {glyph(48, 6, task.ringLabel || undefined)}
            <div className="min-w-0">
              <p className="c-ctx-line">{task.line}</p>
              <p className="c-ctx-sub">{task.sub}</p>
            </div>
          </div>
          {button}
        </div>
        {/* Bản thu gọn — rail 68px: vòng/icon 36px + số. */}
        {action.href ? (
          <Link href={action.href} className="c-ctx-mini" aria-label={`${task.line} — ${action.label}`} tabIndex={-1}>
            {glyph(36, 5)}
            <span>{task.count > 99 ? "99+" : task.count}</span>
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="c-ctx-mini" aria-label={`${task.line} — ${action.label}`} tabIndex={-1}>
            {glyph(36, 5)}
            <span>{task.count > 99 ? "99+" : task.count}</span>
          </button>
        )}
      </section>
      {modal}
    </>
  );
}
