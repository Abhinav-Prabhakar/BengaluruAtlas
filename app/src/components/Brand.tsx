export function AtlasMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`atlas-mark ${className}`.trim()}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Bengaluru Atlas"
    >
      <rect width="64" height="64" rx="16" fill="#1B2C1F" />
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="none"
        stroke="#EFE7D6"
        strokeOpacity="0.22"
        strokeDasharray="1 4"
      />
      <path
        d="M32 7.5 36.1 27.9 56.5 32 36.1 36.1 32 56.5 27.9 36.1 7.5 32 27.9 27.9Z"
        fill="#EFE7D6"
      />
      <circle cx="32" cy="32" r="5.4" fill="#D96C47" />
    </svg>
  );
}
