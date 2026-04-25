import Link from "next/link";
import type { ReactNode } from "react";

interface LogoProps {
  /** Visual size: sm = header (24px), md = inline body (32px), lg = hero (72px) */
  size?: "sm" | "md" | "lg" | "xl";
  /** If provided, wraps the logo in a Link. Pass null to render inline only. */
  href?: string | null;
  /** Show wordmark next to the mark. Defaults to true. */
  showWordmark?: boolean;
  /** Optional muted variant for footer / disabled contexts. */
  muted?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { mark: 24, gap: "gap-2",   text: "text-[17px]" },
  md: { mark: 32, gap: "gap-2.5", text: "text-[20px]" },
  lg: { mark: 56, gap: "gap-4",   text: "text-3xl"    },
  xl: { mark: 88, gap: "gap-6",   text: "text-5xl md:text-6xl" },
} as const;

export default function Logo({
  size = "sm",
  href = "/",
  showWordmark = true,
  muted = false,
  className = "",
}: LogoProps) {
  const cfg = SIZE_MAP[size];
  const opacity = muted ? "opacity-60" : "";
  const colorMint = muted ? "text-text/65" : "text-text";
  const colorFlow = muted ? "text-text/85" : "text-text";

  /* Wordmark treatment: "Mint" in Fraunces 400, "flow" in 500 — a subtle
     two-weight rhythm that gives the wordmark internal music without a color split. */
  const content: ReactNode = (
    <span className={`inline-flex items-center ${cfg.gap} ${opacity} ${className}`}>
      <PulseMark size={cfg.mark} />
      {showWordmark && (
        <span className={`font-display ${cfg.text} tracking-[-0.025em] leading-none`}>
          <span className={`font-normal ${colorMint}`}>Mint</span>
          <span className={`font-medium ${colorFlow}`}>flow</span>
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-block transition-opacity hover:opacity-90">
      {content}
    </Link>
  );
}

/* The Pulse Mark — three concentric three-quarter arcs around a solid gold disc.
   Center = the moment of capture. Arcs = directional reach. Reads from 16px favicon
   to 200px hero treatment without losing its shape. */
function PulseMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M 32 6 A 26 26 0 1 1 6 32"
        stroke="#d4af37"
        strokeWidth="1"
        strokeOpacity="0.22"
        strokeLinecap="round"
      />
      <path
        d="M 32 14 A 18 18 0 1 1 14 32"
        stroke="#d4af37"
        strokeWidth="1.25"
        strokeOpacity="0.5"
        strokeLinecap="round"
      />
      <path
        d="M 32 22 A 10 10 0 1 1 22 32"
        stroke="#d4af37"
        strokeWidth="1.5"
        strokeOpacity="0.85"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="4" fill="#d4af37" />
    </svg>
  );
}
