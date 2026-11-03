"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import JusticeUpgrade from "../contracts/JusticeUpgrade";
import {
  getContractAddress,
  getStudioUrl,
  isContractConfigured,
} from "../genlayer/client";
import type { FeePresetLevel } from "../genlayer/fees";
import { useWallet } from "../genlayer/wallet";
import { success, error } from "../utils/toast";
import type {
  Agreement,
  RulingView,
  Precedent,
  PrecedentStats,
  CourtConfig,
} from "../contracts/types";

const NOT_CONFIGURED_MSG =
  "The JusticeUpgrade v2 contract address is not set. Add NEXT_PUBLIC_JUSTICE_CONTRACT_ADDRESS to your .env once the contract is deployed.";

/**
 * Whether a usable contract address is configured. Components use this to render
 * the graceful "not yet deployed / set the address" state and to gate writes.
 */
export function useIsContractConfigured(): boolean {
  // Reads a build-time NEXT_PUBLIC_* env var, so it is stable per render.
  return isContractConfigured();
}

/**
 * Hook to get the JusticeUpgrade contract instance.
 *
 * Returns null (silently) if the contract address is not configured — the UI
 * surfaces that as an in-page banner rather than a toast, and write mutations
 * throw a clear error if attempted. The instance is recreated whenever the
 * wallet address changes so genlayer-js is configured with the current account.
 * Views work without a wallet; writes require a connected wallet (validated in
 * the mutation hooks).
 */
export function useJusticeUpgradeContract(): JusticeUpgrade | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const studioUrl = getStudioUrl();

  const contract = useMemo(() => {
    if (!contractAddress) {
      return null;
    }
    return new JusticeUpgrade(contractAddress, address, studioUrl);
  }, [contractAddress, address, studioUrl]);

  return contract;
}

/**
 * Hook to read a full agreement record by id.
 * `enabled` is gated on a non-empty id so it won't fire for an empty input.
 */
export function useAgreement(agreementId: string) {
  const contract = useJusticeUpgradeContract();

  return useQuery<Agreement | null, Error>({
    queryKey: ["agreement", agreementId],
    queryFn: () => {
      if (!contract) return Promise.resolve(null);
      return contract.getAgreement(agreementId);
    },
    enabled: !!contract && !!agreementId.trim(),
    staleTime: 2000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to read the compact ruling view (status + verdict + votes) by id.
 */
export function useRuling(agreementId: string) {
  const contract = useJusticeUpgradeContract();

  return useQuery<RulingView | null, Error>({
    queryKey: ["ruling", agreementId],
    queryFn: () => {
      if (!contract) return Promise.resolve(null);
      return contract.getRuling(agreementId);
    },
    enabled: !!contract && !!agreementId.trim(),
    staleTime: 2000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to read the most recent anonymized precedents (public "case law").
 */
export function usePrecedents(n: number = 20) {
  const contract = useJusticeUpgradeContract();

  return useQuery<Precedent[], Error>({
    queryKey: ["precedents", n],
    queryFn: () => {
      if (!contract) return Promise.resolve([]);
      return contract.getPrecedents(n);
    },
    enabled: !!contract,
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to read aggregate precedent counts (total + counts by ruling).
 */
export function usePrecedentStats() {
  const contract = useJusticeUpgradeContract();

  return useQuery<PrecedentStats | null, Error>({
    queryKey: ["precedent-stats"],
    queryFn: () => {
      if (!contract) return Promise.resolve(null);
      return contract.getPrecedentStats();
    },
    enabled: !!contract,
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to read the court configuration (rulings, tiers, arbiter names, limits).
 */
export function useCourtConfig() {
  const contract = useJusticeUpgradeContract();

  return useQuery<CourtConfig | null, Error>({
    queryKey: ["court-config"],
    queryFn: () => {
      if (!contract) return Promise.resolve(null);
      return contract.getConfig();
    },
    enabled: !!contract,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

/** Invalidate every query that depends on a single agreement + the ledger. */
function useAgreementInvalidation() {
  const queryClient = useQueryClient();
  return (agreementId: string) => {
    queryClient.invalidateQueries({ queryKey: ["agreement", agreementId] });
    queryClient.invalidateQueries({ queryKey: ["ruling", agreementId] });
    queryClient.invalidateQueries({ queryKey: ["precedents"] });
    queryClient.invalidateQueries({ queryKey: ["precedent-stats"] });
    queryClient.invalidateQueries({ queryKey: ["court-config"] });
  };
}

/**
 * Hook to record a new agreement.
 */
export function useCreateAgreement() {
  const contract = useJusticeUpgradeContract();
  const { address } = useWallet();
  const invalidate = useAgreementInvalidation();
  const [isCreating, setIsCreating] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      agreementId,
      partyB,
      terms,
      feePresetLevel,
    }: {
      agreementId: string;
      partyB: string;
      terms: string;
      feePresetLevel?: FeePresetLevel;
    }) => {
      if (!contract) throw new Error(NOT_CONFIGURED_MSG);
      if (!address) {
        throw new Error("Wallet not connected. Connect your wallet to record an agreement.");
      }
      setIsCreating(true);
      const feePreset = await contract.estimateCreateAgreementFees(
        agreementId,
        partyB,
        terms,
        feePresetLevel ?? "standard"
      );
      return contract.createAgreement(agreementId, partyB, terms, feePreset);
    },
    onSuccess: (_data, variables) => {
      invalidate(variables.agreementId);
      setIsCreating(false);
      success("Agreement recorded on-chain", {
        description: "Both parties and the terms are now stored on GenLayer.",
      });
    },
    onError: (err: any) => {
      setIsCreating(false);
      error("Failed to record agreement", {
        description: err?.message || "Please try again.",
      });
    },
  });

  return {
    ...mutation,
    isCreating,
    createAgreement: mutation.mutate,
    createAgreementAsync: mutation.mutateAsync,
  };
}

/**
 * Hook to file a dispute against an existing agreement, with evidence.
 * `evidenceJson` is the serialized evidence array the contract expects.
 */
export function useFileDispute() {
  const contract = useJusticeUpgradeContract();
  const { address } = useWallet();
  const invalidate = useAgreementInvalidation();
  const [isFiling, setIsFiling] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      agreementId,
      statement,
      evidenceJson,
    }: {
      agreementId: string;
      statement: string;
      evidenceJson?: string;
    }) => {
      if (!contract) throw new Error(NOT_CONFIGURED_MSG);
      if (!address) {
        throw new Error("Wallet not connected. Connect your wallet to file a dispute.");
      }
      setIsFiling(true);
      return contract.fileDispute(agreementId, statement, evidenceJson ?? "");
    },
    onSuccess: (_data, variables) => {
      invalidate(variables.agreementId);
      setIsFiling(false);
      success("Dispute filed on-chain", {
        description: "Either party can now request an AI ruling.",
      });
    },
    onError: (err: any) => {
      setIsFiling(false);
      error("Failed to file dispute", {
        description: err?.message || "Please try again.",
      });
    },
  });

  return {
    ...mutation,
    isFiling,
    fileDispute: mutation.mutate,
    fileDisputeAsync: mutation.mutateAsync,
  };
}

/**
 * Hook to ask the on-chain AI arbiter panel to rule on a dispute (tier 1).
 * This is the slow, LLM-backed write; the verdict is read back from storage.
 */
export function useResolveDispute() {
  const contract = useJusticeUpgradeContract();
  const { address } = useWallet();
  const invalidate = useAgreementInvalidation();
  const [isResolving, setIsResolving] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      agreementId,
      feePresetLevel,
    }: {
      agreementId: string;
      feePresetLevel?: FeePresetLevel;
    }) => {
      if (!contract) throw new Error(NOT_CONFIGURED_MSG);
      if (!address) {
        throw new Error("Wallet not connected. Connect your wallet to request a ruling.");
      }
      setIsResolving(true);
      const feePreset = await contract.estimateResolveDisputeFees(
        agreementId,
        feePresetLevel ?? "standard"
      );
      return contract.resolveDispute(agreementId, feePreset);
    },
    onSuccess: (_verdict, variables) => {
      invalidate(variables.agreementId);
      setIsResolving(false);
      success("The arbiter has ruled", {
        description: "A verdict was rendered on-chain by consensus.",
      });
    },
    onError: (err: any) => {
      setIsResolving(false);
      error("Failed to resolve dispute", {
        description: err?.message || "Please try again.",
      });
    },
  });

  return {
    ...mutation,
    isResolving,
    resolveDispute: mutation.mutate,
    resolveDisputeAsync: mutation.mutateAsync,
  };
}

/**
 * Hook to appeal a ruled, non-final dispute to the next, larger panel.
 * LLM-backed, like resolve_dispute; the new verdict is read back from storage.
 */
export function useAppeal() {
  const contract = useJusticeUpgradeContract();
  const { address } = useWallet();
  const invalidate = useAgreementInvalidation();
  const [isAppealing, setIsAppealing] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      agreementId,
      feePresetLevel,
    }: {
      agreementId: string;
      feePresetLevel?: FeePresetLevel;
    }) => {
      if (!contract) throw new Error(NOT_CONFIGURED_MSG);
      if (!address) {
        throw new Error("Wallet not connected. Connect your wallet to appeal.");
      }
      setIsAppealing(true);
      const feePreset = await contract.estimateAppealFees(
        agreementId,
        feePresetLevel ?? "high"
      );
      return contract.appeal(agreementId, feePreset);
    },
    onSuccess: (_verdict, variables) => {
      invalidate(variables.agreementId);
      setIsAppealing(false);
      success("Appeal decided by a larger panel", {
        description: "A fresh panel re-judged the dispute on-chain.",
      });
    },
    onError: (err: any) => {
      setIsAppealing(false);
      error("Failed to appeal", {
        description: err?.message || "Please try again.",
      });
    },
  });

  return {
    ...mutation,
    isAppealing,
    appeal: mutation.mutate,
    appealAsync: mutation.mutateAsync,
  };
}

/**
 * Hook to accept the current ruling: it becomes final and sets precedent.
 */
export function useAcceptRuling() {
  const contract = useJusticeUpgradeContract();
  const { address } = useWallet();
  const invalidate = useAgreementInvalidation();
  const [isAccepting, setIsAccepting] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({ agreementId }: { agreementId: string }) => {
      if (!contract) throw new Error(NOT_CONFIGURED_MSG);
      if (!address) {
        throw new Error("Wallet not connected. Connect your wallet to accept the ruling.");
      }
      setIsAccepting(true);
      return contract.acceptRuling(agreementId);
    },
    onSuccess: (_data, variables) => {
      invalidate(variables.agreementId);
      setIsAccepting(false);
      success("Ruling accepted — now final", {
        description: "An anonymized precedent was added to the public ledger.",
      });
    },
    onError: (err: any) => {
      setIsAccepting(false);
      error("Failed to accept ruling", {
        description: err?.message || "Please try again.",
      });
    },
  });

  return {
    ...mutation,
    isAccepting,
    acceptRuling: mutation.mutate,
    acceptRulingAsync: mutation.mutateAsync,
  };
}
