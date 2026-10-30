// Flags drawn as SVG: the flag emojis show as letters ("BR", "GB") on Windows.
export function BrFlag() {
  return (
    <svg className="flag" viewBox="0 0 22 15" width="22" height="15" aria-hidden="true">
      <rect width="22" height="15" fill="#009c3b" />
      <polygon points="11,1.6 20.2,7.5 11,13.4 1.8,7.5" fill="#ffdf00" />
      <circle cx="11" cy="7.5" r="3.7" fill="#002776" />
      <path d="M7.4 6.7 Q11 5.6 14.6 8.2" stroke="#fff" strokeWidth="0.7" fill="none" />
    </svg>
  );
}

export function UkFlag() {
  return (
    <svg className="flag" viewBox="0 0 60 40" width="22" height="15" aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#c8102e" strokeWidth="3" />
      <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0 V40 M0 20 H60" stroke="#c8102e" strokeWidth="8" />
    </svg>
  );
}
