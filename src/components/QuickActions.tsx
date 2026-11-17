"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Banknote, HandCoins, Scale, ScanLine, SquareCheck, Timer, type LucideIcon } from "lucide-react";

/**
 * Hành động nhanh — MỘT nguồn cho dock, menu "+", nút trên dải tab và chuông.
 *
 * Provider này giữ ba hộp thoại THẬT của Finance và mở chúng từ bất kỳ trang
 * nào: nhập khoản chi/thu (`TransactionModal`), quét hoá đơn (`ScanInvoiceModal`)
 * và duyệt hàng đợi (`ReviewQueueModal`). Chúng render qua portal vào `<body>`:
 * dock và menu có `transform` (khi ẩn/hiện), mà `transform` biến phần tử thành
 * khối chứa của `position: fixed` — modal nằm trong chúng sẽ co lại. Portal
 * tránh hẳn chuyện đó (và cả `space-y-*` của `.c-main`).
 *
 * Hộp thoại nạp động: không phải trang nào cũng cần ~100 KB của form giao dịch.
 *
 * `version` tăng sau mỗi lần ghi/duyệt xong. `MainLayoutWrapper` dùng nó làm
 * `key` của `<main>` nên trang đang mở tự tải lại số liệu, và `pending` (số hoá
 * đơn chờ duyệt, từ `/api/drive/pending-count` như `PendingReviewButton`) được
 * đếm lại.
 */
const TransactionModal = dynamic(() => import("@/components/finance/TransactionModal"), { ssr: false });
const ScanInvoiceModal = dynamic(() => import("@/components/finance/ScanInvoiceModal"), { ssr: false });
const ReviewQueueModal = dynamic(() => import("@/components/finance/ReviewQueueModal"), { ssr: false });

export type QuickKey = "expense" | "income" | "scan" | "habit" | "measure" | "timer";
type Overlay = "expense" | "income" | "scan" | "review" | null;

/** Danh sách hành động. `href` = điều hướng; còn lại mở hộp thoại. Thứ tự = thứ tự trong menu. */
export const QUICK_ACTIONS: {
  key: QuickKey;
  icon: LucideIcon;
  vi: string;
  en: string;
  /** Phím tắt chỉ để hiện nhãn; chữ cái hoạt động khi menu đang mở (xem QuickDock). */
  letter: string;
  href?: string;
  /** Có hàng trong menu "+" không (Bấm giờ chỉ có nút riêng trên dock). */
  menu: boolean;
}[] = [
  { key: "expense", icon: Banknote, vi: "Thêm khoản chi", en: "Add expense", letter: "N", menu: true },
  { key: "income", icon: HandCoins, vi: "Thêm thu nhập", en: "Add income", letter: "I", menu: true },
  { key: "scan", icon: ScanLine, vi: "Quét hoá đơn", en: "Scan receipt", letter: "U", menu: true },
  { key: "habit", icon: SquareCheck, vi: "Ghi thói quen", en: "Log a habit", letter: "H", href: "/habits", menu: true },
  { key: "measure", icon: Scale, vi: "Ghi số đo", en: "Log a measurement", letter: "M", href: "/health/body", menu: true },
  { key: "timer", icon: Timer, vi: "Bấm giờ", en: "Start timer", letter: "T", href: "/habits/timer", menu: false },
];

interface QuickCtx {
  /** Mở hộp thoại; hành động điều hướng do chỗ gọi tự `router.push`. */
  open: (what: Exclude<Overlay, null>) => void;
  pending: number;
  version: number;
}

const Ctx = createContext<QuickCtx | null>(null);

export function useQuickActions(): QuickCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useQuickActions ngoài QuickActionsProvider");
  return v;
}

const noopSubscribe = () => () => {};

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(0);
  // Portal cần `document`: false ở lần render của server và lần hydrate đầu.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/drive/pending-count", { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) setPending(j.count ?? 0);
      })
      .catch(() => {
        // Số chờ duyệt không quan trọng tới mức báo lỗi — hỏng thì không hiện số.
      });
    return () => controller.abort();
  }, [version]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const close = useCallback(() => setOverlay(null), []);
  const value = useMemo<QuickCtx>(() => ({ open: setOverlay, pending, version }), [pending, version]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <>
            {(overlay === "expense" || overlay === "income") && (
              <TransactionModal
                isOpen
                defaultType={overlay === "income" ? "Income" : "Expense"}
                onClose={close}
                onSuccess={bump}
              />
            )}
            {overlay === "scan" && <ScanInvoiceModal isOpen onClose={close} onSuccess={bump} />}
            {overlay === "review" && (
              <ReviewQueueModal
                isOpen
                onClose={() => {
                  close();
                  bump();
                }}
              />
            )}
          </>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
