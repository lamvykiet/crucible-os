"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Error boundary cho toàn bộ cây route.
 *
 * Trước đây không route nào có file này, nên bất kỳ lỗi render nào cũng đẩy
 * người dùng vào màn hình lỗi mặc định của Next — không có ngữ cảnh, không có
 * cách nào thử lại ngoài F5.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-error-tint)] text-[var(--color-error)] flex items-center justify-center">
        <AlertTriangle size={32} />
      </div>

      <div className="max-w-md">
        <h2 className="c-h3 text-[var(--color-text)]">
          Đã xảy ra lỗi
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          {error.message || "Không rõ nguyên nhân."}
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--color-text-faint)] mt-2 font-mono">
            Mã lỗi: {error.digest}
          </p>
        )}
      </div>

      <button
        onClick={reset}
        className="c-btn c-btn-primary c-btn-pill flex items-center gap-2"
      >
        <RotateCcw size={16} /> Thử lại
      </button>
    </div>
  );
}
