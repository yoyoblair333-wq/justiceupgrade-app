"use client";

import { useState } from "react";
import {
  Search,
  Scale,
  Loader2,
  Sparkles,
  ChevronsUp,
  CheckCircle2,
} from "lucide-react";
import {
  useAgreement,
  useResolveDispute,
  useAppeal,
  useAcceptRuling,
  useCourtConfig,
  useIsContractConfigured,
} from "@/lib/hooks/useJusticeUpgrade";
import { useWallet } from "@/lib/genlayer/wallet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AddressDisplay } from "./AddressDisplay";
import { RulingBadge, StatusBadge } from "./RulingBadge";
import { EvidenceList } from "./EvidenceList";
import { PanelVotes } from "./PanelVotes";
import { AppealLadder } from "./AppealLadder";
import type { Agreement } from "@/lib/contracts/types";

/**
 * Track an agreement end to end: status, parties, terms, dispute + evidence,
 * the bounded verdict (ruling, reasoning, resolution, panel votes), the appeal
 * ladder, and the gated actions — resolve, appeal (escalate to a larger panel),
 * and accept the ruling.
 */
export function AgreementViewer() {
  const { isConnected } = useWallet();
  const isConfigured = useIsContractConfigured();
  const [idInput, setIdInput] = useState("");
  const [lookupId, setLookupId] = useState("");

  const {
    data: agreement,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useAgreement(lookupId);

  const { data: config } = useCourtConfig();
  const { resolveDispute, isResolving } = useResolveDispute();
  const { appeal, isAppealing } = useAppeal();
  const { acceptRuling, isAccepting } = useAcceptRuling();

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const id = idInput.trim();
    if (!id) return;
    if (id === lookupId) refetch();
    else setLookupId(id);
  };

  const refetchAfter = { onSuccess: () => refetch() };
  const handleResolve = () => lookupId && resolveDispute({ agreementId: lookupId }, refetchAfter);
  const handleAppeal = () => lookupId && appeal({ agreementId: lookupId }, refetchAfter);
  const handleAccept = () => lookupId && acceptRuling({ agreementId: lookupId }, refetchAfter);

  const hasLookedUp = !!lookupId;
  const notFound = hasLookedUp && !isFetching && !isError && agreement === null;

  const arbiterNames = config?.arbiter_names;
  const tierArbiters = config?.tier_arbiters;
  const maxTier = tierArbiters
    ? Math.max(...Object.keys(tierArbiters).map((k) => parseInt(k, 10)))
    : 3;

  const busy = isResolving || isAppealing || isAccepting;

  return (
    <div className="brand-card p-6 md:p-8">
      <div className="flex items-center gap-3 mb-1">
        <span className="gradient-purple-blue rounded-lg p-2 flex">
          <Scale className="w-5 h-5 text-white" />
        </span>
        <h2 className="text-xl font-bold">Track an agreement &amp; its ruling</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Look up any agreement by ID to see its status, evidence, verdict, and appeal history.
      </p>

      <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 space-y-2">
          <Label htmlFor="lookupId" className="sr-only">
            Agreement ID
          </Label>
          <Input
            id="lookupId"
            placeholder="Enter an agreement ID…"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={!idInput.trim() || isFetching || !isConfigured}
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span className="ml-2">Look up</span>
        </Button>
      </form>

      {!isConfigured && (
        <p className="text-sm text-muted-foreground italic mb-4">
          Set the contract address to look up agreements on-chain.
        </p>
      )}

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Lookup failed</AlertTitle>
          <AlertDescription>
            {queryError?.message || "Could not read the agreement from the contract."}
          </AlertDescription>
        </Alert>
      )}

      {notFound && (
        <Alert variant="default" className="mb-4 bg-yellow-500/10 border-yellow-500/20">
          <AlertTitle>No agreement found</AlertTitle>
          <AlertDescription>
            No agreement with ID <span className="font-mono">{lookupId}</span> exists on-chain.
          </AlertDescription>
        </Alert>
      )}

      {agreement && (
        <div className="space-y-6">
          <AgreementDetails agreement={agreement} />

          {/* Resolve (first ruling) */}
          {agreement.status === "disputed" && (
            <ActionRow
              title="Ask the AI arbiter panel to rule"
              body="Runs an LLM panel inside the GenVM with validator consensus — fetching any URL evidence live. This can take up to a minute."
              icon={<Sparkles className="w-4 h-4 text-accent" />}
              connected={isConnected}
              connectHint="Connect your wallet (as a party to this agreement) to request a ruling."
            >
              <Button
                variant="gradient"
                onClick={handleResolve}
                disabled={busy || !isConnected}
                className="shrink-0"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deliberating…
                  </>
                ) : (
                  "Get the ruling"
                )}
              </Button>
            </ActionRow>
          )}

          {/* Verdict + votes + ladder */}
          {(agreement.status === "ruled" || agreement.status === "final") &&
            agreement.ruling && (
              <VerdictCard agreement={agreement} arbiterNames={arbiterNames} />
            )}

          {(agreement.status === "ruled" ||
            agreement.status === "final" ||
            agreement.tier > 0) && (
            <div className="pt-2">
              <AppealLadder
                history={agreement.history}
                currentTier={agreement.tier}
                status={agreement.status}
                arbiterNames={arbiterNames}
                tierArbiters={tierArbiters}
              />
            </div>
          )}

          {/* Appeal / Accept (gated by status) */}
          {agreement.status === "ruled" && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-white/10">
              <Button
                variant="blue"
                onClick={handleAppeal}
                disabled={busy || !isConnected || agreement.tier >= maxTier}
                className="flex-1"
                title={
                  agreement.tier >= maxTier
                    ? "No further appeal — the top tier was reached"
                    : undefined
                }
              >
                {isAppealing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Re-judging…
                  </>
                ) : (
                  <>
                    <ChevronsUp className="w-4 h-4 mr-2" />
                    {agreement.tier >= maxTier
                      ? "No further appeal"
                      : `Appeal to a panel of ${tierArbiters?.[String(agreement.tier + 1)] ?? ""}`}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleAccept}
                disabled={busy || !isConnected}
                className="flex-1"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finalizing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Accept ruling (make final)
                  </>
                )}
              </Button>
            </div>
          )}
          {agreement.status === "ruled" && !isConnected && (
            <p className="text-xs text-muted-foreground">
              Connect your wallet (as a party) to appeal or accept the ruling.
            </p>
          )}

          {agreement.status === "final" && (
            <p className="flex items-center gap-1.5 text-sm text-accent pt-2 border-t border-white/10">
              <CheckCircle2 className="w-4 h-4" />
              This ruling is final and has been recorded as public precedent.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function AgreementDetails({ agreement }: { agreement: Agreement }) {
  const disputed = agreement.status !== "active";
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-muted-foreground break-all">
          #{agreement.id}
        </span>
        <StatusBadge status={agreement.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Party A">
          <AddressDisplay address={agreement.party_a} maxLength={16} showCopy />
        </Field>
        <Field label="Party B">
          <AddressDisplay address={agreement.party_b} maxLength={16} showCopy />
        </Field>
      </div>

      <Field label="Terms">
        <p className="whitespace-pre-wrap rounded-md bg-black/20 border border-white/5 p-3">
          {agreement.terms}
        </p>
      </Field>

      {agreement.dispute && (
        <Field label={`Dispute (filed by ${filedByRole(agreement)})`}>
          <p className="whitespace-pre-wrap rounded-md bg-black/20 border border-white/5 p-3">
            {agreement.dispute}
          </p>
        </Field>
      )}

      {disputed && (
        <Field label="Evidence">
          <EvidenceList
            evidence={agreement.evidence}
            ruled={agreement.status === "ruled" || agreement.status === "final"}
          />
        </Field>
      )}
    </div>
  );
}

function filedByRole(agreement: Agreement): string {
  if (!agreement.filed_by) return "—";
  return agreement.filed_by === agreement.party_a ? "Party A" : "Party B";
}

function VerdictCard({
  agreement,
  arbiterNames,
}: {
  agreement: Agreement;
  arbiterNames?: string[];
}) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-bold">Arbiter&apos;s verdict</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          Tier {agreement.tier} · panel of {agreement.arbiters}
        </span>
      </div>

      <div className="brand-card p-5 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Ruling</span>
          <RulingBadge ruling={agreement.ruling} />
        </div>

        {agreement.reasoning && (
          <Field label="Reasoning">
            <p className="whitespace-pre-wrap leading-relaxed">{agreement.reasoning}</p>
          </Field>
        )}

        {agreement.resolution && (
          <Field label="Recommended resolution">
            <p className="whitespace-pre-wrap leading-relaxed">{agreement.resolution}</p>
          </Field>
        )}

        {agreement.votes && agreement.votes.length > 0 && (
          <PanelVotes votes={agreement.votes} arbiterNames={arbiterNames} />
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Rendered on-chain by the GenVM under the equivalence principle — every validator
        re-judged the dispute (re-fetching any URL evidence) and agreed on the bounded ruling.
      </p>
    </div>
  );
}

function ActionRow({
  title,
  body,
  icon,
  connected,
  connectHint,
  children,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
  connected: boolean;
  connectHint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-2 border-t border-white/10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-semibold flex items-center gap-2">
            {icon}
            {title}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{body}</p>
        </div>
        {children}
      </div>
      {!connected && <p className="text-xs text-muted-foreground mt-3">{connectHint}</p>}
    </div>
  );
}
