export default function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#8fe0ff" />
          <stop offset="0.55" stopColor="#2aa0f2" />
          <stop offset="1" stopColor="#0b5ac2" />
        </linearGradient>
      </defs>
      <path d="M32 3C32 3 11 26 11 41a21 21 0 0 0 42 0C53 26 32 3 32 3z" fill="url(#lg)" />
      <path d="M32 3C32 3 20 17 15 30c4-8 10-13 17-16z" fill="#fff" opacity=".35" />
      <path d="M17 44c5-4 10 4 15 0s10 4 15 0" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" opacity=".92" />
    </svg>
  )
}
