import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text-faint)] flex items-center justify-center">
        <Compass size={32} />
      </div>

      <div>
        <h2 className="c-h3 text-[var(--color-text)]">
          Không tìm thấy trang
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Đường dẫn này không tồn tại hoặc đã bị di chuyển.
        </p>
      </div>

      <Link href="/" className="c-btn c-btn-primary c-btn-pill">
        Về trang chủ
      </Link>
    </div>
  );
}
