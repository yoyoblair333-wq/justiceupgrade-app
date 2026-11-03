"use client";

import { Users } from "lucide-react";
import { RULING_META } from "./RulingBadge";
import type { Ruling, Vote } from "@/lib/contracts/types";

/**
 * Renders a panel's individual bounded votes. Consensus is on the MAJORITY
 * ruling; a tie falls to the safe default (INSUFFICIENT_EVIDENCE), so showing
 * each panelist's vote makes the decision legible.
 */
export function PanelVotes({
  votes,
  arbiterNames,
  compact = false,
}: {
  votes: Vote[];
  arbiterNames?: string[];
  compact?: boolean;
}) {
  if (!votes || votes.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact && (
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          Panel of {votes.length} — individual votes
        </p>
      )}
      <ul className="flex flex-wrap gap-2">
        {votes.map((vote, i) => {
          const meta = RULING_META[vote as Ruling];
          const name = arbiterNames?.[i] ?? `Arbiter ${i + 1}`;
          return (
            <li
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 pl-2 pr-1 py-1"
            >
              <span className="text-xs text-muted-foreground">{name}</span>
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  meta?.className ?? "bg-muted/30 text-muted-foreground"
                }`}
              >
                {meta?.short ?? vote}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
