import { Badge } from "./ui/badge";
import type { AgreementStatus, Ruling } from "@/lib/contracts/types";

/**
 * Shared metadata for the four bounded rulings — label + badge styling — reused
 * by the verdict card, panel votes, and the precedent browser so the court's
 * "case law" reads consistently everywhere.
 */
export const RULING_META: Record<Ruling, { label: string; short: string; className: string }> = {
  PARTY_A: {
    label: "For Party A",
    short: "Party A",
    className: "border-transparent bg-accent/20 text-accent",
  },
  PARTY_B: {
    label: "For Party B",
    short: "Party B",
    className: "border-transparent bg-[var(--blue)]/25 text-[oklch(0.78_0.14_265)]",
  },
  SPLIT: {
    label: "Split Decision",
    short: "Split",
    className: "border-transparent bg-[var(--pink)]/20 text-[var(--pink)]",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient Evidence",
    short: "Insufficient",
    className: "border-transparent bg-yellow-500/20 text-yellow-400",
  },
};

const STATUS_META: Record<AgreementStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "border-transparent bg-green-500/20 text-green-400",
  },
  disputed: {
    label: "Disputed",
    className: "border-transparent bg-yellow-500/20 text-yellow-400",
  },
  ruled: {
    label: "Ruled",
    className: "border-transparent bg-accent/20 text-accent",
  },
  final: {
    label: "Final",
    className: "border-transparent bg-[var(--blue)]/25 text-[oklch(0.80_0.12_265)]",
  },
};

export function RulingBadge({
  ruling,
  size = "md",
}: {
  ruling: Ruling | "";
  size?: "sm" | "md";
}) {
  if (!ruling) return null;
  const meta = RULING_META[ruling];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return <Badge className={`${meta.className} ${sizeClass}`}>{meta.label}</Badge>;
}

export function StatusBadge({ status }: { status: AgreementStatus }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    className: "border-transparent bg-muted/30 text-muted-foreground",
  };
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
