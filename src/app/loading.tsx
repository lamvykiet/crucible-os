export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3 text-[var(--color-text-muted)]">
      <span className="animate-spin text-3xl leading-none">⍥</span>
      <span className="font-bold text-sm">Đang tải...</span>
    </div>
  );
}
