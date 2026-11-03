"use client";

import { useState } from "react";
import { FileSignature, Loader2 } from "lucide-react";
import { useCreateAgreement, useIsContractConfigured } from "@/lib/hooks/useJusticeUpgrade";
import { useWallet } from "@/lib/genlayer/wallet";
import { error } from "@/lib/utils/toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Flow 2 — "Record an agreement".
 * agreement_id + counterparty address + terms -> create_agreement (write).
 */
export function RecordAgreementForm() {
  const { isConnected, address } = useWallet();
  const isConfigured = useIsContractConfigured();
  const { createAgreement, isCreating } = useCreateAgreement();

  const [agreementId, setAgreementId] = useState("");
  const [partyB, setPartyB] = useState("");
  const [terms, setTerms] = useState("");
  const [errors, setErrors] = useState({ agreementId: "", partyB: "", terms: "" });

  const validate = () => {
    const next = { agreementId: "", partyB: "", terms: "" };
    if (!agreementId.trim()) next.agreementId = "An agreement ID is required.";
    if (!partyB.trim()) next.partyB = "The counterparty address is required.";
    else if (!ADDRESS_RE.test(partyB.trim()))
      next.partyB = "Enter a valid 0x… wallet address (40 hex characters).";
    if (!terms.trim()) next.terms = "Terms cannot be empty.";
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
    createAgreement(
      { agreementId: agreementId.trim(), partyB: partyB.trim(), terms: terms.trim() },
      {
        onSuccess: () => {
          setAgreementId("");
          setPartyB("");
          setTerms("");
        },
      }
    );
  };

  return (
    <div className="brand-card p-6 md:p-8 h-full">
      <div className="flex items-center gap-3 mb-1">
        <span className="gradient-purple-pink rounded-lg p-2 flex">
          <FileSignature className="w-5 h-5 text-white" />
        </span>
        <h2 className="text-xl font-bold">Record an agreement</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Store plain-language terms on-chain between you (Party A) and a counterparty.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="agreementId">Agreement ID</Label>
          <Input
            id="agreementId"
            placeholder="e.g. invoice-2026-014"
            value={agreementId}
            onChange={(e) => {
              setAgreementId(e.target.value);
              setErrors((p) => ({ ...p, agreementId: "" }));
            }}
            className={errors.agreementId ? "border-destructive" : ""}
          />
          {errors.agreementId && (
            <p className="text-xs text-destructive">{errors.agreementId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="partyB">Counterparty address (Party B)</Label>
          <Input
            id="partyB"
            placeholder="0x…"
            value={partyB}
            onChange={(e) => {
              setPartyB(e.target.value);
              setErrors((p) => ({ ...p, partyB: "" }));
            }}
            className={`font-mono ${errors.partyB ? "border-destructive" : ""}`}
          />
          {errors.partyB && <p className="text-xs text-destructive">{errors.partyB}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="terms">Terms</Label>
          <textarea
            id="terms"
            rows={5}
            placeholder="Describe, in plain language, what both sides agreed to…"
            value={terms}
            onChange={(e) => {
              setTerms(e.target.value);
              setErrors((p) => ({ ...p, terms: "" }));
            }}
            className={`placeholder:text-muted-foreground border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${
              errors.terms ? "border-destructive" : ""
            }`}
          />
          {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}
        </div>

        <Button
          type="submit"
          variant="gradient"
          className="w-full"
          disabled={isCreating || !isConnected || !isConfigured}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Recording on-chain…
            </>
          ) : (
            "Record agreement"
          )}
        </Button>
        {!isConfigured ? (
          <p className="text-xs text-muted-foreground text-center">
            Set the contract address to record an agreement.
          </p>
        ) : !isConnected ? (
          <p className="text-xs text-muted-foreground text-center">
            Connect your wallet to record an agreement.
          </p>
        ) : null}
      </form>
    </div>
  );
}
