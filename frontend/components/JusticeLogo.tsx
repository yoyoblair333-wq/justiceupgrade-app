/**
 * JusticeUpgrade brand mark — a minimalist scales-of-justice glyph.
 * Pairs with the GenLayer wordmark/footer to signal "powered by GenLayer".
 */
import React from "react";

export type LogoSize = "sm" | "md" | "lg";

const sizeMap: Record<LogoSize, { mark: string; text: string }> = {
  sm: { mark: "w-6 h-6", text: "text-base" },
  md: { mark: "w-8 h-8", text: "text-xl" },
  lg: { mark: "w-10 h-10", text: "text-2xl" },
};

function ScalesMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="JusticeUpgrade"
    >
      {/* central column */}
      <path d="M12 3v18" />
      <path d="M8 21h8" />
      {/* beam */}
      <path d="M5 7h14" />
      <circle cx="12" cy="4.5" r="1.25" fill="currentColor" stroke="none" />
      {/* left pan */}
      <path d="M5 7l-2.5 5a2.5 2.5 0 0 0 5 0L5 7z" />
      {/* right pan */}
      <path d="M19 7l-2.5 5a2.5 2.5 0 0 0 5 0L19 7z" />
    </svg>
  );
}

export function JusticeLogo({
  size = "md",
  showWordmark = true,
  className = "",
}: {
  size?: LogoSize;
  showWordmark?: boolean;
  className?: string;
}) {
  const { mark, text } = sizeMap[size];
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="gradient-purple-pink rounded-lg p-1.5 flex items-center justify-center">
        <ScalesMark className={`${mark} text-white`} />
      </span>
      {showWordmark && (
        <span
          className={`${text} font-bold text-foreground font-[family-name:var(--font-display)]`}
          style={{ letterSpacing: "-0.02em" }}
        >
          Justice<span className="text-accent">Upgrade</span>
        </span>
      )}
    </div>
  );
}

export function JusticeMark(props: { size?: LogoSize; className?: string }) {
  return <JusticeLogo {...props} showWordmark={false} />;
}
