import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type {
  Agreement,
  RulingView,
  Verdict,
  Precedent,
  PrecedentStats,
  CourtConfig,
  TransactionReceipt,
} from "./types";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";

/**
 * Normalize a GenLayer view return value into a plain JS object.
 *
 * genlayer-js decodes a contract dict return as a `Map`. Nested values can be
 * plain primitives or further Maps/arrays. This recursively converts Maps to
 * objects so the UI can read `result.ruling`, `result.evidence[0].kind`, etc.
 * directly.
 */
function normalize(value: any): any {
  if (value instanceof Map) {
    const obj: Record<string, any> = {};
    for (const [k, v] of value.entries()) {
      obj[String(k)] = normalize(v);
    }
    return obj;
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  return value;
}

/**
 * JusticeUpgrade v2 contract binding — the frontend's typed gateway to the
 * on-chain AI arbiter Intelligent Contract (justice_upgrade.py, class
 * JusticeUpgrade).
 *
 * Follows the FootballBets.ts pattern from the GenLayer boilerplate:
 *   - view methods go through client.readContract
 *   - write methods go through client.writeContract + waitForTransactionReceipt
 *   - LLM-backed write fees are estimated with the shared fee-preset helpers
 *
 * v2 surface: evidence-bound disputes (incl. live web evidence the contract
 * fetches itself), an appeal ladder (resolve → appeal → …), accept-ruling, and
 * the public precedent ledger.
 */
class JusticeUpgrade {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;

  constructor(
    contractAddress: string,
    address?: string | null,
    studioUrl?: string
  ) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.studioUrl = studioUrl;

    const config: any = {
      chain: studionet,
    };

    if (address) {
      config.account = address as `0x${string}`;
    }

    if (studioUrl) {
      config.endpoint = studioUrl;
    }

    this.client = createClient(config);
  }

  /**
   * Update the address used for transactions (recreates the client).
   */
  updateAccount(address: string): void {
    const config: any = {
      chain: studionet,
      account: address as `0x${string}`,
    };

    if (this.studioUrl) {
      config.endpoint = this.studioUrl;
    }

    this.client = createClient(config);
  }

  // ── Fee estimation (resolve_dispute & appeal are the expensive LLM calls) ───
  async estimateResolveDisputeFees(
    agreementId: string,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "resolve_dispute",
        args: [agreementId],
      },
      level
    );
  }

  async estimateAppealFees(
    agreementId: string,
    level: FeePresetLevel = "high"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "appeal",
        args: [agreementId],
      },
      level
    );
  }

  async estimateCreateAgreementFees(
    agreementId: string,
    partyB: string,
    terms: string,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "create_agreement",
        args: [agreementId, partyB, terms],
      },
      level
    );
  }

  // ── Views ──────────────────────────────────────────────────────────────────

  /**
   * Read a full agreement record.
   * @returns the Agreement, or null if it does not exist on-chain.
   */
  async getAgreement(agreementId: string): Promise<Agreement | null> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress,
        functionName: "get_agreement",
        args: [agreementId],
      });
      return normalize(result) as Agreement;
    } catch (error: any) {
      // The contract raises "agreement not found" for unknown ids.
      if (String(error?.message || error).includes("not found")) {
        return null;
      }
      console.error("Error fetching agreement:", error);
      throw new Error("Failed to fetch agreement from contract");
    }
  }

  /**
   * Read the compact ruling view (status + verdict + votes) for an agreement.
   * @returns the RulingView, or null if the agreement does not exist.
   */
  async getRuling(agreementId: string): Promise<RulingView | null> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress,
        functionName: "get_ruling",
        args: [agreementId],
      });
      return normalize(result) as RulingView;
    } catch (error: any) {
      if (String(error?.message || error).includes("not found")) {
        return null;
      }
      console.error("Error fetching ruling:", error);
      throw new Error("Failed to fetch ruling from contract");
    }
  }

  /**
   * Read the most recent anonymized precedents (public "case law").
   */
  async getPrecedents(n: number): Promise<Precedent[]> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress,
        functionName: "get_precedents",
        args: [n],
      });
      return normalize(result) as Precedent[];
    } catch (error: any) {
      console.error("Error fetching precedents:", error);
      throw new Error("Failed to fetch precedents from contract");
    }
  }

  /**
   * Read aggregate precedent counts (total + counts by ruling).
   */
  async getPrecedentStats(): Promise<PrecedentStats> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress,
        functionName: "precedent_stats",
        args: [],
      });
      return normalize(result) as PrecedentStats;
    } catch (error: any) {
      console.error("Error fetching precedent stats:", error);
      throw new Error("Failed to fetch precedent stats from contract");
    }
  }

  /**
   * Read the court configuration (rulings, tiers, arbiter names, limits).
   */
  async getConfig(): Promise<CourtConfig> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress,
        functionName: "get_config",
        args: [],
      });
      return normalize(result) as CourtConfig;
    } catch (error: any) {
      console.error("Error fetching config:", error);
      throw new Error("Failed to fetch config from contract");
    }
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  /**
   * Record a new agreement between the connected wallet (party A) and party B.
   */
  async createAgreement(
    agreementId: string,
    partyB: string,
    terms: string,
    feePreset?: FeePresetEstimate
  ): Promise<TransactionReceipt> {
    try {
      const fees = feePresetToTransactionFees(feePreset);
      const txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName: "create_agreement",
        args: [agreementId, partyB, terms],
        value: BigInt(0),
        ...(fees ? { fees } : {}),
      });

      const receipt = await this.client.waitForTransactionReceipt({
        hash: txHash,
        status: "ACCEPTED" as any,
        retries: 24,
        interval: 5000,
      });

      return receipt as TransactionReceipt;
    } catch (error) {
      console.error("Error creating agreement:", error);
      throw error;
    }
  }

  /**
   * File a dispute against an existing agreement, with evidence.
   *
   * `evidenceJson` is the JSON-string the contract expects: an array of
   * {kind:"text"|"url", label, content}. The contract re-validates it, commits
   * each item by sha256, and (for url items) fetches the page live at ruling
   * time. Pass "" for a dispute with no evidence.
   */
  async fileDispute(
    agreementId: string,
    statement: string,
    evidenceJson: string = "",
    feePreset?: FeePresetEstimate
  ): Promise<TransactionReceipt> {
    try {
      const fees = feePresetToTransactionFees(feePreset);
      const txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName: "file_dispute",
        args: [agreementId, statement, evidenceJson],
        value: BigInt(0),
        ...(fees ? { fees } : {}),
      });

      const receipt = await this.client.waitForTransactionReceipt({
        hash: txHash,
        status: "ACCEPTED" as any,
        retries: 24,
        interval: 5000,
      });

      return receipt as TransactionReceipt;
    } catch (error) {
      console.error("Error filing dispute:", error);
      throw error;
    }
  }

  /**
   * Ask the on-chain AI arbiter panel to rule on an open dispute (tier 1).
   *
   * This triggers an LLM panel inside the GenVM with validator consensus — and,
   * for any url evidence, a live web fetch the contract performs itself — so it
   * is the slow, expensive write. After the transaction is accepted we read the
   * stored verdict back with get_ruling (the authoritative on-chain result)
   * rather than parsing it out of the receipt.
   */
  async resolveDispute(
    agreementId: string,
    feePreset?: FeePresetEstimate
  ): Promise<Verdict> {
    return this.runPanelWrite("resolve_dispute", agreementId, feePreset);
  }

  /**
   * Escalate a ruled, non-final dispute to the next, larger independent panel
   * (3, then 5). Re-judged from scratch; the appellate ruling replaces the
   * prior one. Like resolve_dispute, this is an LLM-backed write.
   */
  async appeal(
    agreementId: string,
    feePreset?: FeePresetEstimate
  ): Promise<Verdict> {
    return this.runPanelWrite("appeal", agreementId, feePreset);
  }

  /** Shared body for the two LLM-backed panel writes (resolve/appeal). */
  private async runPanelWrite(
    functionName: "resolve_dispute" | "appeal",
    agreementId: string,
    feePreset?: FeePresetEstimate
  ): Promise<Verdict> {
    try {
      const fees = feePresetToTransactionFees(feePreset);
      const txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName,
        args: [agreementId],
        value: BigInt(0),
        ...(fees ? { fees } : {}),
      });

      await this.client.waitForTransactionReceipt({
        hash: txHash,
        status: "ACCEPTED" as any,
        retries: 36,
        interval: 5000,
      });

      // Read the persisted verdict back from on-chain storage.
      const ruling = await this.getRuling(agreementId);
      if (!ruling) {
        throw new Error("Ruling could not be read back after resolution");
      }
      return {
        ruling: (ruling.ruling || "INSUFFICIENT_EVIDENCE") as Verdict["ruling"],
        reasoning: ruling.reasoning,
        resolution: ruling.resolution,
        tier: ruling.tier,
        arbiters: ruling.arbiters,
        votes: ruling.votes ?? [],
      };
    } catch (error) {
      console.error(`Error running ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Accept the current ruling: it becomes final and is recorded as precedent.
   * A plain (non-LLM) write.
   */
  async acceptRuling(agreementId: string): Promise<TransactionReceipt> {
    try {
      const txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName: "accept_ruling",
        args: [agreementId],
        value: BigInt(0),
      });

      const receipt = await this.client.waitForTransactionReceipt({
        hash: txHash,
        status: "ACCEPTED" as any,
        retries: 24,
        interval: 5000,
      });

      return receipt as TransactionReceipt;
    } catch (error) {
      console.error("Error accepting ruling:", error);
      throw error;
    }
  }
}

export default JusticeUpgrade;
