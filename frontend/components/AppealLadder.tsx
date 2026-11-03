"use client";

import { Check, Gavel } from "lucide-react";
import { RulingBadge } from "./RulingBadge";
import { PanelVotes } from "./PanelVotes";
import type { AgreementStatus, HistoryEntry } from "@/lib/contracts/types";

const DEFAULT_TIERS: Record<string, number> = { "1": 1, "2": 3, "3": 5 };

/**
 * Due process, visualized: the appeal ladder (tier 1 → 2 → 3, panels of 1 → 3
 * → 5) plus every ruling rendered so far. Each appeal is re-judged from scratch
 * by a larger independent panel, and the appellate ruling replaces the prior.
 */
export function AppealLadder({
  history,
  currentTier,
  status,
  arbiterNames,
  tierArbiters = DEFAULT_TIERS,
}: {
  history: HistoryEntry[];
  currentTier: number;
  status: AgreementStatus;
  arbiterNames?: string[];
  tierArbiters?: Record<string, number>;
}) {
  const tiers = Object.keys(tierArbiters)
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);
  const maxTier = tiers[tiers.length - 1] ?? 3;

  return (
    <div className="space-y-4">
      {/* Tier ladder */}
      <ol className="flex items-stretch gap-1.5" aria-label="Appeal ladder">
        {tiers.map((tier) => {
          const size = tierArbiters[String(tier)];
          const decided = currentTier >= tier;
          const isCurrent = currentTier === tier;
          return (
            <li key={tier} className="flex-1">
              <div
                className={`h-full rounded-md border p-2.5 text-center transition-colors ${
                  isCurrent
                    ? "border-accent bg-accent/15"
                    : decided
                    ? "border-accent/30 bg-accent/5"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-xs font-semibold">
                  {decided && <Check className="w-3 h-3 text-accent" />}
                  <span className={decided ? "text-accent" : "text-muted-foreground"}>
                    Tier {tier}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {size} arbiter{size === 1 ? "" : "s"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        {status === "final" && currentTier >= maxTier
          ? "The top tier was reached — the ruling is final."
          : status === "final"
          ? "The ruling was accepted and is now final."
          : status === "ruled" && currentTier < maxTier
          ? "The losing party may appeal to a larger panel, or accept the ruling."
          : "A larger panel re-judges on appeal; an odd panel size avoids a tie."}
      </p>

      {/* History */}
      {history && history.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <Gavel className="w-3.5 h-3.5" />
            Ruling history
          </p>
          <ol className="space-y-2">
            {history.map((h, i) => (
              <li
                key={i}
                className="rounded-md border border-white/10 bg-black/20 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    Tier {h.tier} · panel of {h.arbiters}
                  </span>
                  <RulingBadge ruling={h.ruling} size="sm" />
                </div>
                <PanelVotes votes={h.votes} arbiterNames={arbiterNames} compact />
                {h.at && (
                  <p className="text-[11px] text-muted-foreground font-mono">{h.at}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
