"use client";

import { useState } from "react";
import { Gavel, Loader2 } from "lucide-react";
import { useFileDispute, useIsContractConfigured } from "@/lib/hooks/useJusticeUpgrade";
import { useWallet } from "@/lib/genlayer/wallet";
import { error } from "@/lib/utils/toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  EvidenceInput,
  serializeEvidence,
  validateEvidenceItem,
} from "./EvidenceInput";
import type { EvidenceDraft } from "@/lib/contracts/types";

const MAX_DISPUTE_CHARS = 4000;

/**
 * File a dispute WITH EVIDENCE.
 * agreement_id + statement + evidence list -> file_dispute(id, statement, evidence_json).
 */
export function FileDisputeForm() {
  const { isConnected, address } = useWallet();
  const isConfigured = useIsContractConfigured();
  const { fileDispute, isFiling } = useFileDispute();

  const [agreementId, setAgreementId] = useState("");
  const [statement, setStatement] = useState("");
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
  const [errors, setErrors] = useState({ agreementId: "", statement: "", evidence: "" });

  const validate = () => {
    const next = { agreementId: "", statement: "", evidence: "" };
    if (!agreementId.trim()) next.agreementId = "An agreement ID is required.";
    if (!statement.trim()) next.statement = "A dispute statement is required.";
    else if (statement.trim().length > MAX_DISPUTE_CHARS)
      next.statement = `The statement exceeds ${MAX_DISPUTE_CHARS} characters.`;
    const badItem = evidence.find((it) => validateEvidenceItem(it) !== "");
    if (badItem) next.evidence = validateEvidenceItem(badItem);
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      error("Please connect your wallet first");
      return;
    }
    if (!validate()) return;
    fileDispute(
      {
        agreementId: agreementId.trim(),
        statement: statement.trim(),
        evidenceJson: serializeEvidence(evidence),
      },
      {
        onSuccess: () => {
          setStatement("");
          setEvidence([]);
        },
      }
    );
  };

  const disabled = isFiling || !isConnected || !isConfigured;

  return (
    <div className="brand-card p-6 md:p-8 h-full">
      <div className="flex items-center gap-3 mb-1">
        <span className="rounded-lg p-2 flex bg-[var(--blue)]/80">
          <Gavel className="w-5 h-5 text-white" />
        </span>
        <h2 className="text-xl font-bold">File a dispute</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Describe what went wrong and attach evidence. Only a party to the agreement may file.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="disputeId">Agreement ID</Label>
          <Input
            id="disputeId"
            placeholder="e.g. invoice-2026-014"
            value={agreementId}
            onChange={(e) => {
              setAgreementId(e.target.value);
              setErrors((p) => ({ ...p, agreementId: "" }));
            }}
            aria-invalid={!!errors.agreementId}
            className={errors.agreementId ? "border-destructive" : ""}
          />
          {errors.agreementId && (
            <p className="text-xs text-destructive">{errors.agreementId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="statement">What happened?</Label>
          <textarea
            id="statement"
            rows={5}
            maxLength={MAX_DISPUTE_CHARS}
            placeholder="Describe the breach or disagreement, grounded in the agreed terms…"
            value={statement}
            onChange={(e) => {
              setStatement(e.target.value);
              setErrors((p) => ({ ...p, statement: "" }));
            }}
            aria-invalid={!!errors.statement}
            className={`placeholder:text-muted-foreground border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${
              errors.statement ? "border-destructive" : ""
            }`}
          />
          {errors.statement && (
            <p className="text-xs text-destructive">{errors.statement}</p>
          )}
        </div>

        <div className="pt-1 border-t border-white/10">
          <div className="pt-4">
            <EvidenceInput items={evidence} onChange={setEvidence} disabled={isFiling} />
            {errors.evidence && (
              <p className="text-xs text-destructive mt-2">{errors.evidence}</p>
            )}
          </div>
        </div>

        <Button type="submit" variant="blue" className="w-full" disabled={disabled}>
          {isFiling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Filing dispute…
            </>
          ) : (
            "File dispute"
          )}
        </Button>
        {!isConfigured ? (
          <p className="text-xs text-muted-foreground text-center">
            Set the contract address to file a dispute.
          </p>
        ) : !isConnected ? (
          <p className="text-xs text-muted-foreground text-center">
            Connect your wallet to file a dispute.
          </p>
        ) : null}
      </form>
    </div>
  );
}
