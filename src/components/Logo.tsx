/** Logo Crucible: ô mực bo 8px, chữ A có vạch ngang (đúng glyph của demo). */
export default function Logo({ size = 16 }: { size?: number }) {
  return (
    <span className="c-logo" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 19 12 5l7 14" />
        <path d="M8.5 13h7" />
      </svg>
    </span>
  );
}
