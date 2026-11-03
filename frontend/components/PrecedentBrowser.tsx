"use client";

import { BookOpen, Loader2, RefreshCw, Scale } from "lucide-react";
import {
  usePrecedents,
  usePrecedentStats,
  useIsContractConfigured,
} from "@/lib/hooks/useJusticeUpgrade";
import { RULING_META } from "./RulingBadge";
import { Button } from "./ui/button";
import type { Ruling } from "@/lib/contracts/types";

const RULING_ORDER: Ruling[] = ["PARTY_A", "PARTY_B", "SPLIT", "INSUFFICIENT_EVIDENCE"];

/**
 * The court's public "case law": every finalized ruling appends an ANONYMIZED
 * precedent (ruling + one-line principle, no addresses, no verbatim terms).
 * This browser lists get_precedents(n) and the precedent_stats() counts.
 */
export function PrecedentBrowser() {
  const isConfigured = useIsContractConfigured();
  const {
    data: precedents = [],
    isFetching,
    isError,
    refetch: refetchList,
  } = usePrecedents(20);
  const { data: stats, refetch: refetchStats } = usePrecedentStats();

  const refresh = () => {
    refetchList();
    refetchStats();
  };

  return (
    <div className="brand-card p-6 md:p-8">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <span className="gradient-purple-blue rounded-lg p-2 flex">
            <BookOpen className="w-5 h-5 text-white" />
          </span>
          <h2 className="text-xl font-bold">Precedent — the court&apos;s case law</h2>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={refresh}
          disabled={!isConfigured || isFetching}
          aria-label="Refresh precedents"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Every finalized ruling is published here — anonymized, so like disputes can be
        judged consistently and anyone can audit the court&apos;s decisions.
      </p>

      {!isConfigured ? (
        <p className="text-sm text-muted-foreground italic">
          Precedents appear here once the contract address is set and disputes are finalized.
        </p>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <StatTile
              label="Total"
              value={stats?.total ?? 0}
              className="bg-white/5 text-foreground"
              emphasize
            />
            {RULING_ORDER.map((r) => (
              <StatTile
                key={r}
                label={RULING_META[r].short}
                value={stats?.by_ruling?.[r] ?? 0}
                className={RULING_META[r].className}
              />
            ))}
          </div>

          {isError && (
            <p className="text-sm text-destructive">
              Could not load precedents from the contract.
            </p>
          )}

          {!isError && precedents.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
              <Scale className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">
                No precedents yet. The first finalized ruling will open the ledger.
              </p>
            </div>
          )}

          {precedents.length > 0 && (
            <ol className="space-y-3">
              {precedents.map((p, i) => (
                <li
                  key={i}
                  className="rounded-md border border-white/10 bg-black/20 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${RULING_META[p.ruling]?.className ?? ""}`}
                    >
                      {RULING_META[p.ruling]?.label ?? p.ruling}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      finalized at tier {p.tiers}
                    </span>
                  </div>
                  {p.principle && (
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      “{p.principle}”
                    </p>
                  )}
                  {p.at && (
                    <p className="text-[11px] text-muted-foreground font-mono">{p.at}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  className,
  emphasize = false,
}: {
  label: string;
  value: number;
  className?: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`rounded-md border border-white/10 p-3 text-center ${className ?? ""}`}>
      <p className={`tabular-nums font-bold ${emphasize ? "text-3xl" : "text-2xl"}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider mt-0.5 opacity-80">{label}</p>
    </div>
  );
}
