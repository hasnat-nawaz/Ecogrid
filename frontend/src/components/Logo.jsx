/**
 * EcoGrid logo — a stylised circular wind-turbine / leaf hybrid.
 * Two props: `size` (px) and `tone` ("light"|"dark") for the glass.
 */
export default function Logo({ size = 32, tone = 'light' }) {
  const stroke = tone === 'dark' ? '#ffffff' : '#1a2541';
  const accent = '#f5d34a';
  const blue   = '#4d8df0';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block', filter: 'drop-shadow(0 2px 6px rgba(47,111,216,0.25))' }}
    >
      <defs>
        <linearGradient id="eg-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  stopColor={blue} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#2f6fd8" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="eg-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  stopColor="#fff1a8" />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>
      {/* Glass base */}
      <circle cx="20" cy="20" r="18" fill="url(#eg-bg)" />
      <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
      {/* Three turbine blades */}
      <g transform="translate(20 20)">
        <g fill="url(#eg-accent)">
          <path d="M0 0 C 1.4 -8 4 -10.5 0 -14 C -2.5 -11.5 -1.4 -7 0 0 Z" />
          <path d="M0 0 C 7 -2 10 -4.5 13 0 C 10 3.5 7 1.4 0 0 Z" transform="rotate(120)" />
          <path d="M0 0 C 7 -2 10 -4.5 13 0 C 10 3.5 7 1.4 0 0 Z" transform="rotate(240)" />
        </g>
        {/* Hub */}
        <circle r="2.4" fill="#ffffff" />
        <circle r="1.1" fill={blue} />
      </g>
      {/* Subtle highlight */}
      <ellipse cx="14" cy="11" rx="9" ry="3" fill="rgba(255,255,255,0.20)" />
    </svg>
  );
}
